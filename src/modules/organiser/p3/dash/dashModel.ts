/**
 * Organiser dashboard slice 1 (admin #1535): Home as ONE view-model, built by a pure function so every
 * screen x shape is table-testable. Design: Option A (hero) + B's date rail. Positive-only: a zero is
 * never drawn, it becomes a suggested action. Where a read does not exist the tile is omitted.
 */
import { whoCameLinkOf } from '../sheets/sheetsModel';

export type Seat = 'owner' | 'manager' | 'contributor';
export type DashLoad = 'ready' | 'loading' | 'error';

export interface DashNight {
  key: string;
  date: string;
  /** 'Tonight, 8pm' / 'Friday 30 October, 8pm' */
  when: string;
  name: string;
  cancelled: boolean;
  /** null = not readable for this seat or not loaded: never drawn. */
  going: number | null;
  /** Opens over the month window; null = no honest read for this night (never drawn, never a zero claim). */
  opens: number | null;
  taps: Partial<Record<'ticket' | 'directions' | 'share' | 'whatsapp' | 'other', number>>;
  ticketsSold: number;
  /** Real public night link, or null/absent when none is safe (Share is then disabled with a reason). */
  link?: string | null;
  /** Slice 2: the series this night belongs to (Door link), and whether the event is still a draft (own card, no taps). */
  seriesId?: string;
  draft?: boolean;
}

/** Slice 2: which face Home shows. Derived from tickets/a/clockState (no second clock). */
export type HomeClock = 'before' | 'night' | 'after';

/** A night that has happened. null = no read for this seat / night (never drawn, never a zero claim). */
export interface PastNight {
  key: string;
  seriesId: string;
  /** Slice 3: the night's occurrence id (the Who came sheet reads it); absent = no sheet link. */
  occurrenceId?: string;
  date: string;
  name: string;
  when: string;
  cancelled: boolean;
  /** Checked in at the door (ticket_door_list_v3 in_count for that occurrence). */
  cameIn: number | null;
  /** Tickets for that night (ticket_door_list_v3 total_count). */
  ticketsSold: number | null;
  /** Raffle result words, e.g. "Raffle winner: Ana", or null when no raffle ran. */
  raffle: string | null;
  /** Going is an upcoming-only read: null for a past night unless a caller has it. */
  going?: number | null;
}

export interface ProfileStep { key: 'bio' | 'logo' | 'socials' | 'city'; label: string; sentence: string; button: string; done: boolean }

export interface DashInput {
  load: DashLoad;
  seat: Seat;
  /** Nights from the feed, soonest first. Cancelled ones may be present; they are never counted. */
  nights: readonly DashNight[];
  /** Server count of live upcoming dates (a night list is capped; this is the real total). */
  upcomingDates: number;
  /** The real public page link, or null when none exists (then Share is disabled with a reason). */
  pageLink: string | null;
  profileSteps: readonly ProfileStep[];
  /** Organisers in this page's city, null = unknown. */
  cityOrganisers: number | null;
  /** City average rating, null = no read exists (today: always). */
  cityAverage: number | null;
  sellingViaUs: boolean;
  teamCount: number;
  /** Slice 2 (optional so slice-1 callers are unchanged): the face, the night just gone, a Door link, any past night. */
  clock?: HomeClock;
  lastNight?: PastNight | null;
  canDoor?: boolean;
  hasPastNights?: boolean;
}

export const RAIL_CAP = 3;
export const CITY_MIN = 5;

export type HeroKind = 'first-night' | 'headline' | 'share' | 'no-live-night' | 'night';

export interface Hero {
  kind: HeroKind;
  title: string;
  /** e.g. "12 going, 248 opens"; only for 'headline'. */
  headline: string | null;
  why: string;
  /** The night the hero is about (the next LIVE night), if any. */
  night: DashNight | null;
  action: 'new-event' | 'share-night' | 'share-page' | 'open-door';
  actionLabel: string;
  /** Link taps by type on this night, positive only ("3 ticket taps \u00b7 1 share"). */
  taps?: string | null;
  /** ONE suggested action shown in place of zero rows (owner decision 2). */
  tip?: string | null;
}

export interface RailRow { night: DashNight; cancelled: boolean; isHero: boolean; stats: string | null; tag: string | null }

export interface Control { label: string; disabled: boolean; reason: string | null }

export interface DashModel {
  load: DashLoad;
  hero: Hero | null;
  rail: RailRow[];
  seeAll: { label: string } | null;
  /** "N nights coming up" row, live nights only. */
  nightsRow: { text: string; going: number | null; tickets: number | null } | null;
  /** Collapsed block after a cancelled night. Never says anyone was told. */
  cancelledNote: { summary: string; body: string; action: string } | null;
  profile: { percent: number; complete: boolean; next: ProfileStep | null; control: Control | null } | null;
  sharePage: Control;
  team: { line: string; control: Control };
  cityAverage: { text: string } | null;
  /** Tiles that have no data source and are omitted on purpose. */
  omitted: readonly string[];
  /** Slice 2: which face Home is in, the day-after block, and the Compare nights row. */
  clock: HomeClock;
  dayAfter: DayAfter | null;
  compare: { label: string } | null;
}

