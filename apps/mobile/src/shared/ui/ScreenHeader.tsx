import type { ReactNode } from 'react';
import { View, StyleSheet } from 'react-native';
import { AppText } from './AppText';

interface ScreenHeaderProps {
  title: string;
  brand?: boolean;
  action?: ReactNode;
}
export function ScreenHeader({ title, brand, action }: ScreenHeaderProps) {
  return (
    <View style={styles.row}>
      <AppText accessibilityRole="header" variant={brand ? 'brand' : 'title'} style={styles.title}>
        {title}
      </AppText>
      {action}
    </View>
  );
}
const styles = StyleSheet.create({
  row: {
    minHeight: 44,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
  },
  title: { flex: 1 },
});
