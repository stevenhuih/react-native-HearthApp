/**
 * Type scale — mirrors the `.type-*` utility classes in `src/global.css`.
 *
 * Prefer the `className` utilities (`type-h1`, `type-body`, …) in components.
 * This object exists for the rare cases that must style text via inline/
 * StyleSheet (e.g. text rendered inside a component that doesn't accept
 * `className`). `lineHeight` is absolute (points), matching RN semantics.
 */
import { fontFamily } from './fonts';

export const typography = {
  display: { fontFamily: fontFamily.serifSemibold, fontSize: 64, lineHeight: 64, letterSpacing: -1.6 },
  script: { fontFamily: fontFamily.script, fontSize: 30, lineHeight: 33, letterSpacing: 0 },
  h1: { fontFamily: fontFamily.serifBold, fontSize: 32, lineHeight: 38, letterSpacing: -0.6 },
  h2: { fontFamily: fontFamily.serifSemibold, fontSize: 24, lineHeight: 31, letterSpacing: -0.24 },
  h3: { fontFamily: fontFamily.serifSemibold, fontSize: 20, lineHeight: 26, letterSpacing: 0 },
  h4: { fontFamily: fontFamily.sansSemibold, fontSize: 16, lineHeight: 22, letterSpacing: 0 },
  bodyLg: { fontFamily: fontFamily.sans, fontSize: 16, lineHeight: 26, letterSpacing: 0 },
  body: { fontFamily: fontFamily.sans, fontSize: 14, lineHeight: 22, letterSpacing: 0 },
  bodySm: { fontFamily: fontFamily.sans, fontSize: 13, lineHeight: 21, letterSpacing: 0 },
  caption: { fontFamily: fontFamily.sans, fontSize: 11, lineHeight: 15, letterSpacing: 0 },
} as const;

export type TypographyToken = keyof typeof typography;
