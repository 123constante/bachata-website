import { supabase } from '@/integrations/supabase/client';
import { PEOPLE_ROLE_LABEL, type PeopleRole } from '@/modules/organiser/shared/programmeModel';
import { searchPeople, type PersonResult } from '@/modules/organiser/shared/selfServeApi';

/**
 * The people picker shows each person by the name the LINE-UP will show once
 * saved. organiser_search_people_v1 names a teacher by first name + surname, but
 * the line-up reader (resolve_person_v1) shows a teacher's profile display_name
 * first, so "John Otaran" was picked and "Dj O" read back after save. A DJ's
 * search name already prefers the DJ name, as the line-up does.
 */

/** The dancer_profiles columns the line-up name is built from. */
export interface ProfileNames {
  id: string;
  display_name: string | null;
  first_name: string | null;
  surname: string | null;
}

export interface PickerRow {
  id: string;
  /** What the line-up shows after save: the row's name and what is put on the session. */
  name: string;
  /** Role word first, then the full name when the line-up name differs, then the place when known. */
  sublabel: string;
}

const clean = (v: string | null | undefined) => (v ?? '').trim();

export function pickerRow(result: PersonResult, role: PeopleRole, profile?: ProfileNames | null): PickerRow {
  const fullName = profile ? clean(`${clean(profile.first_name)} ${clean(profile.surname)}`) : '';
  const name = role === 'teaching' && profile ? clean(profile.display_name) || fullName || result.name : result.name;
  const known = fullName || (role === 'teaching' ? result.name : '');
  const differs = !!known && known.toLowerCase() !== name.toLowerCase();
  const sublabel = [PEOPLE_ROLE_LABEL[role], differs ? known : null, result.place].filter(Boolean).join(' \u00b7 ');
  return { id: result.id, name, sublabel };
}

/** The search, then ONE read of the line-up names for its results. A failed read keeps the search names. */
export async function searchPickerRows(term: string, role: PeopleRole): Promise<PickerRow[]> {
  const results = await searchPeople(term, role);
  if (results.length === 0) return [];
  let byId = new Map<string, ProfileNames>();
  try {
    const { data, error } = await supabase
      .from('dancer_profiles')
      .select('id, display_name, first_name, surname')
      .in('id', results.map((r) => r.id));
    if (!error && Array.isArray(data)) byId = new Map((data as ProfileNames[]).map((p) => [p.id, p]));
  } catch {
    // keep the search names
  }
  return results.map((r) => pickerRow(r, role, byId.get(r.id)));
}

export const pickerQueryKey = (role: PeopleRole, term: string) => ['organiser-people-picker', role, term] as const;
