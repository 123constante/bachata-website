import { renderPublicName } from '@/lib/publicName';
import type { MyDancerEdit } from './types';

/**
 * The person's name as the PUBLIC page shows it (review S6): Me, Edit and the
 * avatar initial read this, never their own `display_name || first_name`.
 * Mirrors get_public_dancer_names_v1 (_public_surname_v1, _public_display_name_v1,
 * _public_person_name_v1, read-only from prod 2026-10-15) and resolves through
 * src/lib/publicName.ts renderPublicName, the public readers' authority:
 * first name + surname (the surname dropped while hidden), else the display
 * name (cut to its first word while the surname is hidden).
 */
type NameFields = Pick<MyDancerEdit, 'display_name' | 'first_name' | 'surname' | 'hide_surname_publicly'>;

const clean = (s: string | null | undefined): string | null => (s && s.trim() !== '' ? s.trim() : null);

export const NO_NAME_YET = 'No name yet';

export const ownPublicName = (p: NameFields): string => {
  const hide = p.hide_surname_publicly === true;
  const surname = hide ? null : clean(p.surname);
  const display = hide ? clean(p.first_name) ?? clean((p.display_name ?? '').trim().split(' ')[0]) : clean(p.display_name);
  const personName = clean([clean(p.first_name) ?? '', surname ?? ''].join(' ')) ?? display;
  return renderPublicName({ public_name: personName }, NO_NAME_YET);
};

/** The avatar's letter: the first letter of that same name, or "?" when there is none. */
export const ownInitial = (p: NameFields): string => {
  const name = ownPublicName(p);
  return name === NO_NAME_YET ? '?' : name.charAt(0).toUpperCase();
};
