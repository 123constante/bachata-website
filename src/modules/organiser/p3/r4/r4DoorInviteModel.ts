/*
 * Board R4DoorInvite (flag organiserR4): the door invite link page, one night at a time.
 *
 * What is real today: the night box (the shared event choice and its next night, from
 * organiser_home_v1), "See what door staff see" (the door screen of that event), and two facts
 * that hold for every door seat: access ends 12 hours after the night (the server's
 * _door_seat_window_v1: the night's end, or start + 6h, plus 12h) and the door screen shows
 * first names, never money.
 *
 * What is NOT built: the link itself. ticket_door_seat_invite_v1 can mint a token, but this
 * site has no page where door staff open the link and accept it (ticket_door_seat_accept_v1 has
 * no caller), so a link would lead nowhere. "Copy door invite link" is off with that reason; the
 * LINK card and Share are hidden. Nothing on this page writes.
 */

export interface R4DoorInviteIn {
  load: 'loading' | 'error' | 'ready';
  event: { id: string; name: string; nextDate: string | null } | null;
  /** More than one event on the page: the night box is a real select. */
  many: boolean;
  /** The door screen route exists (flags.organiserTicketing). */
  doorOn: boolean;
}

export interface R4DoorInviteModel {
  load: R4DoorInviteIn['load'] | 'none';
  /** "Friday Social, Friday 20 November" or "Friday Social, no night coming up". */
  pick: string | null;
  pickable: boolean;
  copyWhy: string;
  facts: string[];
  /** The door screen of the chosen event, or null when there is none to show. */
  previewFor: string | null;
}

export const R4_DOOR_INVITE_COPY = {
  intro: 'Send this link to whoever works the door. They get one simple screen: Scan and Search. Nothing else.',
  copy: 'Copy door invite link',
  copyWhy: 'Door invite links are not ready yet: there is no page here for door staff to open the link. For now, add them to your team, or work the door yourself.',
  noNight: 'There is no night coming up to invite door staff to.',
  ends: 'Access ends 12 hours after the event.',
  names: 'They see names only, never money.',
  preview: 'See what door staff see',
  none: 'Add a night first. Door links are made for one night.',
} as const;

const dayWord = (iso: string) =>
  new Date(`${iso}T12:00:00Z`).toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long', timeZone: 'UTC' }).replace(',', '');

export function r4DoorInviteOf(i: R4DoorInviteIn): R4DoorInviteModel {
  const C = R4_DOOR_INVITE_COPY;
  if (i.load !== 'ready') return { load: i.load, pick: null, pickable: false, copyWhy: C.copyWhy, facts: [], previewFor: null };
  if (!i.event) return { load: 'none', pick: null, pickable: false, copyWhy: C.none, facts: [], previewFor: null };
  const name = i.event.name.trim() || 'No name yet';
  const nd = i.event.nextDate;
  return {
    load: 'ready',
    pick: nd ? `${name}, ${dayWord(nd)}` : `${name}, no night coming up`,
    pickable: i.many,
    copyWhy: nd ? C.copyWhy : C.noNight,
    facts: [C.ends, C.names],
    previewFor: i.doorOn ? i.event.id : null,
  };
}
