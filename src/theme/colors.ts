/**
 * Hearth color tokens — DARK / Creme-inspired (design system v2).
 *
 * Single source of truth for color in JS/TS contexts that can't use NativeWind
 * `className` (AGENTS.md style exceptions: shadows, dynamic inline, SafeAreaView…).
 * Mirrored as `--color-*` tokens in `src/global.css`. Keep the two in sync.
 *
 * NOTE: token NAMES are kept stable across the v1→v2 swap so existing code that
 * imports e.g. `colors.ink` keeps working — the VALUES carry the new dark palette
 * (`ink` is now white, `terracotta` is now ember, `olive` is now amber).
 */
export const colors = {
  // Brand / accent (names kept; values are the dark-system palette)
  terracotta: '#D4522A', // ember — primary actions
  terracottaDeep: '#B8431F',
  olive: '#E8923C', // amber — accent / links / ghost text
  oliveDeep: '#C9772A',
  sage: '#E8923C',
  amber: '#E8923C',
  ember: '#D4522A',
  cream: '#FFFFFF',
  creamDeep: '#232327',

  // Semantic
  success: '#3DBB78', // fresh / high match
  warning: '#E8923C',
  warningText: '#E8923C',
  streak: '#E8923C',
  error: '#E5564B', // red zone / error
  info: '#76767E',
  like: '#FF4D6D',

  // Neutrals / surfaces (names kept; `ink` is now primary text = white)
  ink: '#FFFFFF',
  inkSoft: '#B5B5BC',
  muted: '#76767E',
  border: '#2A2A2E',
  borderStrong: '#37373C',
  surface: '#1A1A1D',
  raise: '#141416',
  card2: '#232327',
  background: '#0A0A0B',
  white: '#FFFFFF',
} as const;

export type ColorToken = keyof typeof colors;
