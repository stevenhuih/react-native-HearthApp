// Pantry-match thresholds (§07 / US-008): the match % is colour-coded into three
// tiers (design system: green / amber / red), using the dark-system semantic tokens.

export type MatchTier = 'high' | 'mid' | 'low';

/** ≥80 → high · 50–79 → mid · <50 → low. null (no pantry data) sorts as 0 → low. */
export function matchTier(pct: number | null): MatchTier {
  const p = pct ?? 0;
  if (p >= 80) return 'high';
  if (p >= 50) return 'mid';
  return 'low';
}

/** Text-colour utility per tier (design: green / amber / red). */
export const MATCH_TIER_TEXT_CLASS: Record<MatchTier, string> = {
  high: 'text-success',
  mid: 'text-warning',
  low: 'text-error',
};

/** Full match-chip class per tier (background + colour), for Recipe Detail/cards. */
export const MATCH_TIER_CHIP_CLASS: Record<MatchTier, string> = {
  high: 'match-chip match-good',
  mid: 'match-chip match-mid',
  low: 'match-chip match-low',
};
