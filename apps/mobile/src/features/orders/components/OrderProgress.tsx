import { Bell, Check, CheckCheck, Coffee } from 'lucide-react-native';
import { StyleSheet, View } from 'react-native';

import type { Order } from '@/domain/orders';
import { AppText } from '@/shared/ui';
import { colors, fonts } from '@/theme';

const steps = [
  { status: 'accepted', label: 'Принят', icon: Check },
  { status: 'preparing', label: 'Готовим', icon: Coffee },
  { status: 'ready', label: 'Готов', icon: Bell },
  { status: 'completed', label: 'Выдан', icon: CheckCheck },
] as const;

export function OrderProgress({ status }: { status: Order['status'] }) {
  if (status === 'cancelled') return <AppText style={styles.cancelled}>Заказ отменён</AppText>;
  const current = steps.findIndex((step) => step.status === status);
  return (
    <View
      style={styles.row}
      accessible
      accessibilityLabel={`Статус заказа: ${steps[current]?.label ?? 'Принят'}`}
    >
      {steps.map((step, index) => {
        const active = index <= current;
        const Icon = step.icon;
        return (
          <View key={step.status} style={styles.step}>
            <View style={[styles.circle, active && styles.active]}>
              <Icon size={19} color={active ? colors.cream : colors.muted} strokeWidth={1.8} />
            </View>
            <AppText
              style={[
                styles.label,
                active && styles.activeLabel,
                index === current && styles.current,
              ]}
            >
              {step.label}
            </AppText>
          </View>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', gap: 8 },
  step: { flex: 1, alignItems: 'center', gap: 10 },
  circle: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: colors.subtle,
    alignItems: 'center',
    justifyContent: 'center',
  },
  active: { backgroundColor: colors.green },
  label: { color: colors.muted, fontSize: 10, lineHeight: 16 },
  activeLabel: { color: colors.green },
  current: { fontFamily: fonts.bold },
  cancelled: { color: colors.muted, textAlign: 'center' },
});
