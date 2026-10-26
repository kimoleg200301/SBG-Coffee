import type { BottomTabBarProps } from 'expo-router/tabs';
import { Home, Coffee, Gift, UserRound, ShoppingBag, type LucideIcon } from 'lucide-react-native';
import { useRouter } from 'expo-router';
import { useCart } from '@/core/CartProvider';
import { formatPrice } from '@/domain/catalog';
import { Pressable, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { AppText } from './AppText';
import { Button } from './Button';
import { colors, fonts } from '@/theme';

const items: Record<string, { label: string; icon: LucideIcon }> = {
  index: { label: 'Главная', icon: Home },
  menu: { label: 'Меню', icon: Coffee },
  loyalty: { label: 'Карта', icon: Gift },
  profile: { label: 'Профиль', icon: UserRound },
};

export function TabBar({ state, emitter, navigateToTab }: BottomTabBarProps) {
  const insets = useSafeAreaInsets();
  const cart = useCart();
  const router = useRouter();
  const activeName = state.routes[state.index]?.name;
  return (
    <View style={[styles.container, { paddingBottom: Math.max(insets.bottom, 12) }]}>
      {cart.itemCount > 0 ? (
        <Button
          label={`Корзина · ${cart.itemCount} шт. · ${formatPrice(cart.totalKzt)}`}
          icon={ShoppingBag}
          onPress={() => router.push('/cart')}
          style={styles.cart}
        />
      ) : null}
      <View style={styles.bar} accessibilityRole="tablist">
        {state.routes.map((route, index) => {
          const item = items[route.name];
          if (!item) return null;
          const selected =
            state.index === index || (route.name === 'profile' && activeName === 'orders');
          const Icon = item.icon;
          return (
            <Pressable
              key={route.key}
              accessibilityRole="tab"
              accessibilityLabel={item.label}
              accessibilityState={{ selected }}
              onPress={() => {
                const event = emitter.emit({
                  type: 'tabPress',
                  target: route.key,
                  canPreventDefault: true,
                });
                if ((!selected || activeName === 'orders') && !event.defaultPrevented)
                  navigateToTab(route.key);
              }}
              onLongPress={() => emitter.emit({ type: 'tabLongPress', target: route.key })}
              style={({ pressed }) => [
                styles.item,
                selected && styles.active,
                pressed && styles.pressed,
              ]}
            >
              <Icon color={selected ? colors.green : colors.muted} size={23} strokeWidth={1.8} />
              <AppText style={[styles.label, selected && styles.activeLabel]}>{item.label}</AppText>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}
const styles = StyleSheet.create({
  cart: { marginBottom: 10, minHeight: 50 },
  container: { backgroundColor: colors.cream, paddingHorizontal: 16, paddingTop: 8 },
  bar: {
    borderRadius: 36,
    minHeight: 68,
    padding: 6,
    borderWidth: 1,
    borderColor: colors.line,
    backgroundColor: colors.surface,
    flexDirection: 'row',
    gap: 4,
  },
  item: {
    flex: 1,
    minHeight: 54,
    paddingVertical: 6,
    gap: 3,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 30,
  },
  active: { backgroundColor: colors.sage },
  label: { color: colors.muted, fontSize: 10, lineHeight: 14 },
  activeLabel: { fontFamily: fonts.bold, color: colors.green },
  pressed: { opacity: 0.7 },
});
