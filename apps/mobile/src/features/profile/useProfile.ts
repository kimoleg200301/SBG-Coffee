import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useRepositories } from '@/core/RepositoriesProvider';
import type { ProfileChanges } from '@/domain/profile';

const profileKey = ['profile'] as const;

export function useProfile() {
  const { profile } = useRepositories();
  return useQuery({ queryKey: profileKey, queryFn: () => profile.get() });
}

export function useUpdateProfile() {
  const { profile } = useRepositories();
  const client = useQueryClient();
  return useMutation({
    mutationFn: (changes: ProfileChanges) => profile.update(changes),
    onSuccess: (next) => {
      client.setQueryData(profileKey, next);
    },
  });
}

export function useResetProfile() {
  const { profile } = useRepositories();
  const client = useQueryClient();
  return useMutation({
    mutationFn: () => profile.reset(),
    onSuccess: (next) => {
      client.setQueryData(profileKey, next);
    },
  });
}
