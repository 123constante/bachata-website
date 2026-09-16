// 2026-09-15/16: synthetic-ssr-monitor.yml issue #425 -- page.goto timing out at
// 30s against production on /city/london-gb and an event page, both twice in three
// nights. Not a thrown render error: the whole HTTP response never arrived, which
// points at an SSR loader awaiting a Supabase call that stalled (no default fetch
// timeout in src/integrations/supabase/client.ts) and never resolved or rejected.
//
// Deliberately scoped to LOADERS, not a client-wide fetch patch: an earlier draft
// wrapped every Supabase request via `global.fetch` on the shared client, which
// also caps client-side/CSR calls and interactive auth refreshes that never had a
// "hang the whole HTTP response" failure mode -- and at least one legitimate RPC
// (get_occurrence_program_v1, queued-occurrence-program-rpc-timeout.md) is known to
// take 139s+ against prod on some input. That RPC is invoked from client
// components after hydration (ScheduleBlock.tsx / EventScheduleGrid.tsx), never
// from a loader, so scoping to loaders leaves it untouched.
//
// 2026-09-16 rework: a SECOND draft wrapped individual Supabase call sites inside
// two route loaders (a `raceSsrLoaderTimeout` helper -- removed 2026-09-16 once it
// had zero remaining callers, see below). Review found that pattern unsafe to keep
// as the primary mechanism: home.tsx's midnight-straddle retry ran two
// independently-timed 8s races back to back for an undocumented ~16s worst case,
// and event.tsx still awaited resolveOgCardImage/festivalPrefetch completely
// unguarded -- the #425 hang was still reachable one call downstream inside the
// very loader meant to fix it. A per-call-site pattern has no way to prove a NEW
// loader, or a new await added to an existing one, is covered.
//
// `withSsrLoaderTimeout` is the fix: wrap the LOADER EXPORT once, so the deadline
// covers every await inside it by construction, current and future. Applied at the
// `export const loader = withSsrLoaderTimeout(...)` call in every route file under
// app/routes/ that awaits Supabase from a browser-rendered page loader -- there is
// no guard enforcing that a NEW route does the same (flagged to Ricky as a
// residual, not built here). api.embed.calendar.tsx, api.ics.calendar.tsx and
// api.og.card.tsx are feed/API endpoints, not page loaders a browser awaits via
// page.goto, and are deliberately left out of this pass.
//
// This does not cancel the underlying database work -- Postgres keeps running the
// query -- it only stops the loader from awaiting it forever, so the response
// completes (as a thrown error -> the route ErrorBoundary fallback) instead of
// hanging past Playwright's/the browser's own timeout.
export class SsrLoaderTimeoutError extends Error {
  constructor(label: string, ms: number) {
    super(`SSR loader call "${label}" did not settle within ${ms}ms`);
    this.name = 'SsrLoaderTimeoutError';
  }
}

// Structural check, not `instanceof` -- kept for anything that logs `err.name`
// after a bundler/minifier step where class identity does not survive but the
// constructor-assigned `name` string does (entry.server's handleError relies on
// this to tag the structured log line without depending on module identity).
export function isSsrLoaderTimeoutError(err: unknown): boolean {
  return err instanceof Error && err.name === 'SsrLoaderTimeoutError';
}

const DEFAULT_SSR_LOADER_TIMEOUT_MS = 8_000;

/**
 * Wrap a whole React Router loader in one SSR deadline. Every await inside
 * `loaderFn` shares the single budget, so a call added later is covered without
 * a second call-site edit -- the gap review found in event.tsx (resolveOgCardImage
 * / festivalPrefetch reachable unguarded one hop past the wrapped prefetch) can't
 * recur here because there is no inner boundary left to miss.
 *
 * On timeout, the underlying `loaderFn` promise is left running (Postgres keeps
 * the query open -- see the file header) and its EVENTUAL settlement, win or
 * lose, is logged distinctly rather than silently dropped: the response has
 * already gone out as a timeout by then, and an unhandled rejection on a promise
 * nothing awaits any more would otherwise surface as a bare Node warning with none
 * of this context. Both branches of `inner`'s own settlement log -- a late
 * SUCCESS is the one that actually matters for tuning `ms`, since it is the only
 * signal that the deadline fired on a call that was merely slow, not broken.
 */
export function withSsrLoaderTimeout<Args extends unknown[], R>(
  label: string,
  loaderFn: (...args: Args) => Promise<R>,
  ms: number = DEFAULT_SSR_LOADER_TIMEOUT_MS,
): (...args: Args) => Promise<R> {
  return (...args: Args) => {
    const inner = loaderFn(...args);
    return new Promise<R>((resolve, reject) => {
      let settled = false;
      const timer = setTimeout(() => {
        settled = true;
        reject(new SsrLoaderTimeoutError(label, ms));
      }, ms);
      // One subscription handles both the on-time settlement and the late
      // arrival, branching on `settled` at the moment each handler runs (never
      // set by this branch itself, only by the deadline timer above) -- a
      // late arrival after the deadline already rejected is logged distinctly
      // instead of vanishing as a silent no-op (a bare `.catch` here would only
      // observe a late REJECTION, missing the more actionable "would have
      // succeeded at Xms" case entirely).
      inner.then(
        (value) => {
          if (settled) {
            // eslint-disable-next-line no-console
            console.error(
              `[ssrLoaderTimeout] "${label}" SUCCEEDED after its ${ms}ms deadline had already ` +
                `rejected the response as a timeout -- the DB call was not cancelled and ran to ` +
                `completion, but this value arrived too late to affect what was sent.`,
              value,
            );
            return;
          }
          clearTimeout(timer);
          resolve(value);
        },
        (err) => {
          if (settled) {
            // eslint-disable-next-line no-console
            console.error(
              `[ssrLoaderTimeout] "${label}" FAILED after its ${ms}ms deadline had already ` +
                `rejected the response as a timeout -- the DB call was not cancelled and ran to ` +
                `completion, but this error arrived too late to affect what was sent.`,
              err,
            );
            return;
          }
          clearTimeout(timer);
          reject(err);
        },
      );
    });
  };
}
