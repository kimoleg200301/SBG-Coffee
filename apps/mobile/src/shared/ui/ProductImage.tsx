import { Image } from 'expo-image';
import { CakeSlice, Leaf } from 'lucide-react-native';
import { StyleSheet, View, type StyleProp, type ImageStyle } from 'react-native';

import type { ProductImageKey } from '@/domain/catalog';
import { images } from '@/shared/assets';
import { colors } from '@/theme';

interface ProductImageProps {
  image: ProductImageKey;
  style?: StyleProp<ImageStyle>;
  accessibilityLabel: string;
}

/** New categories use neutral icons until approved product photography is available. */
export function ProductImage({ image, style, accessibilityLabel }: ProductImageProps) {
  if (image === 'tea' || image === 'dessert') {
    const Icon = image === 'tea' ? Leaf : CakeSlice;
    return (
      <View style={[styles.placeholder, style]} accessibilityRole="image" accessibilityLabel={accessibilityLabel}>
        <Icon size={40} color={colors.green} strokeWidth={1.5} />
      </View>
    );
  }
  return <Image source={images[image]} style={style} contentFit="cover" accessibilityLabel={accessibilityLabel} />;
}

const styles = StyleSheet.create({
  placeholder: { backgroundColor: colors.sage, alignItems: 'center', justifyContent: 'center' },
});
