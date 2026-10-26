import { useEffect, useState, type PropsWithChildren } from 'react';
import { AppState, Platform } from 'react-native';
import { focusManager, QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { appRepositories } from '@/data/appRepositories';
import type { AppRepositories } from '@/data/repositories';
import { RepositoriesProvider } from './RepositoriesProvider';
import { FavoritesProvider } from './FavoritesProvider';
import { CartProvider } from './CartProvider';
import { CatalogCacheProvider } from './CatalogCacheProvider';

export function AppProviders({
  children,
  repositories = appRepositories,
}: PropsWithChildren<{ repositories?: AppRepositories }>) {
  const [client] = useState(
    () => new QueryClient({ defaultOptions: { queries: { staleTime: 60_000, retry: 1 } } }),
  );
  useEffect(() => {
    if (Platform.OS === 'web') return;
    const subscription = AppState.addEventListener('change', (state) => {
      focusManager.setFocused(state === 'active');
    });
    return () => subscription.remove();
  }, []);
  return (
    <SafeAreaProvider>
      <RepositoriesProvider repositories={repositories}>
        <QueryClientProvider client={client}>
          <CatalogCacheProvider>
            <FavoritesProvider>
              <CartProvider>{children}</CartProvider>
            </FavoritesProvider>
          </CatalogCacheProvider>
        </QueryClientProvider>
      </RepositoriesProvider>
    </SafeAreaProvider>
  );
}
