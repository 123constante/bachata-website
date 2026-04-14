import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

// ---------------------------------------------------------------------------
// INTEGRATION NOTE — backend contract pending type regeneration
// ---------------------------------------------------------------------------
// This hook calls the Supabase RPC `get_public_promo_codes`.
//
// Status: the RPC exists on the live Supabase instance (created by the admin
// dashboard system) but is NOT yet reflected in src/integrations/supabase/types.ts.
// The `(supabase as any)` cast is the established repo pattern for RPCs that
// pre-date a types-file regeneration (see: useUserIds, AuthCallback, CreateDJProfile).
//
// Expected response row shape (per product specification — not yet in generated types):
//   id                 string
//   code               string
//   title              string
//   description        string | null
//   owner_display_name string | null
//   external_url       string | null
//
// Before deploying, regenerate types from the live schema to remove the cast.
// ---------------------------------------------------------------------------

export interface PublicPromoCode {
  id: string;
  code: string;
  title: string;
  description: string | null;
  owner_display_name: string | null;
  external_url: string | null;
}

export const usePublicPromoCodes = () => {
  return useQuery<PublicPromoCode[]>({
    queryKey: ['public-promo-codes'],
    queryFn: async () => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data, error } = await (supabase as any).rpc('get_public_promo_codes');
      if (error) throw error;
      return (data ?? []) as PublicPromoCode[];
    },
    staleTime: 5 * 60 * 1000,
  });
};
