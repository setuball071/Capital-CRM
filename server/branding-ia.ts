// Leitura de brandbook por IA — extrai a paleta (e a fonte) de um arquivo do
// manual da marca ou de uma lista de cores colada, e devolve os valores já
// distribuídos nos campos da tela de Branding.
//
// A IA só SUGERE: quem aplica é a tela, e o gestor revisa antes de salvar.
// Duas garantias que não são da IA e sim nossas, aplicadas depois dela:
//   1. todo valor tem que ser #RRGGBB — qualquer outra coisa é descartada;
//   2. pares fundo/texto ilegíveis são corrigidos e reportados em `avisos`.

import { ocrClient, ocrModel } from "./openaiClient";

// Campos de cor da tela de Branding que a IA pode preencher.
const CAMPOS_COR = [
  "primaryColor",
  "secondaryColor",
  "loginBgColor",
  "textColor",
  "borderColor",
  "fontColor",
  "successColor",
  "errorColor",
  "warningColor",
  "sidebarBgColor",
  "sidebarFontColor",
] as const;

export type CampoCor = (typeof CAMPOS_COR)[number];

export interface PaletaExtraida {
  cores: Partial<Record<CampoCor, string>>;
  fontFamily: string | null;
  encontradas: string[]; // todas as cores vistas no material, para conferência
  avisos: string[];
}

const HEX = /^#[0-9a-fA-F]{6}$/;

function normalizarHex(valor: unknown): string | null {
  if (typeof valor !== "string") return null;
  let v = valor.trim();
  if (!v.startsWith("#")) v = `#${v}`;
  // #abc -> #aabbcc
  if (/^#[0-9a-fA-F]{3}$/.test(v)) {
    v = `#${v[1]}${v[1]}${v[2]}${v[2]}${v[3]}${v[3]}`;
  }
  return HEX.test(v) ? v.toLowerCase() : null;
}

