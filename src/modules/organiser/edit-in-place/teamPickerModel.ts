// Edit in place: the team picker's rules (mockup "Team sheet", screens 3 and 4).
// Pure and client-free, so the matrix test runs every role x shape over the SAME
// functions the sheet calls -- one mapping, never a second copy in the JSX.
//
// Backend (admin #773, live): organiser_team_search_people_v1 (owner or admin,
// at least two letters, at most 8 rows, never by email, people already on the
// team left out) and organiser_team_add_member_by_profile_v1 (the set_member
// answer plus profile_id). Who sees the picker at all is teamPickerAccess()
// in shared/teamModel.ts.
//
// A tap on a result PICKS the person (a chip); Done adds every chip, one call
// each, and a refused chip stays with the server's reason in plain words.
// Team access is not page content, so it is NOT part of the page's draft and
// Save bar: like the Team page, an add is live once Done answers.
import { OWNER_ONLY_ADD, ROLE_HELP, USE_TRANSFER_ADD, selfServeErrorCode, teamErrorMessage } from '@/modules/organiser/shared/selfServeErrors';
import { buildSignInHref } from '@/lib/authRouting';
import { ROLE_LABEL } from '@/modules/organiser/shared/teamModel';

export const MIN_QUERY = 2;
export const SEARCH_LIMIT = 8;
export const SEARCH_DEBOUNCE_MS = 250;
export type AddRole = 'manager' | 'contributor';
export const DEFAULT_ADD_ROLE: AddRole = 'manager';

export interface PersonResult {
  profileId: string;
  name: string;
  photoUrl: string | null;
  city: string | null;
}

const str = (v: unknown): string | null => (typeof v === 'string' && v.trim() !== '' ? v.trim() : null);

/** organiser_team_search_people_v1 rows -> results. A row with no id or no name is dropped; a duplicate id once. */
export function parsePeople(raw: unknown): PersonResult[] {
  if (!Array.isArray(raw)) return [];
  const seen = new Set<string>();
  const out: PersonResult[] = [];
  for (const row of raw as Record<string, unknown>[]) {
    if (!row || typeof row !== 'object') continue;
    const profileId = str(row.profile_id);
    const name = str(row.display_name);
    if (!profileId || !name || seen.has(profileId)) continue;
    seen.add(profileId);
    out.push({ profileId, name, photoUrl: str(row.photo_url), city: str(row.city_name) });
  }
  return out;
}

/** What the search box sends: trimmed; null while it is too short to search (the RPC answers nothing then). */
export function searchTerm(query: string): string | null {
  const q = query.trim();
  return Array.from(q).length >= MIN_QUERY ? q : null;
}

/** Up to two letters for a person with no photo. Accents kept; never empty. */
export function personInitials(name: string): string {
  const words = name.trim().split(/\s+/).filter(Boolean);
  const letters = words.length > 1 ? [words[0], words[words.length - 1]] : words;
  const out = letters.map((w) => Array.from(w)[0] ?? '').join('').toLocaleUpperCase('en-GB');
  return out || '?';
}

export type SearchState =
  | { kind: 'idle' }
  | { kind: 'searching'; term: string }
  | { kind: 'error'; term: string }
  | { kind: 'done'; term: string; people: PersonResult[] };

export const PICKER_COPY = {
  title: 'Add a person',
  searchLabel: 'Search by name',
  placeholder: 'Type their name',
  idle: 'Type at least two letters of their name. Only people with a dancer profile show up.',
  searching: 'Searching\u2026',
  error: 'The search did not work. Check your connection, then type again.',
  none: (term: string) => `No one called \u201c${term}\u201d can be added yet. Check the spelling, or send them an invite link below.`,
  capped: 'These are the first 8 matches. Type more of the name to find someone else.',
  inviteLead: 'Can\u2019t find them?',
  inviteLink: 'Send an invite link',
  inviteShared: 'Invite link ready. Once they have signed up and made a dancer profile, search for them here.',
  inviteCopied: 'Invite link copied. Send it to them; once they have signed up and made a dancer profile, search for them here.',
  inviteFailed: (url: string) => `Copy this link and send it to them: ${url}`,
  roleLegend: 'Add them as',
  roleHelp: ROLE_HELP,
  reasonLabel: 'Reason (admins only)',
  reasonHelp: 'Admins must say why they change a team. It goes in the audit log.',
  chipsLabel: 'People you picked',
  noneYet: 'Pick someone from the list, or send an invite link.',
  adding: 'Adding\u2026',
  done: 'Done',
  cancel: 'Cancel',
  pick: 'Add',
  picked: 'Picked',
  member: 'On the team',
  network: 'We could not reach the server, so they were not added. Check your connection and tap Done again.',
} as const;

