/**
 * Type scale — mirrors the `.type-*` utility classes in `src/global.css`.
 * DARK design system v2: Inter throughout, heavy + tightly tracked for titles.
 *
 * Prefer the `className` utilities (`type-h1`, `type-body`, …) in components.
 * This object exists for the rare cases that must style text via inline/StyleSheet.
 */
import { fontFamily } from './fonts';

export const typography = {
  display: { fontFamily: fontFamily.sansExtrabold, fontSize: 34, lineHeight: 34, letterSpacing: -1.36 },
  label: { fontFamily: fontFamily.sansBold, fontSize: 13, lineHeight: 16, letterSpacing: 1.04 },
  h1: { fontFamily: fontFamily.sansBold, fontSize: 28, lineHeight: 31, letterSpacing: -0.56 },
  h2: { fontFamily: fontFamily.sansBold, fontSize: 22, lineHeight: 26, letterSpacing: -0.22 },
  h3: { fontFamily: fontFamily.sansSemibold, fontSize: 18, lineHeight: 23, letterSpacing: 0 },
  h4: { fontFamily: fontFamily.sansSemibold, fontSize: 16, lineHeight: 22, letterSpacing: 0 },
  bodyLg: { fontFamily: fontFamily.sans, fontSize: 16, lineHeight: 24, letterSpacing: 0 },
  body: { fontFamily: fontFamily.sans, fontSize: 14, lineHeight: 21, letterSpacing: 0 },
  bodySm: { fontFamily: fontFamily.sans, fontSize: 13, lineHeight: 20, letterSpacing: 0 },
  caption: { fontFamily: fontFamily.sansMedium, fontSize: 11, lineHeight: 15, letterSpacing: 0 },
} as const;

export type TypographyToken = keyof typeof typography;
