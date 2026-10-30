const _si = window.setInterval.bind(window);
(window as any).setInterval = (fn: any, ms?: number, ...a: any[]) =>
  _si(typeof fn === "function" ? (...x: any[]) => { if (!document.hidden) fn(...x); } : fn, ms, ...a);
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import ReactDOM from "react-dom/client";
import App from "./App";
import "./index.css";
import { initTranslate } from "./lib/translate";
import { initNavHeight } from "./lib/navHeight";

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
