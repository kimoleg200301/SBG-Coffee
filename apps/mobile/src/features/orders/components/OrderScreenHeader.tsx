import { ArrowLeft, type LucideIcon } from 'lucide-react-native';
import { StyleSheet, View } from 'react-native';

import { AppText, IconButton } from '@/shared/ui';
import { colors, fonts } from '@/theme';

interface OrderScreenHeaderProps {
  title: string;
  onBack: () => void;
  backLabel?: string;
  action?: { icon: LucideIcon; label: string; onPress: () => void };
  eyebrow?: boolean;
  disabled?: boolean;
}

export function OrderScreenHeader({
  title,
  onBack,
  backLabel = 'Назад',
  action,
  eyebrow,
  disabled,
}: OrderScreenHeaderProps) {
  return (
    <View style={styles.row}>
      <IconButton icon={ArrowLeft} label={backLabel} onPress={onBack} disabled={disabled} />
      <AppText style={[styles.title, eyebrow && styles.eyebrow]}>{title}</AppText>
      {action ? <IconButton {...action} disabled={disabled} /> : <View style={styles.spacer} />}
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: 12, minHeight: 44 },
  title: { flex: 1, textAlign: 'center', fontFamily: fonts.bold, fontSize: 16, lineHeight: 22 },
  eyebrow: { color: colors.green, fontSize: 10, letterSpacing: 1.5, lineHeight: 16 },
  spacer: { width: 44, height: 44 },
});
