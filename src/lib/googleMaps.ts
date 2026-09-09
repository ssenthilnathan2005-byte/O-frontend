const MAPS_KEY = (import.meta.env.VITE_GOOGLE_MAPS_API_KEY as string) || "";

let loadPromise: Promise<void> | null = null;

export function loadGoogleMaps(): Promise<void> {
  // Already loaded
  if ((window as any).google?.maps) return Promise.resolve();

  // Return existing promise if already loading
  if (loadPromise) return loadPromise;

  loadPromise = new Promise((resolve, reject) => {
    if (!MAPS_KEY) {
      reject(new Error("NO_KEY"));
      return;
    }

    // Script already in DOM (e.g. added by another module)
    const existing = document.getElementById("google-maps-script");
    if (existing) {
      // If google.maps already populated, resolve immediately
      if ((window as any).google?.maps) { resolve(); return; }
      // Otherwise wait for it to finish loading
      existing.addEventListener("load", () => resolve(), { once: true });
      existing.addEventListener("error", () => reject(new Error("LOAD_FAILED")), { once: true });
      return;
    }

    const s = document.createElement("script");
    s.id = "google-maps-script";
    s.src = `https://maps.googleapis.com/maps/api/js?key=${MAPS_KEY}`;
    s.async = true;
    s.onload = () => resolve();
    s.onerror = () => reject(new Error("LOAD_FAILED"));
    document.head.appendChild(s);
  });

  return loadPromise;
}
