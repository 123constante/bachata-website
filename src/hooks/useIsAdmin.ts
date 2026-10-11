import { useQuery } from '@tanstack/react-query';
import { useAuth } from '@/hooks/useAuth';
import { adminCheckQueryKey, fetchIsAdmin } from '@/modules/admin-organisers/adminApi';

/**
 * THE admin check for the website: admin_is_admin() over is_admin(). Never
 * profiles.is_admin (legacy, a different definition). The server re-checks on
 * every admin RPC, so this only decides what to show.
 */
export function useIsAdmin() {
  const { user, authStatus } = useAuth();
  const query = useQuery({
    queryKey: adminCheckQueryKey(user?.id),
    queryFn: fetchIsAdmin,
    enabled: authStatus === 'ready' && !!user,
    staleTime: 5 * 60 * 1000,
  });
  return {
    isAdmin: query.data === true,
    isPending: authStatus === 'resolving' || (!!user && query.isPending),
    isError: query.isError,
    refetch: query.refetch,
    signedIn: !!user,
  };
}
