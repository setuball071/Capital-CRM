export default function CalculadoraContracheque() {
  return (
    <div className="flex flex-col h-full w-full" style={{ height: "calc(100vh - 60px)" }}>
      <iframe
        src="/simulador-contracheque.html"
        title="Cálculo de Contracheque"
        className="w-full flex-1 border-0"
        style={{ height: "100%" }}
        allow="same-origin"
      />
    </div>
  );
}
