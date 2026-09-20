// Accepts "9.5104, 77.6294" or a Google Maps link containing coordinates.
// Returns normalized "lat, lng", "" for empty, or false when invalid.
export function normalizeLabLocation(input: string): string | false {
  const t = input.trim();
  if (!t) return "";
  const m =
    t.match(/^(-?\d+(?:\.\d+)?)\s*,\s*(-?\d+(?:\.\d+)?)$/) ||
    t.match(/@(-?\d+(?:\.\d+)?),(-?\d+(?:\.\d+)?)/) ||
    t.match(/[?&](?:q|ll|query|destination)=(-?\d+(?:\.\d+)?)(?:,|%2C)\s*(-?\d+(?:\.\d+)?)/i) ||
    t.match(/!3d(-?\d+(?:\.\d+)?)!4d(-?\d+(?:\.\d+)?)/);
  if (!m) return false;
  const lat = parseFloat(m[1]);
  const lng = parseFloat(m[2]);
  if (lat < -90 || lat > 90 || lng < -180 || lng > 180) return false;
  return `${lat}, ${lng}`;
}

export function locOrThrow(input: string): string {
  const v = normalizeLabLocation(input);
  if (v === false) {
    throw new Error("Map location must be GPS coordinates like 9.5104, 77.6294 (or a Google Maps link that contains them)");
  }
  return v;
}
