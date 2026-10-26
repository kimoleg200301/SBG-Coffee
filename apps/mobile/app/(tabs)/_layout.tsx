import { Tabs } from 'expo-router';
import { TabBar } from '@/shared/ui/TabBar';
import { colors } from '@/theme';

export default function TabsLayout() {
  return (
    <Tabs
      tabBar={(props) => <TabBar {...props} />}
      screenOptions={{
        headerShown: false,
        sceneStyle: { backgroundColor: colors.cream },
        animation: 'fade',
      }}
    >
      <Tabs.Screen name="index" options={{ title: 'Главная' }} />
      <Tabs.Screen name="menu" options={{ title: 'Меню' }} />
      <Tabs.Screen name="loyalty" options={{ title: 'Карта' }} />
      <Tabs.Screen name="profile" options={{ title: 'Профиль' }} />
      <Tabs.Screen name="orders" options={{ title: 'Мои заказы' }} />
    </Tabs>
  );
}
