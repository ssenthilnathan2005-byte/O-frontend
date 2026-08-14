import { useState, useCallback } from "react";
import type { Hospital } from "../types";

export interface HospitalWithDistance extends Hospital {
  distanceKm: number | null;
}

type State =
  | { status: "idle" }
  | { status: "loading" }
  | { status: "denied" }
  | { status: "unsupported" }
  | { status: "done"; lat: number; lng: number };

function parseCoords(str?: string): { lat: number; lng: number } | null {
  if (!str) return null;
  const m = str.match(/(-?\d+\.?\d*)\s*,\s*(-?\d+\.?\d*)/);
  if (!m) return null;
  const lat = parseFloat(m[1]);
  const lng = parseFloat(m[2]);
  if (isNaN(lat) || isNaN(lng)) return null;
  if (lat < -90 || lat > 90 || lng < -180 || lng > 180) return null;
  return { lat, lng };
}

function haversineKm(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 6371;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLng = ((lng2 - lng1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) *
    Math.cos((lat2 * Math.PI) / 180) *
    Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

export function useNearMe(hospitals: Hospital[]) {
  const [state, setState] = useState<State>({ status: "idle" });

  const locate = useCallback(() => {
    if (!navigator.geolocation) { setState({ status: "unsupported" }); return; }
    setState({ status: "loading" });
    navigator.geolocation.getCurrentPosition(
      (pos) => setState({ status: "done", lat: pos.coords.latitude, lng: pos.coords.longitude }),
      () => setState({ status: "denied" }),
      { timeout: 10000, maximumAge: 60000 }
    );
  }, []);

  const clear = useCallback(() => setState({ status: "idle" }), []);

  const sorted: HospitalWithDistance[] | null =
    state.status === "done"
      ? [...hospitals]
          .map((h) => {
            const coords = parseCoords(h.address) || parseCoords(h.area);
            const distanceKm = coords ? haversineKm(state.lat, state.lng, coords.lat, coords.lng) : null;
            return { ...h, distanceKm };
          })
          .filter((h) => h.distanceKm === null || h.distanceKm <= 20)
          .sort((a, b) => {
            if (a.distanceKm === null && b.distanceKm === null) return 0;
            if (a.distanceKm === null) return 1;
            if (b.distanceKm === null) return -1;
            return a.distanceKm - b.distanceKm;
          })
      : null;

  return { state, locate, clear, sorted };
}