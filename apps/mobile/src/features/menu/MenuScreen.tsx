import { Image } from 'expo-image';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { ArrowRight, Heart, Search, X } from 'lucide-react-native';
import { useMemo, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, TextInput, View } from 'react-native';

import { useFavorites } from '@/core/FavoritesProvider';
import {
  CATEGORIES,
  filterProducts,
  formatPrice,
  type Category,
  type Product,
} from '@/domain/catalog';
import { useCatalog } from '@/features/catalog/useCatalog';
import { CatalogStatus } from '@/features/catalog/CatalogStatus';
import { CartButton } from '@/features/cart/CartButton';
import { images } from '@/shared/assets';
import { AppText, Button, EmptyState, IconButton, Screen, ScreenHeader } from '@/shared/ui';
import { colors, fonts } from '@/theme';

import { ProductDetails } from './ProductDetails';

function readCategory(value: string | string[] | undefined): Category {
  return value === 'tea' || value === 'seasonal' ? value : 'coffee';
}

export function MenuScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ category?: string; favorites?: string; q?: string }>();
  const category = readCategory(params.category);
  const query = typeof params.q === 'string' ? params.q : '';
  const favoritesOnly = params.favorites === '1';
  const [selectedProductId, setSelectedProductId] = useState<string | null>(null);
  const { favoriteIds } = useFavorites();
  const catalog = useCatalog();
  const selectedProduct = catalog.data?.find((product) => product.id === selectedProductId);
  const seasonal = catalog.data?.find((product) => product.id === 'lavender')?.variants[0];

  const products = useMemo(
    () =>
      filterProducts({
        products: catalog.data ?? [],
        category: favoritesOnly ? undefined : category,
        query,
        favoriteIds,
        favoritesOnly,
      }),
    [catalog.data, category, query, favoriteIds, favoritesOnly],
  );

  const selectCategory = (nextCategory: Category) => {
    router.setParams({ category: nextCategory, favorites: '0', q: '' });
  };

  const toggleFavorites = () => {
    router.setParams({ favorites: favoritesOnly ? '0' : '1', q: '' });
  };

  const resetFilters = () => {
    router.setParams({ category: 'coffee', favorites: '0', q: '' });
  };

  const showSeasonalPromo =
    !favoritesOnly &&
    category === 'coffee' &&
    !query.trim() &&
    !catalog.isPending &&
    !catalog.isError && Boolean(seasonal);

  return (
    <>
      <Screen>
        <ScreenHeader
          title={favoritesOnly ? 'Избранное' : 'Меню'}
          action={
            <View style={{ flexDirection: 'row', gap: 8 }}>
              <IconButton
                icon={Heart}
                label={favoritesOnly ? 'Показать всё меню' : 'Показать избранные напитки'}
                selected={favoritesOnly}
                onPress={toggleFavorites}
              />
              <CartButton />
            </View>
          }
        />

        <View style={styles.searchBox}>
          <Search size={20} color={colors.muted} strokeWidth={1.7} />
          <TextInput
            accessibilityLabel="Поиск напитков"
            placeholder="Найти любимый напиток"
            placeholderTextColor={colors.muted}
            value={query}
            onChangeText={(value) => router.setParams({ q: value })}
            returnKeyType="search"
            autoCorrect={false}
            style={styles.searchInput}
          />
          {query ? (
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Очистить поиск"
              onPress={() => router.setParams({ q: '' })}
              style={styles.clearSearch}
            >
              <X size={18} color={colors.muted} />
            </Pressable>
          ) : null}
        </View>

        {!favoritesOnly ? (
          <View style={styles.categories} accessibilityRole="tablist">
            {CATEGORIES.map((item) => (
              <Pressable
                key={item.id}
                accessibilityRole="tab"
                accessibilityState={{ selected: category === item.id }}
                onPress={() => selectCategory(item.id)}
                style={({ pressed }) => [
                  styles.category,
                  category === item.id && styles.selectedCategory,
                  pressed && styles.pressed,
                ]}
              >
                <AppText
                  style={[
                    styles.categoryLabel,
                    category === item.id && styles.selectedCategoryLabel,
                  ]}
                >
                  {item.label}
                </AppText>
              </Pressable>
            ))}
          </View>
        ) : null}

        <CatalogStatus />
        {catalog.isPending ? (
          <View style={styles.loading} accessibilityLabel="Загружаем меню">
            <ActivityIndicator color={colors.green} />
            <AppText variant="caption">Готовим меню…</AppText>
          </View>
        ) : catalog.isError && !catalog.data ? (
          <EmptyState
            title="Меню пока недоступно"
            description="Не получилось загрузить напитки. Попробуем ещё раз?"
            action={<Button label="Повторить" onPress={() => void catalog.refetch()} />}
          />
        ) : products.length ? (
          <View style={styles.productList}>
            {products.map((product) => (
              <ProductRow
                key={product.id}
                product={product}
                onPress={() => setSelectedProductId(product.id)}
              />
            ))}
          </View>
        ) : (
          <EmptyState
            title={
              query.trim()
                ? 'Напиток не нашёлся'
                : favoritesOnly
                  ? 'Любимое — всегда рядом'
                  : category === 'tea'
                    ? 'Скоро здесь будет чай'
                    : 'Меню обновляется'
            }
            description={
              query.trim()
                ? 'Попробуйте другое название или выберите категорию.'
                : favoritesOnly
                  ? 'Откройте напиток и нажмите на сердечко — он появится здесь.'
                  : category === 'tea'
                    ? 'Чайное меню ещё готовится. А пока выберите кофе или сезонный напиток.'
                    : 'В этой категории пока нет напитков. Загляните в другие разделы меню.'
            }
            action={
              <Button
                label={favoritesOnly ? 'Выбрать любимый напиток' : 'Вернуться к кофе'}
                variant="secondary"
                onPress={resetFilters}
              />
            }
          />
        )}

        {showSeasonalPromo ? (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Тыква или лаванда? Открыть сезонное меню"
            onPress={() => selectCategory('seasonal')}
            style={({ pressed }) => [styles.seasonalPromo, pressed && styles.pressed]}
          >
            <Image
              source={images.lavender}
              style={styles.seasonalImage}
              contentFit="cover"
              accessibilityLabel="Лавандовый раф"
            />
            <View style={styles.seasonalCopy}>
              <AppText style={styles.seasonalTitle}>Тыква или лаванда?</AppText>
              <AppText style={styles.seasonalDescription}>Сезонное · {seasonal?.volumeMl} мл · {seasonal ? formatPrice(seasonal.priceKzt) : ''}</AppText>
              <ArrowRight size={22} color={colors.green} strokeWidth={1.8} />
            </View>
          </Pressable>
        ) : null}
      </Screen>
      {selectedProduct ? (
        <ProductDetails
          key={selectedProduct.id}
          product={selectedProduct}
          onClose={() => setSelectedProductId(null)}
        />
      ) : null}
    </>
  );
}

