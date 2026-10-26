import { queryOptions } from '@tanstack/react-query';
import type { CatalogRepository, CatalogSnapshot } from '../../data/repositories';

export function catalogQueryKey(repository: CatalogRepository) {
  return ['catalog', repository.cacheKey ?? repository.source ?? 'custom'] as const;
}

export function catalogQueryOptions(repository: CatalogRepository) {
  return queryOptions<CatalogSnapshot>({
    queryKey: catalogQueryKey(repository),
    queryFn: async () => ({ products: await repository.list(), receivedAt: Date.now(), restored: false }),
    // Even a recently persisted snapshot must be checked again after relaunch.
    staleTime: (current) => current.state.data?.restored ? 0 : 60_000,
    refetchOnMount: true,
    networkMode: 'always',
  });
}