/** One result row's state: pickable, already picked (a chip), or already on the team (added this visit). */
export type RowState = 'pick' | 'picked' | 'member';

export function rowState(person: PersonResult, picked: readonly PersonResult[], added: ReadonlySet<string>): RowState {
  if (added.has(person.profileId)) return 'member';
  return picked.some((p) => p.profileId === person.profileId) ? 'picked' : 'pick';
}

export const ROW_STATE_LABEL: Record<RowState, string> = { pick: PICKER_COPY.pick, picked: PICKER_COPY.picked, member: PICKER_COPY.member };

/** The line under a result's name: the city, else what is known. Never blank. */
export const personSubline = (p: PersonResult): string => p.city ?? 'City not added';

/** The accessible name of a result's button, which says what a tap does (or why it does nothing). */
export function rowActionLabel(p: PersonResult, state: RowState): string {
  const where = p.city ? `, ${p.city}` : '';
  if (state === 'member') return `${p.name}${where}: already on the team`;
  if (state === 'picked') return `${p.name}${where}: picked. Tap the cross on their chip to unpick.`;
  return `Pick ${p.name}${where}`;
}

/** The message under the list, by search state. Every one says what the person CAN do. Null: rows only. */
export function listMessage(state: SearchState): { tone: 'muted' | 'error'; text: string } | null {
  switch (state.kind) {
    case 'idle': return { tone: 'muted', text: PICKER_COPY.idle };
    case 'searching': return { tone: 'muted', text: PICKER_COPY.searching };
    case 'error': return { tone: 'error', text: PICKER_COPY.error };
    case 'done':
      if (state.people.length === 0) return { tone: 'muted', text: PICKER_COPY.none(state.term) };
      if (state.people.length >= SEARCH_LIMIT) return { tone: 'muted', text: PICKER_COPY.capped };
      return null;
  }
}

/**
 * Why Done cannot add the chips right now, in the organiser's words; null when
 * it can (or when there is nothing to add: Done then only closes).
 */
export function addBlockedReason(input: { access: 'owner' | 'admin'; picked: number; reason: string; online?: boolean }): string | null {
  if (input.picked === 0) return null;
  if (input.access === 'admin' && input.reason.trim() === '') return 'Write a reason first. Admins must say why they add someone.';
  if (input.reason.trim().length > 500) return 'Keep the reason under 500 characters.';
  if (input.online === false) return 'You are offline. Connect, then tap Done to add them.';
  return null;
}

/** "Add 2 people as managers" -- the line above Done, so the tap's effect is stated before it happens. */
export function willAddLine(picked: readonly PersonResult[], role: AddRole): string | null {
  if (picked.length === 0) return null;
  const roleWord = ROLE_LABEL[role].toLowerCase();
  const who = picked.length === 1 ? picked[0].name : `${picked.length} people`;
  return `Done adds ${who} as ${picked.length === 1 ? `a ${roleWord}` : `${roleWord}s`}. They can help at once.`;
}

