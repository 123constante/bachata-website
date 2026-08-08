// @vitest-environment node
/**
 * REGRESSION GATE: a pinned "today" must not outlive its own day at the edge.
 *
 * THE DEFECT THIS CLOSES. /festival/:id derives `todayKey` on the festival's
 * calendar in the loader and ships it in the SSR payload, so the hero's timing
 * line renders in the crawled HTML rather than only after hydration. That
 * document is edge-cached. Under the default policy (s-maxage 3600 +
 * stale-while-revalidate 86400) ONE generation stays servable for 25 hours, and
 * nothing evicts it on a clock tick -- the tag purge fires on content edits, and
 * the 04:30 UTC daily redeploy leaves the whole midnight-to-04:30 window open.
 * So a document rendered at 23:20 on a multi-day festival's last day could be
 * served at 00:40 the next morning still saying "Happening now" about a
 * finished event. A JS client self-corrects a tick after hydration; the crawled
 * document and the pre-hydration paint do not.
 *
 * WHY TOTAL SERVABILITY, NOT s-maxage. Under SWR the first request past
 * s-maxage is served the STALE copy while revalidation runs behind it -- and for
 * a crawler that first request is frequently the only one. Bounding s-maxage
 * alone would leave the exact request that matters reading the stale claim, so
 * every assertion below is on `s-maxage + stale-while-revalidate`.
 *
 * The label half of this claim is already gated by
 * tests/ssr/festivalDaysAwaySsr.test.tsx ("renders 'Happening now' server-side
 * mid-run"); this file gates the lifetime half.
 */
import { describe, it, expect } from 'vitest';
import {
  cacheHeaders,
  edgeCacheControl,
  taggedData,
  EDGE_STORE_MARGIN_SECONDS,
  parseEdgeTtlBound,
} from '../app/detailLoader';
import { secondsUntilKeyRollsOver } from '@/lib/londonDate';

/** Read one cache-control directive's seconds. Split rather than matched: a
 *  regex for `s-maxage` also matches inside `stale-while-revalidate`. */
const secondsOf = (value: string, directive: string): number | null => {
  const part = value
    .split(',')
    .map((s) => s.trim())
    .find((s) => s.startsWith(directive + '='));
  return part ? Number(part.slice(directive.length + 1)) : null;
};

/** s-maxage is never optional; a missing one means the header is malformed. */
const sMaxAgeOf = (cacheControl: string): number => {
  const s = secondsOf(cacheControl, 's-maxage');
  if (s === null) throw new Error(`no s-maxage in "${cacheControl}"`);
  return s;
};

/** How long the edge may serve ONE generation of this response, in seconds.
 *  An ABSENT stale-while-revalidate is the intended spelling of "no stale
 *  window" -- see the comment on cacheControl in app/detailLoader.ts. */
const totalServableSeconds = (cacheControl: string): number =>
  sMaxAgeOf(cacheControl) + (secondsOf(cacheControl, 'stale-while-revalidate') ?? 0);

/** The Headers a route's `headers({ loaderHeaders })` receives from taggedData. */
const loaderHeadersOf = (result: unknown): Headers =>
  new Headers((result as { init: { headers: Record<string, string> } }).init.headers);

