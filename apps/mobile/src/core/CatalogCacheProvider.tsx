import { createContext, useContext, useEffect, useState, type PropsWithChildren } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import type { CatalogRepository } from '@/data/repositories';
import { useRepositories } from './RepositoriesProvider';
import { catalogQueryKey } from '@/features/catalog/catalogQuery';

const CatalogHydratingContext = createContext(false);

export function CatalogCacheProvider({ children }: PropsWithChildren) {
  const { catalog } = useRepositories();
  const client = useQueryClient();
  const [restoredRepository, setRestoredRepository] = useState<CatalogRepository | null>(null);
  const hydrating = Boolean(catalog.loadCached) && restoredRepository !== catalog;

  useEffect(() => {
    let active = true;
    if (!catalog.loadCached) return;
    void catalog.loadCached().then((snapshot) => {
      if (!active) return;
      if (snapshot && !client.getQueryData(catalogQueryKey(catalog))) {
        // Restored records retain their age and remain explicitly unconfirmed.
        client.setQueryData(catalogQueryKey(catalog), snapshot, { updatedAt: snapshot.receivedAt });
      }
    }).catch(() => {}).finally(() => {
      if (active) setRestoredRepository(catalog);
    });
    return () => { active = false; };
  }, [catalog, client]);

  return <CatalogHydratingContext.Provider value={hydrating}>{children}</CatalogHydratingContext.Provider>;
}

export function useCatalogHydrating() {
  return useContext(CatalogHydratingContext);
}
