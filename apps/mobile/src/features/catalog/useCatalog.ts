import { useQuery } from '@tanstack/react-query';
import { useRepositories } from '@/core/RepositoriesProvider';
import { useCatalogHydrating } from '@/core/CatalogCacheProvider';
import { catalogQueryOptions } from './catalogQuery';

export function useCatalog() {
  const { catalog } = useRepositories();
  const hydrating = useCatalogHydrating();
  const query = useQuery({
    ...catalogQueryOptions(catalog),
    enabled: !hydrating,
  });
  return {
    ...query,
    data: query.data?.products,
    receivedAt: query.data?.receivedAt,
    source: catalog.source ?? 'mock',
    isPriceUnconfirmed: catalog.source === 'api' &&
      (!query.data || query.data.restored || query.isStale || query.isError),
  };
}
