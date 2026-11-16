export function registerOfflineSW() {
  if (!("serviceWorker" in navigator)) return;
  window.addEventListener("load", () => {
    navigator.serviceWorker
      .register("/sw-offline.js")
      .catch((e) => console.warn("[SW] registration failed", e));
  });
}
