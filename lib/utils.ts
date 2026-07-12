import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

/**
 * Normalizes a device timestamp string to a proper ISO format.
 * ZK devices return timestamps like "2026-04-21 21:10:15".
 * We convert them to "2026-04-21T21:10:15" (no timezone info).
 * This allows the browser/database to interpret it as Local Time,
 * which matches the device's actual configuration.
 */
export function normalizeDeviceTimestamp(value: unknown): string | undefined {
  if (!value) return undefined;
  const raw = String(value).trim();
  if (!raw) return undefined;

  // Convert "2026-04-21 21:10:15" to "2026-04-21T21:10:15"
  // Also strip any timezone suffix (Z, +00, etc.) to force local time interpretation
  const iso = raw.replace(' ', 'T');
  
  // Regex to extract just the YYYY-MM-DDTHH:mm:ss part
  const match = iso.match(/^(\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2})/);
  if (match) {
    return match[1];
  }

  return iso;
}
