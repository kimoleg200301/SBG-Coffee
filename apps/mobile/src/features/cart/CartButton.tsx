import { ShoppingBag } from 'lucide-react-native';
import { useRouter } from 'expo-router';
import { StyleSheet, View } from 'react-native';
import { useCart } from '@/core/CartProvider';
import { AppText, IconButton } from '@/shared/ui';
import { colors, fonts } from '@/theme';

export function CartButton() {
  const cart = useCart();
  const router = useRouter();
  return (
    <View>
      <IconButton
        icon={ShoppingBag}
        label={`Открыть корзину, товаров: ${cart.itemCount}`}
        onPress={() => router.push('/cart')}
      />
      {cart.itemCount > 0 ? (
        <View pointerEvents="none" style={styles.badge}>
          <AppText style={styles.count}>{cart.itemCount}</AppText>
        </View>
      ) : null}
    </View>
  );
}
const styles = StyleSheet.create({
  badge: {
    position: 'absolute',
    right: -3,
    top: -3,
    minWidth: 19,
    height: 19,
    paddingHorizontal: 4,
    borderRadius: 10,
    backgroundColor: colors.green,
    justifyContent: 'center',
    alignItems: 'center',
  },
  count: { color: colors.cream, fontFamily: fonts.bold, fontSize: 10, lineHeight: 14 },
});
