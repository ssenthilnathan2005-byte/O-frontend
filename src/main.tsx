const _si = window.setInterval.bind(window);
(window as any).setInterval = (fn: any, ms?: number, ...a: any[]) =>
  _si(typeof fn === "function" ? (...x: any[]) => { if (!document.hidden) fn(...x); } : fn, ms, ...a);
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import ReactDOM from "react-dom/client";
import App from "./App";
import "./index.css";
import { initTranslate } from "./lib/translate";
import { initNavHeight } from "./lib/navHeight";
import { registerOfflineSW } from "./lib/offlineSW";

// Clear stale storage on version upgrade
const APP_VERSION = "1.2.0";
const storedVersion = localStorage.getItem("app_version");
if (storedVersion !== APP_VERSION) {
  localStorage.clear();
  sessionStorage.clear();
  localStorage.setItem("app_version", APP_VERSION);
}


BigInt.prototype.toJSON = function () {
  return this.toString();
};

declare global {
  interface BigInt {
    toJSON(): string;
  }
}

initTranslate();
initNavHeight();
registerOfflineSW();

const queryClient = new QueryClient();

ReactDOM.createRoot(document.getElementById("root")!).render(
  <QueryClientProvider client={queryClient}>
    <App />
  </QueryClientProvider>,
);

window.addEventListener("vite:preloadError", () => {
  if (!sessionStorage.getItem("chunk-reloaded")) {
    sessionStorage.setItem("chunk-reloaded", "1");
    window.location.reload();
  }
});
