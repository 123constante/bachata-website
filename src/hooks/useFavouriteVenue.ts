import { useCallback } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { useToast } from '@/hooks/use-toast';

/**
 * useFavouriteVenue — server-backed venue Save button state.
 *
 * Decided 2026-04-30 (Ricky): saves follow the user's account, not
 * localStorage. Wraps the 4 SECURITY-INVOKER RPCs from migration
 * `20260430210000_user_venue_favourites_v1.sql`:
 *   - is_venue_favourited_v1 (read)
 *   - add_favourite_venue_v1 (toggle on)
 *   - remove_favourite_venue_v1 (toggle off)
 *   - list_my_favourite_venues_v1 (used by other surfaces)
 *
 * Anonymous users: the read still returns false (RPC returns false
 * when auth.uid() is null), and clicking Save shows a toast asking
 * them to sign in. We don't open a modal here — the sign-in route
 * already exists at /auth, so a deep-link toast is the cheapest
 * "graceful degradation" until a proper auth modal lands.
 *
 * Mutations are optimistic: the button flips state instantly and
 * rolls back on error.
 */
export const useFavouriteVenue = (venueId: string | null | undefined) => {
  const { user, isLoading: authLoading } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const queryKey = ['venue-favourited', venueId, user?.id ?? null];

  const { data: isFavourited = false, isLoading: queryLoading } = useQuery({
    queryKey,
    queryFn: async () => {
      if (!venueId || !user) return false;
      const { data, error } = await supabase.rpc(
        'is_venue_favourited_v1' as never,
        { p_venue_id: venueId } as never,
      );
      if (error) {
        console.warn('[useFavouriteVenue] is_venue_favourited_v1 failed', error);
        return false;
      }
      return Boolean(data);
    },
    enabled: !!venueId && !!user && !authLoading,
    staleTime: 30 * 1000,
  });

  const mutation = useMutation({
    mutationFn: async (next: boolean) => {
      if (!venueId) throw new Error('no_venue');
      const fn = next ? 'add_favourite_venue_v1' : 'remove_favourite_venue_v1';
      const { error } = await supabase.rpc(fn as never, { p_venue_id: venueId } as never);
      if (error) throw error;
      return next;
    },
    onMutate: async (next) => {
      await queryClient.cancelQueries({ queryKey });
      const prev = queryClient.getQueryData<boolean>(queryKey);
      queryClient.setQueryData(queryKey, next);
      return { prev };
    },
    onError: (err, _next, ctx) => {
      if (ctx?.prev !== undefined) queryClient.setQueryData(queryKey, ctx.prev);
      toast({
        title: 'Could not save',
        description: 'Please try again in a moment.',
        variant: 'destructive',
      });
      console.error('[useFavouriteVenue] mutation failed', err);
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey });
      queryClient.invalidateQueries({ queryKey: ['my-favourite-venues'] });
    },
  });

  const toggle = useCallback(() => {
    if (authLoading) return;
    if (!user) {
      toast({
        title: 'Sign in to save venues',
        description: 'Saved venues follow your account across devices.',
      });
      return;
    }
    if (!venueId) return;
    mutation.mutate(!isFavourited);
  }, [authLoading, user, venueId, isFavourited, mutation, toast]);

  return {
    isFavourited,
    isLoading: queryLoading || authLoading,
    isPending: mutation.isPending,
    canSave: !!user,
    toggle,
  };
};