describe('secondsUntilKeyRollsOver', () => {
  it('measures on the GIVEN calendar, not the runtime one', () => {
    // 22:20 UTC on 6 Sept is 23:20 in Tunis (UTC+1, no DST) -- 40 minutes of the
    // festival's own day left. The literal scenario in the finding.
    expect(
      secondsUntilKeyRollsOver('2026-09-06', 'Africa/Tunis', new Date('2026-09-06T22:20:00Z')),
    ).toBe(40 * 60);
    // A zone further east has already rolled PAST that key at the same instant:
    // it is 07:20 on the 7th in Tokyo, so the key is spent.
    expect(
      secondsUntilKeyRollsOver('2026-09-06', 'Asia/Tokyo', new Date('2026-09-06T22:20:00Z')),
    ).toBe(0);
  });

  it('returns 0 for a key the calendar has already passed', () => {
    // The await-crossed-midnight case: a key derived at 23:59:59 and measured
    // three seconds later must not buy a fresh day.
    expect(
      secondsUntilKeyRollsOver('2026-09-06', 'Africa/Tunis', new Date('2026-09-06T23:00:02Z')),
    ).toBe(0);
  });

  it('is DST-safe in both directions', () => {
    // Spring forward: London midnight 2027-03-28 is 00:00Z (BST starts at 01:00),
    // and the next midnight is 23:00Z the same day. A 23-hour day.
    expect(
      secondsUntilKeyRollsOver('2027-03-28', 'Europe/London', new Date('2027-03-28T00:00:00Z')),
    ).toBe(23 * 3600);
    // Fall back: London midnight 2026-10-25 is 23:00Z on the 24th (still BST),
    // and the next midnight is 00:00Z on the 26th. A 25-hour day.
    expect(
      secondsUntilKeyRollsOver('2026-10-25', 'Europe/London', new Date('2026-10-24T23:00:00Z')),
    ).toBe(25 * 3600);
  });

  it('degrades to the London calendar on a missing or invalid zone, never throws', () => {
    const at = new Date('2026-09-06T22:20:00Z');
    const london = secondsUntilKeyRollsOver('2026-09-06', 'Europe/London', at);
    expect(secondsUntilKeyRollsOver('2026-09-06', 'Not/AZone', at)).toBe(london);
    expect(secondsUntilKeyRollsOver('2026-09-06', '', at)).toBe(london);
    expect(secondsUntilKeyRollsOver('2026-09-06', undefined as unknown as string, at)).toBe(london);
  });

  it('degrades a malformed key to today rather than throwing', () => {
    const at = new Date('2026-09-06T22:20:00Z');
    const today = secondsUntilKeyRollsOver('2026-09-06', 'Africa/Tunis', at);
    expect(secondsUntilKeyRollsOver('not-a-date', 'Africa/Tunis', at)).toBe(today);
    expect(secondsUntilKeyRollsOver('2027-02-30', 'Africa/Tunis', at)).toBe(today);
  });

  it('under-estimates, never over-estimates, where local midnight does not exist', () => {
    // The documented limit. America/Havana springs forward AT midnight on
    // 2026-03-08, so local 00:00 never occurs and the underlying fixed point
    // lands an hour early -- the day is reported spent at 04:00Z when it truly
    // ends at 05:00Z. SHORT is the harmless direction: an extra cache miss, not
    // an extra hour of a stale claim. Pinned so that a future change to the
    // fixed point cannot flip the error the other way unnoticed.
    const trueEnd = new Date('2026-03-08T05:00:00Z');
    const anHourBefore = new Date('2026-03-08T04:00:00Z');
    expect(secondsUntilKeyRollsOver('2026-03-07', 'America/Havana', anHourBefore)).toBe(0);
    expect(secondsUntilKeyRollsOver('2026-03-07', 'America/Havana', trueEnd)).toBe(0);
    // The ordinary case in the same zone is exact, so the line above is a
    // narrow limit and not a broken helper. Local 2026-03-09 runs 04:00Z to
    // 04:00Z (Havana is UTC-4 once DST is in), so 03:00Z on the 10th is 23:00
    // local with an hour to run.
    expect(
      secondsUntilKeyRollsOver('2026-03-09', 'America/Havana', new Date('2026-03-10T03:00:00Z')),
    ).toBe(3600);
  });

  it('floors a fractional second rather than rounding it up', () => {
    // Every other case here sits on a whole second, where floor and ceil agree
    // -- so without this one the rounding direction is untested and a change to
    // ceil goes green. Ceil is the over-grant direction, which is the one the
    // "never once long" invariant forbids: 2399.6s left must be 2399, not 2400.
    expect(
      secondsUntilKeyRollsOver('2026-09-06', 'Africa/Tunis', new Date('2026-09-06T22:20:00.400Z')),
    ).toBe(2399);
  });

  it('never returns a negative or absurd span', () => {
    for (const hour of [0, 1, 6, 12, 18, 23]) {
      const stamp = String(hour).padStart(2, '0');
      const at = new Date(`2026-09-06T${stamp}:37:00Z`);
      const s = secondsUntilKeyRollsOver('2026-09-06', 'Europe/London', at);
      expect(s).toBeGreaterThanOrEqual(0);
      expect(s).toBeLessThanOrEqual(25 * 3600);
    }
  });
});

describe('edgeCacheControl', () => {
  it('is byte-identical to the previous policy when unbounded', () => {
    expect(edgeCacheControl()).toBe('public, s-maxage=3600, stale-while-revalidate=86400');
  });

  it('FAILS CLOSED to no caching when a bound was asked for but did not arrive', () => {
    // Absent and corrupt must not collapse into the same case: a route that
    // declared it cannot tolerate the 25h policy must not silently get it back
    // because one value broke in the side channel. Nor may it keep a fresh
    // HOUR -- an hour IS the defect window; the motivating example is a
    // document rendered at 23:20 and served at 00:40.
    expect(edgeCacheControl(Number.NaN)).toBe('public, s-maxage=0');
    expect(totalServableSeconds(edgeCacheControl(Number.NaN))).toBe(0);
    // The distinction itself, stated as the assertion:
    expect(edgeCacheControl(Number.NaN)).not.toBe(edgeCacheControl());
  });

  it('caps TOTAL servability at the bound, less the store margin', () => {
    // The failing case: 40 minutes of the pinned day left. Before this fix the
    // edge granted 90000s here.
    const cc = edgeCacheControl(2400);
    expect(totalServableSeconds(cc)).toBe(2400 - EDGE_STORE_MARGIN_SECONDS);
    // ...with NO stale directive at all, so the first request past the boundary
    // revalidates synchronously rather than being served the stale copy -- and
    // nothing downstream can read a presence-only `stale-while-revalidate` as
    // permission to serve it.
    expect(cc).toBe(`public, s-maxage=${2400 - EDGE_STORE_MARGIN_SECONDS}`);
    expect(secondsOf(cc, 'stale-while-revalidate')).toBeNull();
  });

  it('never grants past the bound, because the CDN clock starts after the loader', () => {
    // The bound is measured in the loader; Vercel starts counting when it
    // STORES the response, after the tree has streamed. Every entry would
    // otherwise outlive its day by the render time, and that error runs the
    // same way as the DST one -- which is the direction the module forbids.
    for (const bound of [30, 600, 2400, 50000, 86400]) {
      expect(totalServableSeconds(edgeCacheControl(bound))).toBeLessThan(bound);
    }
  });

  it('keeps the full fresh window when the day has hours left', () => {
    const cc = edgeCacheControl(50000);
    expect(sMaxAgeOf(cc)).toBe(3600);
    expect(totalServableSeconds(cc)).toBe(50000 - EDGE_STORE_MARGIN_SECONDS);
  });

  it('clamps a zero, negative or sub-margin bound to no caching', () => {
    expect(edgeCacheControl(0)).toBe('public, s-maxage=0');
    expect(edgeCacheControl(-5)).toBe('public, s-maxage=0');
    // Less time left than the margin: the entry cannot be stored in time, so
    // it must not be stored at all rather than wrapping to a huge number.
    expect(edgeCacheControl(EDGE_STORE_MARGIN_SECONDS - 1)).toBe('public, s-maxage=0');
  });
});

