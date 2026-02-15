import { createRoot } from "react-dom/client";
import App from "./App";
import "./index.css";

const BUILD_VERSION = "2026-02-15-v2";
console.log(`[QuantaFlow] Build: ${BUILD_VERSION}`);

createRoot(document.getElementById("root")!).render(<App />);
