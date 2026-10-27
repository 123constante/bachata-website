import { supabase } from '@/integrations/supabase/client';
import { NOT_DEACTIVATED } from '@/lib/notDeactivatedFilter';
import { fetchOrganiserDirectoryHiddenIds, withoutHiddenOrganisers } from '@/lib/organiserDirectoryHiddenIds';

/* eslint-disable @typescript-eslint/no-explicit-any */

// The /organisers directory list (queryKey `entities-organisers`), lifted out of
// src/pages/Organisers.tsx so it can be tested without rendering the page.
// Hidden self-started pages (D3) are subtracted here via the shared helper.

export type OrgRow = {
  id: string;
  slug: string | null;
  name: string;
  avatar_url: string | null;
  bio: string | null;
  organisation_category: string | null;
  city_id?: string;
  cities?: { name: string } | null;
};

export async function fetchDirectoryOrganisers(): Promise<OrgRow[]> {
  const [{ data: rows, error }, hiddenIds] = await Promise.all([
    supabase
      .from('organiser_profiles')
      .select('id, slug, name, avatar_url, bio, organisation_category, city_id')
      .not(...NOT_DEACTIVATED)
      .order('name'),
    fetchOrganiserDirectoryHiddenIds(supabase),
  ]);
  if (error) throw error;
  const data = withoutHiddenOrganisers((rows ?? []) as any[], hiddenIds);

  if (data.length > 0) {
    const cityIds = [...new Set(data.map((o) => o.city_id).filter(Boolean))];
    let cityMap: Record<string, { name: string }> = {};
    if (cityIds.length > 0) {
      const { data: cities } = await supabase
        .from('cities')
        .select('id, name')
        .in('id', cityIds);
      if (cities) {
        cityMap = Object.fromEntries((cities as any[]).map((c) => [c.id, { name: c.name }]));
      }
    }
    return data.map((org) => ({
      ...org,
      cities: org.city_id ? cityMap[org.city_id] : null,
    })) as OrgRow[];
  }
  return data as OrgRow[];
}
