/*
 * Organiser guest list inside one night (admin #1577, Option B). Pure: the RPC's jsonb in, plain facts out.
 * Every sentence that appears on more than one screen lives here once.
 */

export type ReadOnlyReason = 'view_only' | 'cancelled' | 'past';
export type GateReason = 'not_signed_in' | 'night_not_found' | 'not_on_team';

export interface GuestEntry {
  id: string;
  firstName: string;
  everyWeek: boolean;
  waitlist: boolean;
  byTeam: boolean;
  checkedIn: boolean;
}

export interface GuestNight {
  occurrenceId: string;
  enabled: boolean;
  capacityMax: number | null;
  cutoffTime: string | null;
  closed: boolean;
  full: boolean;
  past: boolean;
  cancelled: boolean;
}

export interface GuestCounts { names: number; inCount: number; placesLeft: number | null }

export interface GuestListView {
  ok: true;
  role: string;
  canEdit: boolean;
  canCheckIn: boolean;
  readOnly: ReadOnlyReason | null;
  night: GuestNight;
  counts: GuestCounts;
  total: number;
  entries: GuestEntry[];
}
export type GuestRead = GuestListView | { ok: false; reason: string };

/** The RPC pages at most this many rows; the screen asks for this many at a time. */
export const PAGE = 50;

type J = Record<string, unknown>;
const obj = (v: unknown): J => (v && typeof v === 'object' ? (v as J) : {});
const num = (v: unknown, d = 0): number => (typeof v === 'number' && Number.isFinite(v) ? v : d);
const numOrNull = (v: unknown): number | null => (typeof v === 'number' && Number.isFinite(v) ? v : null);
const str = (v: unknown): string => (typeof v === 'string' ? v : '');

export function parseRead(raw: unknown): GuestRead {
  const r = obj(raw);
  if (r.ok !== true) return { ok: false, reason: str(r.reason) || 'unknown' };
  const n = obj(r.night);
  const c = obj(r.counts);
  const ro = r.read_only_reason;
  return {
    ok: true,
    role: str(r.role),
    canEdit: r.can_edit === true,
    canCheckIn: r.can_check_in === true,
    readOnly: ro === 'view_only' || ro === 'cancelled' || ro === 'past' ? ro : null,
    night: {
      occurrenceId: str(n.occurrence_id), enabled: n.enabled === true, capacityMax: numOrNull(n.capacity_max),
      cutoffTime: str(n.cutoff_time) || null, closed: n.closed === true, full: n.full === true,
      past: n.past === true, cancelled: n.cancelled === true,
    },
    counts: { names: num(c.names), inCount: num(c.in), placesLeft: numOrNull(c.places_left) },
    total: num(r.total),
    entries: (Array.isArray(r.entries) ? r.entries : []).map((e) => {
      const x = obj(e);
      return {
        id: str(x.id), firstName: str(x.first_name), everyWeek: x.is_permanent === true, waitlist: x.status === 'waitlist',
        byTeam: x.added_via === 'organiser', checkedIn: typeof x.checked_in_at === 'string' && x.checked_in_at !== '',
      };
    }).filter((e) => e.id),
  };
}

/** Reasons the RPCs give back, said in words. Every one ends with what is true now. */
const REASON_WORDS: Record<string, string> = {
  not_signed_in: 'Sign in again, then try. Nothing was changed.',
  night_not_found: 'This night is not on the list any more. Nothing was changed.',
  not_on_team: 'You are not on this page\u2019s team. Nothing was changed.',
  view_only: 'Contributors can look at the list but cannot change it. Ask an owner to make you a manager.',
  cancelled: 'This night is cancelled. The names are kept, and nothing can be changed.',
  past: 'This night is over. The list is kept as it was, and nothing can be changed.',
  bad_capacity: 'Places must be a number from 0 to 100000 (0 means no limit). Nothing was changed.',
  bad_cutoff_time: 'Closing time must look like 22:00. Nothing was changed.',
  name_required: 'Type a first name. Nobody was added.',
  name_too_long: 'That name is too long (80 letters at most). Nobody was added.',
  duplicate_name: 'That name is already on this night\u2019s list. Nobody was added.',
  not_restorable: 'That name cannot be put back. Nothing was changed.',
  not_on_list: 'That person is not on the list. Nothing was changed.',
  not_found: 'No one on this night\u2019s list has that code. Nobody was checked in.',
  other_night: 'That code is for a different night. Nobody was checked in.',
  night_required: 'This night could not be found. Nothing was changed.',
  entry_not_found: 'That name is not on the list any more. Nothing was changed.',
};
export const reasonWords = (reason: string): string => REASON_WORDS[reason] ?? 'That did not work. Nothing was changed. Try again.';

