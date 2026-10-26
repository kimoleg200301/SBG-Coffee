import { useLocalSearchParams, useRouter } from 'expo-router';
import { MessageCircle, Wallet } from 'lucide-react-native';
import { useState } from 'react';
import { ActivityIndicator, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { formatPrice } from '@/domain/catalog';
import type { Order } from '@/domain/orders';
import { AppText, Button, EmptyState, Screen, Sheet } from '@/shared/ui';
import { colors, fonts } from '@/theme';

import { OrderLineSummary } from './components/OrderLineSummary';
import { OrderProgress } from './components/OrderProgress';
import { OrderScreenHeader } from './components/OrderScreenHeader';
import { useOrder } from './useOrders';

const statusTitles: Record<Order['status'], string> = {
  accepted: 'Заказ принят',
  preparing: 'Готовим ваш кофе',
  ready: 'Можно забирать',
  completed: 'Спасибо за встречу!',
  cancelled: 'Заказ отменён',
};

function formatCreatedAt(value: string, timeOnly = false) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return 'Дата уточняется';
  const time = new Intl.DateTimeFormat('ru-RU', {
    timeZone: 'Asia/Almaty',
    hour: '2-digit',
    minute: '2-digit',
  }).format(date);
  if (timeOnly) return time;
  return `${new Intl.DateTimeFormat('ru-RU', { timeZone: 'Asia/Almaty', day: 'numeric', month: 'long' }).format(date)} · ${time}`;
}

export function OrderDetailScreen() {
  const params = useLocalSearchParams<{ id?: string }>();
  const id = typeof params.id === 'string' ? params.id : '';
  const query = useOrder(id);
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [showHelp, setShowHelp] = useState(false);
  const order = query.data;
  const openHistory = () => router.dismissTo('/orders');

  return (
    <>
      <Screen contentContainerStyle={{ paddingBottom: Math.max(insets.bottom, 24) }}>
        <OrderScreenHeader
          title="Мой заказ"
          onBack={openHistory}
          backLabel="Вернуться к заказам"
          action={{
            icon: MessageCircle,
            label: 'Помощь с заказом',
            onPress: () => setShowHelp(true),
          }}
        />
        {query.isPending && id ? (
          <ActivityIndicator
            color={colors.green}
            accessibilityLabel="Загружаем заказ"
            style={styles.loading}
          />
        ) : query.isError ? (
          <EmptyState
            title="Не удалось загрузить заказ"
            description="Попробуйте открыть его ещё раз. Ваши данные останутся на устройстве."
            action={<Button label="Повторить" onPress={() => void query.refetch()} />}
          />
        ) : !order ? (
          <EmptyState
            title="Заказ не найден"
            description="На этом устройстве нет такого заказа. Все сохранённые заказы доступны в профиле."
            action={<Button label="Мои заказы" onPress={openHistory} />}
          />
        ) : (
          <>
            <View style={styles.orderCard}>
              <View style={styles.numberHeader}>
                <AppText style={styles.eyebrow}>ВАШ НОМЕР</AppText>
                <AppText style={styles.time}>{formatCreatedAt(order.createdAt, true)}</AppText>
              </View>
              <AppText
                style={styles.number}
                accessibilityRole="header"
                numberOfLines={1}
                adjustsFontSizeToFit
                minimumFontScale={0.55}
              >
                №{order.number}
              </AppText>
              <AppText style={styles.statusTitle}>{statusTitles[order.status]}</AppText>
              <AppText style={styles.statusDescription}>
                {order.isDemo
                  ? 'Демонстрационный статус.\nЗаказ сохранён на вашем устройстве.'
                  : 'Номер понадобится при получении.'}
              </AppText>
            </View>
            <OrderProgress status={order.status} />
            <View style={styles.items}>
              <AppText style={styles.sectionTitle}>
                {order.items.length === 1 ? 'Ваш напиток' : 'Ваши напитки'}
              </AppText>
              {order.items.map((item) => (
                <OrderLineSummary key={`${item.productId}:${item.variantId}`} {...item} />
              ))}
            </View>
            <View style={styles.metadata}>
              <View style={styles.metaRow}>
                <AppText variant="caption">Получение</AppText>
                <AppText style={styles.metaValue}>В кофейне SBG Coffee</AppText>
              </View>
              <View style={styles.metaRow}>
                <AppText variant="caption">Создан</AppText>
                <AppText style={styles.metaValue}>{formatCreatedAt(order.createdAt)}</AppText>
              </View>
              {order.comment ? (
                <View style={styles.comment}>
                  <AppText variant="label">Комментарий бариста</AppText>
                  <AppText style={styles.muted}>{order.comment}</AppText>
                </View>
              ) : null}
            </View>
            <View style={styles.payment}>
              <Wallet size={25} color={colors.ink} strokeWidth={1.6} />
              <View style={styles.paymentCopy}>
                <AppText variant="label">Оплата на кассе</AppText>
                <AppText variant="caption">
                  К оплате при получении · {formatPrice(order.totalKzt)}
                </AppText>
              </View>
            </View>
            {order.isDemo ? (
              <View style={styles.demo}>
                <AppText variant="label">Демонстрационный заказ</AppText>
                <AppText variant="caption">
                  Бариста ещё не получает заказы из приложения. Деньги и чашки лояльности не
                  списываются и не начисляются.
                </AppText>
              </View>
            ) : null}
            <Button
              label="На главную"
              variant="secondary"
              style={styles.outlineButton}
              onPress={() => router.replace('/')}
            />
            <Button
              label="Мои заказы"
              variant="secondary"
              onPress={openHistory}
            />
          </>
        )}
      </Screen>
      <Sheet visible={showHelp} onClose={() => setShowHelp(false)} title="Помощь с заказом">
        <AppText>
          Если вы уже в кофейне, обратитесь к бариста — он поможет с напитком и получением заказа.
        </AppText>
        {order?.isDemo ? (
          <AppText variant="caption">
            Этот заказ сохранён только на вашем устройстве. Отправка в кофейню появится после
            подключения сервиса заказов.
          </AppText>
        ) : null}
        <Button label="Понятно" onPress={() => setShowHelp(false)} />
      </Sheet>
    </>
  );
}

