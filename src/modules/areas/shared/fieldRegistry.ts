// The ONE role field registry (teacher + DJ). Built from the pinned
// save_my_role_v1 writable-key list; a test asserts the key sets are equal.
// Every field is optional (owner decision: "offered in full, all optional"), EXCEPT the
// go-live keys (invite A1, owner 2026-10-23): those are named by the one go-live mapping
// (organiser/shared/goLiveKeys) and say so in the same words as every required step.
import { isRoleGoLiveField } from '@/modules/organiser/shared/goLiveKeys';

export { REQUIRED_HINT } from '@/modules/organiser/shared/goLiveKeys';

export type Role = 'teacher' | 'dj';
export const ROLES: readonly Role[] = ['teacher', 'dj'];

export type FieldKind = 'years' | 'list' | 'yesno' | 'text' | 'longtext' | 'link';

export interface RoleField {
  key: string;
  label: string;
  /** The wizard's one question for this field. */
  question: string;
  kind: FieldKind;
  /** Max characters (text, link, list items). */
  max?: number;
  help?: string;
  /** Form group heading. */
  group: string;
}

export const LIST_MAX_ITEMS = 20;
export const LIST_ITEM_MAX = 80;
export const YEARS_MIN = 0;
export const YEARS_MAX = 80;

export const ROLE_NAME: Record<Role, string> = { teacher: 'Teacher', dj: 'DJ' };
/** Mid-sentence form: "your teacher details", "your DJ details". */
export const ROLE_NOUN: Record<Role, string> = { teacher: 'teacher', dj: 'DJ' };

export const ROLE_FIELDS: Record<Role, readonly RoleField[]> = {
  teacher: [
    { key: 'years_teaching', label: 'Years teaching', question: 'How many years have you been teaching?', kind: 'years', group: 'About your teaching', help: 'A whole number from 0 to 80.' },
    { key: 'teaching_styles', label: 'Styles you teach', question: 'Which styles do you teach?', kind: 'list', max: LIST_ITEM_MAX, group: 'About your teaching', help: 'For example Sensual, Dominican or Moderna.' },
    { key: 'partner_role', label: 'Role you dance when teaching', question: 'Which role do you dance when you teach?', kind: 'text', max: 80, group: 'About your teaching', help: 'For example Leader, Follower or Both.' },
    { key: 'offers_private', label: 'Private lessons', question: 'Do you give private lessons?', kind: 'yesno', group: 'Private lessons' },
    { key: 'private_lesson_types', label: 'Kinds of private lesson', question: 'What kinds of private lesson do you give?', kind: 'list', max: LIST_ITEM_MAX, group: 'Private lessons', help: 'For example Couples, Solo or Wedding dance.' },
    { key: 'private_lesson_locations', label: 'Where you teach privately', question: 'Where do you give private lessons?', kind: 'list', max: LIST_ITEM_MAX, group: 'Private lessons', help: 'Areas or studios, one at a time.' },
    { key: 'private_travel_distance', label: 'How far you travel', question: 'How far will you travel for a private lesson?', kind: 'text', max: 80, group: 'Private lessons', help: 'For example Up to 10 miles.' },
  ],
  dj: [
    { key: 'dj_name', label: 'DJ name', question: 'What is your DJ name?', kind: 'text', max: 80, group: 'About your DJing' },
    { key: 'genres', label: 'Music you play', question: 'What music do you play?', kind: 'list', max: LIST_ITEM_MAX, group: 'About your DJing', help: 'For example Bachata, Kizomba or Salsa.' },
    { key: 'soundcloud', label: 'SoundCloud link', question: 'What is your SoundCloud link?', kind: 'link', max: 300, group: 'Links and pricing' },
    { key: 'mixcloud', label: 'Mixcloud link', question: 'What is your Mixcloud link?', kind: 'link', max: 300, group: 'Links and pricing' },
    { key: 'pricing', label: 'Pricing', question: 'How do you price a booking?', kind: 'longtext', max: 280, group: 'Links and pricing', help: 'Up to 280 characters. New lines are fine.' },
  ],
};

/** True when the field must be filled before the person's events can go live (the one mapping). */
export const isGoLiveField = (role: Role, key: string): boolean => isRoleGoLiveField(role, key);

/** The line over the details: which ones go live needs, then that the rest are optional (W2 walk fix 3). */
export const ROLE_REQUIRED_LEAD: Record<Role, string> = {
  teacher: 'The styles you teach are needed before your events can go live. Every other detail is optional.',
  dj: 'Your DJ name and the music you play are needed before your events can go live. Every other detail is optional.',
};

export function roleFieldKeys(role: Role): string[] {
  return ROLE_FIELDS[role].map((f) => f.key);
}

export function roleField(role: Role, key: string): RoleField | undefined {
  return ROLE_FIELDS[role].find((f) => f.key === key);
}
