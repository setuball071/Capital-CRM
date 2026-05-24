export default function SimuladorPortCompletoPage() {
  return (
    <div className="flex flex-col h-full w-full" style={{ height: "calc(100vh - 60px)" }}>
      <iframe
        src="/ferramentas-portabilidade.html#simulador"
        title="Simulador de Portabilidade"
        className="w-full flex-1 border-0"
        style={{ height: "100%" }}
        allow="same-origin"
      />
    </div>
  );
}