const styles = StyleSheet.create({
  loading: { marginVertical: 48 },
  orderCard: {
    backgroundColor: colors.green,
    borderRadius: 24,
    padding: 24,
    gap: 16,
    alignItems: 'center',
  },
  numberHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    width: '100%',
    gap: 12,
  },
  eyebrow: {
    fontFamily: fonts.bold,
    fontSize: 10,
    lineHeight: 16,
    letterSpacing: 1.6,
    color: colors.cream,
  },
  time: { fontSize: 11, lineHeight: 16, color: colors.cream },
  number: {
    fontFamily: fonts.serif,
    fontSize: 76,
    lineHeight: 84,
    color: colors.cream,
    textAlign: 'center',
  },
  statusTitle: {
    fontFamily: fonts.serif,
    fontSize: 28,
    lineHeight: 32,
    color: colors.cream,
    textAlign: 'center',
  },
  statusDescription: {
    fontSize: 12,
    lineHeight: 18,
    textAlign: 'center',
    color: colors.cream,
    opacity: 0.82,
  },
  items: { gap: 16 },
  sectionTitle: { fontFamily: fonts.bold, fontSize: 16, lineHeight: 22 },
  metadata: { borderTopWidth: 1, borderTopColor: colors.line, paddingTop: 24, gap: 14 },
  metaRow: { flexDirection: 'row', justifyContent: 'space-between', gap: 16 },
  metaValue: {
    flex: 1,
    fontFamily: fonts.semibold,
    fontSize: 12,
    lineHeight: 18,
    textAlign: 'right',
  },
  comment: { gap: 6, marginTop: 4 },
  muted: { color: colors.muted },
  payment: {
    backgroundColor: colors.sand,
    borderRadius: 16,
    padding: 16,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  paymentCopy: { flex: 1, gap: 4 },
  demo: { backgroundColor: colors.sage, borderRadius: 16, padding: 16, gap: 8 },
  outlineButton: { borderWidth: 1, borderColor: colors.green, backgroundColor: colors.cream },
});
