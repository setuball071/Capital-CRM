// ─────────────────────────────────────────────────────────────────────────────
// Leitura do extrato de consignações (SIAPE) — FONTE ÚNICA.
// Carregado por ferramentas-portabilidade.html e por viabilidade-inter.html:
// corrigir o parser aqui conserta os dois. Define funções globais (script
// clássico, sem módulo) porque a ferramenta antiga já as chamava por esse nome.
// ─────────────────────────────────────────────────────────────────────────────

// Número em formato BR ("R$ 1.234,56") → 1234.56
function _parseBRnum(str) {
  if (str === null || str === undefined || str === '') return 0;
  if (typeof str === 'number') return str;
  const clean = String(str)
    .replace(/[R$%\s]/g, '')
    .replace(/\.(?=\d{3}(,|$))/g, '')
    .replace(',', '.');
  return parseFloat(clean) || 0;
}

// Reconstrói as linhas visuais do PDF agrupando itens pela coordenada de linha.
// Página retrato (rotate 0/180): linha = Y. Página paisagem (rotate 90/270): as
// coordenadas vêm trocadas — a linha visual é o X (extratos SIAPE são paisagem).
function _linhasPorY(items, rotate) {
  if (!items || !items.length) return [];
  const paisagem = rotate === 90 || rotate === 270;
  const lin = it => (paisagem ? it.x : it.y);   // eixo que define a linha
  const col = it => (paisagem ? it.y : it.x);   // eixo que ordena dentro da linha
  // rotate 90: linhas crescem com X; retrato: Y decresce de cima p/ baixo
  const ordemLinha = paisagem ? (a, b) => a - b : (a, b) => b - a;

  const grupos = [];
  for (const it of items) {
    const g = grupos.find(g => Math.abs(g.lin - lin(it)) <= 2);
    if (g) g.items.push(it); else grupos.push({ lin: lin(it), items: [it] });
  }
  grupos.sort((a, b) => ordemLinha(a.lin, b.lin));
  return grupos.map(g => g.items.sort((a, b) => col(a) - col(b)).map(i => i.str).join(' '));
}

