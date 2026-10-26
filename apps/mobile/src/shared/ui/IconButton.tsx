import { Pressable, StyleSheet } from 'react-native';
import type { LucideIcon } from 'lucide-react-native';
import { colors } from '@/theme';

interface IconButtonProps {
  icon: LucideIcon;
  label: string;
  onPress: () => void;
  selected?: boolean;
  disabled?: boolean;
}

export function IconButton({
  icon: Icon,
  label,
  onPress,
  selected,
  disabled = false,
}: IconButtonProps) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ selected, disabled }}
      disabled={disabled}
      onPress={onPress}
      style={({ pressed }) => [
        styles.button,
        selected && styles.selected,
        (pressed || disabled) && styles.pressed,
      ]}
    >
      <Icon
        color={selected ? colors.green : colors.ink}
        size={22}
        strokeWidth={1.8}
        fill={selected ? colors.sage : 'none'}
      />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  button: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: colors.subtle,
    alignItems: 'center',
    justifyContent: 'center',
  },
  selected: { backgroundColor: colors.sage },
  pressed: { opacity: 0.6 },
});
