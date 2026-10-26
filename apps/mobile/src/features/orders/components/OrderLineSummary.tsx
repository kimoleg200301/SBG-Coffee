import { StyleSheet, View } from 'react-native';

import { formatPrice, formatVariant, type Addon, type ProductImageKey } from '@/domain/catalog';
import { AppText, ProductImage } from '@/shared/ui';
import { fonts } from '@/theme';

interface OrderLineSummaryProps {
  name: string;
  image: ProductImageKey;
  variantLabel: string;
  volumeMl: number | null;
  addons: readonly Addon[];
  unitPriceKzt: number;
  quantity: number;
}

export function OrderLineSummary({
  name,
  image,
  variantLabel,
  volumeMl,
  addons,
  unitPriceKzt,
  quantity,
}: OrderLineSummaryProps) {
  return (
    <View style={styles.row}>
      <ProductImage
        image={image}
        style={styles.image}
        accessibilityLabel={name}
      />
      <View style={styles.copy}>
        <AppText style={styles.name}>{name}</AppText>
        <AppText variant="caption">
          {formatVariant(variantLabel, volumeMl)} · {quantity} шт.
        </AppText>
        {addons.map((addon) => (
          <AppText key={addon.id} variant="caption">{addon.name} +{formatPrice(addon.priceKzt)}</AppText>
        ))}
        <AppText style={styles.price}>{formatPrice(unitPriceKzt * quantity)}</AppText>
        {quantity > 1 ? (
          <AppText variant="caption">{formatPrice(unitPriceKzt)} за шт.</AppText>
        ) : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: 16 },
  image: { width: 88, height: 112, borderRadius: 18 },
  copy: { flex: 1, gap: 8 },
  name: { fontFamily: fonts.bold, fontSize: 16, lineHeight: 22 },
  price: { fontFamily: fonts.bold, fontSize: 20, lineHeight: 28 },
});
