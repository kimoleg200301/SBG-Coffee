import { createContext, useContext, type PropsWithChildren } from 'react';
import type { AppRepositories } from '@/data/repositories';

const RepositoriesContext = createContext<AppRepositories | null>(null);

export function RepositoriesProvider({
  repositories,
  children,
}: PropsWithChildren<{ repositories: AppRepositories }>) {
  return (
    <RepositoriesContext.Provider value={repositories}>{children}</RepositoriesContext.Provider>
  );
}

export function useRepositories(): AppRepositories {
  const repositories = useContext(RepositoriesContext);
  if (!repositories) throw new Error('RepositoriesProvider is missing');
  return repositories;
}