// ── Margem + nome do extrato de consignações (SIAPE) ──────────────────────
// Fórmula: Bruta Facult. Global − Utilizada Facultativa − Utilizada Cartão
//          − Utilizada Cartão Benefício  →  margem do cliente (negativa = estourado)
function extrairMargemENome(texto, items, rotate) {
  // Preferir linhas reconstruídas pelas coordenadas; fallback no texto cru
  const linhas = (items && items.length) ? _linhasPorY(items, rotate || 0) : texto.split('\n');
  const money = l => (l.match(/R\$\s*-?[\d.,]+/g) || []).map(v => _parseBRnum(v));

  let nome = '';
  let brutaFacult = null, utilFacult = null, utilCartao = null, utilCartaoBenef = null;
  let liquidaComp = null; // Líquida Compulsória — limitadora de todas as margens
  let brutaCartao = null, brutaCartaoBenef = null; // margens próprias dos cartões (formato 35+5+5)

  for (let i = 0; i < linhas.length; i++) {
    const l = linhas[i];

    // Nome: linha do cabeçalho "... CPF MATRÍCULA NOME" (nome em maiúsculas no fim)
    if (!nome) {
      const m = /(\d{3}\.\d{3}\.\d{3}-\d{2})\s+\d+\s+([A-ZÀ-ÜÇ][A-ZÀ-ÜÇ'\s.]{4,})\s*$/.exec(l);
      if (m) nome = m[2].trim().replace(/\s{2,}/g, ' ');
    }

    // Bloco global: ordem fixa do extrato — Bruta Comp. · Líquida Comp. ·
    // Bruta Facult. Global · Líquida Facult. Global · Bruta Cartão · ...
    // Valores podem vir na mesma linha do cabeçalho ou nas 2 seguintes.
    if (brutaFacult === null && /Bruta\s+Facult/i.test(l)) {
      for (let j = i; j <= i + 2 && j < linhas.length; j++) {
        const vals = money(linhas[j]);
        if (vals.length >= 6) {
          liquidaComp = vals[1]; brutaFacult = vals[2];
          brutaCartao = vals[4] ?? null;
          brutaCartaoBenef = vals[6] ?? null;
          break;
        }
      }
    }

    // Bloco utilizadas: 3 valores na sequência Facultativa · Cartão · Cartão Benefício
    // (podem estar 1-3 linhas abaixo do rótulo, misturados com a nota de rodapé)
    if (utilFacult === null && /Utilizada\s+Facultativa/i.test(l)) {
      for (let j = i; j <= i + 3 && j < linhas.length; j++) {
        const vals = money(linhas[j]);
        if (vals.length >= 3) {
          utilFacult      = vals[vals.length - 3];
          utilCartao      = vals[vals.length - 2];
          utilCartaoBenef = vals[vals.length - 1];
          break;
        }
      }
    }
  }

  // Formato 45% dividido (35 empréstimo + 5 cartão + 5 benefício), vigente desde a
  // queda da MP da margem 40% (09/2026): cartão e benefício consomem as SUAS margens,
  // não a de empréstimo. Subtrair os dois da facultativa gerava falso negativo.
  const margem = (brutaFacult !== null && utilFacult !== null)
    ? brutaFacult - utilFacult
    : null;
  const margemCartao = (brutaCartao !== null && utilCartao !== null)
    ? brutaCartao - utilCartao : null;
  const margemCartaoBenef = (brutaCartaoBenef !== null && utilCartaoBenef !== null)
    ? brutaCartaoBenef - utilCartaoBenef : null;
  return { nome, brutaFacult, utilFacult, utilCartao, utilCartaoBenef, liquidaComp,
           brutaCartao, brutaCartaoBenef, margem, margemCartao, margemCartaoBenef };
}

function extrairContratos(texto, items) {
  // ── BANCO MAP ──────────────────────────────────────────────────────
  const BANCO_MAP = [
    ['BCO BRAS','Banco do Brasil'],['INBURSA','Inbursa'],
    ['BICBANC','BIC Banco'],['DIGIO','Digio'],['EAGLE','Eagle'],
    ['DAYBCO','Daycoval'],['DAYCOVAL','Daycoval'],
    ['SANTANDER','Santander'],['PAN','Pan'],['LECCA','Lecca'],
    ['INTER','Inter'],['BMG','BMG'],['SAFRA','Safra'],
    ['ITAU','Itaú'],['BRADESCO','Bradesco'],['CEF','Caixa'],
    ['CAIXA','Caixa'],['BANRISUL','Banrisul'],['C6','C6'],
    ['FACTA','Facta'],['MASTER','Master'],['MERCANTIL','Mercantil'],
    ['BRB','BRB'],['BANPARA','Banpará'],['VOTORANTIM','Votorantim'],
    ['ORIGINAL','Original'],['SOFISA','Sofisa'],['PINE','Pine'],
    ['NUBANK','Nubank'],['MERCADO PAGO','Mercado Pago'],['MERCADOPAGO','Mercado Pago'],
    ['CREFISA','Crefisa'],['OLE','Olé'],['BANESE','Banese'],['BANESTES','Banestes'],
    ['AMAZONIA','Banco da Amazônia'],['NORDESTE','Banco do Nordeste'],['CCB','CCB'],
    ['QUERO MAIS','Quero+'],['PARANA','Paraná Banco'],['AGIBANK','Agibank'],
    ['QI SCD','QI SCD'],['QI TECH','QI SCD'],['SICOOB','Sicoob'],
    ['CREDITAS','Creditas'],['PORTOCRED','Portocred'],['TORO','Toro'],
    ['PICPAY','PicPay'],['NEXT','Next'],['WILL','Will'],
    ['NEON','Neon'],['MIDWAY','Midway'],['AVISTA','Avista'],
    ['CRED11','Cred11'],['BARI','Bari'],['SENFF','Senff'],
  ];

  function detectarBanco(rub) {
    const up = rub.toUpperCase();
    for (const [key, nome] of BANCO_MAP) {
      if (up.includes(key)) return nome;
    }
    // Nome do banco costuma ser o último segmento após " - " da rubrica
    const partes = up.split(/\s+-\s+/);
    return partes[partes.length - 1].trim().replace(/\b\w/g, c => c.toUpperCase());
  }

  // ── PRIMÁRIO: reconstrói as linhas por coordenada Y (mesma altura = mesma
  // linha) e ordena por X. Robusto à ordem embaralhada que o pdf.js entrega.
  // O parser antigo (máquina de estados) fica como fallback abaixo.
  function parseRowLinha(line) {
    const mRub = /\d{5}\s*-\s*(.+?)(?=\s+\d+\s+\d+\s+\d{2}\/\d{2}\/\d{4}|\s+\d{1,3}\/\d{1,4}\s+R\$)/.exec(line);
    if (!mRub) return null;
    const rubrica = mRub[1].trim();
    if (!/EMPREST/i.test(rubrica)) return null;                 // só empréstimos consignados
    if (/CARTAO|MENSALIDADE|SINDICAL/i.test(rubrica)) return null; // ignora cartão/sindicato
    const mParc = /(\d{1,3})\/(\d{1,4})(?=\s+R\$)/.exec(line)  // N/N antes do R$ (pdf.js)
              || /R\$\s*[\d.,]+\s+(\d{1,3})\/(\d{1,4})/.exec(line); // N/N após R$ (fallback)
    const mVal  = /R\$\s*([\d.,]+)/.exec(line);
    const mCon  = /^(\S+)\s+\d{5}\s*-/.exec(line);
    const pa = mParc ? parseInt(mParc[1], 10) : 0;
    const pt = mParc ? parseInt(mParc[2], 10) : 0;
    const val = mVal ? parseFloat(mVal[1].replace(/\./g, '').replace(',', '.')) : 0;
    return {
      banco:           detectarBanco(rubrica),
      numero_contrato: mCon ? mCon[1] : '',
      parcela:         Math.round(val * 100) / 100,
      prazo:           (pt && pa) ? (pt - pa) : (pt || 0),
      prazo_total:     pt || 0,
    };
  }

  if (items && items.length) {
    const rows = {};
    for (const it of items) {
      if (!it || !it.str) continue;
      const key = Math.round(it.y / 2); // agrupa por altura (tolerância de 2px)
      (rows[key] = rows[key] || []).push(it);
    }
    const out = [];
    for (const k of Object.keys(rows)) {
      const line = rows[k].slice().sort((a, b) => a.x - b.x).map((i) => i.str).join(' ');
      const c = parseRowLinha(line);
      if (c) out.push(c);
    }
    if (out.length) return out;
  }

  // ── STATE MACHINE: lê campos um por linha (formato PDF.js) ─────────
  const RE_RUBRICA  = /^\d{5}\s*-\s*(.+)$/;
  const RE_VALOR    = /^R\$\s*([\d.,]+)$/;
  const RE_PARCELA  = /^(\d+)\/(\d+)$/;
  const RE_DATA     = /^\d{2}\/\d{2}\/\d{4}/;
  const RE_MMYYYY   = /^\d{2}\/\d{4}$/;
  // Separadores (- / . espaco) sao aceitos apenas ENTRE grupos alfanumericos: a Caixa
  // emite numero com espaco no meio ("1011 12492351"). Assim nao confunde com a linha
  // da rubrica ("34113 - EMPREST BCO OFICIAL - CEF"), que tem " - " com espaco duplo.
  // Exige ao menos um digito: sem isso, palavras do cabecalho ("Fim") entravam como
  // contrato e desincronizavam a maquina de estados, comendo o registro seguinte.
  const RE_CONTRATO = /^(?=.*\d)[A-Za-z0-9]+(?:[-/. ][A-Za-z0-9]+)*$/;
  const RE_SKIP     = /CARTAO CREDITO|CARTAO BENEFICIO|AMORT CARTAO/i;

  const S = {IDLE:0,RUB:1,SEQ:2,PRIOR:3,DATA:4,VALOR:5,PARCELA:6,INICIO:7,FIM:8};
  let state = S.IDLE, cur = {};
  const results = [];

  const linhas = texto.split('\n');
  for (let raw of linhas) {
    const line = raw.trim();
    if (!line) continue;

    if (state === S.IDLE) {
      // Mínimo 3 chars: contratos da CEF chegam com 4-5 dígitos (ex: 2430, 63476) e o
      // filtro de 6 os descartava. 3 ainda barra os fragmentos de sequência (1 char)
      // e prioridade (2 chars); um falso positivo morre no estado seguinte (exige rubrica).
      if (RE_CONTRATO.test(line) && !RE_MMYYYY.test(line) && !RE_DATA.test(line) && line.length >= 3) {
        cur = { contrato: line }; state = S.RUB;
      }
    } else if (state === S.RUB) {
      const m = RE_RUBRICA.exec(line);
      if (m) { cur.rubrica = m[1].trim(); state = S.SEQ; } else state = S.IDLE;
    } else if (state === S.SEQ) {
      if (/^\d+$/.test(line)) { cur.seq = parseInt(line); state = S.PRIOR; } else state = S.IDLE;
    } else if (state === S.PRIOR) {
      if (/^\d+$/.test(line)) { cur.prior = parseInt(line); state = S.DATA; } else state = S.IDLE;
    } else if (state === S.DATA) {
      if (RE_DATA.test(line)) { cur.data = line; state = S.VALOR; } else state = S.IDLE;
    } else if (state === S.VALOR) {
      const m = RE_VALOR.exec(line);
      if (m) { cur.valor = parseFloat(m[1].replace(/\./g,'').replace(',','.')); state = S.PARCELA; } else state = S.IDLE;
    } else if (state === S.PARCELA) {
      const m = RE_PARCELA.exec(line);
      if (m) { cur.parcAtual = parseInt(m[1]); cur.parcTotal = parseInt(m[2]); state = S.INICIO; } else state = S.IDLE;
    } else if (state === S.INICIO) {
      if (RE_MMYYYY.test(line)) { cur.inicio = line; state = S.FIM; } else state = S.IDLE;
    } else if (state === S.FIM) {
      if (RE_MMYYYY.test(line)) {
        if ((cur.prior || 10) < 12 && !RE_SKIP.test(cur.rubrica || '')) {
          results.push({
            banco:           detectarBanco(cur.rubrica || ''),
            numero_contrato: cur.contrato || '',
            parcela:         Math.round(cur.valor * 100) / 100,
            prazo:           cur.parcTotal - cur.parcAtual,
            prazo_total:     cur.parcTotal || 0,
          });
        }
      }
      state = S.IDLE; cur = {};
    }
  }

  // ── FALLBACK: texto concatenado (outros formatos de extrato) ───────
  if (results.length === 0) {
    const RE_LINHA = /([A-Za-z0-9\-/.]+)\s+\d{5}\s*-\s*(.+?)\s+\d+\s+\d+\s+\d{2}\/\d{2}\/\d{4}\s+[\d:]+\s+(\d+)\/(\d+)\s+R\$\s*([\d.,]+)\s+\d{2}\/\d{4}\s+\d{2}\/\d{4}/g;
    let m;
    while ((m = RE_LINHA.exec(texto)) !== null) {
      const rub = m[2].trim();
      if (RE_SKIP.test(rub)) continue;
      const numContr = (m[0].match(/^[\d\-\/]+/) || [''])[0];
      results.push({
        banco:           detectarBanco(rub),
        numero_contrato: m[1].trim(),
        parcela:         parseFloat(m[5].replace(/\./g,'').replace(',','.')),
        prazo:           parseInt(m[4]) - parseInt(m[3]),
        prazo_total:     parseInt(m[4]),
      });
    }
  }

  return results;
}
