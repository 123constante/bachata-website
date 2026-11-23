import { supabase } from '@/integrations/supabase/client';
import type { PickerRow } from './peoplePicker';

export const teacherListQueryKey = ['organiser-picker-teacher-list'] as const;

interface TeacherListRow {
  entity_id: string;
  first_name: string | null;
  surname: string | null;
  hide_surname: boolean | null;
  photo_url: string | null;
}

/** Every public teacher (existing read-only RPC, no city filter), as picker rows. */
export async function fetchAllTeacherRows(): Promise<PickerRow[]> {
  const { data, error } = await supabase.rpc('get_public_teachers_list_v1', { p_limit: 200, p_offset: 0 });
  if (error) throw error;
  return ((data ?? []) as TeacherListRow[]).flatMap((r) => {
    const first = (r.first_name ?? '').trim();
    const name = [first, r.hide_surname ? '' : (r.surname ?? '').trim()].filter(Boolean).join(' ');
    return r.entity_id && name ? [{ id: r.entity_id, name, sublabel: '', avatarUrl: (r.photo_url ?? '').trim() || null }] : [];
  });
}

/** Empty-search groups: team teachers first, then everyone else A to Z. Already-on-session ids are dropped. */
export function groupTeachers(rows: PickerRow[], teamIds: ReadonlySet<string>, onIds: ReadonlySet<string>) {
  const free = rows.filter((r) => !onIds.has(r.id));
  const byName = (a: PickerRow, b: PickerRow) => a.name.localeCompare(b.name);
  return {
    team: free.filter((r) => teamIds.has(r.id)).sort(byName),
    all: free.filter((r) => !teamIds.has(r.id)).sort(byName),
  };
}
