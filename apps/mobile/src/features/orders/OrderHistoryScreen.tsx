import { useMemo, useRef, useState } from 'react';
import { useRouter } from 'expo-router';
import { Image } from 'expo-image';
import { ActivityIndicator, Pressable, StyleSheet, View } from 'react-native';
import {
  ArrowLeft,
  CheckCheck,
  ChevronRight,
  Coffee,
  MessageCircle,
  RotateCcw,
} from 'lucide-react-native';

import { useCart } from '@/core/CartProvider';
import { formatPrice } from '@/domain/catalog';
import { isActiveOrder, ORDER_STATUS_LABELS, type Order } from '@/domain/orders';
import { images } from '@/shared/assets';
import { AppText, Button, EmptyState, IconButton, Screen, Sheet } from '@/shared/ui';
import { colors, fonts } from '@/theme';
import { useOrders } from './useOrders';

const dateFormatter = new Intl.DateTimeFormat('ru-RU', {
  day: 'numeric',
  month: 'long',
  hour: '2-digit',
  minute: '2-digit',
  timeZone: 'Asia/Almaty',
});
const monthFormatter = new Intl.DateTimeFormat('ru-RU', {
  month: 'long',
  year: 'numeric',
  timeZone: 'Asia/Almaty',
});

function isFinished(order: Order) {
  return !isActiveOrder(order);
}

