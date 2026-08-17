export function normalizeBookingStatus(raw?: string | null): string {
  const value = (raw ?? "").trim().toLowerCase();
  const map: Record<string, string> = {
    booked: "confirmed",
    paid: "confirmed",
    waiting: "confirmed",
    in_queue: "confirmed",
    inqueue: "confirmed",
    queued: "confirmed",
    ongoing: "confirmed",
    live: "confirmed",
    checked_in: "confirmed",
    expired: "unvisited",
    missed: "unvisited",
    skipped: "unvisited",
    not_seen: "unvisited",
    "not-seen": "unvisited",
  };

  const normalized = map[value] ?? value;
  return normalized || "confirmed";
}

export function isLiveBookingStatus(raw?: string | null): boolean {
  const status = normalizeBookingStatus(raw);
  return ["confirmed", "waiting", "booked", "paid", "ongoing", "live", "checked_in"].includes(status);
}

export function isCompletedStatus(raw?: string | null): boolean {
  const status = normalizeBookingStatus(raw);
  return ["completed", "unvisited", "cancelled"].includes(status);
}

export function isTodayKey(date?: string | null): boolean {
  const value = (date ?? "").slice(0, 10);
  if (!value) return false;

  const now = new Date();
  const localDate = new Date(now.getTime() - now.getTimezoneOffset() * 60000);
  return value === localDate.toISOString().slice(0, 10);
}

export function getBookingPatientName(value?: string | null, fallback = "Patient"): string {
  const name = (value ?? "").trim();
  return name || fallback;
}

export function getBookingPhone(value?: string | null, fallback = "Phone not provided"): string {
  const phone = (value ?? "").trim();
  return phone || fallback;
}
