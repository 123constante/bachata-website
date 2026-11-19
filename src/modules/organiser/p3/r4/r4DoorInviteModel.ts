/*
 * Board R4DoorInvite (flag organiserR4): the door invite link page, one night at a time.
 *
 * The night box is the shared event choice and its next night (organiser_home_v1). "Copy door
 * invite link" mints a link for that night with ticket_door_seat_invite_v1 ON TAP ONLY (never on
 * page load), copies the full URL, and the LINK card shows it with when access ends and Share. The
 * door person opens it at /door/join/:token (door/join/DoorJoinPage). Access ends 12 hours after the
 * night (the server's _door_seat_window_v1), and the door screen shows first names, never money.
 */
import { DOOR_MINT_FAILED, DOOR_MINT_WHY, accessEndsWord, doorInviteUrl, type MintAnswer } from '../door/join/doorJoinModel';

export interface R4DoorInviteIn {
  load: 'loading' | 'error' | 'ready';
  event: { id: string; name: string; nextDate: string | null } | null;
  /** More than one event on the page: the night box is a real select. */
  many: boolean;
  /** The door screen route exists (flags.organiserTicketing). */
  doorOn: boolean;
  /** The next night's occurrence id (from the event's dates), or null while unknown / not found. */
  occurrenceId?: string | null;
  /** The read of the event's dates that gives occurrenceId. */
  nightRead?: 'loading' | 'error' | 'ready';
  /** The mint on tap: not tried, running, failed (unknown answer), or the server's answer. */
  mint?: 'idle' | 'running' | 'failed' | MintAnswer;
  /** The site's origin, for the full link. */
  origin?: string;
}

export interface R4DoorInviteModel {
  load: R4DoorInviteIn['load'] | 'none';
  /** "Friday Social, Friday 20 November" or "Friday Social, no night coming up". */
  pick: string | null;
  pickable: boolean;
  /** The Copy button can be pressed. */
  canCopy: boolean;
  busy: boolean;
  /** Why Copy is off, or why the last try did not make a link; null when there is nothing to say. */
  copyWhy: string | null;
  facts: string[];
  /** The door screen of the chosen event, or null when there is none to show. */
  previewFor: string | null;
  /** The dates read failed: the page offers Try again for it. */
  nightRetry: boolean;
  /** The LINK card, once a link was made. */
  link: { url: string; ends: string | null } | null;
}

export const R4_DOOR_INVITE_COPY = {
  intro: 'Send this link to whoever works the door. They get one simple screen: Scan and Search. Nothing else.',
  copy: 'Copy door invite link',
  copying: 'Making the link\u2026',
  copied: 'Link copied. Send it to your door person.',
  copyFailed: 'The link is below. Copy it by hand: press and hold it.',
  linkLabel: 'Link',
  share: 'Share',
  shareText: 'Your door link for tonight. Open it on your phone to scan tickets.',
  oneUse: 'Each link works for one person. Make a new one for each door person.',
  noNight: 'There is no night coming up to invite door staff to.',
  noOccurrence: 'This night is not in the event\u2019s dates. Pick the event again, or check its dates.',
  nightFailed: 'We couldn\u2019t load this night. Nothing was changed.',
  retry: 'Try again',
  ends: 'Access ends 12 hours after the event.',
  names: 'They see names only, never money.',
  preview: 'See what door staff see',
  none: 'Add a night first. Door links are made for one night.',
} as const;

const dayWord = (iso: string) =>
  new Date(`${iso}T12:00:00Z`).toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long', timeZone: 'UTC' }).replace(',', '');

const OFF = { canCopy: false, busy: false, link: null, nightRetry: false } as const;

export function r4DoorInviteOf(i: R4DoorInviteIn): R4DoorInviteModel {
  const C = R4_DOOR_INVITE_COPY;
  if (i.load !== 'ready') return { load: i.load, pick: null, pickable: false, ...OFF, copyWhy: null, facts: [], previewFor: null };
  if (!i.event) return { load: 'none', pick: null, pickable: false, ...OFF, copyWhy: C.none, facts: [], previewFor: null };
  const name = i.event.name.trim() || 'No name yet';
  const nd = i.event.nextDate;
  const mint = i.mint ?? 'idle';
  const busy = mint === 'running';
  const ok = typeof mint === 'object' && mint.result === 'ok' && mint.token ? mint : null;
  const read = i.nightRead ?? 'ready';
  const copyWhy = !nd ? C.noNight
    : read === 'loading' && !i.occurrenceId ? null
    : read === 'error' && !i.occurrenceId ? C.nightFailed
    : !i.occurrenceId ? C.noOccurrence
    : mint === 'failed' ? DOOR_MINT_FAILED
    : typeof mint === 'object' && mint.result !== 'ok' ? DOOR_MINT_WHY[mint.result]
    : null;
  return {
    load: 'ready',
    pick: nd ? `${name}, ${dayWord(nd)}` : `${name}, no night coming up`,
    pickable: i.many,
    canCopy: !!nd && !!i.occurrenceId && !busy,
    busy,
    copyWhy,
    nightRetry: !!nd && read === 'error' && !i.occurrenceId,
    facts: [C.ends, C.names],
    previewFor: i.doorOn ? i.event.id : null,
    link: ok ? { url: doorInviteUrl(i.origin ?? '', ok.token as string), ends: accessEndsWord(ok.expiresAt) } : null,
  };
}
