export default function CriadorPropostaPage() {
  return (
    <div className="flex flex-col h-full w-full" style={{ height: "calc(100vh - 60px)" }}>
      <iframe
        src="/ferramentas-portabilidade.html#proposta"
        title="Criador de Proposta"
        className="w-full flex-1 border-0"
        style={{ height: "100%" }}
        allow="same-origin"
      />
    </div>
  );
}
