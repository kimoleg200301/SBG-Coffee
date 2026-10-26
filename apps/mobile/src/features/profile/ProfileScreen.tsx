import { useState } from 'react';
import { useRouter } from 'expo-router';
import { ActivityIndicator, Pressable, StyleSheet, Switch, TextInput, View } from 'react-native';
import {
  Bell,
  Check,
  ChevronRight,
  Coffee,
  Heart,
  History,
  Languages,
  MessageCircle,
  Pencil,
  SlidersHorizontal,
  Sun,
  type LucideIcon,
} from 'lucide-react-native';

import { getLoyaltyProgress } from '@/domain/loyalty';
import { MAX_PROFILE_NAME_LENGTH, normalizeProfileName } from '@/domain/profile';
import { useLoyaltyCard } from '@/features/loyalty/useLoyaltyCard';
import { useOrders } from '@/features/orders/useOrders';
import { AppText, Button, EmptyState, IconButton, Screen, ScreenHeader, Sheet } from '@/shared/ui';
import { colors, fonts } from '@/theme';
import { useProfile, useResetProfile, useUpdateProfile } from './useProfile';

type ProfileSheet =
  'edit' | 'settings' | 'notifications' | 'language' | 'theme' | 'about' | 'support' | 'reset';

const sheetTitles: Record<ProfileSheet, string> = {
  edit: 'Как вас зовут?',
  settings: 'Настройки',
  notifications: 'Уведомления',
  language: 'Язык приложения',
  theme: 'Тема приложения',
  about: 'О кофейне',
  support: 'Мы рядом',
  reset: 'Сбросить профиль?',
};

function orderCountLabel(count: number): string {
  const lastTwo = count % 100;
  const last = count % 10;
  return `${count} ${lastTwo >= 11 && lastTwo <= 14 ? 'заказов' : last === 1 ? 'заказ' : last >= 2 && last <= 4 ? 'заказа' : 'заказов'}`;
}

interface ProfileRowProps {
  icon: LucideIcon;
  title: string;
  subtitle?: string;
  onPress: () => void;
}
function ProfileRow({ icon: Icon, title, subtitle, onPress }: ProfileRowProps) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={subtitle ? `${title}. ${subtitle}` : title}
      onPress={onPress}
      style={({ pressed }) => [styles.row, pressed && styles.pressed]}
    >
      <Icon size={22} color={colors.green} strokeWidth={1.8} />
      <View style={styles.rowCopy}>
        <AppText variant="label">{title}</AppText>
        {subtitle ? <AppText style={styles.rowSubtitle}>{subtitle}</AppText> : null}
      </View>
      <ChevronRight size={18} color={colors.muted} strokeWidth={1.7} />
    </Pressable>
  );
}