/** The add's refusal, in words about a PERSON (the email-shaped TEAM_COPY lines would mislead here). */
const PROFILE_COPY: Record<string, string> = {
  user_not_found: 'This person can no longer be added: their profile is hidden or gone. Search again, or send them an invite link.',
  unconfirmed_email: 'This person has not confirmed their email address yet, so they cannot be added. Ask them to confirm it, then try again.',
  target_is_owner: 'This person is already an owner of this page.',
  not_authorised: OWNER_ONLY_ADD,
  owner_only: OWNER_ONLY_ADD,
  use_transfer: USE_TRANSFER_ADD,
};

const NETWORK_RE = /failed to fetch|network|load failed|fetch failed|timeout|aborted/i;

/** Server refusal -> plain words. Never the raw error text. */
export function addRefusalCopy(error: unknown): string {
  const code = selfServeErrorCode(error);
  if (code && PROFILE_COPY[code]) return PROFILE_COPY[code];
  if (code) return teamErrorMessage(error);
  const message = (error as { message?: unknown } | null)?.message;
  if (typeof message !== 'string' || message.trim() === '' || NETWORK_RE.test(message)) return PICKER_COPY.network;
  return teamErrorMessage(error);
}

/** The add's answer: did it change anything (false: they already had that role). */
export function parseAddResult(raw: unknown): { changed: boolean; role: string | null } {
  const row = (raw ?? {}) as Record<string, unknown>;
  return { changed: row.changed !== false, role: typeof row.member_role === 'string' ? row.member_role : null };
}

export type AddOutcome =
  | { profileId: string; name: string; ok: true; already: boolean }
  | { profileId: string; name: string; ok: false; message: string };

/** Done: add every picked person, one call each, in order. Never throws; one refusal does not stop the rest. */
export async function addPicked(
  add: (profileId: string) => Promise<unknown>,
  picked: readonly PersonResult[],
): Promise<AddOutcome[]> {
  const out: AddOutcome[] = [];
  for (const p of picked) {
    try {
      const r = parseAddResult(await add(p.profileId));
      out.push({ profileId: p.profileId, name: p.name, ok: true, already: !r.changed });
    } catch (e) {
      out.push({ profileId: p.profileId, name: p.name, ok: false, message: addRefusalCopy(e) });
    }
  }
  return out;
}

/** The confirmation after Done, for the page's notice line. Null when nobody was added. */
export function addedMessage(outcomes: readonly AddOutcome[], role: AddRole): string | null {
  const ok = outcomes.filter((o): o is Extract<AddOutcome, { ok: true }> => o.ok);
  if (ok.length === 0) return null;
  const fresh = ok.filter((o) => !o.already);
  const already = ok.filter((o) => o.already);
  const roleWord = ROLE_LABEL[role].toLowerCase();
  const parts: string[] = [];
  if (fresh.length === 1) parts.push(`${fresh[0].name} is now a ${roleWord}.`);
  else if (fresh.length > 1) parts.push(`${fresh.length} people are now ${roleWord}s.`);
  if (already.length === 1) parts.push(`${already[0].name} was already a ${roleWord}.`);
  else if (already.length > 1) parts.push(`${already.length} people were already ${roleWord}s.`);
  return parts.join(' ');
}

/** The invite fallback: a link to sign up. There is no owner invite RPC; once they have a profile, the search finds them. */
export function inviteShare(organiserName: string, origin: string): { title: string; text: string; url: string } {
  const url = `${origin.replace(/\/+$/, '')}${buildSignInHref(null, 'signup')}`;
  return {
    title: 'Join Bachata Calendar',
    text: `Join Bachata Calendar and make your dancer profile, so I can add you to the ${organiserName} team.`,
    url,
  };
}

/** The Team card's one line about who can edit the page now. */
export function teamCountLine(counts: { owner: number; manager: number; contributor: number }): string {
  const parts: string[] = [];
  const say = (n: number, one: string) => { if (n > 0) parts.push(`${n} ${one}${n === 1 ? '' : 's'}`); };
  say(counts.owner, 'owner');
  say(counts.manager, 'manager');
  say(counts.contributor, 'contributor');
  return parts.length === 0 ? 'No one is on the team yet. Add a person to share the work.' : `On the team: ${parts.join(', ')}.`;
}