export interface DayAfter { night: PastNight; title: string; big: number | null; bigWord: string; lines: string[] }

const plural = (n: number, one: string, many: string) => `${n.toLocaleString('en-GB')} ${n === 1 ? one : many}`;
const OWNER_ONLY = 'Only the owner or a manager can do this.';

export function headlineOf(n: DashNight): string | null {
  const parts: string[] = [];
  if (!n.draft && n.going && n.going > 0) parts.push(`${n.going.toLocaleString('en-GB')} going`);
  return parts.length ? parts.join(', ') : null;
}

/** Link taps by type, positive only; a draft night has no taps (GAP-4: no per-night read). */
export function tapsOf(n: DashNight): string | null {
  if (n.draft) return null;
  const t = n.taps;
  const parts: string[] = [];
  if ((t.ticket ?? 0) > 0) parts.push(plural(t.ticket!, 'ticket tap', 'ticket taps'));
  if ((t.share ?? 0) > 0) parts.push(plural(t.share!, 'share', 'shares'));
  if ((t.whatsapp ?? 0) > 0) parts.push(plural(t.whatsapp!, 'WhatsApp tap', 'WhatsApp taps'));
  if ((t.directions ?? 0) > 0) parts.push(plural(t.directions!, 'directions tap', 'directions taps'));
  return parts.length ? parts.join(' \u00b7 ') : null;
}

export const TIP_NO_TAPS = 'Share your link to get taps.';
export const TIP_DRAFT = 'Publish this night to start getting taps.';

function statsOf(n: DashNight): string | null {
  const parts: string[] = [];
  const h = headlineOf(n);
  if (h) parts.push(h);
  const t = tapsOf(n);
  if (t) parts.push(t);
  if (n.ticketsSold > 0) parts.push(`${n.ticketsSold.toLocaleString('en-GB')} sold`);
  return parts.length ? parts.join(' · ') : null;
}

function heroOf(live: readonly DashNight[], hasCancelled: boolean, clock: HomeClock, canDoor: boolean): Hero {
  const h0 = heroBase(live, hasCancelled);
  if (!h0.night) return h0;
  const n = h0.night;
  const taps = tapsOf(n);
  const tip = n.draft ? TIP_DRAFT : taps || headlineOf(n) ? null : TIP_NO_TAPS;
  if (clock === 'night' && !n.draft) {
    return { kind: 'night', title: n.name, headline: headlineOf(n), night: n, why: `Tonight \u00b7 ${n.when}`, taps, tip: null,
      action: canDoor ? 'open-door' : 'share-night', actionLabel: canDoor ? 'Open the door' : 'Share this night' };
  }
  return { ...h0, taps, tip };
}

function heroBase(live: readonly DashNight[], hasCancelled: boolean): Hero {
  const night = live[0] ?? null;
  if (!night) {
    return hasCancelled
      ? { kind: 'no-live-night', title: 'No live night right now', headline: null, night: null, action: 'new-event', actionLabel: 'Put a night on',
          why: 'Your cancelled night is not counted. Put another night on and it shows here.' }
      : { kind: 'first-night', title: 'Put your first night on', headline: null, night: null, action: 'new-event', actionLabel: 'New event',
          why: 'Once a night is on, going and opens show here.' };
  }
  const h = headlineOf(night);
  if (h) return { kind: 'headline', title: night.name, headline: h, night, action: 'share-night', actionLabel: 'Share this night', why: night.when };
  return { kind: 'share', title: 'Get people looking at this night', headline: null, night, action: 'share-night', actionLabel: 'Share this night',
    why: `${night.name}, ${night.when}. Sharing the link is the quickest way to get it seen.` };
}

