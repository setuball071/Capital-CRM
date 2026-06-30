import { createRoot } from "react-dom/client";
import App from "./App";
import "./index.css";

(window as any).__BUILD = "railway-supabase-20260621";
createRoot(document.getElementById("root")!).render(<App />);
