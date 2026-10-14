/**
 * server/bases-governo.ts
 *
 * BASES DE GOVERNO compradas por assinantes (ES = Leticia Santos, PR = Elisandra
 * Cassol, MA = a definir). Ficam em tabelas proprias (gov_*), FORA da base global
 * de clientes que todo ambiente enxerga.
 *
 * Trava de acesso: TODA rota daqui passa por `basesLiberadas()`. O master (isMaster)
 * ve todas; os demais so as bases do proprio ambiente em `tenant_bases`. A trava
 * fica no servidor -- esconder a tela nao basta, uma requisicao montada a mao tem
 * que ser recusada aqui.
 *
 * Nenhuma outra parte do sistema le gov_servidores / gov_contatos.
 */

import type { Express, Request, RequestHandler, Response } from "express";
import { sql, type SQL } from "drizzle-orm";
import { db } from "./storage";

const POR_PAGINA = 50;
const LIMITE_EXPORTACAO = 100_000;

const digitos = (v: unknown) => String(v ?? "").replace(/\D/g, "");

/** Bases que o usuario pode ver. Master: todas. Demais: as do ambiente. */
async function basesLiberadas(req: Request): Promise<string[]> {
  if (req.user?.isMaster) {
    const r = await db.execute(sql`SELECT codigo FROM gov_bases ORDER BY codigo`);
    return (r.rows as any[]).map((x) => x.codigo);
  }
  if (!req.tenantId) return [];
  const r = await db.execute(
    sql`SELECT base_codigo FROM tenant_bases WHERE tenant_id = ${req.tenantId} ORDER BY base_codigo`,
  );
  return (r.rows as any[]).map((x) => x.base_codigo);
}

/** Confere a base pedida na URL. Responde 403 e devolve null se nao for liberada. */
async function baseDaRota(req: Request, res: Response): Promise<string | null> {
  const codigo = String(req.params.base || "").toUpperCase();
  if (!(await basesLiberadas(req)).includes(codigo)) {
    res.status(403).json({ message: "Base não liberada para este ambiente" });
    return null;
  }
  return codigo;
}

/** Filtros da tela -> condicoes SQL sobre gov_servidores (alias s). */
function condicoes(base: string, q: Record<string, any>): SQL[] {
  const c: SQL[] = [sql`s.base_codigo = ${base}`];
  const busca = String(q.q || "").trim();
  const nums = digitos(busca);
  if (busca) {
    if (nums.length === 11 && nums === busca.replace(/[.\-\s]/g, "")) {
      c.push(sql`(s.cpf = ${nums} OR s.cpf IN (SELECT cpf FROM gov_contatos WHERE base_codigo = ${base} AND tipo = 'telefone' AND valor = ${nums}))`);
    } else if (nums.length >= 10 && nums.length === busca.replace(/[()\-\s]/g, "").length) {
      c.push(sql`s.cpf IN (SELECT cpf FROM gov_contatos WHERE base_codigo = ${base} AND tipo = 'telefone' AND valor = ${nums})`);
    } else {
      c.push(sql`s.nome LIKE ${busca.toUpperCase() + "%"}`);
    }
  }
  if (q.situacao) c.push(sql`s.situacao = ${String(q.situacao)}`);
  if (q.orgao) c.push(sql`s.orgao ILIKE ${"%" + String(q.orgao) + "%"}`);
  if (q.cargo) c.push(sql`s.cargo ILIKE ${"%" + String(q.cargo) + "%"}`);
  if (q.regime) c.push(sql`s.regime = ${String(q.regime)}`);
  if (q.cidade) c.push(sql`UPPER(s.cidade) = ${String(q.cidade).toUpperCase()}`);
  if (q.sexo) c.push(sql`s.sexo = ${String(q.sexo)}`);
  const idMin = parseInt(q.idade_min), idMax = parseInt(q.idade_max);
  if (!isNaN(idMin)) c.push(sql`s.data_nascimento <= (CURRENT_DATE - make_interval(years => ${idMin}))`);
  if (!isNaN(idMax)) c.push(sql`s.data_nascimento > (CURRENT_DATE - make_interval(years => ${idMax + 1}))`);
  const remMin = parseFloat(q.rem_min), remMax = parseFloat(q.rem_max);
  if (!isNaN(remMin)) c.push(sql`s.remuneracao >= ${remMin}`);
  if (!isNaN(remMax)) c.push(sql`s.remuneracao <= ${remMax}`);
  if (q.com_celular === "1") {
    c.push(sql`EXISTS (SELECT 1 FROM gov_contatos t WHERE t.base_codigo = s.base_codigo AND t.cpf = s.cpf AND t.tipo = 'telefone' AND t.celular)`);
  }
  return c;
}

