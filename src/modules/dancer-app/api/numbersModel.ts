import type { MyDancerStats, MyProfileViews } from './types';

/**
 * The ONE mapping from my_dancer_stats_v1 / my_profile_views_v1 to the words and
 * numbers a dancer sees. Home and My page both read it, so the same fact is the
 * same number on every screen (owner rule: one mapping, never two copies).
 */
export type Numbers = {
  /** Views in the last 7 days -> "People who looked at your page this week". */
  viewsWeek: number;
  viewsMonth: number;
  viewsTotal: number;
  going: number;
  went: number;
  interested: number;
  votes: number;
  /** True when nobody has looked yet: the screen then says what the dancer CAN do. */
  noViews: boolean;
  /** True when there is nothing at all to count (new dancer). */
  allZero: boolean;
};

export const numbersFrom = (stats: MyDancerStats, views: MyProfileViews): Numbers => {
  const viewsTotal = Math.max(views.total, stats.views_total);
  return {
    viewsWeek: views.last_7_days,
    viewsMonth: views.last_30_days,
    viewsTotal,
    going: stats.nights_going_upcoming,
    went: stats.nights_went,
    interested: stats.interested_upcoming,
    votes: stats.level_votes,
    noViews: viewsTotal === 0,
    allZero: viewsTotal === 0 && stats.nights_going_upcoming + stats.nights_went + stats.interested_upcoming + stats.level_votes === 0,
  };
};

/** 1234567 -> "1,234,567". Fixed locale so a phone's settings never change the number. */
export const fmt = (n: number): string => (Number.isFinite(n) ? Math.max(0, Math.floor(n)).toLocaleString('en-GB') : '0');

export const VIEWS_WEEK_LABEL = 'People who looked at your page this week';
export const NUMBERS_LOAD_FAILED = 'We could not load your numbers. Check your connection and try again.';

/** What the dancer can do when nobody has looked yet; says the photo first when there is none. */
export const noViewsHelp = (hasPhoto: boolean): string =>
  hasPhoto ? 'Share your page to get your first visitor.' : 'Add a photo and share your page.';

/** One line under the weekly count: month and all-time, or the next step when it is zero. */
export const viewsDetail = (n: Numbers, hasPhoto: boolean): string => {
  if (n.noViews) return noViewsHelp(hasPhoto);
  return `${fmt(n.viewsMonth)} in the last 30 days \u00B7 ${fmt(n.viewsTotal)} in all`;
};

export type StripCell = { id: 'going' | 'went' | 'interested' | 'votes'; label: string; value: number };

export const stripCells = (n: Numbers): StripCell[] => [
  { id: 'going', label: 'Going', value: n.going },
  { id: 'interested', label: 'Interested', value: n.interested },
  { id: 'went', label: 'Nights been to', value: n.went },
  { id: 'votes', label: 'Levels rated', value: n.votes },
];

/** Zero everywhere: the strip says what to do instead of four zeros. */
export const STRIP_EMPTY_HELP = 'Your counts start when you say you are going to a night.';
