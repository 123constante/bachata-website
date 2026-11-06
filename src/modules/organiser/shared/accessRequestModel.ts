import type { MyAccessRequest } from './selfServeApi';

/** How long a declined answer stays on /account before it is no longer news. */
export const DECLINED_VISIBLE_DAYS = 30;

const DAY_MS = 24 * 60 * 60 * 1000;

/**
 * The requester's declined answers worth showing (S4): the NEWEST request per
 * organiser, only when that newest one is declined and was answered within
 * DECLINED_VISIBLE_DAYS. A later open, granted or member row for the same
 * organiser supersedes an older decline, so "asked again" never shows both.
 *
 * The admin's reason, when there is one: list_organiser_access_requests_v1('mine')
 * returns `decision_note` for the caller's own DECLINED rows only (scoped to
 * auth.uid() server-side). fetchMyAccessRequests maps it to `decisionNote`
 * (trimmed, blank becomes null).
 */
export function declinedRequests(requests: readonly MyAccessRequest[], now: Date = new Date()): MyAccessRequest[] {
  const newest = new Map<string, MyAccessRequest>();
  for (const r of requests) {
    const seen = newest.get(r.organiserId);
    if (!seen || Date.parse(r.createdAt) > Date.parse(seen.createdAt)) newest.set(r.organiserId, r);
  }
  return [...newest.values()]
    .filter((r) => {
      if (r.status !== 'declined') return false;
      const answered = Date.parse(r.resolvedAt ?? r.createdAt);
      return Number.isFinite(answered) && now.getTime() - answered <= DECLINED_VISIBLE_DAYS * DAY_MS;
    })
    .sort((a, b) => Date.parse(b.resolvedAt ?? b.createdAt) - Date.parse(a.resolvedAt ?? a.createdAt));
}
