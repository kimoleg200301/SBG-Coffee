import { usePreventRemove, useRouter } from 'expo-router';
import { Check, Gift, Store, Wallet, X } from 'lucide-react-native';
import { useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Keyboard,
  KeyboardAvoidingView,
  Platform,
  StyleSheet,
  TextInput,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useCart } from '@/core/CartProvider';
import { CatalogStatus } from '@/features/catalog/CatalogStatus';
import { MAX_COMMENT_LENGTH } from '@/domain/cart';
import { formatPrice } from '@/domain/catalog';
import { CartLineEditor } from '@/features/cart/components/CartLineEditor';
import { OrderScreenHeader } from '@/features/orders/components/OrderScreenHeader';
import { AppText, Button, EmptyState, Screen } from '@/shared/ui';
import { colors, fonts } from '@/theme';

export function CheckoutScreen() {
  const cart = useCart();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [actionError, setActionError] = useState<string | null>(null);
  const [changing, setChanging] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [comment, setComment] = useState(cart.isReady ? cart.draft.comment : '');
  const commentInitialized = useRef(cart.isReady);
  const commentWriteVersion = useRef(0);
  const confirmationLock = useRef(false);
  const submitting = confirming || cart.isSubmitting;
  const busy = changing || submitting || cart.isSaving;
  const disablePrevention = usePreventRemove(submitting);
  const error = actionError || cart.error;
  const openCart = () => router.dismissTo('/cart');

  useEffect(() => {
    if (cart.isReady && !commentInitialized.current) {
      setComment(cart.draft.comment);
      commentInitialized.current = true;
    }
  }, [cart.isReady, cart.draft.comment]);

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
          : 'Не удалось сохранить изменения. Попробуйте ещё раз.',
      );
    } finally {
      setChanging(false);
    }
  }

  function updateComment(value: string) {
    if (confirmationLock.current || submitting || changing) return;
    const version = ++commentWriteVersion.current;
    setComment(value);
    setActionError(null);
    void cart.setComment(value).catch((cause: unknown) => {
      if (version !== commentWriteVersion.current) return;
      setActionError(cause instanceof Error ? cause.message : 'Не удалось сохранить комментарий.');
    });
  }

  async function confirm() {
    if (
      confirmationLock.current ||
      busy ||
      !cart.isReady ||
      !cart.lines.length ||
      cart.issues.length
    )
      return;
    confirmationLock.current = true;
    setConfirming(true);
    setActionError(null);
    Keyboard.dismiss();
    try {
      await cart.setComment(comment);
      const order = await cart.submitOrder();
      disablePrevention();
      router.dismissTo({ pathname: '/orders/[id]', params: { id: order.id } });
    } catch (cause) {
      setActionError(
        cause instanceof Error
          ? cause.message
          : 'Не удалось сохранить заказ. Корзина осталась на месте — попробуйте ещё раз.',
      );
    } finally {
      confirmationLock.current = false;
      setConfirming(false);
    }
  }

  return (
    <KeyboardAvoidingView
      style={styles.keyboard}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <Screen contentContainerStyle={{ paddingBottom: Math.max(insets.bottom, 24) }}>
        <OrderScreenHeader
          title="ВАШ ЗАКАЗ"
          eyebrow
          backLabel="Вернуться в корзину"
          onBack={openCart}
          action={{
            icon: X,
            label: 'Закрыть оформление заказа',
            onPress: openCart,
          }}
          disabled={busy}
        />
        <View style={styles.heading}>
          <AppText variant="title" accessibilityRole="header">
            Подтвердите заказ
          </AppText>
          <AppText style={styles.muted}>Всё верно? Проверьте состав и количество.</AppText>
        </View>
        <CatalogStatus />
        {!cart.isReady ? (
          error ? (
            <EmptyState
              title="Не удалось открыть заказ"
              description={error}
              action={
                <Button
                  label="Попробовать ещё раз"
                  disabled={busy}
                  onPress={() => void change(cart.retryLoad)}
                />
              }
            />
          ) : (
            <ActivityIndicator
              color={colors.green}
              accessibilityLabel="Загружаем заказ"
              style={styles.loading}
            />
          )
        ) : !cart.lines.length && !cart.issues.length && !submitting ? (
          <EmptyState
            title="В заказе пока ничего нет"
            description="Добавьте любимый кофе в корзину и возвращайтесь к оформлению."
            action={
              <Button
                label="Открыть меню"
                onPress={() =>
                  router.dismissTo({ pathname: '/menu', params: { favorites: '0', q: '' } })
                }
              />
            }
          />
        ) : (
          <>
            {error ? (
              <AppText accessibilityRole="alert" style={styles.error}>
                {error}
              </AppText>
            ) : null}
            {cart.issues.length ? (
              <View style={styles.demo}>
                <AppText variant="label">Проверьте состав заказа</AppText>
                {cart.issues.map((issue, index) => (
                  <AppText variant="caption" key={`${issue}-${index}`}>
                    {issue}
                  </AppText>
                ))}
                <Button
                  label="Вернуться в корзину"
                  variant="secondary"
                  disabled={busy}
                  onPress={openCart}
                />
              </View>
            ) : null}
            <View style={styles.items}>
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
            <View style={styles.fulfillment}>
              <View style={styles.infoRow}>
                <Store size={23} color={colors.green} strokeWidth={1.8} />
                <View style={styles.infoCopy}>
                  <AppText variant="label">Забрать в кофейне</AppText>
                  <AppText variant="caption">SBG Coffee · самовывоз</AppText>
                </View>
              </View>
              <View style={styles.infoRow}>
                <Wallet size={23} color={colors.green} strokeWidth={1.8} />
                <View style={styles.infoCopy}>
                  <AppText variant="label">Оплата</AppText>
                  <AppText variant="caption">На кассе при получении</AppText>
                </View>
              </View>
            </View>
            <View style={styles.commentSection}>
              <AppText variant="label">Комментарий бариста</AppText>
              <TextInput
                accessibilityLabel="Комментарий бариста"
                multiline
                maxLength={MAX_COMMENT_LENGTH}
                editable={!submitting && !changing}
                value={comment}
                onChangeText={updateComment}
                placeholder="Например, не очень горячий"
                placeholderTextColor={colors.muted}
                textAlignVertical="top"
                style={[styles.comment, (submitting || changing) && styles.disabled]}
              />
              <AppText variant="caption" style={styles.characterCount}>
                {comment.length} / {MAX_COMMENT_LENGTH}
              </AppText>
            </View>
            <View style={styles.totalRow}>
              <AppText style={styles.totalLabel}>Итого</AppText>
              <AppText style={styles.total}>{formatPrice(cart.totalKzt)}</AppText>
            </View>
            <View style={styles.reward}>
              <Gift size={20} color={colors.green} strokeWidth={1.8} />
              <AppText variant="caption" style={styles.rewardText}>
                Чашки появятся в карте только после оплаты и выдачи.
              </AppText>
            </View>
            <View style={styles.demo}>
              <AppText variant="label">Демонстрационный заказ</AppText>
              <AppText variant="caption">
                Заказ сохранится на этом устройстве. Бариста его пока не получит; деньги не
                списываются.
              </AppText>
            </View>
            <Button
              label={
                submitting ? 'Сохраняем заказ…' : `Подтвердить · ${formatPrice(cart.totalKzt)}`
              }
              icon={Check}
              loading={submitting}
              disabled={busy || cart.issues.length > 0 || !cart.lines.length}
              onPress={() => void confirm()}
            />
            <AppText variant="caption" style={styles.paymentNote}>
              Оплата на кассе. Сейчас деньги не списываются.
            </AppText>
          </>
        )}
      </Screen>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  keyboard: { flex: 1, backgroundColor: colors.cream },
  heading: { gap: 10 },
  muted: { color: colors.muted },
  loading: { marginVertical: 48 },
  items: { gap: 24 },
  fulfillment: { gap: 20 },
  infoRow: { flexDirection: 'row', alignItems: 'center', gap: 14 },
  infoCopy: { flex: 1, gap: 4 },
  commentSection: { gap: 10 },
  comment: {
    minHeight: 96,
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: 16,
    backgroundColor: colors.subtle,
    padding: 16,
    fontFamily: fonts.regular,
    fontSize: 13,
    lineHeight: 20,
    color: colors.ink,
  },
  characterCount: { textAlign: 'right', fontSize: 10, lineHeight: 14 },
  totalRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
  },
  totalLabel: { fontFamily: fonts.bold, fontSize: 18, lineHeight: 26 },
  total: { fontFamily: fonts.bold, fontSize: 26, lineHeight: 36 },
  reward: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  rewardText: { flex: 1, color: colors.green },
  demo: { backgroundColor: colors.sage, borderRadius: 16, padding: 16, gap: 8 },
  error: { color: colors.ink, backgroundColor: colors.sand, padding: 16, borderRadius: 16 },
  paymentNote: { textAlign: 'center', fontSize: 11, lineHeight: 17 },
  disabled: { opacity: 0.6 },
});
