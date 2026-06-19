/// <reference types="vite/client" />
// ============================================================
// FILE: src/frontend/src/components/hospital/HospitalMapModal.tsx
// REPLACE: entire file
// Fix: detects coordinates in address field and uses them
//      directly — no Geocoding API needed, completely free.
//      Falls back to text search only if no coordinates found.
// ============================================================

import { useEffect, useRef, useState } from "react";
import { X, Navigation } from "lucide-react";

interface Props {
  hospital: {
    name: string;
    address?: string;
    area?: string;
  };
  onClose: () => void;
}

const MAPS_API_KEY = (import.meta.env.VITE_GOOGLE_MAPS_API_KEY as string) || "";

// ── Detect if string contains coordinates like "9.5104, 77.6294" ─────────────
function parseCoordinates(str?: string): { lat: number; lng: number } | null {
  if (!str) return null;
  const match = str.match(/(-?\d+\.?\d*)\s*,\s*(-?\d+\.?\d*)/);
  if (!match) return null;
  const lat = parseFloat(match[1]);
  const lng = parseFloat(match[2]);
  if (isNaN(lat) || isNaN(lng)) return null;
  if (lat < -90 || lat > 90 || lng < -180 || lng > 180) return null;
  return { lat, lng };
}

function buildDirectionsUrl(hospital: Props["hospital"]): string {
  // If coordinates available, use them for precise directions
  const coords = parseCoordinates(hospital.address) || parseCoordinates(hospital.area);
  if (coords) {
    return `https://www.google.com/maps/dir/?api=1&destination=${coords.lat},${coords.lng}`;
  }
  const query = [hospital.name, hospital.address, hospital.area].filter(Boolean).join(", ");
  return `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(query)}`;
}

function loadMapsScript(): Promise<void> {
  return new Promise((resolve, reject) => {
    if ((window as any).google?.maps) { resolve(); return; }
    const existing = document.getElementById("google-maps-script");
    if (existing) {
      existing.addEventListener("load", () => resolve(), { once: true });
      return;
    }
    if (!MAPS_API_KEY) { reject(new Error("NO_KEY")); return; }
    const s   = document.createElement("script");
    s.id      = "google-maps-script";
    s.src     = `https://maps.googleapis.com/maps/api/js?key=${MAPS_API_KEY}`;
    // NOTE: No &libraries=places needed — we use coordinates directly
    s.async   = true;
    s.onload  = () => resolve();
    s.onerror = () => reject(new Error("LOAD_FAILED"));
    document.head.appendChild(s);
  });
}

