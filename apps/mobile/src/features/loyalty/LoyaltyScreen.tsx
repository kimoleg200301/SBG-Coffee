import { useState } from 'react';
import { ActivityIndicator, StyleSheet, View } from 'react-native';
import { Coffee, Gift, Info, QrCode } from 'lucide-react-native';
import QRCode from 'react-native-qrcode-svg';

import { AppText, Button, EmptyState, IconButton, Screen, ScreenHeader, Sheet } from '@/shared/ui';
import { colors, fonts, radii } from '@/theme';
import { LoyaltyPass } from './LoyaltyPass';
import { useLoyaltyCard } from './useLoyaltyCard';

export function LoyaltyScreen() {
  const { data: card, isPending, isError, refetch } = useLoyaltyCard();
  const [visibleSheet, setVisibleSheet] = useState<'rules' | 'code' | null>(null);
  const closeSheet = () => setVisibleSheet(null);

  return (
    <>
      <Screen>
        <ScreenHeader
          title="Моя карта"
          action={
            <IconButton
              icon={Info}
              label="Правила программы лояльности"
              onPress={() => setVisibleSheet('rules')}
            />
          }
        />

        {isPending ? (
          <View style={styles.loading} accessibilityLiveRegion="polite">
            <ActivityIndicator
              color={colors.green}
              size="large"
              accessibilityLabel="Загружаем карту"
            />
            <AppText variant="caption">Загружаем вашу карту…</AppText>
          </View>
        ) : isError || !card ? (
          <EmptyState
            title="Карта пока недоступна"
            description="Не удалось загрузить карту. Попробуйте ещё раз."
            action={
              <Button
                label="Повторить"
                onPress={() => {
                  void refetch();
                }}
              />
            }
          />
        ) : (
          <>
            <LoyaltyPass card={card} />

            <View style={styles.introduction}>
              <View style={styles.qrIcon}>
                <QrCode size={38} color={colors.green} strokeWidth={1.8} />
              </View>
              <AppText style={styles.instruction}>Покажите карту бариста</AppText>
              <AppText style={styles.description}>
                {'Любимый кофе становится\nещё приятнее с каждым визитом.'}
              </AppText>
            </View>

            <Button
              label="Показать код карты"
              icon={QrCode}
              onPress={() => setVisibleSheet('code')}
            />

            <View style={styles.quotation}>
              <AppText style={styles.quote}>«Щедрая душа будет насыщена»</AppText>
              <AppText style={styles.citation}>ПРИТЧИ 11:25</AppText>
            </View>
          </>
        )}
      </Screen>

      <Sheet visible={visibleSheet === 'rules'} onClose={closeSheet} title="Кофе в подарок">
        <View style={styles.rule}>
          <View style={styles.ruleIcon}>
            <Coffee color={colors.green} size={24} strokeWidth={1.8} />
          </View>
          <View style={styles.ruleCopy}>
            <AppText variant="label">Семь чашек — семь отметок</AppText>
            <AppText variant="body">
              Показывайте карту бариста при покупке кофе. После подтверждения покупки на карте
              появляется отметка.
            </AppText>
          </View>
        </View>
        <View style={styles.rule}>
          <View style={styles.ruleIcon}>
            <Gift color={colors.green} size={24} strokeWidth={1.8} />
          </View>
          <View style={styles.ruleCopy}>
            <AppText variant="label">Восьмой кофе — в подарок</AppText>
            <AppText variant="body">
              Соберите семь отметок и покажите карту бариста, чтобы получить подарочную чашку.
              Подробности программы уточняйте в кофейне.
            </AppText>
          </View>
        </View>
        {card?.isDemo ? (
          <View style={styles.notice}>
            <AppText variant="label">Сейчас это демонстрационная карта</AppText>
            <AppText variant="caption">
              Начисление отметок и получение подарков станут доступны после подключения программы
              лояльности кофейни.
            </AppText>
          </View>
        ) : null}
        <Button label="Всё понятно" onPress={closeSheet} />
      </Sheet>

      <Sheet
        visible={visibleSheet === 'code' && !!card}
        onClose={closeSheet}
        title="Код вашей карты"
      >
        {card ? (
          <>
            <View style={styles.codeArea}>
              <View
                style={styles.codeFrame}
                accessible
                accessibilityLabel={`QR-код демонстрационной карты ${card.id}`}
              >
                <QRCode
                  value={`sbgcoffee:demo:${card.id}`}
                  size={200}
                  color={colors.green}
                  backgroundColor={colors.surface}
                  quietZone={12}
                />
              </View>
              <AppText variant="label">{card.id}</AppText>
            </View>
            <View style={styles.notice}>
              <AppText variant="label">Демонстрационная карта</AppText>
              <AppText variant="body">
                Этот код показывает, как будет выглядеть ваша карта. Он не подходит для начисления
                отметок или получения подарков на кассе.
              </AppText>
            </View>
            <Button label="Вернуться к карте" onPress={closeSheet} />
          </>
        ) : null}
      </Sheet>
    </>
  );
}

const styles = StyleSheet.create({
  loading: { minHeight: 360, justifyContent: 'center', alignItems: 'center', gap: 16 },
  introduction: { alignItems: 'center', gap: 16, paddingTop: 4, paddingBottom: 4 },
  qrIcon: {
    width: 72,
    height: 72,
    backgroundColor: colors.sand,
    borderRadius: radii.xl,
    alignItems: 'center',
    justifyContent: 'center',
  },
  instruction: { fontSize: 18, lineHeight: 26, fontFamily: fonts.bold, textAlign: 'center' },
  description: { color: colors.muted, fontSize: 13, lineHeight: 20, textAlign: 'center' },
  quotation: { alignItems: 'center', gap: 8, paddingTop: 2, paddingBottom: 4 },
  quote: {
    fontFamily: fonts.serifItalic,
    fontSize: 18,
    lineHeight: 22,
    color: colors.green,
    textAlign: 'center',
  },
  citation: { fontSize: 9, lineHeight: 14, letterSpacing: 1.4, color: colors.muted },
  rule: { flexDirection: 'row', alignItems: 'flex-start', gap: 14 },
  ruleIcon: {
    width: 44,
    height: 44,
    borderRadius: radii.sm,
    backgroundColor: colors.sage,
    justifyContent: 'center',
    alignItems: 'center',
  },
  ruleCopy: { flex: 1, gap: 8 },
  notice: { padding: 16, borderRadius: radii.md, backgroundColor: colors.sage, gap: 8 },
  codeArea: { alignItems: 'center', gap: 16 },
  codeFrame: { backgroundColor: colors.surface, padding: 8, borderRadius: radii.md },
});
