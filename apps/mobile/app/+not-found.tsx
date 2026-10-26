import { useRouter } from 'expo-router';
import { Screen, EmptyState, Button } from '@/shared/ui';

export default function NotFoundScreen() {
  const router = useRouter();
  return (
    <Screen>
      <EmptyState
        title="Здесь пока нет кофе"
        description="Такой страницы не существует. Вернёмся в кофейню?"
        action={<Button label="На главную" onPress={() => router.replace('/')} />}
      />
    </Screen>
  );
}
