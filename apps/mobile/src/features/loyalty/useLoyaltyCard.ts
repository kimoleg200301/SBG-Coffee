import { useQuery } from '@tanstack/react-query';

import { useRepositories } from '@/core/RepositoriesProvider';

export function useLoyaltyCard() {
  const repositories = useRepositories();

  return useQuery({
    queryKey: ['loyalty', 'card'],
    queryFn: () => repositories.loyalty.getCard(),
  });
}
