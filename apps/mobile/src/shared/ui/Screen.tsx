import type { PropsWithChildren } from 'react';
import { ScrollView, StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { colors } from '@/theme';

interface ScreenProps extends PropsWithChildren {
  contentContainerStyle?: StyleProp<ViewStyle>;
  scroll?: boolean;
}

export function Screen({ children, contentContainerStyle, scroll = true }: ScreenProps) {
  const insets = useSafeAreaInsets();
  const content = [styles.content, contentContainerStyle];
  return (
    <View style={[styles.frame, { paddingTop: insets.top }]}>
      {scroll ? (
        <ScrollView
          style={styles.scroll}
          contentContainerStyle={content}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
          keyboardDismissMode="on-drag"
        >
          {children}
        </ScrollView>
      ) : (
        <View style={content}>{children}</View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  frame: { flex: 1, backgroundColor: colors.cream },
  scroll: { flex: 1 },
  content: { paddingTop: 16, paddingHorizontal: 20, paddingBottom: 24, gap: 24, flexGrow: 1 },
});
