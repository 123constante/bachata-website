/**
 * Organiser dashboard slice 1 (admin #1535): Home as ONE view-model, built by a pure function so every
 * screen x shape is table-testable. Design: Option A (hero) + B's date rail. Positive-only: a zero is
 * never drawn, it becomes a suggested action. Where a read does not exist the tile is omitted.
 */
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
  opens: number;
  taps: Partial<Record<'ticket' | 'directions' | 'share' | 'whatsapp' | 'other', number>>;
  ticketsSold: number;
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
}

export const RAIL_CAP = 3;
export const CITY_MIN = 5;

export type HeroKind = 'first-night' | 'headline' | 'share' | 'no-live-night';

export interface Hero {
  kind: HeroKind;
  title: string;
  /** e.g. "12 going, 248 opens"; only for 'headline'. */
  headline: string | null;
  why: string;
  /** The night the hero is about (the next LIVE night), if any. */
  night: DashNight | null;
  action: 'new-event' | 'share-night' | 'share-page';
  actionLabel: string;
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
}

const plural = (n: number, one: string, many: string) => `${n.toLocaleString('en-GB')} ${n === 1 ? one : many}`;
const OWNER_ONLY = 'Only the owner or a manager can do this.';

export function headlineOf(n: DashNight): string | null {
  const parts: string[] = [];
  if (n.going && n.going > 0) parts.push(`${n.going.toLocaleString('en-GB')} going`);
  if (n.opens > 0) parts.push(plural(n.opens, 'open', 'opens'));
  return parts.length ? parts.join(', ') : null;
}

function statsOf(n: DashNight): string | null {
  const parts: string[] = [];
  const h = headlineOf(n);
  if (h) parts.push(h);
  const t = n.taps;
  if ((t.ticket ?? 0) > 0) parts.push(plural(t.ticket!, 'ticket tap', 'ticket taps'));
  if ((t.directions ?? 0) > 0) parts.push(plural(t.directions!, 'directions tap', 'directions taps'));
  if ((t.whatsapp ?? 0) > 0) parts.push(plural(t.whatsapp!, 'WhatsApp tap', 'WhatsApp taps'));
  if ((t.share ?? 0) > 0) parts.push(plural(t.share!, 'share', 'shares'));
  if (n.ticketsSold > 0) parts.push(`${n.ticketsSold.toLocaleString('en-GB')} sold`);
  return parts.length ? parts.join(' · ') : null;
}

function heroOf(live: readonly DashNight[], hasCancelled: boolean): Hero {
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
  return { kind: 'share', title: 'No one has found this night yet', headline: null, night, action: 'share-night', actionLabel: 'Share this night',
    why: `${night.name}, ${night.when}. Sharing the link is the quickest way to get people looking.` };
}

export function buildDash(i: DashInput): DashModel {
  const omitted = ['Organiser rating', 'City average (no read)', 'Opens by source', 'Per-night opens (series-level only)'];
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
  const base = { load: i.load, sharePage, team, omitted };
  if (i.load !== 'ready') {
    return { ...base, hero: null, rail: [], seeAll: null, nightsRow: null, cancelledNote: null, profile: null, cityAverage: null };
  }

  const live = i.nights.filter((n) => !n.cancelled);
  const cancelled = i.nights.filter((n) => n.cancelled);
  const hero = heroOf(live, cancelled.length > 0);

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
  const profile = {
    percent: i.profileSteps.length ? Math.round((done / i.profileSteps.length) * 100) : 0,
    complete: !next,
    next,
    control: next ? (canEdit ? { label: next.button, disabled: false, reason: null } : { label: next.button, disabled: true, reason: OWNER_ONLY }) : null,
  };

  const cityAverage = i.cityAverage !== null && i.cityOrganisers !== null && i.cityOrganisers >= CITY_MIN
    ? { text: `City average ${i.cityAverage.toFixed(1)} across ${i.cityOrganisers} organisers` }
    : null;

  return { ...base, hero, rail, seeAll, nightsRow, cancelledNote, profile, cityAverage };
}
