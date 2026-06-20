// Pantry-match thresholds (§07 / US-008): the match % is colour-coded into three
// tiers. The TIER LOGIC is implemented here; the actual palette is deferred to the
// design pass — these are structural placeholders mapped to existing neutral tokens.

export type MatchTier = 'high' | 'mid' | 'low';

/** ≥80 → high · 50–79 → mid · <50 → low. null (no pantry data) sorts as 0 → low. */
export function matchTier(pct: number | null): MatchTier {
  const p = pct ?? 0;
  if (p >= 80) return 'high';
  if (p >= 50) return 'mid';
  return 'low';
}

// TODO(design): replace with the real palette. The spec intent is green / amber /
// grey; mapped here to existing tokens so only the colours need swapping later.
export const MATCH_TIER_TEXT_CLASS: Record<MatchTier, string> = {
  high: 'text-olive',
  mid: 'text-amber-600',
  low: 'text-muted',
};