export function buildDash(i: DashInput): DashModel {
  const omitted = ['Organiser rating', 'City average (no read)', 'Opens / page views (no page-view tiles on Home)', 'Per-night taps (series-level only, GAP-4)', 'Money (never on Home)'];
  const clock: HomeClock = i.clock ?? 'before';
  const canEdit = i.seat !== 'contributor';
  const sharePage: Control = i.pageLink
    ? { label: 'Share my page', disabled: false, reason: null }
    : { label: 'Share my page', disabled: true, reason: 'Your page link is not ready yet.' };
  const team = {
    line: i.teamCount > 1 ? `Everyone on your team (${i.teamCount} people) sees this page.` : 'Only you so far.',
    control: canEdit
      ? { label: 'Add a teammate', disabled: false, reason: null }
      : { label: 'Add a teammate', disabled: true, reason: OWNER_ONLY },
  };
  const base = { load: i.load, sharePage, team, omitted, clock, compare: i.load === 'ready' && i.hasPastNights ? { label: 'Compare nights' } : null };
  if (i.load !== 'ready') {
    return { ...base, dayAfter: null, hero: null, rail: [], seeAll: null, nightsRow: null, cancelledNote: null, profile: null, cityAverage: null };
  }

  const live = i.nights.filter((n) => !n.cancelled);
  const cancelled = i.nights.filter((n) => n.cancelled);
  const hero = heroOf(live, cancelled.length > 0, clock, !!i.canDoor);
  const dayAfter = clock === 'after' && i.lastNight && !i.lastNight.cancelled ? dayAfterOf(i.lastNight) : null;

  // rail: live nights soonest first, capped; a cancelled night sits at its date, tagged
  const shownLive = live.slice(0, RAIL_CAP);
  const lastDate = shownLive.length ? shownLive[shownLive.length - 1].date : null;
  const railNights = i.nights.filter((n) => (n.cancelled ? lastDate === null || n.date <= lastDate : shownLive.includes(n))).slice(0, RAIL_CAP + 1);
  const rail: RailRow[] = railNights.map((n) => ({
    night: n,
    cancelled: n.cancelled,
    isHero: hero.night?.key === n.key,
    // the hero night's numbers/message live in the hero: no second copy on its rail row
    stats: n.cancelled || hero.night?.key === n.key ? null : statsOf(n),
    tag: n.cancelled ? 'Cancelled' : null,
  }));

  const liveTotal = Math.max(i.upcomingDates, live.length);
  const seeAll = liveTotal > shownLive.length ? { label: `See all ${liveTotal.toLocaleString('en-GB')} dates` } : null;
  const goingSum = live.some((n) => n.going !== null) ? live.reduce((s, n) => s + (n.going ?? 0), 0) : null;
  const ticketsSum = i.sellingViaUs ? live.reduce((s, n) => s + n.ticketsSold, 0) : null;
  const nightsRow = liveTotal > 0
    ? { text: `${plural(liveTotal, 'night', 'nights')} coming up`, going: goingSum && goingSum > 0 ? goingSum : null, tickets: ticketsSum && ticketsSum > 0 ? ticketsSum : null }
    : null;

  const cancelledNote = cancelled.length
    ? { summary: 'About the cancelled night',
        body: 'A cancelled night is not counted in any number here. People who opened it can still see it as cancelled on the calendar; nobody is messaged automatically.',
        action: 'Tell your group' }
    : null;

  const done = i.profileSteps.filter((s) => s.done).length;
  const next = i.profileSteps.find((s) => !s.done) ?? null;
  // no steps = progress loading, failed, or steps absent: say nothing rather than claim complete
  const profile = i.profileSteps.length === 0 ? null : {
    percent: Math.round((done / i.profileSteps.length) * 100),
    complete: !next,
    next,
    control: next ? (canEdit ? { label: next.button, disabled: false, reason: null } : { label: next.button, disabled: true, reason: OWNER_ONLY }) : null,
  };

  const cityAverage = i.cityAverage !== null && i.cityOrganisers !== null && i.cityOrganisers >= CITY_MIN
    ? { text: `City average ${i.cityAverage.toFixed(1)} across ${i.cityOrganisers} organisers` }
    : null;

  return { ...base, hero, rail, seeAll, nightsRow, cancelledNote, profile, cityAverage, dayAfter };
}

/** Day after (owner decision 4): Who came big; tickets sold + raffle underneath. No count = no big number. */
export function dayAfterOf(n: PastNight): DayAfter {
  const big = n.cameIn !== null && n.cameIn > 0 ? n.cameIn : null;
  const lines: string[] = [];
  if (n.ticketsSold !== null && n.ticketsSold > 0) lines.push(plural(n.ticketsSold, 'ticket sold', 'tickets sold'));
  if (n.raffle) lines.push(n.raffle);
  return { night: n, title: `${n.name}, ${n.when}`, big, bigWord: big === 1 ? 'person came' : 'people came', lines };
}

/** `to`: slice 3's Who came sheet for this night (null = no night id, no link). */
export interface CompareRow { key: string; name: string; when: string; value: number; word: string; to: string | null }
export interface CompareModel { rows: CompareRow[]; empty: string | null }

/** Compare nights (owner decision 3): past, not-cancelled nights ranked by Who came, else Going. Unknown or zero = not ranked. */
export function compareOf(past: readonly PastNight[]): CompareModel {
  const rows: CompareRow[] = [];
  for (const n of past) {
    if (n.cancelled) continue;
    const to = whoCameLinkOf(n, 'compare');
    if (n.cameIn !== null && n.cameIn > 0) rows.push({ key: n.key, name: n.name, when: n.when, value: n.cameIn, word: 'came', to });
    else if (n.going != null && n.going > 0) rows.push({ key: n.key, name: n.name, when: n.when, value: n.going, word: 'going', to });
  }
  rows.sort((a, b) => b.value - a.value || (a.key < b.key ? -1 : 1));
  return { rows, empty: rows.length ? null : 'No night has a count yet. Scan tickets at the door on the night and each night shows here, best first.' };
}
