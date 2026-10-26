import { Check, Coffee, Gift } from 'lucide-react-native';
import { StyleSheet, View } from 'react-native';

import { getLoyaltyProgress, type LoyaltyCard } from '@/domain/loyalty';
import { AppText } from '@/shared/ui';
import { colors, fonts, radii } from '@/theme';

interface LoyaltyPassProps {
  card: LoyaltyCard;
}

export function LoyaltyPass({ card }: LoyaltyPassProps) {
  const progress = getLoyaltyProgress(card);
  const message =
    progress.rewardsAvailable > 0
      ? 'Кофе ждёт вас'
      : progress.isComplete
        ? 'Все чашки собраны'
        : progress.collected === 0
          ? 'Начнём с первой?'
          : `До подарка: ${progress.remaining}`;

  return (
    <View
      style={styles.card}
      accessible
      accessibilityLabel={`Карта SBG Coffee. Каждый восьмой кофе в подарок. Собрано ${progress.collected} из ${progress.target} чашек. Доступно подарков: ${progress.rewardsAvailable}.`}
    >
      <View style={styles.brandRow}>
        <AppText variant="brand" style={styles.brand}>
          SBG COFFEE
        </AppText>
        <Coffee color={colors.cream} size={26} strokeWidth={1.8} />
      </View>

      <AppText variant="display" style={styles.title}>
        {'Каждый 8-й кофе\nв подарок'}
      </AppText>

      <View style={styles.stampRows}>
        {[0, 1].map((row) => (
          <View key={row} style={styles.stampRow}>
            {[1, 2, 3, 4].map((column) => {
              const stamp = row * 4 + column;
              const isGift = stamp === progress.target + 1;
              const isCollected = stamp <= progress.collected;

              return (
                <View
                  key={stamp}
                  style={[styles.stamp, (isGift || isCollected) && styles.filledStamp]}
                >
                  {isGift ? (
                    <Gift color={colors.green} size={25} strokeWidth={1.8} />
                  ) : isCollected ? (
                    <Check color={colors.green} size={25} strokeWidth={1.8} />
                  ) : (
                    <AppText style={styles.stampNumber}>{stamp}</AppText>
                  )}
                </View>
              );
            })}
          </View>
        ))}
      </View>

      <View style={styles.progressRow}>
        <AppText style={styles.progress}>
          {progress.collected} из {progress.target} чашек
        </AppText>
        <AppText variant="caption" style={styles.encouragement}>
          {message}
        </AppText>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: { borderRadius: radii.xl, backgroundColor: colors.green, padding: 24, gap: 22 },
  brandRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: 12,
  },
  brand: { color: colors.cream, fontSize: 23, lineHeight: 28, flexShrink: 1 },
  title: { color: colors.cream, fontSize: 30, lineHeight: 31 },
  stampRows: { gap: 12 },
  stampRow: { flexDirection: 'row', gap: 8 },
  stamp: {
    flex: 1,
    aspectRatio: 1.25,
    borderWidth: 1.25,
    borderColor: colors.cream,
    borderRadius: radii.pill,
    alignItems: 'center',
    justifyContent: 'center',
  },
  filledStamp: { backgroundColor: colors.cream },
  stampNumber: { color: colors.cream, fontSize: 20, lineHeight: 28, fontFamily: fonts.medium },
  progressRow: {
    borderTopWidth: 1,
    borderColor: 'rgba(255,244,232,0.28)',
    paddingTop: 20,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 10,
  },
  progress: { color: colors.cream, fontFamily: fonts.bold, fontSize: 13, lineHeight: 20 },
  encouragement: {
    color: colors.cream,
    opacity: 0.78,
    fontSize: 11,
    lineHeight: 16,
    flexShrink: 1,
    textAlign: 'right',
  },
});