async function contatosDe(base: string, cpf: string) {
  const r = await db.execute(sql`
    SELECT tipo, valor, fonte, celular, nao_perturbe, ordem
    FROM gov_contatos WHERE base_codigo = ${base} AND cpf = ${cpf}
    ORDER BY tipo DESC, ordem`);
  return r.rows;
}

async function vinculosDe(base: string, cpf: string) {
  const r = await db.execute(sql`
    SELECT s.*, date_part('year', age(s.data_nascimento))::int AS idade
    FROM gov_servidores s WHERE s.base_codigo = ${base} AND s.cpf = ${cpf}
    ORDER BY (s.situacao = 'ATIVO') DESC, s.admissao DESC NULLS LAST`);
  return r.rows;
}

const cacheFiltros = new Map<string, { em: number; dados: any }>();

export function registerBasesGovernoRoutes(
  app: Express,
  requireAuth: RequestHandler,
  requireModuleAccess: (module: string, accessType?: "view" | "edit") => RequestHandler,
  requireMaster: RequestHandler,
) {
  const acesso = [requireAuth, requireModuleAccess("modulo_base_clientes")];

  // Bases que este usuario enxerga (vazio = menu "Consulta Governo" some)
  app.get("/api/bases-governo/minhas", requireAuth, async (req, res) => {
    try {
      const codigos = await basesLiberadas(req);
      if (codigos.length === 0) return res.json([]);
      const r = await db.execute(sql`
        SELECT codigo, nome, uf, total_servidores, atualizado_em FROM gov_bases
        WHERE codigo IN (${sql.join(codigos.map((c) => sql`${c}`), sql`, `)}) ORDER BY nome`);
      return res.json(r.rows);
    } catch (e) {
      console.error("[GOV] minhas:", e);
      return res.status(500).json({ message: "Erro ao carregar bases" });
    }
  });

  // Opcoes dos filtros (orgao, cargo, regime, situacao, cidade) -- cache de 10 min
  app.get("/api/bases-governo/:base/filtros", ...acesso, async (req, res) => {
    try {
      const base = await baseDaRota(req, res);
      if (!base) return;
      const c = cacheFiltros.get(base);
      if (c && Date.now() - c.em < 10 * 60_000) return res.json(c.dados);
      const top = async (col: string, limite: number) =>
        (await db.execute(sql`
          SELECT ${sql.raw(col)} AS valor, COUNT(*)::int AS qtd FROM gov_servidores
          WHERE base_codigo = ${base} AND ${sql.raw(col)} IS NOT NULL AND ${sql.raw(col)} <> ''
          GROUP BY 1 ORDER BY 2 DESC LIMIT ${limite}`)).rows;
      const dados = {
        situacoes: await top("situacao", 20),
        regimes: await top("regime", 30),
        orgaos: await top("orgao", 400),
        cargos: await top("cargo", 400),
        cidades: await top("cidade", 400),
      };
      cacheFiltros.set(base, { em: Date.now(), dados });
      return res.json(dados);
    } catch (e) {
      console.error("[GOV] filtros:", e);
      return res.status(500).json({ message: "Erro ao carregar filtros" });
    }
  });

  // Busca paginada
  app.get("/api/bases-governo/:base/busca", ...acesso, async (req, res) => {
    try {
      const base = await baseDaRota(req, res);
      if (!base) return;
      const pagina = Math.max(1, parseInt(String(req.query.pagina)) || 1);
      const onde = sql.join(condicoes(base, req.query as any), sql` AND `);
      const [total] = (await db.execute(sql`SELECT COUNT(*)::int AS n FROM gov_servidores s WHERE ${onde}`)).rows as any[];
      const linhas = await db.execute(sql`
        SELECT s.cpf, s.nome, s.orgao, s.cargo, s.situacao, s.regime, s.cidade, s.remuneracao,
               date_part('year', age(s.data_nascimento))::int AS idade,
               (SELECT valor FROM gov_contatos t WHERE t.base_codigo = s.base_codigo AND t.cpf = s.cpf
                  AND t.tipo = 'telefone' ORDER BY t.celular DESC, t.ordem LIMIT 1) AS telefone
        FROM gov_servidores s WHERE ${onde}
        ORDER BY s.nome LIMIT ${POR_PAGINA} OFFSET ${(pagina - 1) * POR_PAGINA}`);
      return res.json({ total: total?.n || 0, pagina, porPagina: POR_PAGINA, linhas: linhas.rows });
    } catch (e) {
      console.error("[GOV] busca:", e);
      return res.status(500).json({ message: "Erro na busca" });
    }
  });

  // Ficha do servidor
  app.get("/api/bases-governo/:base/servidor/:cpf", ...acesso, async (req, res) => {
    try {
      const base = await baseDaRota(req, res);
      if (!base) return;
      const cpf = digitos(req.params.cpf).padStart(11, "0");
      const vinculos = await vinculosDe(base, cpf);
      if (vinculos.length === 0) return res.status(404).json({ message: "Servidor não encontrado nesta base" });
      // SIAPE e global: dizer que a pessoa tambem e SIAPE nao vaza nada
      const [siape] = (await db.execute(sql`
        SELECT EXISTS (SELECT 1 FROM clientes_vinculo WHERE cpf = ${cpf} AND convenio = 'SIAPE') AS sim`)).rows as any[];
      return res.json({ base, cpf, vinculos, contatos: await contatosDe(base, cpf), tambemSiape: !!siape?.sim });
    } catch (e) {
      console.error("[GOV] ficha:", e);
      return res.status(500).json({ message: "Erro ao carregar ficha" });
    }
  });

  // Quadro "Tambem e servidor do governo" na Consulta Individual. So bases liberadas;
  // para quem nao tem nenhuma, devolve [] e o quadro nao aparece.
  app.get("/api/bases-governo/por-cpf/:cpf", ...acesso, async (req, res) => {
    try {
      const codigos = await basesLiberadas(req);
      const cpf = digitos(req.params.cpf).padStart(11, "0");
      if (codigos.length === 0 || cpf.length !== 11) return res.json([]);
      const achadas = (await db.execute(sql`
        SELECT DISTINCT s.base_codigo, b.nome FROM gov_servidores s JOIN gov_bases b ON b.codigo = s.base_codigo
        WHERE s.cpf = ${cpf} AND s.base_codigo IN (${sql.join(codigos.map((c) => sql`${c}`), sql`, `)})`)).rows as any[];
      const out = [];
      for (const a of achadas) {
        out.push({ base: a.base_codigo, nomeBase: a.nome, vinculos: await vinculosDe(a.base_codigo, cpf), contatos: await contatosDe(a.base_codigo, cpf) });
      }
      return res.json(out);
    } catch (e) {
      console.error("[GOV] por-cpf:", e);
      return res.status(500).json({ message: "Erro ao consultar bases de governo" });
    }
  });

  // Exportacao da lista filtrada (CSV). So admin/coordenacao do ambiente e o master.
  app.get("/api/bases-governo/:base/exportar", ...acesso, async (req, res) => {
    try {
      if (!req.user?.isMaster && !["master", "coordenacao"].includes(String(req.user?.role))) {
        return res.status(403).json({ message: "Exportação liberada só para administrador e coordenação" });
      }
      const base = await baseDaRota(req, res);
      if (!base) return;
      const onde = sql.join(condicoes(base, req.query as any), sql` AND `);
      const r = await db.execute(sql`
        SELECT s.nome, s.cpf, date_part('year', age(s.data_nascimento))::int AS idade, s.orgao, s.cargo,
               s.situacao, s.regime, s.cidade, s.uf, s.remuneracao,
               (SELECT string_agg(valor, ' | ' ORDER BY celular DESC, ordem) FROM (
                  SELECT valor, celular, ordem FROM gov_contatos t WHERE t.base_codigo = s.base_codigo
                  AND t.cpf = s.cpf AND t.tipo = 'telefone' AND NOT t.nao_perturbe ORDER BY celular DESC, ordem LIMIT 3) x) AS telefones,
               (SELECT valor FROM gov_contatos t WHERE t.base_codigo = s.base_codigo AND t.cpf = s.cpf AND t.tipo = 'email' LIMIT 1) AS email
        FROM gov_servidores s WHERE ${onde} ORDER BY s.nome LIMIT ${LIMITE_EXPORTACAO}`);
      const esc = (v: unknown) => {
        const t = v == null ? "" : String(v);
        return /[;"\n]/.test(t) ? `"${t.replace(/"/g, '""')}"` : t;
      };
      const cab = ["NOME", "CPF", "IDADE", "ORGAO", "CARGO", "SITUACAO", "REGIME", "CIDADE", "UF", "REMUNERACAO", "TELEFONES", "EMAIL"];
      const corpo = (r.rows as any[]).map((l) =>
        [l.nome, l.cpf, l.idade, l.orgao, l.cargo, l.situacao, l.regime, l.cidade, l.uf, l.remuneracao, l.telefones, l.email].map(esc).join(";"));
      console.log(`[GOV] exportacao base=${base} user=${req.user?.id} tenant=${req.tenantId} linhas=${r.rows.length}`);
      res.setHeader("Content-Type", "text/csv; charset=utf-8");
      res.setHeader("Content-Disposition", `attachment; filename="${base}_${new Date().toISOString().slice(0, 10)}.csv"`);
      return res.send("﻿" + [cab.join(";"), ...corpo].join("\n"));
    } catch (e) {
      console.error("[GOV] exportar:", e);
      return res.status(500).json({ message: "Erro na exportação" });
    }
  });

  // ===== ADMIN (master): quais bases cada ambiente acessa =====
  app.get("/api/admin/tenants/:id/bases", requireAuth, requireMaster, async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      if (isNaN(id)) return res.status(400).json({ message: "ID inválido" });
      const r = await db.execute(sql`
        SELECT b.codigo, b.nome, b.total_servidores,
               EXISTS (SELECT 1 FROM tenant_bases tb WHERE tb.tenant_id = ${id} AND tb.base_codigo = b.codigo) AS liberada
        FROM gov_bases b ORDER BY b.nome`);
      return res.json(r.rows);
    } catch (e) {
      console.error("[GOV] admin bases:", e);
      return res.status(500).json({ message: "Erro ao carregar bases do ambiente" });
    }
  });

  app.put("/api/admin/tenants/:id/bases", requireAuth, requireMaster, async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const bases: unknown = req.body?.bases;
      if (isNaN(id) || !Array.isArray(bases)) return res.status(400).json({ message: "Parâmetros inválidos" });
      const validas = new Set(((await db.execute(sql`SELECT codigo FROM gov_bases`)).rows as any[]).map((x) => x.codigo));
      const escolhidas = bases.map(String).filter((c) => validas.has(c));
      await db.execute(sql`DELETE FROM tenant_bases WHERE tenant_id = ${id}`);
      for (const c of escolhidas) {
        await db.execute(sql`INSERT INTO tenant_bases (tenant_id, base_codigo) VALUES (${id}, ${c}) ON CONFLICT DO NOTHING`);
      }
      console.log(`[GOV] admin user=${req.user?.id} tenant=${id} bases=${escolhidas.join(",") || "(nenhuma)"}`);
      return res.json({ message: "Bases atualizadas", bases: escolhidas });
    } catch (e) {
      console.error("[GOV] admin salvar bases:", e);
      return res.status(500).json({ message: "Erro ao salvar bases" });
    }
  });
}
