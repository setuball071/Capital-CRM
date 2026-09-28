// Avisos legais dos simuladores e documentos.
//
// Ficam AQUI, num lugar so, porque antes o rodape estava escrito por extenso em
// tres pontos diferentes do codigo e as versoes ja divergiam entre si.
//
// VERSAO_AVISO: muda sempre que o texto mudar. E ela que fica gravada junto da
// confirmacao do corretor, para depois se saber exatamente o que ele leu.
export const VERSAO_AVISO = "2026-09-28";

/** Aviso ao lado do resultado de cada simulador. */
export const AVISO_SIMULADOR =
  "Aviso importante: esta simulação possui caráter informativo e utiliza os dados e " +
  "parâmetros cadastrados no sistema. Confira as condições e regras vigentes diretamente " +
  "com a instituição financeira antes de apresentar ou formalizar a proposta com o cliente.";

/** Aviso no rodape das propostas e PDFs gerados. */
export const AVISO_DOCUMENTO =
  "Simulação informativa, sujeita à análise e confirmação da instituição financeira. " +
  "Taxas, prazos, valores, margens e demais condições podem sofrer alterações até a " +
  "formalização. A empresa responsável pelo atendimento deverá conferir todas as " +
  "informações antes de apresentá-las ao cliente.";

/** Texto que o usuario confirma antes de gerar ou baixar uma proposta. */
export const TEXTO_CONFIRMACAO =
  "Declaro que conferi os dados e compreendo que os resultados apresentados são " +
  "estimativas sujeitas à validação da instituição financeira.";

/** Aviso do rodape do ambiente, ou o padrao quando ele nao configurou nada. */
export function avisoDocumento(theme: any): string {
  const proprio = theme?.avisoLegalDocumentos;
  return typeof proprio === "string" && proprio.trim() ? proprio.trim() : AVISO_DOCUMENTO;
}
