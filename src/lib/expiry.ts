/**
 * Expiry helpers. Red Zone / color tones are computed client-side from
 * expires_at because the pantry_items.is_red_zone column can't be a generated
 * column (CURRENT_DATE isn't immutable) and isn't live-maintained yet.
 */

export type ExpiryTone = 'red' | 'amber' | 'grey';

function startOfTodayUTC(): number {
  const now = new Date();
  return Date.UTC(now.getFullYear(), now.getMonth(), now.getDate());
}

/** Whole days from today until the given ISO date (negative = already past). */
export function daysUntil(isoDate: string | null): number | null {
  if (!isoDate) return null;
  const d = new Date(isoDate);
  if (Number.isNaN(d.getTime())) return null;
  const target = Date.UTC(d.getFullYear(), d.getMonth(), d.getDate());
  return Math.round((target - startOfTodayUTC()) / 86_400_000);
}

/** Red Zone = expires within 2 days (architecture: expires_at <= today + 2). */
export function isRedZone(isoDate: string | null): boolean {
  const days = daysUntil(isoDate);
  return days !== null && days <= 2;
}

/** red <= 2d, amber <= 5d, grey otherwise / no date. */
export function expiryTone(isoDate: string | null): ExpiryTone {
  const days = daysUntil(isoDate);
  if (days === null) return 'grey';
  if (days <= 2) return 'red';
  if (days <= 5) return 'amber';
  return 'grey';
}

/** Short human label for an expiry chip. */
export function expiryLabel(isoDate: string | null): string {
  const days = daysUntil(isoDate);
  if (days === null) return 'No date';
  if (days < 0) return 'Expired';
  if (days === 0) return 'Today';
  if (days === 1) return '1 day';
  return `${days} days`;
}

/** Today's date as ISO (YYYY-MM-DD), for new pantry rows. */
export function todayISO(): string {
  return new Date().toISOString().slice(0, 10);
}

/** today + n days as ISO (YYYY-MM-DD). */
export function addDaysISO(days: number): string {
  const d = new Date();
  d.setDate(d.getDate() + days);
  return d.toISOString().slice(0, 10);
}
