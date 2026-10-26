import { Image } from 'expo-image';
import { Check, Heart, ShoppingBag, X } from 'lucide-react-native';
import { useRef, useState } from 'react';
import { useRouter } from 'expo-router';
import { Modal, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useFavorites } from '@/core/FavoritesProvider';
import { useCart } from '@/core/CartProvider';
import { CatalogStatus } from '@/features/catalog/CatalogStatus';
import { formatPrice, type Product } from '@/domain/catalog';
import { images } from '@/shared/assets';
import { AppText, Button, IconButton, QuantityStepper } from '@/shared/ui';
import { colors, fonts } from '@/theme';

interface ProductDetailsProps {
  product: Product;
  onClose: () => void;
}

export function ProductDetails({ product, onClose }: ProductDetailsProps) {
  const insets = useSafeAreaInsets();
  const { isFavorite, toggleFavorite } = useFavorites();
  const cart = useCart();
  const router = useRouter();
  const [variantId, setVariantId] = useState(product.variants[0]?.id);
  const [quantity, setQuantity] = useState(1);
  const [adding, setAdding] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const addingRef = useRef(false);

  const variant = product.variants.find((item) => item.id === variantId) ?? product.variants[0];
  const favorite = isFavorite(product.id);
  const busy = adding || cart.isSaving || cart.isSubmitting;

  async function addToCart() {
    if (addingRef.current || busy || !variant || !cart.isReady) return;
    addingRef.current = true;
    setAdding(true);
    setError(null);
    try {
      await cart.addItem(product.id, variant.id, quantity);
      onClose();
      router.push('/cart');
    } catch (cause) {
      setError(
        cause instanceof Error ? cause.message : 'Не удалось добавить напиток. Попробуйте ещё раз.',
      );
    } finally {
      addingRef.current = false;
      setAdding(false);
    }
  }

  return (
    <Modal
      visible
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={() => {
        if (!adding) onClose();
      }}
    >
      <View
        accessibilityViewIsModal
        style={[
          styles.modal,
          { paddingTop: Math.max(insets.top, 16), paddingBottom: insets.bottom },
        ]}
      >
        <View style={styles.container}>
          <View style={styles.header}>
            <IconButton
              icon={X}
              label="Закрыть карточку напитка"
              onPress={onClose}
              disabled={adding}
            />
            <AppText variant="caption">
              {product.category === 'seasonal' ? 'Сезонное меню' : 'Наше меню'}
            </AppText>
            <IconButton
              icon={Heart}
              label={favorite ? 'Убрать напиток из избранного' : 'Добавить напиток в избранное'}
              selected={favorite}
              onPress={() => toggleFavorite(product.id)}
            />
          </View>
          <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
            <Image
              source={images[product.image]}
              style={styles.image}
              contentFit="cover"
              accessibilityLabel={product.name}
            />
            <View style={styles.description}>
              {product.tag ? (
                <View style={styles.badge}>
                  <AppText style={styles.badgeText}>{product.tag.toLocaleUpperCase('ru')}</AppText>
                </View>
              ) : null}
              <AppText variant="title">{product.name}</AppText>
              <AppText style={styles.descriptionText}>{product.description}</AppText>
            </View>
            <View style={styles.variantsSection}>
              <AppText variant="label">Объём</AppText>
              <View style={styles.variants}>
                {product.variants.map((item) => {
                  const selected = variant?.id === item.id;
                  return (
                    <Pressable
                      key={item.id}
                      accessibilityRole="radio"
                      disabled={busy}
                      accessibilityState={{ checked: selected }}
                      accessibilityLabel={`${item.label}, ${item.volumeMl} миллилитров, ${formatPrice(item.priceKzt)}`}
                      onPress={() => setVariantId(item.id)}
                      style={({ pressed }) => [
                        styles.variant,
                        selected && styles.variantSelected,
                        pressed && styles.pressed,
                      ]}
                    >
                      <AppText style={[styles.variantText, selected && styles.variantTextSelected]}>
                        {item.label} · {item.volumeMl} мл
                      </AppText>
                      {selected ? <Check size={16} color={colors.cream} strokeWidth={1.8} /> : null}
                    </Pressable>
                  );
                })}
              </View>
            </View>
            <CatalogStatus />
            <View style={styles.priceSection}>
              <View style={styles.quantityRow}>
                <AppText variant="label">Количество</AppText>
                <QuantityStepper value={quantity} onChange={setQuantity} disabled={busy} />
              </View>
              <AppText variant="caption">Стоимость</AppText>
              <AppText style={styles.price}>
                {variant ? formatPrice(variant.priceKzt * quantity) : 'Уточните у бариста'}
              </AppText>
            </View>
            {error || cart.error ? (
              <AppText accessibilityRole="alert">{error || cart.error}</AppText>
            ) : null}
            <Button
              label={adding ? 'Добавляем…' : 'Добавить в заказ'}
              icon={ShoppingBag}
              loading={adding}
              disabled={busy || !cart.isReady || !variant}
              onPress={() => void addToCart()}
            />
            <AppText variant="caption" style={styles.orderHint}>
              Самовывоз из SBG Coffee · оплата при получении
            </AppText>
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  modal: { flex: 1, backgroundColor: colors.cream, alignItems: 'center' },
  container: { flex: 1, width: '100%', maxWidth: 540 },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingBottom: 16,
    gap: 12,
  },
  content: { paddingHorizontal: 20, paddingBottom: 32, gap: 24 },
  image: { width: '100%', aspectRatio: 350 / 312, borderRadius: 24 },
  description: { gap: 12 },
  descriptionText: { color: colors.muted, fontSize: 14, lineHeight: 22 },
  badge: {
    backgroundColor: colors.sand,
    alignSelf: 'flex-start',
    paddingVertical: 6,
    paddingHorizontal: 10,
    borderRadius: 20,
  },
  badgeText: { fontFamily: fonts.bold, fontSize: 10, lineHeight: 14, letterSpacing: 1 },
  variantsSection: { gap: 12 },
  variants: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  variant: {
    minHeight: 44,
    paddingHorizontal: 18,
    paddingVertical: 12,
    borderRadius: 24,
    backgroundColor: colors.subtle,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  variantSelected: { backgroundColor: colors.green },
  variantText: { fontSize: 13, lineHeight: 18, fontFamily: fonts.semibold },
  variantTextSelected: { color: colors.cream },
  priceSection: { gap: 4, borderTopWidth: 1, borderTopColor: colors.line, paddingTop: 24 },
  quantityRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 16,
  },
  price: { fontFamily: fonts.bold, fontSize: 28, lineHeight: 38 },
  orderHint: { textAlign: 'center' },
  pressed: { opacity: 0.75 },
});
