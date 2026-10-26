import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  type StyleProp,
  type ViewStyle,
} from 'react-native';
import type { LucideIcon } from 'lucide-react-native';
import { AppText } from './AppText';
import { colors, fonts, radii } from '@/theme';

interface ButtonProps {
  label: string;
  onPress: () => void;
  icon?: LucideIcon;
  variant?: 'primary' | 'secondary';
  disabled?: boolean;
  loading?: boolean;
  style?: StyleProp<ViewStyle>;
}

export function Button({
  label,
  onPress,
  icon: Icon,
  variant = 'primary',
  disabled,
  loading = false,
  style,
}: ButtonProps) {
  const color = variant === 'primary' ? colors.cream : colors.green;
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ disabled: !!disabled || loading, busy: loading }}
      disabled={disabled || loading}
      onPress={onPress}
      style={({ pressed }) => [
        styles.button,
        variant === 'secondary' && styles.secondary,
        (pressed || disabled) && styles.dimmed,
        style,
      ]}
    >
      <AppText style={[styles.label, { color }]}>{label}</AppText>
      {loading ? (
        <ActivityIndicator color={color} />
      ) : Icon ? (
        <Icon size={22} color={color} strokeWidth={1.8} />
      ) : null}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  button: {
    minHeight: 56,
    borderRadius: radii.md,
    backgroundColor: colors.green,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
    paddingHorizontal: 20,
    paddingVertical: 14,
  },
  secondary: { backgroundColor: colors.sage },
  label: {
    fontSize: 15,
    lineHeight: 22,
    fontFamily: fonts.bold,
    flexShrink: 1,
    textAlign: 'center',
  },
  dimmed: { opacity: 0.7 },
});
