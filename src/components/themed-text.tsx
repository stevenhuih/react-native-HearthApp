import { Platform, StyleSheet, Text, type TextProps } from 'react-native';

import { Fonts, ThemeColor } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { colors, fontFamily } from '@/theme';

export type ThemedTextProps = TextProps & {
  type?: 'default' | 'title' | 'small' | 'smallBold' | 'subtitle' | 'link' | 'linkPrimary' | 'code';
  themeColor?: ThemeColor;
};

export function ThemedText({ style, type = 'default', themeColor, ...rest }: ThemedTextProps) {
  const theme = useTheme();

  return (
    <Text
      style={[
        { color: theme[themeColor ?? 'text'] },
        type === 'default' && styles.default,
        type === 'title' && styles.title,
        type === 'small' && styles.small,
        type === 'smallBold' && styles.smallBold,
        type === 'subtitle' && styles.subtitle,
        type === 'link' && styles.link,
        type === 'linkPrimary' && styles.linkPrimary,
        type === 'code' && styles.code,
        style,
      ]}
      {...rest}
    />
  );
}

// Weight is encoded in the brand font family (RN can't synthesize weights), so
// these set fontFamily rather than fontWeight. Headings use Fraunces (serif),
// operational text uses Inter (sans) — matching the design system.
const styles = StyleSheet.create({
  small: {
    fontFamily: fontFamily.sansMedium,
    fontSize: 14,
    lineHeight: 20,
  },
  smallBold: {
    fontFamily: fontFamily.sansBold,
    fontSize: 14,
    lineHeight: 20,
  },
  default: {
    fontFamily: fontFamily.sans,
    fontSize: 16,
    lineHeight: 24,
  },
  title: {
    fontFamily: fontFamily.serifBold,
    fontSize: 48,
    lineHeight: 52,
  },
  subtitle: {
    fontFamily: fontFamily.serifSemibold,
    fontSize: 32,
    lineHeight: 44,
  },
  link: {
    fontFamily: fontFamily.sansMedium,
    lineHeight: 30,
    fontSize: 14,
  },
  linkPrimary: {
    fontFamily: fontFamily.sansSemibold,
    lineHeight: 30,
    fontSize: 14,
    color: colors.terracotta,
  },
  code: {
    fontFamily: Fonts.mono,
    fontWeight: Platform.select({ android: 700 }) ?? 500,
    fontSize: 12,
  },
});
