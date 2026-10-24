// The ONE go-live mapping (W2 walk fixes 1, 3, 4, 5). Every screen that names,
// links, counts or asks a go-live key reads it from here: the Go live list on
// the event, the Go live flow's "Still to do", Home's to-do row, the profile
// wizard, and the teacher / DJ details editors. Pure and import-free (types
// only), so the areas module and Home's jobs read it without the api client.
// The codes and sections are the server's (_series_go_live_check_p5, prod
// 2026-10-24); a code missing here still shows, as UNKNOWN_ITEM_LABEL.
import type { GoLiveCheck, GoLiveItem } from './goLiveCheck';

/** The required-step reason, the same words on every screen that asks a go-live key. */
export const REQUIRED_HINT = 'Needed before your events can go live.';

/** A code the map does not know yet still shows, in plain words, never as the code. */
export const UNKNOWN_ITEM_LABEL = 'Something else on the event';

export interface BlockerDef {
  /** The action, because the list is a to-do (D49, D82). */
  label: string;
  /** The server's section: goLiveFixHref turns it into the screen that fixes it. */
  section: string;
  /** The same fact as another code the server sends too: shown once, under that code. */
  sameAs?: string;
}

/** Every event code the server sends (event_missing), in its order, plus the recommended ticket link. */
export const GO_LIVE_BLOCKERS: Readonly<Record<string, BlockerDef>> = {
  venue: { label: 'Add a venue', section: 'venue' },
  city: { label: 'Add a city', section: 'venue' },
  upcoming_date: { label: 'Add a date', section: 'dates' },
  session: { label: 'Add a session with a title, start and end', section: 'programme' },
  cover: { label: 'Upload a flyer', section: 'cover' },
  description: { label: 'Write a description', section: 'about' },
  name: { label: 'Add an event name', section: 'basics' },
  country: { label: 'Pick a city with a country', section: 'venue' },
  organiser: { label: 'Link an active organiser', section: 'organisers' },
  no_session_first_date: { label: 'Give the first day a session with a start and end time', section: 'programme' },
  first_date_past: { label: 'Move the first date to today or later', section: 'dates' },
  bad_session_times: { label: 'Fix a session time: each needs a start and a different end', section: 'programme' },
  no_payment: { label: 'Say how dancers pay', section: 'payment' },
  no_flyer: { label: 'Upload a flyer', section: 'cover', sameAs: 'cover' },
  ticket_link: { label: 'Add a ticket link', section: 'tickets' },
};

/** Every section the server names; each one has a screen that fixes it (goLiveFixHref). */
export const GO_LIVE_SECTIONS: readonly string[] = ['venue', 'basics', 'about', 'tickets', 'dates', 'programme', 'cover', 'organisers', 'payment'];

export const goLiveLabel = (code: string): string =>
  Object.prototype.hasOwnProperty.call(GO_LIVE_BLOCKERS, code) ? GO_LIVE_BLOCKERS[code].label : UNKNOWN_ITEM_LABEL;

/** The event blockers to SHOW: one row per fact (no_flyer is cover's twin, so it shows once). */
export function eventBlockers(items: readonly GoLiveItem[]): GoLiveItem[] {
  const codes = new Set(items.map((i) => i.code));
  const seen = new Set<string>();
  return items.filter((i) => {
    const twin = GO_LIVE_BLOCKERS[i.code]?.sameAs;
    if (twin && codes.has(twin)) return false;
    if (seen.has(i.code)) return false;
    seen.add(i.code);
    return true;
  });
}

// ---- the profile keys (teacher / DJ, invite A1) ----------------------------------------------

export type RoleArea = 'teacher' | 'dj';

/** One go-live key of a role: the server's key (go-live check), the role editor's field, and its to-do words. */
export interface RoleGoLiveKey { key: string; field: string; todo: string }

/** _role_required_keys_v1, prod 2026-10-24: teacher teaching_styles; dj dj_name and genres (key dj_genres). */
export const ROLE_GO_LIVE_KEYS: Readonly<Record<RoleArea, readonly RoleGoLiveKey[]>> = {
  teacher: [{ key: 'teaching_styles', field: 'teaching_styles', todo: 'Your teacher page: add the styles you teach' }],
  dj: [
    { key: 'dj_name', field: 'dj_name', todo: 'Your DJ page: add your DJ name' },
    { key: 'dj_genres', field: 'genres', todo: 'Your DJ page: add the music you play' },
  ],
};

/** True when this role field must be filled before the person's events can go live. */
export const isRoleGoLiveField = (role: RoleArea, field: string): boolean => ROLE_GO_LIVE_KEYS[role].some((k) => k.field === field);

/** The go-live key -> the role editor's field (the DJ key `dj_genres` is the field `genres`). */
export const ROLE_GO_LIVE_FIELD: Readonly<Record<string, string>> = Object.fromEntries(
  (Object.values(ROLE_GO_LIVE_KEYS) as RoleGoLiveKey[][]).flat().map((k) => [k.key, k.field]),
);

const humanise = (f: string) => f.replace(/_/g, ' ');

/** A role gap's to-do words; a key not in the map still reads as words. */
export const roleGapText = (role: RoleArea, key: string): string =>
  ROLE_GO_LIVE_KEYS[role].find((k) => k.key === key)?.todo ?? `Your ${role === 'dj' ? 'DJ' : 'teacher'} page: add your ${humanise(key)}`;

// ---- the count ---------------------------------------------------------------------------------

export const profileFieldsLeft = (c: GoLiveCheck): number => c.profileMissing.reduce((n, p) => n + p.fields.length, 0);

/** The profile row shows only when the rule applies to this person and something is left. */
export const showsProfileRow = (c: GoLiveCheck): boolean => c.profileRuleApplies && profileFieldsLeft(c) > 0;

/** How many rows the event's Go live list shows: each event blocker once, plus the one profile row. Home quotes this. */
export const goLiveLeft = (c: GoLiveCheck): number => eventBlockers(c.eventMissing).length + (showsProfileRow(c) ? 1 : 0);

/** The ONE "N things left" formatter (D82): the card's count line. */
export const thingsLeftText = (n: number): string => (n === 1 ? '1 thing left' : `${n} things left`);

// ---- the wizard's order ------------------------------------------------------------------------

/**
 * The questions in the order to ask them: every required one first (in the server's
 * order), then the optional ones. `requiredOnly` (the wizard was opened from an
 * event, with returnTo): the required ones and nothing else.
 */
export function askOrder<T extends { required: boolean }>(steps: readonly T[], requiredOnly = false): T[] {
  const req = steps.filter((s) => s.required);
  return requiredOnly ? req : [...req, ...steps.filter((s) => !s.required)];
}