export const READ_ONLY_WORDS: Record<ReadOnlyReason, string> = {
  view_only: REASON_WORDS.view_only, cancelled: REASON_WORDS.cancelled, past: REASON_WORDS.past,
};

const plural = (n: number, w: string) => `${n} ${w}${n === 1 ? '' : 's'}`;
export const namesWord = (n: number) => plural(n, 'name');

/** One line under the switch: On / Off, names, places, closing time. */
export function statusLine(v: GuestListView): string {
  const n = v.night;
  if (!n.enabled) return 'Off for this night';
  const parts = ['On', namesWord(v.counts.names)];
  if (n.capacityMax !== null && v.counts.placesLeft !== null) parts.push(`${v.counts.placesLeft} of ${n.capacityMax} places left`);
  if (n.closed) parts.push('closed');
  else if (n.cutoffTime) parts.push(`closes ${n.cutoffTime}`);
  return parts.join(' · ');
}

/** The banner above Names, or null. Full and closed stop dancers, not the team. */
export function stateBanner(v: GuestListView): string | null {
  if (v.night.cancelled) return READ_ONLY_WORDS.cancelled;
  if (v.night.past) return READ_ONLY_WORDS.past;
  if (!v.night.enabled) return 'No guest list on this night. Turn the switch on and dancers can add their names.';
  if (v.night.closed) return 'Sign-up is closed. Dancers cannot add themselves, but you can still add names.';
  if (v.night.full) return 'Every place is taken, so dancers cannot add themselves. Raise the places in Settings, or add names yourself.';
  return null;
}

/** Why the switch / Add / settings are disabled, or null when they work. */
export function editBlock(v: GuestListView): string | null {
  return v.canEdit ? null : v.readOnly ? READ_ONLY_WORDS[v.readOnly] : null;
}

/** Door: "41 of 63 in". */
export const doorLine = (c: GuestCounts) => `${c.inCount} of ${c.names} in`;

export function emptyWords(v: GuestListView, searching: boolean): string {
  if (searching) return 'No one matches. Clear the search to see everyone.';
  if (!v.night.enabled) return 'No names yet. The list is off for this night.';
  return v.canEdit ? 'No names yet. Add one above, or share the sign-up link.' : 'No names yet.';
}

export interface SettingsDraft { places: string; closes: string }
export const draftOf = (v: GuestListView): SettingsDraft => ({ places: v.night.capacityMax === null ? '' : String(v.night.capacityMax), closes: v.night.cutoffTime ?? '' });

/** Saving an untouched form sends nothing. Blank places = 0 = no limit; blank closes = none. */
export function settingsArgs(v: GuestListView, d: SettingsDraft): { capacity: number | null; cutoff: string } | null {
  const was = draftOf(v);
  if (d.places.trim() === was.places && d.closes.trim() === was.closes) return null;
  const places = d.places.trim();
  return { capacity: places === '' ? 0 : Number(places), cutoff: d.closes.trim() };
}

export function settingsError(d: SettingsDraft): string | null {
  const p = d.places.trim();
  if (p !== '' && !/^\d{1,6}$/.test(p)) return reasonWords('bad_capacity');
  if (p !== '' && Number(p) > 100000) return reasonWords('bad_capacity');
  const c = d.closes.trim();
  if (c !== '' && !/^([01]\d|2[0-3]):[0-5]\d$/.test(c)) return reasonWords('bad_cutoff_time');
  return null;
}

/** The scan sentence. */
export function scanWords(r: { ok: boolean; reason?: string; firstName?: string; alreadyIn?: boolean; counts?: GuestCounts }): string {
  if (!r.ok) return reasonWords(r.reason ?? '');
  const base = r.alreadyIn ? `${r.firstName} was already in.` : `${r.firstName} is in.`;
  return r.counts ? `${base} ${doorLine(r.counts)}.` : base;
}

/** Names first, then Door, on the night; the Door view opens by itself only for a night that is on today. */
export type GuestTab = 'names' | 'door' | 'settings';
export const GUEST_VIEWS: readonly GuestTab[] = ['names', 'door', 'settings'];
export const TAB_WORD: Record<GuestTab, string> = { names: 'Names', door: 'Door', settings: 'Settings' };