export function OrderHistoryScreen() {
  const router = useRouter();
  const orders = useOrders();
  const cart = useCart();
  const [filter, setFilter] = useState<'active' | 'finished'>('active');
  const [repeatCandidate, setRepeatCandidate] = useState<Order | null>(null);
  const [repeating, setRepeating] = useState<string | null>(null);
  const repeatInFlight = useRef(false);
  const [repeatError, setRepeatError] = useState<string | null>(null);
  const [showSupport, setShowSupport] = useState(false);
  const repeatDisabled = !cart.isReady || cart.isSaving || cart.isSubmitting || repeating !== null;
  const allOrders = orders.data ?? [];
  const finishedCount = allOrders.filter(isFinished).length;
  const activeCount = allOrders.length - finishedCount;
  const groups = useMemo(() => {
    const result: { month: string; orders: Order[] }[] = [];
    const visibleOrders = [...(orders.data ?? [])]
      .filter((order) => (filter === 'finished' ? isFinished(order) : !isFinished(order)))
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
    for (const order of visibleOrders) {
      const month = monthFormatter.format(new Date(order.createdAt));
      const previous = result[result.length - 1];
      if (previous?.month === month) previous.orders.push(order);
      else result.push({ month, orders: [order] });
    }
    return result;
  }, [orders.data, filter]);

  async function repeatOrder(order: Order) {
    if (repeatInFlight.current || repeatDisabled) return;
    repeatInFlight.current = true;
    setRepeating(order.id);
    setRepeatError(null);
    try {
      await cart.replaceFromOrder(order);
      setRepeatCandidate(null);
      router.push('/cart');
    } catch {
      setRepeatError(
        'Не удалось добавить заказ в корзину. Проверьте, что напитки ещё доступны, и попробуйте снова.',
      );
    } finally {
      repeatInFlight.current = false;
      setRepeating(null);
    }
  }

  function requestRepeat(order: Order) {
    if (repeatInFlight.current || repeatDisabled) return;
    setRepeatError(null);
    if (cart.draft.items.length > 0) setRepeatCandidate(order);
    else void repeatOrder(order);
  }

  function returnToProfile() {
    router.replace('/profile');
  }

  return (
    <>
      <Screen>
        <View style={styles.navigation}>
          <IconButton icon={ArrowLeft} label="Назад в профиль" onPress={returnToProfile} />
          <AppText style={styles.eyebrow}>ПРОФИЛЬ</AppText>
          <IconButton
            icon={MessageCircle}
            label="Помощь с заказами"
            onPress={() => setShowSupport(true)}
          />
        </View>
        <View style={styles.heading}>
          <AppText variant="title" accessibilityRole="header">
            Мои заказы
          </AppText>
          <AppText style={styles.subtitle}>Любимые вкусы и тёплые встречи.</AppText>
        </View>
        <View style={styles.filters} accessibilityRole="tablist">
          {(
            [
              { id: 'active', label: `Активные · ${activeCount}` },
              { id: 'finished', label: `Завершённые · ${finishedCount}` },
            ] as const
          ).map((item) => (
            <Pressable
              key={item.id}
              accessibilityRole="tab"
              accessibilityState={{ selected: filter === item.id }}
              onPress={() => setFilter(item.id)}
              style={({ pressed }) => [
                styles.filter,
                filter === item.id && styles.selectedFilter,
                pressed && styles.pressed,
              ]}
            >
              <AppText
                style={[styles.filterLabel, filter === item.id && styles.selectedFilterLabel]}
              >
                {item.label}
              </AppText>
            </Pressable>
          ))}
        </View>

        {orders.isPending ? (
          <View style={styles.loading}>
            <ActivityIndicator color={colors.green} />
            <AppText variant="caption">Загружаем ваши заказы…</AppText>
          </View>
        ) : orders.isError ? (
          <EmptyState
            title="Заказы пока недоступны"
            description="Не получилось загрузить историю. Попробуем ещё раз?"
            action={<Button label="Повторить" onPress={() => void orders.refetch()} />}
          />
        ) : groups.length === 0 ? (
          <EmptyState
            title={
              filter === 'active' ? 'Ваша следующая чашка впереди' : 'История только начинается'
            }
            description={
              filter === 'active'
                ? 'Пока нет активных заказов. Выберите любимый напиток в меню.'
                : 'Здесь появятся завершённые и отменённые заказы.'
            }
            action={<Button label="Выбрать свой кофе" onPress={() => router.push('/menu')} />}
          />
        ) : (
          groups.map((group) => (
            <View key={group.month} style={styles.group}>
              <AppText style={styles.month}>{group.month.toLocaleUpperCase('ru-RU')}</AppText>
              {group.orders.map((order) => (
                <View key={order.id} style={styles.order}>
                  <Pressable
                    accessibilityRole="button"
                    accessibilityLabel={`Открыть заказ №${order.number}`}
                    onPress={() =>
                      router.push({ pathname: '/orders/[id]', params: { id: order.id } })
                    }
                    style={({ pressed }) => [styles.orderHeader, pressed && styles.pressed]}
                  >
                    <AppText style={styles.orderNumber}>№{order.number}</AppText>
                    <View
                      style={[
                        styles.status,
                        order.status === 'cancelled' && styles.cancelledStatus,
                      ]}
                    >
                      {isFinished(order) ? (
                        <CheckCheck size={16} color={colors.green} />
                      ) : (
                        <Coffee size={16} color={colors.green} />
                      )}
                      <AppText style={styles.statusLabel}>
                        {ORDER_STATUS_LABELS[order.status]}
                      </AppText>
                    </View>
                    <ChevronRight size={16} color={colors.muted} />
                  </Pressable>
                  <AppText style={styles.orderDate}>
                    {dateFormatter.format(new Date(order.createdAt))}
                  </AppText>
                  {order.items.map((item) => (
                    <View key={`${item.productId}:${item.variantId}`} style={styles.orderLine}>
                      <Image
                        source={images[item.image]}
                        style={styles.drinkImage}
                        contentFit="cover"
                        accessibilityLabel={item.name}
                      />
                      <View style={styles.drinkCopy}>
                        <AppText variant="label">{item.name}</AppText>
                        <AppText style={styles.orderDate}>
                          {item.variantLabel} · {item.volumeMl} мл · {item.quantity} шт.
                        </AppText>
                        <AppText style={styles.linePrice}>
                          {formatPrice(item.unitPriceKzt * item.quantity)}
                        </AppText>
                      </View>
                    </View>
                  ))}
                  {order.items.length > 1 ? (
                    <View style={styles.total}>
                      <AppText variant="label">Итого</AppText>
                      <AppText variant="label">{formatPrice(order.totalKzt)}</AppText>
                    </View>
                  ) : null}
                  {order.isDemo ? (
                    <AppText style={styles.demo}>
                      Демонстрационный заказ · оплата не списывалась
                    </AppText>
                  ) : null}
                  <Button
                    label={repeating === order.id ? 'Добавляем…' : 'Повторить заказ'}
                    icon={RotateCcw}
                    disabled={repeatDisabled}
                    onPress={() => requestRepeat(order)}
                  />
                </View>
              ))}
            </View>
          ))
        )}
        {repeatError && !repeatCandidate ? (
          <AppText accessibilityLiveRegion="polite" style={styles.error}>
            {repeatError}
          </AppText>
        ) : null}
        {groups.length > 0 ? (
          <>
            <View style={styles.repeatHint}>
              <RotateCcw size={26} color={colors.green} strokeWidth={1.8} />
              <AppText variant="serif" style={styles.green}>
                Снова любимый вкус
              </AppText>
              <AppText style={styles.green}>
                Нажмите «Повторить», проверьте состав и подтвердите новый заказ.
              </AppText>
            </View>
            <Button
              label="Выбрать что-нибудь новое"
              variant="secondary"
              style={styles.outline}
              onPress={() => router.push('/menu')}
            />
          </>
        ) : null}
      </Screen>

      <Sheet
        visible={repeatCandidate !== null}
        onClose={() => {
          if (!repeatInFlight.current) setRepeatCandidate(null);
        }}
        title="Заменить корзину?"
      >
        <AppText>
          В корзине уже есть напитки. Заменить их составом заказа №{repeatCandidate?.number}?
        </AppText>
        <AppText variant="caption">
          Это подготовит новую корзину. Заказ появится только после вашего подтверждения.
        </AppText>
        {repeatError ? (
          <AppText accessibilityLiveRegion="polite" style={styles.error}>
            {repeatError}
          </AppText>
        ) : null}
        <Button
          label={repeating ? 'Добавляем…' : 'Заменить и проверить'}
          disabled={repeatDisabled}
          onPress={() => {
            if (repeatCandidate) void repeatOrder(repeatCandidate);
          }}
        />
        <Button
          label="Оставить текущую корзину"
          variant="secondary"
          disabled={repeating !== null}
          onPress={() => {
            if (!repeatInFlight.current) setRepeatCandidate(null);
          }}
        />
      </Sheet>
      <Sheet visible={showSupport} onClose={() => setShowSupport(false)} title="Помощь с заказом">
        <AppText>
          Вопрос о напитке или получении заказа можно задать бариста в кофейне SBG Coffee.
        </AppText>
        <View style={styles.repeatHint}>
          <AppText variant="caption">
            В этой версии заказы сохраняются на устройстве и не отправляются в кофейню. Статусы
            демонстрационные.
          </AppText>
        </View>
        <Button label="Всё понятно" onPress={() => setShowSupport(false)} />
      </Sheet>
    </>
  );
}

