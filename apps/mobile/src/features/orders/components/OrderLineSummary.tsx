import { Image } from 'expo-image';
import { StyleSheet, View } from 'react-native';

import { formatPrice, type ProductImageKey } from '@/domain/catalog';
import { images } from '@/shared/assets';
import { AppText } from '@/shared/ui';
import { fonts } from '@/theme';

interface OrderLineSummaryProps {
  name: string;
  image: ProductImageKey;
  variantLabel: string;
  volumeMl: number;
  unitPriceKzt: number;
  quantity: number;
}

export function OrderLineSummary({
  name,
  image,
  variantLabel,
  volumeMl,
  unitPriceKzt,
  quantity,
}: OrderLineSummaryProps) {
  return (
    <View style={styles.row}>
      <Image
        source={images[image]}
        style={styles.image}
        contentFit="cover"
        accessibilityLabel={name}
      />
      <View style={styles.copy}>
        <AppText style={styles.name}>{name}</AppText>
        <AppText variant="caption">
          {variantLabel} · {volumeMl} мл · {quantity} шт.
        </AppText>
        <AppText style={styles.price}>{formatPrice(unitPriceKzt * quantity)}</AppText>
        {quantity > 1 ? (
          <AppText variant="caption">{formatPrice(unitPriceKzt)} за напиток</AppText>
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
