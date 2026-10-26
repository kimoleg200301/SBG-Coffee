import { useQuery } from '@tanstack/react-query';
import { useRepositories } from '@/core/RepositoriesProvider';

export function useOrders() {
  const { orders } = useRepositories();
  return useQuery({ queryKey: ['orders'], queryFn: () => orders.list() });
}

export function useOrder(id: string) {
  const { orders } = useRepositories();
  return useQuery({ queryKey: ['orders', id], queryFn: () => orders.get(id), enabled: !!id });
}
