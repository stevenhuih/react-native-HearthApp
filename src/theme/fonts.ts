/**
 * Font loading + family-name tokens — DARK design system v2: Inter only.
 *
 * The Creme-inspired direction is a single clean sans (Inter), heavy (700–800)
 * with tight negative tracking for titles, regular (400) for body. No serif, no
 * script (v1's Fraunces/Dancing Script are retired).
 *
 * React Native does not synthesize font weights reliably, so every weight is
 * loaded as its own family. The string keys are the exact family names referenced
 * in CSS via the `--font-*` tokens and in JS via `fontFamily`.
 *
 * `fontAssets` is passed to `useFonts()` in the root layout.
 */
import { Inter_400Regular } from '@expo-google-fonts/inter/400Regular';
import { Inter_500Medium } from '@expo-google-fonts/inter/500Medium';
import { Inter_600SemiBold } from '@expo-google-fonts/inter/600SemiBold';
import { Inter_700Bold } from '@expo-google-fonts/inter/700Bold';
import { Inter_800ExtraBold } from '@expo-google-fonts/inter/800ExtraBold';

/** Map passed to `useFonts()`. Keys become the registered fontFamily names. */
export const fontAssets = {
  Inter_400Regular,
  Inter_500Medium,
  Inter_600SemiBold,
  Inter_700Bold,
  Inter_800ExtraBold,
};

/** Family-name constants for `fontFamily` in inline styles / StyleSheet. */
export const fontFamily = {
  sans: 'Inter_400Regular',
  sansMedium: 'Inter_500Medium',
  sansSemibold: 'Inter_600SemiBold',
  sansBold: 'Inter_700Bold',
  sansExtrabold: 'Inter_800ExtraBold',
} as const;

export type FontFamilyToken = keyof typeof fontFamily;
