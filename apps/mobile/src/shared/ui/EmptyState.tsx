import type { ReactNode } from 'react';
import { View, StyleSheet } from 'react-native';
import { Coffee } from 'lucide-react-native';
import { AppText } from './AppText';
import { colors } from '@/theme';

interface EmptyStateProps {
  title: string;
  description: string;
  action?: ReactNode;
}
export function EmptyState({ title, description, action }: EmptyStateProps) {
  return (
    <View style={styles.container}>
      <Coffee size={34} color={colors.green} strokeWidth={1.5} />
      <AppText variant="serif" style={styles.text}>
        {title}
      </AppText>
      <AppText variant="caption" style={styles.text}>
        {description}
      </AppText>
      {action}
    </View>
  );
}
const styles = StyleSheet.create({
  container: { paddingVertical: 32, alignItems: 'center', gap: 14 },
  text: { textAlign: 'center' },
});