describe('parseEdgeTtlBound', () => {
  // Asserted HERE rather than through cacheHeaders on purpose: a corrupt bound
  // and a legitimate zero both emit `public, s-maxage=0`, so a gate written at
  // the header is green whether or not the empty-string check exists. Only the
  // parser can tell the two apart, so only the parser can gate it.
  it('separates never-asked from asked-and-broke', () => {
    expect(parseEdgeTtlBound(null)).toBeUndefined();
    expect(parseEdgeTtlBound('2400')).toBe(2400);
    for (const corrupt of ['', '   ', 'NaN', 'undefined', 'not-a-number']) {
      expect(parseEdgeTtlBound(corrupt)).toBeNaN();
    }
  });

  it('does not read an empty header as a deliberate zero', () => {
    // Number("") is 0 and Number.isFinite(0) is true -- the whole trap.
    expect(Number.isFinite(Number(''))).toBe(true);
    expect(parseEdgeTtlBound('')).not.toBe(0);
  });
});

describe('cacheHeaders', () => {
  const bounded = (seconds?: number) =>
    loaderHeadersOf(taggedData({ ok: true }, 'festival:abc', { edgeTtlBoundSeconds: seconds }));

  it('honours a bound carried on the loader headers', () => {
    expect(totalServableSeconds(cacheHeaders(bounded(2400))['Vercel-CDN-Cache-Control'])).toBe(
      2400 - EDGE_STORE_MARGIN_SECONDS,
    );
  });

  it('does not leak the internal bound header to the client', () => {
    const headers = bounded(2400);
    // Non-vacuity: the loader really did set it, so its absence below is
    // cacheHeaders consuming it and not taggedData having skipped it.
    expect(headers.get('X-Edge-Ttl-Bound')).toBe('2400');
    expect(Object.keys(cacheHeaders(headers))).not.toContain('X-Edge-Ttl-Bound');
  });

  it('fails closed when the bound header is present but unparseable', () => {
    // The side channel breaking must not restore the 25h policy on a route that
    // declared a bound. The empty string is in this list on purpose: Number("")
    // is 0 and 0 is FINITE, so without an explicit guard it slips past the
    // fail-closed branch and lands on the right answer for the wrong reason.
    for (const raw of ['undefined', 'NaN', 'not-a-number', '', '   ']) {
      const out = cacheHeaders(
        new Headers({ 'Vercel-Cache-Tag': 'festival:abc', 'X-Edge-Ttl-Bound': raw }),
      );
      expect(out['Vercel-CDN-Cache-Control']).toBe('public, s-maxage=0');
    }
  });

  it('treats an explicitly-passed undefined as having asked, and fails closed', () => {
    // A caller who meant to supply a bound and computed nothing is NOT the same
    // as a caller who passed no options at all -- the untouched-route case
    // asserted at the end of this block.
    expect(cacheHeaders(bounded(undefined))['Vercel-CDN-Cache-Control']).toBe(
      'public, s-maxage=0',
    );
  });

  it('leaves an untagged (404/500) response uncached, bound or not', () => {
    const out = cacheHeaders(new Headers({ 'X-Edge-Ttl-Bound': '2400' }));
    expect(out['Vercel-CDN-Cache-Control']).toBeUndefined();
  });

  it('leaves a route that passes no bound on the previous policy', () => {
    const out = cacheHeaders(loaderHeadersOf(taggedData({ ok: true }, 'venue:abc')));
    expect(out['Vercel-CDN-Cache-Control']).toBe(
      'public, s-maxage=3600, stale-while-revalidate=86400',
    );
  });
});

// The /festival/:id wiring -- that its LOADER supplies the bound at all -- is
// gated in tests/festivalLoaderEdgeTtl.test.ts, which drives the real loader.
// Asserting it here by hand-building the loader headers looked like a wiring
// test and was not: deleting the third argument at the route's taggedData call
// left it green.