export function ProfileScreen() {
  const router = useRouter();
  const profile = useProfile();
  const loyalty = useLoyaltyCard();
  const orders = useOrders();
  const update = useUpdateProfile();
  const reset = useResetProfile();
  const [sheet, setSheet] = useState<ProfileSheet | null>(null);
  const [name, setName] = useState('');
  const [error, setError] = useState<string | null>(null);
  const busy = update.isPending || reset.isPending;
  const progress = loyalty.data ? getLoyaltyProgress(loyalty.data) : null;

  function openSheet(next: ProfileSheet) {
    setError(null);
    if (next === 'edit') setName(profile.data?.displayName ?? '');
    setSheet(next);
  }

  function closeSheet() {
    if (!busy) setSheet(null);
  }

  async function saveName() {
    let displayName: string;
    try {
      displayName = normalizeProfileName(name);
    } catch {
      setError(`Введите имя от 1 до ${MAX_PROFILE_NAME_LENGTH} символов.`);
      return;
    }
    setError(null);
    try {
      await update.mutateAsync({ displayName });
      setSheet(null);
    } catch {
      setError('Не удалось сохранить имя. Попробуйте ещё раз.');
    }
  }

  async function changeNotifications(enabled: boolean) {
    setError(null);
    try {
      await update.mutateAsync({ notificationsEnabled: enabled });
    } catch {
      setError('Не удалось сохранить настройку. Попробуйте ещё раз.');
    }
  }

  async function resetProfile() {
    setError(null);
    try {
      await reset.mutateAsync();
      setSheet(null);
    } catch {
      setError('Не удалось сбросить профиль. Попробуйте ещё раз.');
    }
  }

  return (
    <>
      <Screen>
        <ScreenHeader
          title="Профиль"
          action={
            <IconButton
              icon={SlidersHorizontal}
              label="Настройки профиля"
              onPress={() => openSheet('settings')}
            />
          }
        />
        {profile.isPending ? (
          <View style={styles.loading}>
            <ActivityIndicator color={colors.green} />
            <AppText variant="caption">Открываем ваш профиль…</AppText>
          </View>
        ) : profile.isError || !profile.data ? (
          <EmptyState
            title="Профиль пока недоступен"
            description="Не удалось загрузить данные на этом устройстве."
            action={<Button label="Повторить" onPress={() => void profile.refetch()} />}
          />
        ) : (
          <>
            <View style={styles.guest}>
              <View style={styles.avatar}>
                <Coffee size={30} color={colors.cream} strokeWidth={1.8} />
              </View>
              <View style={styles.guestCopy}>
                <AppText style={styles.name}>{profile.data.displayName}</AppText>
                <AppText variant="caption">ID {profile.data.id}</AppText>
              </View>
              <IconButton icon={Pencil} label="Изменить имя" onPress={() => openSheet('edit')} />
            </View>

            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Моя карта лояльности"
              onPress={() => router.push('/loyalty')}
              style={({ pressed }) => [styles.loyalty, pressed && styles.pressed]}
            >
              <View style={styles.loyaltyTop}>
                <AppText variant="serif" style={styles.onGreen}>
                  Моя карта
                </AppText>
                <AppText style={styles.progress}>
                  {progress ? `${progress.collected} / ${progress.target}` : '— / 7'}
                </AppText>
              </View>
              <View style={styles.segments}>
                {Array.from({ length: 7 }, (_, index) => (
                  <View
                    key={index}
                    style={[styles.segment, index < (progress?.collected ?? 0) && styles.collected]}
                  />
                ))}
              </View>
              <AppText style={styles.loyaltyCaption}>
                {progress
                  ? progress.rewardsAvailable > 0
                    ? 'Подарочная чашка уже ждёт вас'
                    : progress.isComplete
                      ? 'Все отметки собраны — загляните за подарком'
                      : `Ещё ${progress.remaining} ${progress.remaining === 1 ? 'покупка' : progress.remaining < 5 ? 'покупки' : 'покупок'} — и следующий кофе в подарок`
                  : loyalty.isError
                    ? 'Откройте карту, чтобы повторить загрузку'
                    : 'Загружаем вашу карту…'}
              </AppText>
            </Pressable>

            <View>
              <ProfileRow
                icon={History}
                title="Мои заказы"
                subtitle={
                  orders.data
                    ? orderCountLabel(orders.data.length)
                    : orders.isError
                      ? 'Не удалось загрузить'
                      : 'Загружаем…'
                }
                onPress={() => router.push('/orders')}
              />
              <ProfileRow
                icon={Heart}
                title="Избранное"
                onPress={() =>
                  router.push({ pathname: '/menu', params: { favorites: '1', q: '' } })
                }
              />
              <ProfileRow
                icon={Bell}
                title="Уведомления"
                subtitle={profile.data.notificationsEnabled ? 'Включены в настройках' : 'Выключены'}
                onPress={() => openSheet('notifications')}
              />
              <ProfileRow
                icon={Languages}
                title="Язык приложения"
                subtitle="Русский"
                onPress={() => openSheet('language')}
              />
              <ProfileRow
                icon={Sun}
                title="Тема приложения"
                subtitle="Светлая"
                onPress={() => openSheet('theme')}
              />
              <ProfileRow icon={Coffee} title="О кофейне" onPress={() => openSheet('about')} />
              <ProfileRow
                icon={MessageCircle}
                title="Поддержка"
                onPress={() => openSheet('support')}
              />
            </View>
            <Pressable
              accessibilityRole="button"
              onPress={() => openSheet('reset')}
              style={styles.resetLink}
            >
              <AppText style={styles.resetLabel}>Сбросить профиль</AppText>
            </Pressable>
            <AppText variant="caption" style={styles.localNote}>
              Гостевой профиль · данные на этом устройстве
            </AppText>
          </>
        )}
      </Screen>

      <Sheet visible={sheet !== null} onClose={closeSheet} title={sheet ? sheetTitles[sheet] : ''}>
        {sheet === 'edit' ? (
          <>
            <AppText variant="body">Так мы будем обращаться к вам в приложении.</AppText>
            <View style={styles.field}>
              <AppText variant="label">Имя</AppText>
              <TextInput
                accessibilityLabel="Имя гостя"
                value={name}
                onChangeText={setName}
                placeholder="Ваше имя"
                placeholderTextColor={colors.muted}
                maxLength={MAX_PROFILE_NAME_LENGTH}
                autoCapitalize="words"
                autoCorrect={false}
                returnKeyType="done"
                onSubmitEditing={() => void saveName()}
                editable={!busy}
                style={styles.input}
              />
            </View>
            {error ? (
              <AppText accessibilityLiveRegion="polite" style={styles.error}>
                {error}
              </AppText>
            ) : null}
            <Button
              label={busy ? 'Сохраняем…' : 'Сохранить имя'}
              onPress={() => void saveName()}
              disabled={busy}
            />
          </>
        ) : null}
        {sheet === 'settings' ? (
          <>
            <AppText variant="body">Настройте приложение под себя.</AppText>
            <View>
              <ProfileRow icon={Pencil} title="Имя гостя" onPress={() => openSheet('edit')} />
              <ProfileRow
                icon={Bell}
                title="Уведомления"
                onPress={() => openSheet('notifications')}
              />
              <ProfileRow
                icon={Languages}
                title="Язык приложения"
                subtitle="Русский"
                onPress={() => openSheet('language')}
              />
              <ProfileRow
                icon={Sun}
                title="Тема приложения"
                subtitle="Светлая"
                onPress={() => openSheet('theme')}
              />
            </View>
          </>
        ) : null}
        {sheet === 'notifications' ? (
          <>
            <View style={styles.preference}>
              <View style={styles.preferenceCopy}>
                <AppText variant="label">Новости и напоминания</AppText>
                <AppText variant="caption">Сохранить моё предпочтение</AppText>
              </View>
              <Switch
                accessibilityLabel="Новости и напоминания"
                value={profile.data?.notificationsEnabled ?? false}
                onValueChange={(value) => void changeNotifications(value)}
                disabled={busy}
                trackColor={{ false: colors.line, true: colors.green }}
                thumbColor={colors.surface}
              />
            </View>
            <View style={styles.notice}>
              <AppText variant="caption">
                В этой версии сохраняется только настройка. Push-уведомления ещё не подключены и не
                отправляются.
              </AppText>
            </View>
            {error ? (
              <AppText accessibilityLiveRegion="polite" style={styles.error}>
                {error}
              </AppText>
            ) : null}
            <Button label="Готово" onPress={closeSheet} disabled={busy} />
          </>
        ) : null}
        {sheet === 'language' || sheet === 'theme' ? (
          <>
            <View style={styles.selectedOption}>
              <AppText variant="label">{sheet === 'language' ? 'Русский' : 'Светлая'}</AppText>
              <Check color={colors.green} size={22} />
            </View>
            <AppText variant="body">
              {sheet === 'language'
                ? 'Сейчас приложение доступно на русском языке.'
                : 'Сливочный фон и лесной зелёный — фирменная тема SBG Coffee. В этой версии доступна светлая тема.'}
            </AppText>
            <Button label="Понятно" onPress={closeSheet} />
          </>
        ) : null}
        {sheet === 'about' ? (
          <>
            <View style={styles.aboutIcon}>
              <Coffee color={colors.green} size={34} strokeWidth={1.6} />
            </View>
            <AppText variant="display">Кофе вкуснее{'\n'}в компании.</AppText>
            <AppText variant="body">
              SBG Coffee — любимые напитки, сезонные вкусы и тёплые встречи. Загляните за своей
              чашкой и хорошим настроением.
            </AppText>
            <AppText variant="caption">
              Приложение помогает выбрать напиток и познакомиться с программой «Каждый 8-й кофе в
              подарок».
            </AppText>
            <Button
              label="К меню"
              onPress={() => {
                setSheet(null);
                router.push('/menu');
              }}
            />
          </>
        ) : null}
        {sheet === 'support' ? (
          <>
            <MessageCircle size={34} color={colors.green} strokeWidth={1.6} />
            <AppText variant="serif">Поможем с вашей чашкой</AppText>
            <AppText variant="body">
              Если есть вопрос о напитке, заказе или программе лояльности, обратитесь к бариста в
              кофейне SBG Coffee.
            </AppText>
            <View style={styles.notice}>
              <AppText variant="caption">
                Заказы в этой версии демонстрационные и не передаются в кофейню. Чат поддержки пока
                не подключён.
              </AppText>
            </View>
            <Button label="Всё понятно" onPress={closeSheet} />
          </>
        ) : null}
        {sheet === 'reset' ? (
          <>
            <AppText variant="body">
              Имя снова станет «Гость SBG», а настройки вернутся к исходным значениям. Корзина,
              избранное и история заказов сохранятся.
            </AppText>
            {error ? (
              <AppText accessibilityLiveRegion="polite" style={styles.error}>
                {error}
              </AppText>
            ) : null}
            <Button
              label={busy ? 'Сбрасываем…' : 'Сбросить имя и настройки'}
              onPress={() => void resetProfile()}
              disabled={busy}
            />
            <Button label="Отмена" variant="secondary" onPress={closeSheet} disabled={busy} />
          </>
        ) : null}
      </Sheet>
    </>
  );
}

