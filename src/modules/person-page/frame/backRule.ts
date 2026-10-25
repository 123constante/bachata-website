/**
 * The frame's Back rule (people arc S3, owner D9): history back when the previous page was on
 * this site, else the world's list (backHref).
 *
 * In the browser React Router keeps the entry's position in `history.state.idx`: 0 = the first
 * page of this visit (a shared link, a new tab, or a page a client redirect replaced), so there is
 * no page of this site behind it. Without an idx (the memory router), the location key decides:
 * the first entry's key is "default", every page reached inside the site gets its own.
 */
export const backGoesToHistory = (locationKey: string | null | undefined, historyIdx?: unknown): boolean => {
  if (typeof historyIdx === 'number') return historyIdx > 0;
  return !!locationKey && locationKey !== 'default';
};

/** The current entry's idx from React Router's history state (browser only; undefined elsewhere). */
export const currentHistoryIdx = (): unknown =>
  typeof window === 'undefined' ? undefined : (window.history.state as { idx?: unknown } | null)?.idx;
