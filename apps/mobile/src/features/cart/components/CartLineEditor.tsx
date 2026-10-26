import { Pressable, StyleSheet, View } from 'react-native';

import { MAX_ITEM_QUANTITY, type ResolvedCartLine } from '@/domain/cart';
import { OrderLineSummary } from '@/features/orders/components/OrderLineSummary';
import { AppText, QuantityStepper } from '@/shared/ui';
import { colors } from '@/theme';

interface CartLineEditorProps {
  line: ResolvedCartLine;
  disabled?: boolean;
  onQuantityChange: (quantity: number) => void;
  onRemove: () => void;
}

export function CartLineEditor({
  line,
  disabled,
  onQuantityChange,
  onRemove,
}: CartLineEditorProps) {
  return (
    <View style={styles.item}>
      <OrderLineSummary
        name={line.product.name}
        image={line.product.image}
        variantLabel={line.variant.label}
        volumeMl={line.variant.volumeMl}
        unitPriceKzt={line.variant.priceKzt}
        quantity={line.quantity}
      />
      <View style={styles.controls}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={`Убрать ${line.product.name}, ${line.variant.volumeMl} мл из заказа`}
          disabled={disabled}
          accessibilityState={{ disabled: !!disabled }}
          onPress={onRemove}
          style={({ pressed }) => [styles.remove, (pressed || disabled) && styles.dimmed]}
        >
          <AppText variant="caption">Убрать из заказа</AppText>
        </Pressable>
        <QuantityStepper
          value={line.quantity}
          min={1}
          max={MAX_ITEM_QUANTITY}
          disabled={disabled}
          label={`${line.product.name}, ${line.variant.volumeMl} мл`}
          onChange={onQuantityChange}
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  item: { gap: 20, borderBottomWidth: 1, borderBottomColor: colors.line, paddingBottom: 24 },
  controls: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: 12,
    flexWrap: 'wrap',
  },
  remove: { minHeight: 44, justifyContent: 'center' },
  dimmed: { opacity: 0.55 },
});
