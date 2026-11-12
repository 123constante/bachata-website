import type { Night } from '../nights/nightsModel';

/**
 * Home's going-shaped VIEWS, with no going import: the hero and the "Upcoming nights"
 * tile render here in every state, and the going words and numbers come in as a
 * HomeGoing value from homeGoing.tsx, which HomeScreen lazy-loads only while the going
 * switch is on (the CalendarGoingFeed pattern). Switch off, /app/* loads none of the
 * going module (perf-budgets.json, dancer-app row).
 */

/** The hero's night, already in words (homeGoing.tsx maps it from the going list). */
export type HeroNight = { name: string; inDays: string; place: string; tag: string; href: string | null };

/**
 * Everything Home shows from the going list (get_my_going_v1 through useMyNights), already
 * in the going module's words. Built ONLY by homeGoing.tsx. The words are null while the
 * feed is still loading (HomeScreen's HOME_GOING_LOADING), when nothing that needs them is on screen.
 */
export type HomeGoing = {
  isLoading: boolean;
  isError: boolean;
  retry: () => void;
  /** The next night going ahead, or null (empty hero). */
  hero: HeroNight | null;
  /** The module's "how a night gets here" line under the empty hero. */
  how: string | null;
  /** Rate-nudge candidates (nudgeCandidates over the past list). */
  nudge: Night[];
  todayKey: string;
  /** THE upcoming going count (tile and strip); null until the list has loaded. */
  goingCount: number | null;
  /** Past nights the person went to (mapMyGoing's past list, the strip's Went); null until loaded. */
  wentCount: number | null;
  /** The strip's Going cell label (the module's tag). */
  tagGoing: string | null;
  /** The words under the tile's number. */
  tileHelp: string | null;
};
