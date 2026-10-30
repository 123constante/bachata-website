import { requiredLeftText } from '@/modules/organiser/shared/profileProgress';
import { P3_PATHS } from '../shell/paths';

/**
 * The You hub's rows (mockup p3-w4a A), as data: ONE entry per row, in order. A new row (e.g.
 * ticketing's Get paid) is one more entry in YOU_ROWS and nothing else, so parallel arcs do not
 * collide in the screen. Each entry turns the facts into a row, or null when it does not apply.
 */
export interface YouFacts {
  /** Pages on the login (organiser_home_v1). */
  pages: number;
  /** People on the shown page's team; null while it loads or when it failed. */
  teamCount: number | null;
  /** Open join requests on the shown page. */
  requests: number;
  /** my_profile_progress_v1 required_left for the shown page; 0 when ready or unknown. */
  requiredLeft: number;
  /** Add a page (P3 youAdd: find, claim, ask to join, create). */
  addPage: string;
}

export interface YouRow {
  id: string;
  label: string;
  sub: string | null;
  /** Null = shown disabled, with `reason`. */
  to: string | null;
  reason: string | null;
  /** A count the row needs answering (join requests). */
  badge: number | null;
}

export const YOU = {
  switch: 'Switch page',
  switchSub: (n: number) => `${n} pages`,
  page: 'Organiser page',
  pageSub: 'Photo, about, links, contact',
  pageRequired: (n: number) => `Required to publish: ${requiredLeftText(n)}`,
  team: 'Team',
  teamSub: (n: number) => (n === 1 ? 'Just you' : `${n} people`),
  // Says why, never "add one": at 0 pages the no-page card above has the Add a page link.
  teamNoPage: 'A team belongs to a page, and you don\u2019t run one yet.',
  addPage: 'Add another page',
  account: 'Account and help',
  accountSub: 'Sign out, help, leave a page',
  loading: 'Loading your pages\u2026',
  failed: 'Your pages did not load',
  failedBody: 'Check your connection, then try again.',
  requestsLabel: (n: number) => (n === 1 ? '1 person wants to join' : `${n} people want to join`),
} as const;

type RowDef = { id: string; build: (f: YouFacts) => YouRow | null };
const row = (id: string, label: string, sub: string | null, to: string | null, extra: Partial<YouRow> = {}): YouRow =>
  ({ id, label, sub, to, reason: null, badge: null, ...extra });

export const YOU_ROWS: readonly RowDef[] = [
  // Only with 2+ pages: one page has nothing to switch to (owner pick 2026-10-27).
  { id: 'switch', build: (f) => (f.pages >= 2 ? row('switch', YOU.switch, YOU.switchSub(f.pages), P3_PATHS.youSwitch) : null) },
  { id: 'page', build: (f) => (f.pages ? row('page', YOU.page, f.requiredLeft > 0 ? YOU.pageRequired(f.requiredLeft) : YOU.pageSub, P3_PATHS.youPage) : null) },
  {
    id: 'team',
    build: (f) => (f.pages
      ? row('team', YOU.team, f.teamCount === null ? null : YOU.teamSub(f.teamCount), P3_PATHS.youTeam, { badge: f.requests > 0 ? f.requests : null })
      : row('team', YOU.team, null, null, { reason: YOU.teamNoPage })),
  },
  // With 2+ pages, Switch page carries "Add a page"; with one, it is here.
  { id: 'add-page', build: (f) => (f.pages === 1 ? row('add-page', YOU.addPage, null, f.addPage) : null) },
];

export function youRows(f: YouFacts): YouRow[] {
  return YOU_ROWS.map((d) => d.build(f)).filter((r): r is YouRow => r !== null);
}
