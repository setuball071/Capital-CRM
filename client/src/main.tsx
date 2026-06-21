import { createRoot } from "react-dom/client";
import App from "./App";
import "./index.css";

// build: migracao-railway-supabase (cache-bust do bundle p/ invalidar 500 antigo em cache)
createRoot(document.getElementById("root")!).render(<App />);
