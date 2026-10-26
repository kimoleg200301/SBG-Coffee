import { Minus, Plus } from 'lucide-react-native';
import { Pressable, StyleSheet, View } from 'react-native';
import { colors, fonts } from '@/theme';
import { AppText } from './AppText';

interface QuantityStepperProps {
  value: number;
  onChange: (value: number) => void;
  min?: number;
  max?: number;
  disabled?: boolean;
  label?: string;
}

export function QuantityStepper({
  value,
  onChange,
  min = 1,
  max = 20,
  disabled = false,
  label = 'напитка',
}: QuantityStepperProps) {
  const lowerDisabled = disabled || value <= min;
  const upperDisabled = disabled || value >= max;
  return (
    <View style={styles.stepper}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`Уменьшить количество ${label}`}
        accessibilityState={{ disabled: lowerDisabled }}
        disabled={lowerDisabled}
        onPress={() => onChange(value - 1)}
        style={({ pressed }) => [styles.action, (lowerDisabled || pressed) && styles.dimmed]}
      >
        <Minus size={18} color={colors.green} />
      </Pressable>
      <AppText accessibilityLabel={`Количество: ${value}`} style={styles.value}>
        {value}
      </AppText>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`Увеличить количество ${label}`}
        accessibilityState={{ disabled: upperDisabled }}
        disabled={upperDisabled}
        onPress={() => onChange(value + 1)}
        style={({ pressed }) => [styles.action, (upperDisabled || pressed) && styles.dimmed]}
      >
        <Plus size={18} color={colors.green} />
      </Pressable>
    </View>
  );
}
const styles = StyleSheet.create({
  stepper: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: 24,
    alignSelf: 'flex-start',
  },
  action: { minWidth: 44, minHeight: 44, alignItems: 'center', justifyContent: 'center' },
  value: { minWidth: 24, textAlign: 'center', fontFamily: fonts.bold },
  dimmed: { opacity: 0.4 },
});
