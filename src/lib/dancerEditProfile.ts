import type { DanceRoleValue } from "@/lib/auth-otp-routing";
import type { SaveMyDancerProfileInput } from "@/lib/saveMyDancerProfile";

/** The fields the dancer edit screen owns. Photo, bio and social links are a later slice. */
export type DancerEditFields = {
  firstName: string;
  surname: string;
  cityId: string;
  danceRole: DanceRoleValue | "";
  /** null = the column could not be read (the switch is then disabled with a reason). */
  hideSurname: boolean | null;
};

/** Every dancer_profiles column this screen edits, and the form field that edits it. */
export const EDITABLE_COLUMNS = [
  ["first_name", "firstName"],
  ["surname", "surname"],
  ["hide_surname_publicly", "hideSurname"],
  ["based_city_id", "cityId"],
  ["dance_role", "danceRole"],
] as const satisfies readonly (readonly [string, keyof DancerEditFields])[];

export const NOTHING_TO_SAVE = "Nothing to save yet";

/**
 * Only what the person changed, in the shape saveMyDancerProfile takes. null = nothing
 * changed, so no command is sent. An absent key never nulls a column (the live function
 * reads absent as "leave it"). Clearing the surname is an explicit null for that key only.
 */
export const buildDancerEditSave = (initial: DancerEditFields, draft: DancerEditFields): SaveMyDancerProfileInput | null => {
  const input: SaveMyDancerProfileInput = {};
  const first = draft.firstName.trim();
  if (first && first !== initial.firstName.trim()) input.first_name = first;
  const surname = draft.surname.trim();
  if (surname !== initial.surname.trim()) input.surname = surname === "" ? null : surname;
  if (draft.cityId && draft.cityId !== initial.cityId) input.based_city_id = draft.cityId;
  if (draft.danceRole && draft.danceRole !== initial.danceRole) input.dance_role = draft.danceRole;
  if (initial.hideSurname !== null && draft.hideSurname !== null && draft.hideSurname !== initial.hideSurname) {
    input.hide_surname_publicly = draft.hideSurname;
  }
  return Object.keys(input).length > 0 ? input : null;
};

/**
 * Why Save cannot be used right now, or null when it can. The live function keeps the old
 * value when asked for an empty one (COALESCE(NULLIF(x,''), old)), so a name that is set
 * cannot be removed: saying "Saved" for it would be a lie.
 */
export const dancerEditSaveReason = (initial: DancerEditFields, draft: DancerEditFields, isSaving: boolean): string | null => {
  if (isSaving) return "Saving your profile…";
  if (initial.firstName.trim() && !draft.firstName.trim()) return "Your first name can’t be left empty. Type it back to save other changes.";
  if (initial.surname.trim() && !draft.surname.trim()) {
    return "A saved surname can’t be removed here yet. Type it back, or use the switch to hide it from the public.";
  }
  return buildDancerEditSave(initial, draft) ? null : NOTHING_TO_SAVE;
};
