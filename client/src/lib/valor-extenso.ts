const unidades = ["", "um", "dois", "três", "quatro", "cinco", "seis", "sete", "oito", "nove"];
const especiais = ["dez", "onze", "doze", "treze", "quatorze", "quinze", "dezesseis", "dezessete", "dezoito", "dezenove"];
const dezenas = ["", "", "vinte", "trinta", "quarenta", "cinquenta", "sessenta", "setenta", "oitenta", "noventa"];
const centenas = ["", "cento", "duzentos", "trezentos", "quatrocentos", "quinhentos", "seiscentos", "setecentos", "oitocentos", "novecentos"];

function grupoParaExtenso(n: number): string {
  if (n === 0) return "";
  if (n === 100) return "cem";

  const c = Math.floor(n / 100);
  const resto = n % 100;
  const d = Math.floor(resto / 10);
  const u = resto % 10;

  const partes: string[] = [];

  if (c > 0) partes.push(centenas[c]);

  if (resto >= 10 && resto <= 19) {
    partes.push(especiais[resto - 10]);
  } else {
    if (d > 0) partes.push(dezenas[d]);
    if (u > 0) partes.push(unidades[u]);
  }

  return partes.join(" e ");
}

export function valorPorExtenso(valor: number): string {
  if (valor === 0) return "zero reais";

  const inteiro = Math.floor(valor);
  const centavos = Math.round((valor - inteiro) * 100);

  const escalas = [
    { singular: "", plural: "" },
    { singular: "mil", plural: "mil" },
    { singular: "milhão", plural: "milhões" },
    { singular: "bilhão", plural: "bilhões" },
  ];

  const grupos: number[] = [];
  let tmp = inteiro;
  while (tmp > 0) {
    grupos.push(tmp % 1000);
    tmp = Math.floor(tmp / 1000);
  }

  const partesInteiro: string[] = [];
  for (let i = grupos.length - 1; i >= 0; i--) {
    if (grupos[i] === 0) continue;
    const texto = grupoParaExtenso(grupos[i]);
    const escala = escalas[i];
    if (i === 0) {
      partesInteiro.push(texto);
    } else {
      partesInteiro.push(`${texto} ${grupos[i] === 1 ? escala.singular : escala.plural}`);
    }
  }

  let resultado = "";

  if (partesInteiro.length > 0) {
    if (partesInteiro.length === 1) {
      resultado = partesInteiro[0];
    } else {
      const ultimo = partesInteiro.pop()!;
      resultado = partesInteiro.join(", ") + " e " + ultimo;
    }

    resultado += inteiro === 1 ? " real" : " reais";
  }

  if (centavos > 0) {
    const centavosTexto = grupoParaExtenso(centavos);
    if (resultado) {
      resultado += " e " + centavosTexto + (centavos === 1 ? " centavo" : " centavos");
    } else {
      resultado = centavosTexto + (centavos === 1 ? " centavo" : " centavos");
    }
  }

  return resultado.charAt(0).toUpperCase() + resultado.slice(1);
}