const styles = StyleSheet.create({
  navigation: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  eyebrow: { fontFamily: fonts.bold, fontSize: 10, letterSpacing: 1.7, color: colors.green },
  heading: { gap: 10 },
  subtitle: { color: colors.muted },
  filters: { flexDirection: 'row', gap: 10 },
  filter: {
    flex: 1,
    minHeight: 44,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 10,
    borderRadius: 24,
    backgroundColor: colors.subtle,
  },
  selectedFilter: { backgroundColor: colors.green },
  filterLabel: { fontSize: 12, lineHeight: 18, fontFamily: fonts.bold, textAlign: 'center' },
  selectedFilterLabel: { color: colors.cream },
  loading: { minHeight: 200, alignItems: 'center', justifyContent: 'center', gap: 12 },
  group: { gap: 20 },
  month: { color: colors.muted, fontSize: 11, letterSpacing: 1.5 },
  order: {
    padding: 18,
    gap: 16,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: colors.line,
    backgroundColor: colors.surface,
  },
  orderHeader: { flexDirection: 'row', alignItems: 'center', gap: 8, minHeight: 44 },
  orderNumber: { flex: 1, fontFamily: fonts.serif, fontSize: 26, lineHeight: 32 },
  status: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: colors.sage,
    borderRadius: 20,
    paddingVertical: 8,
    paddingHorizontal: 10,
  },
  cancelledStatus: { backgroundColor: colors.subtle },
  statusLabel: { fontSize: 10, lineHeight: 14, fontFamily: fonts.bold, color: colors.green },
  orderDate: { fontSize: 11, lineHeight: 17, color: colors.muted },
  orderLine: { flexDirection: 'row', gap: 14, alignItems: 'center' },
  drinkImage: { width: 68, height: 86, borderRadius: 16 },
  drinkCopy: { flex: 1, gap: 6 },
  linePrice: { fontFamily: fonts.bold, fontSize: 17, lineHeight: 24 },
  total: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    borderTopWidth: 1,
    borderTopColor: colors.line,
    paddingTop: 14,
  },
  demo: { fontSize: 10, lineHeight: 16, color: colors.muted },
  repeatHint: { backgroundColor: colors.sage, borderRadius: 18, padding: 20, gap: 10 },
  green: { color: colors.green },
  outline: { backgroundColor: 'transparent', borderWidth: 1, borderColor: colors.green },
  pressed: { opacity: 0.7 },
  error: { fontFamily: fonts.semibold, color: colors.ink },
});
