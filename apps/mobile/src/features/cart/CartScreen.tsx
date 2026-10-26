import { useRouter } from 'expo-router';
import { ArrowRight, ShoppingBag, X } from 'lucide-react-native';
import { useState } from 'react';
import { ActivityIndicator, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useCart } from '@/core/CartProvider';
import { CatalogStatus } from '@/features/catalog/CatalogStatus';
import { formatPrice } from '@/domain/catalog';
import { OrderScreenHeader } from '@/features/orders/components/OrderScreenHeader';
import { AppText, Button, EmptyState, Screen, Sheet } from '@/shared/ui';
import { colors, fonts } from '@/theme';

import { CartLineEditor } from './components/CartLineEditor';

export function CartScreen() {
  const cart = useCart();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [actionError, setActionError] = useState<string | null>(null);
  const [changing, setChanging] = useState(false);
  const [showClear, setShowClear] = useState(false);
  const busy = cart.isSubmitting || cart.isSaving || changing;
  const error = actionError || cart.error;
  const openMenu = () =>
    router.dismissTo({ pathname: '/menu', params: { favorites: '0', q: '' } });

  async function change(action: () => Promise<void>) {
    if (busy) return;
    setChanging(true);
    setActionError(null);
    try {
      await action();
    } catch (cause) {
      setActionError(
        cause instanceof Error
          ? cause.message
          : 'Не удалось сохранить корзину. Попробуйте ещё раз.',
      );
    } finally {
      setChanging(false);
    }
  }

  return (
    <>
      <Screen contentContainerStyle={{ paddingBottom: Math.max(insets.bottom, 24) }}>
        <OrderScreenHeader
          title="ВАШ ЗАКАЗ"
          eyebrow
          onBack={() => (router.canGoBack() ? router.back() : openMenu())}
          action={{ icon: X, label: 'Закрыть корзину', onPress: openMenu }}
          disabled={busy}
        />
        <View style={styles.heading}>
          <AppText variant="title" accessibilityRole="header">
            Корзина
          </AppText>
          <AppText variant="body" style={styles.muted}>
            Всё любимое — в одном заказе.
          </AppText>
        </View>

        <CatalogStatus />
        {!cart.isReady ? (
          error ? (
            <EmptyState
              title="Корзина пока недоступна"
              description={error}
              action={
                <Button
                  label="Попробовать ещё раз"
                  onPress={() => void change(cart.retryLoad)}
                  disabled={busy}
                />
              }
            />
          ) : (
            <ActivityIndicator
              color={colors.green}
              accessibilityLabel="Загружаем корзину"
              style={styles.loading}
            />
          )
        ) : (
          <>
            {error ? (
              <AppText accessibilityRole="alert" style={styles.notice}>
                {error}
              </AppText>
            ) : null}
            {cart.issues.length ? (
              <View style={styles.notice}>
                <AppText variant="label">Состав заказа нужно проверить</AppText>
                {cart.issues.map((issue, index) => (
                  <AppText key={`${issue}-${index}`} variant="caption">
                    {issue}
                  </AppText>
                ))}
                <Button
                  label="Очистить корзину"
                  variant="secondary"
                  disabled={busy}
                  onPress={() => setShowClear(true)}
                />
              </View>
            ) : null}
            {cart.lines.length ? (
              <>
                <View style={styles.list}>
                  {cart.lines.map((line) => (
                    <CartLineEditor
                      key={line.key}
                      line={line}
                      disabled={busy}
                      onQuantityChange={(quantity) =>
                        void change(() => cart.setQuantity(line.key, quantity))
                      }
                      onRemove={() => void change(() => cart.removeItem(line.key))}
                    />
                  ))}
                </View>
                <Button
                  label="Добавить ещё напиток"
                  icon={ShoppingBag}
                  variant="secondary"
                  disabled={busy}
                  onPress={openMenu}
                />
                <View style={styles.totalRow}>
                  <AppText style={styles.totalLabel}>Итого</AppText>
                  <AppText style={styles.total}>{formatPrice(cart.totalKzt)}</AppText>
                </View>
                <Button
                  label={`К оформлению · ${formatPrice(cart.totalKzt)}`}
                  icon={ArrowRight}
                  disabled={busy || cart.issues.length > 0}
                  onPress={() => router.push('/checkout')}
                />
                <AppText variant="caption" style={styles.hint}>
                  Оплата на кассе при получении.
                </AppText>
              </>
            ) : !cart.issues.length ? (
              <EmptyState
                title="Начнём с любимого кофе?"
                description="Пока здесь пусто. Выберите напиток в меню — мы сохраним его в корзине."
                action={
                  <Button
                    label="Выбрать свой кофе"
                    icon={ArrowRight}
                    onPress={openMenu}
                  />
                }
              />
            ) : null}
          </>
        )}
      </Screen>
      <Sheet
        visible={showClear}
        onClose={() => {
          if (!busy) setShowClear(false);
        }}
        title="Очистить корзину?"
      >
        <AppText>
          Все напитки и комментарий будут удалены из корзины. Созданные заказы сохранятся.
        </AppText>
        {error ? (
          <AppText accessibilityRole="alert" style={styles.notice}>
            {error}
          </AppText>
        ) : null}
        <Button
          label="Очистить"
          disabled={busy}
          onPress={() =>
            void change(async () => {
              await cart.clear();
              setShowClear(false);
            })
          }
        />
        <Button
          label="Оставить напитки"
          variant="secondary"
          disabled={busy}
          onPress={() => setShowClear(false)}
        />
      </Sheet>
    </>
  );
}

const styles = StyleSheet.create({
  heading: { gap: 10 },
  muted: { color: colors.muted },
  loading: { marginVertical: 48 },
  list: { gap: 24 },
  notice: {
    backgroundColor: colors.sand,
    padding: 16,
    borderRadius: 16,
    gap: 12,
    color: colors.ink,
  },
  totalRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
  },
  totalLabel: { fontSize: 18, fontFamily: fonts.bold },
  total: { fontSize: 26, lineHeight: 36, fontFamily: fonts.bold },
  hint: { textAlign: 'center' },
});
