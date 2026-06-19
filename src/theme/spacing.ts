/**
 * Spacing & radius tokens.
 *
 * The spacing scale maps 1:1 onto Tailwind's default numeric scale (4px base),
 * so in `className` you use the standard utilities — there is no custom spacing
 * scale in CSS. Use this object only for inline styles / StyleSheet (the
 * exceptions listed in AGENTS.md).
 *
 *   xs (4)  → p-1   sm (8)  → p-2   md (16) → p-4   lg (24) → p-6   xl (32) → p-8
 */
export const spacing = {
  xs: 4,
  sm: 8,
  md: 16,
  lg: 24,
  xl: 32,
} as const;

/**
 * Corner radii. Mirrored as `--radius-card` / `--radius-control` in global.css,
 * which generate `rounded-card` and `rounded-control`. The pill radius is the
 * built-in `rounded-full`.
 */
export const radius = {
  card: 22,
  control: 14,
  pill: 999,
} as const;

export type SpacingToken = keyof typeof spacing;
export type RadiusToken = keyof typeof radius;
