/**
 * Every URL in the P3 organiser area (flag organiserP3). A separate base from
 * the R1 area (/account/o), so nothing there changes while P3 is built.
 */
export const P3_BASE = '/account/p3';

export const P3_PATHS = {
  home: P3_BASE,
  events: `${P3_BASE}/events`,
  stats: `${P3_BASE}/stats`,
  you: `${P3_BASE}/you`,
} as const;

export type P3Tab = keyof typeof P3_PATHS;
export const P3_TABS: readonly P3Tab[] = ['home', 'events', 'stats', 'you'];
