/** One mapping from a tracker row to what the card shows. Counts only: the server sends no names. */
export interface TrackerLink {
  link_id: string;
  code: string;
  city_name: string;
  city_slug: string;
  is_active: boolean;
  admin_locked: boolean;
  live: boolean;
  ambassador_first_name: string | null;
  joined: number;
  city_set: number;
}

export type LinkState = 'on' | 'off' | 'not_live';

export const LOCKED_REASON = 'An admin switched this link off. Ask an admin to turn it back on.';
export const EMPTY_TEXT = 'Nobody has joined yet. Send your link to the first organiser.';
export const OFF_NOTE = 'Your link is off. Nobody can join with it';
export const NOT_LIVE_NOTE = 'This link no longer works. Ask us';
export const CONFIRM_OFF = 'Switch this link off? Nobody will be able to join with it until you switch it on again.';
export const CONFIRM_ON = 'Switch this link on? Anyone with it will be able to join.';

const int = (v: unknown) => (typeof v === 'number' && Number.isFinite(v) && v > 0 ? Math.floor(v) : 0);

/** Defensive parse of the RPC payload: unknown shapes give no links rather than a crash. */
export function parseTracker(data: unknown): TrackerLink[] {
  const links = (data as { links?: unknown } | null)?.links;
  if (!Array.isArray(links)) return [];
  const out: TrackerLink[] = [];
  for (const r of links as Record<string, unknown>[]) {
    if (!r || typeof r.link_id !== 'string' || typeof r.code !== 'string') continue;
    out.push({
      link_id: r.link_id,
      code: r.code,
      city_name: typeof r.city_name === 'string' ? r.city_name : '',
      city_slug: typeof r.city_slug === 'string' ? r.city_slug : '',
      is_active: r.is_active === true,
      admin_locked: r.admin_locked === true,
      live: r.live === true,
      ambassador_first_name: typeof r.ambassador_first_name === 'string' ? r.ambassador_first_name : null,
      joined: int(r.joined),
      city_set: int(r.city_set),
    });
  }
  return out;
}

export const linkUrl = (origin: string, code: string) => `${origin}/join/a/${encodeURIComponent(code)}`;

export function linkState(l: TrackerLink): LinkState {
  if (!l.is_active) return 'off';
  return l.live ? 'on' : 'not_live';
}

export interface CardModel {
  state: LinkState;
  title: string;
  joinedLabel: string;
  cityLabel: string;
  empty: string | null;
  note: string | null;
  /** The switch button: null = no switch at all (not live). */
  toggle: { label: string; next: boolean; confirm: string; disabledReason: string | null } | null;
  canCopy: boolean;
}

export function cardModel(l: TrackerLink, isAdmin: boolean, showWho: boolean): CardModel {
  const state = linkState(l);
  const city = l.city_name || 'city';
  const who = showWho && l.ambassador_first_name ? ` (${l.ambassador_first_name})` : '';
  let toggle: CardModel['toggle'] = null;
  if (state === 'on') toggle = { label: 'Switch off', next: false, confirm: CONFIRM_OFF, disabledReason: null };
  if (state === 'off') {
    toggle = { label: 'Switch on', next: true, confirm: CONFIRM_ON, disabledReason: l.admin_locked && !isAdmin ? LOCKED_REASON : null };
  }
  return {
    state,
    title: `Your ${city} link${who}`,
    joinedLabel: `Joined ${l.joined}`,
    cityLabel: `Set ${city} ${l.city_set}`,
    empty: state !== 'not_live' && l.joined === 0 ? EMPTY_TEXT : null,
    note: state === 'off' ? OFF_NOTE : state === 'not_live' ? NOT_LIVE_NOTE : null,
    toggle,
    canCopy: state !== 'not_live',
  };
}

/** The server's refusal words, as a sentence the person can act on. */
export function switchError(err: unknown): string {
  const m = String((err as { message?: string } | null)?.message ?? err ?? '');
  if (/admin_locked/.test(m)) return LOCKED_REASON;
  if (/not_authorised|link_not_found/.test(m)) return 'You can no longer change this link. Reload the page.';
  if (/authentication_required/.test(m)) return 'You are signed out. Sign in again and retry.';
  return 'That did not save. Check your connection and try again.';
}
