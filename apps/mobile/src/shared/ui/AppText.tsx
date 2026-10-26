import { Text, StyleSheet, type TextProps } from 'react-native';
import { colors, fonts } from '@/theme';

interface AppTextProps extends TextProps {
  variant?: keyof typeof variants;
}

export function AppText({ variant = 'body', style, ...props }: AppTextProps) {
  return <Text {...props} style={[styles.base, variants[variant], style]} />;
}

const styles = StyleSheet.create({ base: { color: colors.ink, fontFamily: fonts.regular } });
const variants = StyleSheet.create({
  body: { fontSize: 14, lineHeight: 22 },
  caption: { fontSize: 12, lineHeight: 18, color: colors.muted },
  label: { fontSize: 14, lineHeight: 20, fontFamily: fonts.semibold },
  title: { fontSize: 32, lineHeight: 38, fontFamily: fonts.serif },
  display: { fontSize: 32, lineHeight: 34, fontFamily: fonts.serif },
  brand: { fontSize: 26, lineHeight: 32, fontFamily: fonts.serif },
  serif: { fontSize: 24, lineHeight: 28, fontFamily: fonts.serif },
});
