import { Image } from 'expo-image';
import { useRouter } from 'expo-router';
import { ArrowRight, ArrowUpRight, Gift, Heart } from 'lucide-react-native';
import { Pressable, StyleSheet, View } from 'react-native';

import { images } from '@/shared/assets';
import { formatPrice } from '@/domain/catalog';
import { useCatalog } from '@/features/catalog/useCatalog';
import { CatalogStatus } from '@/features/catalog/CatalogStatus';
import { AppText, Button, IconButton, Screen, ScreenHeader } from '@/shared/ui';
import { colors, fonts } from '@/theme';

export function HomeScreen() {
  const router = useRouter();
  const catalog = useCatalog();
  const seasonal = catalog.data?.find((product) => product.id === 'pumpkin')?.variants[0];

  return (
    <Screen>
      <ScreenHeader
        title="SBG COFFEE"
        brand
        action={
          <IconButton
            icon={Heart}
            label="Открыть избранные напитки"
            onPress={() => router.push({ pathname: '/menu', params: { favorites: '1', q: '' } })}
          />
        }
      />

      <CatalogStatus />
      <View style={styles.greeting}>
        <AppText style={styles.eyebrow}>РАДЫ ВИДЕТЬ ВАС</AppText>
        <AppText variant="display" style={styles.heading}>
          {'Кофе вкуснее\nв компании.'}
        </AppText>
      </View>

      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Осенние любимчики. Открыть сезонное меню"
        onPress={() =>
          router.push({
            pathname: '/menu',
            params: { category: 'seasonal', favorites: '0', q: '' },
          })
        }
        style={({ pressed }) => [styles.seasonal, pressed && styles.pressed]}
      >
        <Image
          source={images.autumn}
          style={styles.autumnImage}
          contentFit="cover"
          accessibilityLabel="Два осенних напитка с тыквой и сливками"
        />
        <View style={styles.seasonalCaption}>
          <View style={styles.captionText}>
            <AppText style={styles.seasonalTitle}>Осенние любимчики</AppText>
            <AppText variant="caption">{seasonal ? `${seasonal.volumeMl} мл · ${formatPrice(seasonal.priceKzt)}` : 'Откройте сезонное меню'}</AppText>
          </View>
          <ArrowUpRight color={colors.ink} size={24} strokeWidth={1.8} />
        </View>
      </Pressable>

      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Каждый восьмой кофе в подарок. Открыть мою карту"
        onPress={() => router.push('/loyalty')}
        style={({ pressed }) => [styles.loyalty, pressed && styles.pressed]}
      >
        <Gift color={colors.cream} size={32} strokeWidth={1.8} />
        <View style={styles.loyaltyText}>
          <AppText variant="serif" style={styles.loyaltyTitle}>
            {'Каждый 8-й кофе\nв подарок'}
          </AppText>
          <AppText variant="caption" style={styles.loyaltyLink}>
            Моя карта →
          </AppText>
        </View>
      </Pressable>

      <View style={styles.birthday}>
        <Image
          source={images.birthday}
          style={styles.birthdayImage}
          contentFit="cover"
          accessibilityLabel="Иллюстрация чашки кофе"
        />
        <View style={styles.birthdayCopy}>
          <AppText style={styles.birthdayTitle}>Именинникам — подарок!</AppText>
          <AppText variant="caption">Узнайте подробности у бариста</AppText>
        </View>
      </View>

      <Button
        label="Выбрать свой кофе"
        icon={ArrowRight}
        onPress={() =>
          router.push({ pathname: '/menu', params: { category: 'coffee', favorites: '0', q: '' } })
        }
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  greeting: { gap: 8 },
  eyebrow: {
    fontFamily: fonts.bold,
    fontSize: 10,
    lineHeight: 14,
    letterSpacing: 1.7,
    color: colors.green,
  },
  heading: { fontSize: 32, lineHeight: 34 },
  seasonal: { overflow: 'hidden', backgroundColor: colors.sand, borderRadius: 20 },
  autumnImage: { width: '100%', aspectRatio: 350 / 196 },
  seasonalCaption: {
    paddingHorizontal: 18,
    paddingVertical: 18,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  captionText: { flex: 1, gap: 4 },
  seasonalTitle: { fontFamily: fonts.bold, fontSize: 18, lineHeight: 25 },
  loyalty: {
    backgroundColor: colors.green,
    borderRadius: 20,
    padding: 20,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
  },
  loyaltyText: { flex: 1, gap: 8 },
  loyaltyTitle: { fontSize: 22, lineHeight: 23, color: colors.cream },
  loyaltyLink: { color: colors.cream },
  birthday: { flexDirection: 'row', alignItems: 'center', gap: 14 },
  birthdayImage: { width: 70, height: 70, borderRadius: 16 },
  birthdayCopy: { flex: 1, gap: 6 },
  birthdayTitle: { fontFamily: fonts.bold, fontSize: 14, lineHeight: 20 },
  pressed: { opacity: 0.78 },
});
