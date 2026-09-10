import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import App from "./App";
import { AiWindow } from "./AiWorkspace";

const root = document.getElementById("root");
if (!root) throw new Error("Application root is missing.");
createRoot(root).render(
  <StrictMode>
    {new URLSearchParams(window.location.search).get("view") === "ai" ? (
      <AiWindow />
    ) : (
      <App />
    )}
  </StrictMode>,
);
