import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import { initTg } from "./tg.ts";
import "./styles.css";

initTg();
createRoot(document.getElementById("root")!).render(<App />);
