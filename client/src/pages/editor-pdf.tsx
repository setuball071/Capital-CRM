export default function EditorPdfPage() {
  return (
    <div style={{ width: "100%", height: "100%", overflow: "hidden" }}>
      <iframe
        src="/editor-pdf.html"
        title="Editor PDF"
        style={{
          width: "100%",
          height: "100%",
          border: "none",
          display: "block",
        }}
        allow="clipboard-read; clipboard-write"
      />
    </div>
  );
}