function luminancia(hex: string): number {
  const canal = (v: number) => {
    const c = v / 255;
    return c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
  };
  const r = canal(parseInt(hex.slice(1, 3), 16));
  const g = canal(parseInt(hex.slice(3, 5), 16));
  const b = canal(parseInt(hex.slice(5, 7), 16));
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

function contraste(a: string, b: string): number {
  const l1 = luminancia(a);
  const l2 = luminancia(b);
  return (Math.max(l1, l2) + 0.05) / (Math.min(l1, l2) + 0.05);
}

// Onde o texto tem que continuar legível. Se a IA escolher um par ruim, trocamos
// o TEXTO (nunca o fundo, que é a cor da marca) por preto ou branco.
const PARES_LEGIBILIDADE: Array<{ fundo: CampoCor; texto: CampoCor; rotulo: string }> = [
  { fundo: "sidebarBgColor", texto: "sidebarFontColor", rotulo: "menu lateral" },
];

const PROMPT = `Você analisa manuais de marca (brandbooks) e devolve a paleta pronta para configurar um sistema web.

Responda SOMENTE com JSON neste formato:
{
  "encontradas": ["#RRGGBB", ...],
  "fontFamily": "Nome da fonte" ou null,
  "cores": {
    "primaryColor": "#RRGGBB",
    "secondaryColor": "#RRGGBB",
    "loginBgColor": "#RRGGBB",
    "textColor": "#RRGGBB",
    "borderColor": "#RRGGBB",
    "fontColor": "#RRGGBB",
    "successColor": "#RRGGBB",
    "errorColor": "#RRGGBB",
    "warningColor": "#RRGGBB",
    "sidebarBgColor": "#RRGGBB",
    "sidebarFontColor": "#RRGGBB"
  }
}

Onde cada campo é usado no sistema:
- primaryColor: botões e destaques. É a cor principal da marca.
- secondaryColor: destaques secundários. Cor de apoio da marca.
- loginBgColor: fundo da tela de login. Precisa ser ESCURA, porque o logo e o texto em cima dela são brancos.
- textColor e fontColor: texto do sistema sobre fundo claro. Precisam ser bem escuras.
- borderColor: linhas divisórias. Cinza bem claro.
- successColor, errorColor, warningColor: verde, vermelho e laranja de aviso. O brandbook quase nunca traz essas três; quando não houver, use #22c55e, #ef4444 e #f59e0b.
- sidebarBgColor: fundo do menu lateral.
- sidebarFontColor: texto do menu lateral. TEM que contrastar com sidebarBgColor.

Regras:
- Use apenas cores que existam no material. Não invente cor de marca.
- Todo valor em #RRGGBB.
- "encontradas" traz todas as cores do material, na ordem de destaque.
- Se o material não citar a fonte, fontFamily é null.
- Se o material não tiver cor para algum campo, escolha entre as cores encontradas a que melhor sirva para aquele uso, respeitando as regras de claro/escuro acima.`;

export async function extrairPaleta(input: {
  imagensBase64?: string[]; // data URLs
  texto?: string;
}): Promise<PaletaExtraida> {
  const conteudo: any[] = [];
  if (input.texto?.trim()) {
    conteudo.push({
      type: "text",
      text: `Material da marca (texto):\n\n${input.texto.trim().slice(0, 8000)}`,
    });
  }
  for (const img of (input.imagensBase64 || []).slice(0, 4)) {
    conteudo.push({ type: "image_url", image_url: { url: img } });
  }
  if (conteudo.length === 0) {
    throw new Error("Envie o arquivo do brandbook ou cole as cores.");
  }

  const resposta = await ocrClient.chat.completions.create({
    model: ocrModel,
    temperature: 0,
    response_format: { type: "json_object" },
    messages: [
      { role: "system", content: PROMPT },
      { role: "user", content: conteudo as any },
    ],
  });

  let bruto: any = {};
  try {
    bruto = JSON.parse(resposta.choices[0]?.message?.content || "{}");
  } catch {
    throw new Error("A IA não devolveu um resultado legível. Tente de novo.");
  }

  const avisos: string[] = [];
  const cores: Partial<Record<CampoCor, string>> = {};
  for (const campo of CAMPOS_COR) {
    const hex = normalizarHex(bruto?.cores?.[campo]);
    if (hex) cores[campo] = hex;
  }
  if (Object.keys(cores).length === 0) {
    throw new Error("Não consegui achar nenhuma cor nesse material.");
  }

  // Legibilidade: a IA erra o par fundo/texto com frequência e o estrago só
  // aparece depois de salvar. Aqui o texto vira preto ou branco, o que contrastar mais.
  for (const par of PARES_LEGIBILIDADE) {
    const fundo = cores[par.fundo];
    const texto = cores[par.texto];
    if (!fundo || !texto) continue;
    if (contraste(fundo, texto) >= 4.5) continue;
    const novo = contraste(fundo, "#ffffff") > contraste(fundo, "#000000") ? "#ffffff" : "#1f2937";
    cores[par.texto] = novo;
    avisos.push(
      `O texto do ${par.rotulo} ficaria ilegível sobre o fundo escolhido. Troquei para ${novo}.`,
    );
  }

  // Fundo do login precisa ser escuro: o logo e as frases em cima dele são brancos.
  if (cores.loginBgColor && luminancia(cores.loginBgColor) > 0.35) {
    avisos.push(
      "A cor sugerida para o fundo do login é clara, e o texto dessa tela é branco. Confira antes de salvar.",
    );
  }

  const encontradas = Array.isArray(bruto?.encontradas)
    ? (bruto.encontradas.map(normalizarHex).filter(Boolean) as string[])
    : [];

  const fontFamily =
    typeof bruto?.fontFamily === "string" && bruto.fontFamily.trim()
      ? bruto.fontFamily.trim().slice(0, 60)
      : null;

  return { cores, fontFamily, encontradas, avisos };
}
