import { Stack } from 'expo-router';
import { colors } from '@/theme';

export default function OrdersLayout() {
  return (
    <Stack
      screenOptions={{ headerShown: false, contentStyle: { backgroundColor: colors.cream } }}
    />
  );
}
