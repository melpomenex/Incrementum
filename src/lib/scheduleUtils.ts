/**
 * Schedule View Utilities
 *
 * Shared helpers for date parsing and formatting in schedule components.
 */

export function parseScheduleDate(dateStr: string): Date | null {
  if (!dateStr) return null;
  try {
    // Bare date like "2026-05-04" — parse as local midnight
    if (/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) {
      const [y, m, d] = dateStr.split("-").map(Number);
      return new Date(y, m - 1, d);
    }
    // Full ISO/RFC3339 — parse and zero to midnight local
    const parsed = new Date(dateStr);
    if (isNaN(parsed.getTime())) return null;
    return new Date(parsed.getFullYear(), parsed.getMonth(), parsed.getDate());
  } catch {
    return null;
  }
}

/**
 * Extract just the date portion (YYYY-MM-DD) from a date string.
 * Works with both bare dates and RFC3339 timestamps.
 */
export function toDateString(dateStr: string): string {
  const d = parseScheduleDate(dateStr);
  if (!d) return dateStr;
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}
