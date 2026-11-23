import type { ClassValue } from "clsx";
import { clsx } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]): string {
  return twMerge(clsx(inputs));
}

/** Display a stored Indian number (91XXXXXXXXXX) as the 10 digits people type. */
export function shortPhone(value?: string | null): string {
  const raw = String(value ?? "").trim();
  const digits = raw.replace(/\D/g, "");
  return digits.length === 12 && digits.startsWith("91") ? digits.slice(2) : raw;
}
