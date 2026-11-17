import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import App from "./App";
import "./i18n";
import "./index.css";
import { reloadForNewVersion } from "./lib/staleVersion";

// Old version still open after an update: load the new one instead of failing.
window.addEventListener("vite:preloadError", (e) => {
  if (reloadForNewVersion()) e.preventDefault();
});

// A new version took over in the background: switch to it, but never while
// a request is being filled in (unsaved input would be lost).
if ("serviceWorker" in navigator) {
  const hadController = !!navigator.serviceWorker.controller;
  navigator.serviceWorker.addEventListener("controllerchange", () => {
    if (!hadController) return;
    if (/\/(new|edit)(\?|$)/.test(window.location.hash)) return;
    window.location.reload();
  });
}

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