interface ProductRowProps {
  product: Product;
  onPress: () => void;
}

function ProductRow({ product, onPress }: ProductRowProps) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`Открыть ${product.name}`}
      onPress={onPress}
      style={({ pressed }) => [styles.productRow, pressed && styles.pressed]}
    >
      <Image
        source={images[product.image]}
        contentFit="cover"
        style={styles.productImage}
        accessibilityLabel={product.name}
      />
      <View style={styles.productContent}>
        <AppText style={styles.productName}>{product.name}</AppText>
        <View style={styles.prices}>
          {product.variants.map((variant) => (
            <View key={variant.id} style={styles.priceVariant}>
              <AppText style={styles.volume}>
                {variant.label} · {variant.volumeMl} мл
              </AppText>
              <AppText style={styles.price}>{formatPrice(variant.priceKzt)}</AppText>
            </View>
          ))}
        </View>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  searchBox: {
    minHeight: 48,
    flexDirection: 'row',
    alignItems: 'center',
    paddingLeft: 16,
    paddingRight: 10,
    borderRadius: 16,
    backgroundColor: colors.subtle,
    gap: 10,
  },
  searchInput: {
    flex: 1,
    minWidth: 0,
    paddingVertical: 14,
    paddingHorizontal: 0,
    color: colors.ink,
    fontFamily: fonts.regular,
    fontSize: 13,
    lineHeight: 20,
  },
  clearSearch: { minWidth: 44, minHeight: 44, alignItems: 'center', justifyContent: 'center' },
  categories: { flexDirection: 'row', gap: 8 },
  category: {
    flex: 1,
    minHeight: 44,
    borderRadius: 24,
    backgroundColor: colors.subtle,
    paddingHorizontal: 8,
    paddingVertical: 12,
    justifyContent: 'center',
    alignItems: 'center',
  },
  selectedCategory: { backgroundColor: colors.green },
  categoryLabel: { fontFamily: fonts.bold, fontSize: 13, lineHeight: 18 },
  selectedCategoryLabel: { color: colors.cream },
  productList: { gap: 18 },
  productRow: { flexDirection: 'row', alignItems: 'stretch', gap: 14, minHeight: 92 },
  productImage: { width: 78, height: 92, borderRadius: 16 },
  productContent: {
    flex: 1,
    gap: 12,
    borderBottomWidth: 1,
    borderBottomColor: colors.line,
    paddingBottom: 12,
    paddingTop: 2,
  },
  productName: { fontFamily: fonts.bold, fontSize: 16, lineHeight: 22 },
  prices: { flexDirection: 'row', gap: 12 },
  priceVariant: { flex: 1, gap: 5 },
  volume: { color: colors.muted, fontSize: 10, lineHeight: 14 },
  price: { fontFamily: fonts.bold, fontSize: 14, lineHeight: 19 },
  seasonalPromo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
    padding: 16,
    borderRadius: 20,
    backgroundColor: colors.sage,
  },
  seasonalImage: { width: 64, height: 78, borderRadius: 14 },
  seasonalCopy: { flex: 1, gap: 5 },
  seasonalTitle: { color: colors.green, fontFamily: fonts.bold, fontSize: 16, lineHeight: 22 },
  seasonalDescription: { color: colors.green, fontSize: 11, lineHeight: 17 },
  loading: { minHeight: 220, alignItems: 'center', justifyContent: 'center', gap: 12 },
  pressed: { opacity: 0.75 },
});
