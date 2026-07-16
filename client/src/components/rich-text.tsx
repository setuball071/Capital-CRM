import React from "react";

// Renderizador mínimo de Markdown — só o que a Central de Atualizações usa:
// **negrito**, listas com "-"/"*"/"1." e parágrafos. Não instala dependência e
// NÃO usa dangerouslySetInnerHTML (o texto vem da IA/do master; renderizar HTML
// cru abriria porta pra injeção). Tudo vira nó React, então é seguro por
// construção — qualquer tag no texto é exibida como texto, não executada.

function renderNegrito(texto: string, keyBase: string): React.ReactNode[] {
  // Divide em **negrito** preservando o resto
  const partes = texto.split(/(\*\*[^*]+\*\*)/g);
  return partes.filter(Boolean).map((p, i) =>
    p.startsWith("**") && p.endsWith("**") && p.length > 4 ? (
      <strong key={`${keyBase}-b${i}`} className="font-semibold text-foreground">
        {p.slice(2, -2)}
      </strong>
    ) : (
      <React.Fragment key={`${keyBase}-t${i}`}>{p}</React.Fragment>
    ),
  );
}

export function RichText({ children, className = "" }: { children?: string | null; className?: string }) {
  const texto = (children || "").trim();
  if (!texto) return null;

  const linhas = texto.split(/\r?\n/);
  const blocos: React.ReactNode[] = [];
  let itensLista: { texto: string; ordenada: boolean }[] = [];

  const fecharLista = () => {
    if (itensLista.length === 0) return;
    const ordenada = itensLista[0].ordenada;
    const Tag = ordenada ? "ol" : "ul";
    blocos.push(
      <Tag
        key={`lista-${blocos.length}`}
        className={`${ordenada ? "list-decimal" : "list-disc"} pl-5 space-y-1.5 my-2`}
      >
        {itensLista.map((it, i) => (
          <li key={i} className="leading-relaxed">
            {renderNegrito(it.texto, `li-${blocos.length}-${i}`)}
          </li>
        ))}
      </Tag>,
    );
    itensLista = [];
  };

  linhas.forEach((linhaRaw, idx) => {
    const linha = linhaRaw.trim();
    if (!linha) {
      fecharLista();
      return;
    }
    const mNum = linha.match(/^(\d+)[.)]\s+(.*)$/);
    const mBullet = linha.match(/^[-*•]\s+(.*)$/);
    if (mNum) {
      itensLista.push({ texto: mNum[2], ordenada: true });
    } else if (mBullet) {
      itensLista.push({ texto: mBullet[1], ordenada: false });
    } else {
      fecharLista();
      blocos.push(
        <p key={`p-${idx}`} className="leading-relaxed my-1.5">
          {renderNegrito(linha, `p-${idx}`)}
        </p>,
      );
    }
  });
  fecharLista();

  return <div className={className}>{blocos}</div>;
}
