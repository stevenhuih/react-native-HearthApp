/**
 * Font loading + family-name tokens.
 *
 * Hearth pairs three families (the "homemade editorial-cookbook" feel):
 *   - Fraunces      → display & headings (serif)
 *   - Inter         → operational / body text (sans)
 *   - Dancing Script → handwritten accents (script)
 *
 * React Native does not synthesize font weights reliably across platforms, so
 * every weight is loaded as its own family. The string keys below are the exact
 * family names you reference — in CSS via the `--font-*` tokens (which generate
 * `font-serif`, `font-sans-bold`, `font-script`, …) and in JS via `fontFamily`.
 *
 * `fontAssets` is passed to `useFonts()` in the root layout. Only the weights we
 * actually use are imported (subpath imports keep unused weights out of the bundle).
 */
import { Fraunces_400Regular } from '@expo-google-fonts/fraunces/400Regular';
import { Fraunces_500Medium } from '@expo-google-fonts/fraunces/500Medium';
import { Fraunces_600SemiBold } from '@expo-google-fonts/fraunces/600SemiBold';
import { Fraunces_700Bold } from '@expo-google-fonts/fraunces/700Bold';
import { Inter_400Regular } from '@expo-google-fonts/inter/400Regular';
import { Inter_500Medium } from '@expo-google-fonts/inter/500Medium';
import { Inter_600SemiBold } from '@expo-google-fonts/inter/600SemiBold';
import { Inter_700Bold } from '@expo-google-fonts/inter/700Bold';
import { DancingScript_500Medium } from '@expo-google-fonts/dancing-script/500Medium';
import { DancingScript_600SemiBold } from '@expo-google-fonts/dancing-script/600SemiBold';
import { DancingScript_700Bold } from '@expo-google-fonts/dancing-script/700Bold';

/** Map passed to `useFonts()`. Keys become the registered fontFamily names. */
export const fontAssets = {
  Fraunces_400Regular,
  Fraunces_500Medium,
  Fraunces_600SemiBold,
  Fraunces_700Bold,
  Inter_400Regular,
  Inter_500Medium,
  Inter_600SemiBold,
  Inter_700Bold,
  DancingScript_500Medium,
  DancingScript_600SemiBold,
  DancingScript_700Bold,
};

/** Family-name constants for `fontFamily` in inline styles / StyleSheet. */
export const fontFamily = {
  serif: 'Fraunces_400Regular',
  serifMedium: 'Fraunces_500Medium',
  serifSemibold: 'Fraunces_600SemiBold',
  serifBold: 'Fraunces_700Bold',
  sans: 'Inter_400Regular',
  sansMedium: 'Inter_500Medium',
  sansSemibold: 'Inter_600SemiBold',
  sansBold: 'Inter_700Bold',
  scriptMedium: 'DancingScript_500Medium',
  script: 'DancingScript_600SemiBold',
  scriptBold: 'DancingScript_700Bold',
} as const;

export type FontFamilyToken = keyof typeof fontFamily;