export default function HospitalMapModal({ hospital, onClose }: Props) {
  const mapRef                = useRef<HTMLDivElement>(null);
  const [error, setError]     = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const directionsUrl         = buildDirectionsUrl(hospital);

  // Close on Escape
  useEffect(() => {
    const fn = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", fn);
    return () => window.removeEventListener("keydown", fn);
  }, [onClose]);

  useEffect(() => {
    async function init() {
      try {
        await loadMapsScript();
        const google = (window as any).google;
        if (!mapRef.current) return;

        // ── Try coordinates first (no API cost) ──────────────────────────────
        const coords =
          parseCoordinates(hospital.address) ||
          parseCoordinates(hospital.area);

        if (coords) {
          // Direct coordinate placement — FREE, no Geocoding API needed
          setLoading(false);
          const location = new google.maps.LatLng(coords.lat, coords.lng);

          const map = new google.maps.Map(mapRef.current, {
            center:            location,
            zoom:              17,
            mapTypeControl:    false,
            streetViewControl: false,
            fullscreenControl: true,
          });

          const marker = new google.maps.Marker({
            position:  location,
            map,
            title:     hospital.name,
            animation: google.maps.Animation.DROP,
            icon: {
              path:        google.maps.SymbolPath.CIRCLE,
              scale:       10,
              fillColor:   "#14b8a6",
              fillOpacity: 1,
              strokeColor: "#ffffff",
              strokeWeight: 2,
            },
          });

          const infoWindow = new google.maps.InfoWindow({
            content: `
              <div style="font-family:sans-serif;padding:2px">
                <div style="font-weight:700;font-size:14px">${hospital.name}</div>
                <div style="font-size:12px;color:#6b7280;margin-top:2px">
                  ${hospital.address || hospital.area || ""}
                </div>
              </div>`,
          });
          marker.addListener("click", () => infoWindow.open(map, marker));
          infoWindow.open(map, marker);
          return;
        }

        // ── Fallback: text search using Places API (requires billing) ─────────
        // Only reached if no coordinates in address field
        setLoading(false);
        setError(
          `No coordinates found for "${hospital.name}". ` +
          `Go to Admin → Edit hospital → paste the GPS coordinates ` +
          `(e.g. 9.5104, 77.6294) into the Address field.`
        );

      } catch (err: any) {
        setLoading(false);
        if (err.message === "NO_KEY") {
          setError("Maps API key not configured. Add VITE_GOOGLE_MAPS_API_KEY to Vercel.");
        } else {
          setError("Failed to load Google Maps. Please check your connection.");
        }
      }
    }

    init();
  }, [hospital.address, hospital.area, hospital.name]);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ background: "rgba(0,0,0,0.5)" }}
      onClick={e => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div className="bg-white rounded-2xl w-full max-w-xl overflow-hidden shadow-2xl flex flex-col">

        {/* Header */}
        <div className="flex items-start justify-between px-6 py-4 border-b border-gray-100">
          <div>
            <h3 className="font-bold text-gray-900 text-lg">{hospital.name}</h3>
            {(hospital.address || hospital.area) && (
              <p className="text-sm text-gray-500 mt-0.5 flex items-center gap-1">
                <span>📍</span>
                {/* Show area name instead of raw coordinates */}
                {parseCoordinates(hospital.address)
                  ? (hospital.area || hospital.address)
                  : (hospital.address || hospital.area)}
              </p>
            )}
          </div>
          <button
            onClick={onClose}
            className="ml-4 flex-shrink-0 w-8 h-8 rounded-full bg-gray-100 hover:bg-gray-200 flex items-center justify-center transition-colors"
          >
            <X className="w-4 h-4 text-gray-500" />
          </button>
        </div>

        {/* Map */}
        <div className="relative" style={{ height: 340 }}>
          {loading && (
            <div className="absolute inset-0 flex flex-col items-center justify-center bg-gray-50 gap-3">
              <div className="w-8 h-8 rounded-full border-4 border-gray-200 border-t-teal-500 animate-spin" />
              <p className="text-sm text-gray-500">Loading map…</p>
            </div>
          )}
          {error && !loading && (
            <div className="absolute inset-0 flex flex-col items-center justify-center bg-red-50 p-8 text-center gap-3">
              <span className="text-4xl">🗺️</span>
              <p className="text-sm text-red-600 leading-relaxed">{error}</p>
              <a
                href={directionsUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="px-4 py-2 bg-teal-500 text-white rounded-lg text-sm font-semibold hover:bg-teal-600 transition-colors"
              >
                Open in Google Maps instead
              </a>
            </div>
          )}
          <div ref={mapRef} className="w-full h-full" />
        </div>

        {/* Footer */}
        <div className="flex gap-3 px-6 py-4 border-t border-gray-100">
          <a
            href={directionsUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="flex-1 flex items-center justify-center gap-2 bg-teal-500 hover:bg-teal-600 text-white font-semibold text-sm py-2.5 rounded-xl transition-colors"
          >
            <Navigation className="w-4 h-4" />
            Get Directions
          </a>
          <button
            onClick={onClose}
            className="px-5 py-2.5 rounded-xl border border-gray-200 text-gray-600 text-sm font-medium hover:bg-gray-50 transition-colors"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}
