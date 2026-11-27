import { supabase } from "@/integrations/supabase/client";
import { withPublicNames } from "@/lib/publicDancerNames";
import { renderPublicName } from "@/lib/publicName";
import { flags } from "@/lib/featureFlags";
import { hrefFor } from "@/lib/searchEntities";
import { parseBadges, type PersonBadge } from "@/modules/person-page/badges";
import { dancerHref, onlyDancers } from "@/components/dancers/dancerListModel";
import { sortDjsUpcomingFirst, type DjListRow } from "@/components/dj/djListModel";

export type PeopleRow = { name: string; href: string };

const MAX_ROWS = 200;
const BADGE_CHUNK = 300;

// Same read as src/pages/Dancers.tsx fetchDancers, then the same onlyDancers
// filter (with the page's "empty badges = show unfiltered" fallback). Never throws.
export async function loadDancerRows(): Promise<PeopleRow[]> {
  try {
    const { data, error } = await supabase
      .from("dancer_profiles")
      .select("id, first_name, avatar_url, nationality, dance_role, cities!based_city_id(name), dancing_role_details(favorite_styles, dance_started_year, looking_for_partner)")
      .or("is_active.is.null,is_active.eq.true")
      .order("created_at", { ascending: false });
    if (error) throw error;
    const dancers = await withPublicNames(data || []);
    let badges = new Map<string, PersonBadge>();
    try {
      const rpc = supabase.rpc.bind(supabase) as unknown as (
        fn: string,
        args: Record<string, unknown>,
      ) => Promise<{ data: unknown; error: { message: string } | null }>;
      const ids = Array.from(new Set(dancers.map((d) => d.id).filter(Boolean)));
      const chunks: string[][] = [];
      for (let i = 0; i < ids.length; i += BADGE_CHUNK) chunks.push(ids.slice(i, i + BADGE_CHUNK));
      const parts = await Promise.all(
        chunks.map(async (p_ids) => {
          const res = await rpc("get_public_people_badges_v1", { p_ids });
          if (res.error) throw new Error(res.error.message);
          return parseBadges(res.data);
        }),
      );
      for (const m of parts) m.forEach((v, k) => badges.set(k, v));
    } catch {
      badges = new Map();
    }
    const shown = badges.size === 0 && dancers.length > 0 ? dancers : onlyDancers(dancers, badges);
    return shown.slice(0, MAX_ROWS).map((d) => ({
      name: renderPublicName(d, "Dancer"),
      href: dancerHref(d.id, flags.teacherDetail),
    }));
  } catch {
    return [];
  }
}

// Same RPC call as src/pages/DJs.tsx, same sort and name resolver.
export async function loadDjRows(): Promise<PeopleRow[]> {
  try {
    const { data, error } = await supabase.rpc("list_public_djs_v1", {
      p_city_id: null,
      p_limit: MAX_ROWS,
    });
    if (error) throw error;
    const djs = ((data ?? []) as unknown) as Array<DjListRow & { id: string }>;
    return sortDjsUpcomingFirst(djs)
      .slice(0, MAX_ROWS)
      .map((dj) => ({ name: renderPublicName(dj, "DJ"), href: hrefFor("dj", dj.id) }));
  } catch {
    return [];
  }
}
