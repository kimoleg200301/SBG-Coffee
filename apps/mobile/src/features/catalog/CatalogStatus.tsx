import { ActivityIndicator, StyleSheet, View } from 'react-native';
import { AppText, Button } from '@/shared/ui';
import { colors } from '@/theme';
import { useCatalog } from './useCatalog';

/** Shared status stays visible alongside cached menu/cart prices. */
export function CatalogStatus() {
  const catalog = useCatalog();
  if (catalog.source !== 'api') return null;
  if (!catalog.data) {
    if (!catalog.isError) return (
      <View style={styles.notice} accessibilityLabel="Загружаем меню с сервера">
        <ActivityIndicator color={colors.green} />
        <AppText variant="caption">Загружаем меню…</AppText>
      </View>
    );
    return (
      <View style={styles.notice} accessibilityRole="alert">
        <AppText variant="caption">Не удалось загрузить меню с сервера.</AppText>
        <Button label="Повторить запрос" variant="secondary" loading={catalog.isFetching}
          onPress={() => void catalog.refetch()} />
      </View>
    );
  }
  if (!catalog.isPriceUnconfirmed && !catalog.isFetching) return null;
  return (
    <View style={styles.notice} accessibilityRole={catalog.isError ? 'alert' : undefined}>
      <AppText variant="caption">
        {catalog.isPriceUnconfirmed
          ? 'Показано сохранённое меню. Цены и наличие могли измениться — обновите перед оформлением.'
          : 'Обновляем меню…'}
      </AppText>
      {catalog.isError ? <AppText variant="caption">Нет актуального ответа от сервера. Меню остаётся доступным для просмотра.</AppText> : null}
      {catalog.receivedAt ? <AppText variant="caption">Последнее обновление: {new Date(catalog.receivedAt).toLocaleString('ru-RU')}</AppText> : null}
      {catalog.isPriceUnconfirmed ? <Button label="Обновить меню" variant="secondary" loading={catalog.isFetching}
        onPress={() => void catalog.refetch()} /> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  notice: { backgroundColor: colors.sand, padding: 16, borderRadius: 16, gap: 8 },
});