const styles = StyleSheet.create({
  loading: { minHeight: 280, alignItems: 'center', justifyContent: 'center', gap: 12 },
  guest: { flexDirection: 'row', alignItems: 'center', gap: 16 },
  avatar: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: colors.green,
    justifyContent: 'center',
    alignItems: 'center',
  },
  guestCopy: { flex: 1, gap: 6 },
  name: { fontFamily: fonts.bold, fontSize: 20, lineHeight: 28 },
  loyalty: { backgroundColor: colors.green, borderRadius: 20, padding: 20, gap: 16 },
  loyaltyTop: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
  },
  onGreen: { color: colors.cream },
  progress: { fontSize: 18, lineHeight: 25, fontFamily: fonts.bold, color: colors.cream },
  segments: { flexDirection: 'row', gap: 5 },
  segment: { flex: 1, height: 8, borderRadius: 4, backgroundColor: 'rgba(255,244,232,0.24)' },
  collected: { backgroundColor: colors.cream },
  loyaltyCaption: { fontSize: 12, lineHeight: 18, color: colors.cream },
  row: {
    flexDirection: 'row',
    gap: 14,
    alignItems: 'center',
    minHeight: 58,
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: colors.line,
  },
  rowCopy: { flex: 1, gap: 3 },
  rowSubtitle: { fontSize: 11, lineHeight: 16, color: colors.muted },
  pressed: { opacity: 0.7 },
  resetLink: { minHeight: 44, justifyContent: 'center', alignSelf: 'flex-start' },
  resetLabel: { fontFamily: fonts.bold, fontSize: 13, color: colors.ink },
  localNote: { fontSize: 10, textAlign: 'center', marginTop: -12 },
  field: { gap: 8 },
  input: {
    borderWidth: 1,
    borderColor: colors.line,
    backgroundColor: colors.surface,
    borderRadius: 14,
    padding: 16,
    fontFamily: fonts.regular,
    fontSize: 16,
    color: colors.ink,
    minHeight: 56,
  },
  error: { color: colors.ink, fontFamily: fonts.semibold },
  preference: { flexDirection: 'row', alignItems: 'center', gap: 14 },
  preferenceCopy: { flex: 1, gap: 4 },
  notice: { backgroundColor: colors.sage, padding: 16, borderRadius: 16 },
  selectedOption: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: colors.sage,
    padding: 16,
    borderRadius: 16,
  },
  aboutIcon: {
    width: 68,
    height: 68,
    borderRadius: 20,
    backgroundColor: colors.sage,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
