import { supabase } from "@/integrations/supabase/client";
import { buildFullName } from "@/lib/name-utils";
import { DEFAULT_TEACHERS_CITY } from "@/modules/teachers-directory/teachersCity";
import { fetchVendorDirectoryRpc } from "@/hooks/vendor/useVendorDirectory";
import type { VendorPublicCard } from "@/modules/vendor/types";
import type { PeopleRow } from "./peopleListRows";

const MAX_ROWS = 200;

type TeacherRpcRow = {
  entity_id: string;
  first_name: string | null;
  surname: string | null;
  hide_surname: boolean | null;
};

// Same RPC call as src/pages/Teachers.tsx (London list); same name rule as the card.
// Never throws.
export async function loadTeacherRows(): Promise<PeopleRow[]> {
  try {
    const { data, error } = await supabase.rpc("get_public_teachers_list_v1", {
      p_city_slug: DEFAULT_TEACHERS_CITY.slug,
      p_limit: MAX_ROWS,
      p_offset: 0,
    });
    if (error) throw error;
    return ((data ?? []) as TeacherRpcRow[]).slice(0, MAX_ROWS).map((t) => ({
      name: buildFullName(t.first_name ?? "", t.hide_surname ? null : t.surname),
      href: `/teachers/${t.entity_id}`,
    }));
  } catch {
    return [];
  }
}

// Same read as useVendorDirectory page 1 with no search/city/category. Never throws.
export async function loadVendorRows(): Promise<PeopleRow[]> {
  try {
    const { data, error } = await fetchVendorDirectoryRpc({
      query: null,
      cityId: null,
      category: null,
      limit: MAX_ROWS,
      offset: 0,
    });
    if (error) throw error;
    return ((data || []) as VendorPublicCard[]).slice(0, MAX_ROWS).map((v) => ({
      name: v.business_name || "Untitled vendor",
      href: `/vendors/${v.id}`,
    }));
  } catch {
    return [];
  }
}
