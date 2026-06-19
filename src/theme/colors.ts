/**
 * Hearth color tokens — the warm cookbook palette.
 *
 * These hex values are the single source of truth for color in JS/TS contexts
 * that cannot use NativeWind `className` (see AGENTS.md "Style exception rules":
 * cross-platform shadows, dynamic inline styles, SafeAreaView, etc.).
 *
 * The same values are mirrored as `--color-*` tokens in `src/global.css`, which
 * is what generates the `bg-*` / `text-*` / `border-*` utilities. Keep the two
 * in sync — never hardcode a hex in a component.
 */
export const colors = {
  // Primary
  terracotta: '#C65A3A',
  terracottaDeep: '#B14E30',
  olive: '#5A6440',
  oliveDeep: '#4A5235',
  sage: '#8B9472',
  cream: '#F3EDE2',
  creamDeep: '#EBE3D5',

  // Semantic
  success: '#5A6440',
  warning: '#D9A441',
  warningText: '#9A6F1C',
  streak: '#C65A3A',
  error: '#A4452E',
  info: '#7E8A9E',

  // Neutrals
  ink: '#2E2A24',
  inkSoft: '#5C564C',
  muted: '#938C7E',
  border: '#DDD4C5',
  surface: '#FBF8F2',
  background: '#F3EDE2',
  white: '#FFFFFF',
} as const;

export type ColorToken = keyof typeof colors;
