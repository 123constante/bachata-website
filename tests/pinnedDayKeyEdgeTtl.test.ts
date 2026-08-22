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
import { describe, it, expect, vi } from 'vitest';
import {
  cacheHeaders,
  edgeCacheControl,
  taggedData,
  EDGE_STORE_MARGIN_SECONDS,
  parseEdgeTtlBound,
} from '../app/detailLoader';
import { pinDayAndBound, secondsUntilKeyRollsOver } from '@/lib/londonDate';

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

  it('degrades a malformed key to today on the GIVEN zone, not London', () => {
    // Africa/Tunis above is UTC+1 year-round, the same offset London runs at
    // all BST season, so that case cannot tell "degrades on timeZone" apart
    // from "degrades to London" -- the exact vacuity in F1. Tokyo (UTC+9, no
    // DST) disagrees with London on the calendar DATE at this instant: 22:20Z
    // on 6 Sept is 07:20 on the 7th in Tokyo, still 23:20 on the 6th in
    // London (BST, UTC+1). A fallback to London would report the wrong day's
    // rollover.
    const at = new Date('2026-09-06T22:20:00Z');
    const tokyoToday = secondsUntilKeyRollsOver('2026-09-07', 'Asia/Tokyo', at);
    const london = secondsUntilKeyRollsOver('2026-09-06', 'Europe/London', at);
    expect(tokyoToday).not.toBe(london);
    expect(secondsUntilKeyRollsOver('not-a-date', 'Asia/Tokyo', at)).toBe(tokyoToday);
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

// A zero bound is not spelled `public, s-maxage=0`. `must-revalidate` is set
// explicitly even though RFC 9111 5.2.2.8/5.2.2.10 already forbid a shared
// cache from serving this stale on origin error via `s-maxage` alone -- the
// whole premise of reaching zero is that we do not know this document is
// true, so the directive states that intent rather than granting a latitude
// that was never there to withdraw.
const NO_EDGE_CACHE = 'public, s-maxage=0, must-revalidate';

describe('pinDayAndBound', () => {
  // A clock that returns each instant in turn, so the gap between the key read
  // and the bound read can be made to straddle midnight. That gap is two
  // adjacent statements in real code, which no frozen clock can reproduce --
  // which is exactly why the helper takes an injectable `now`.
  const clockOf = (...instants: string[]) => {
    let i = 0;
    return () => new Date(instants[Math.min(i++, instants.length - 1)]);
  };

  it('re-derives when the key and the bound straddle midnight', () => {
    // Key read at 23:59:59 London, bound read at 00:00:01 the next day.
    const { dayKey, boundSeconds } = pinDayAndBound(
      'Europe/London',
      clockOf('2026-09-06T22:59:59Z', '2026-09-06T23:00:01Z'),
    );

    // The emitted key is the day it is NOW, not the day the read started on.
    // Without the retry this is '2026-09-06' with a zero bound: a document
    // asserting yesterday, merely uncached. Declining to cache does not unsay
    // it, and for a crawler that one request is the whole audience.
    expect(dayKey).toBe('2026-09-07');
    // ...and a real day's servability rather than none.
    expect(boundSeconds).toBeGreaterThan(86000);
  });

  it('leaves the ordinary case on ONE derivation', () => {
    // Non-vacuity for the case above: mid-afternoon, no straddle, so the first
    // answer stands and the bound is the remainder of the day.
    const { dayKey, boundSeconds } = pinDayAndBound(
      'Europe/London',
      clockOf('2026-09-06T13:00:00Z'),
    );
    expect(dayKey).toBe('2026-09-06');
    expect(boundSeconds).toBe(10 * 3600); // 14:00 to midnight BST
  });

  it('still reports zero when the SECOND read straddles too', () => {
    // The retry is bounded at one. A pathological clock that crosses on both
    // reads must degrade to an uncacheable answer, never loop and never hand
    // back a fresh day for a key that is already stale.
    // Four reads, because the helper makes four: key, bound, key again, bound
    // again. Both PAIRS straddle -- 23:59:59 then 00:00:01, a day apart.
    const { boundSeconds } = pinDayAndBound(
      'Europe/London',
      clockOf(
        '2026-09-06T22:59:59Z',
        '2026-09-06T23:00:01Z',
        '2026-09-07T22:59:59Z',
        '2026-09-07T23:00:01Z',
      ),
    );
    expect(boundSeconds).toBe(0);
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
    expect(edgeCacheControl(Number.NaN)).toBe(NO_EDGE_CACHE);
    expect(totalServableSeconds(edgeCacheControl(Number.NaN))).toBe(0);
    // The distinction itself, stated as the assertion:
    expect(edgeCacheControl(Number.NaN)).not.toBe(edgeCacheControl());
  });

  it('prohibits stale-on-error at zero, rather than merely not permitting it', () => {
    // Withholding stale-while-revalidate is not the same as forbidding a stale
    // serve. Asserted separately from the string above so that a future rewrite
    // of the zero spelling cannot drop the directive while still "passing" on a
    // byte comparison someone updated to match.
    expect(edgeCacheControl(Number.NaN)).toContain('must-revalidate');
    expect(edgeCacheControl(0)).toContain('must-revalidate');
    // ...and the BOUNDED path deliberately does not, because serving a slightly
    // old festival page beats failing it while Supabase is down.
    expect(edgeCacheControl(2400)).not.toContain('must-revalidate');
    expect(edgeCacheControl()).not.toContain('must-revalidate');
  });

  it('treats Infinity as "no expiry" from a CALLER, and as corrupt from the wire', () => {
    // Infinity is the natural spelling of content that never goes stale -- a
    // caller asking for the MOST permissive policy. Failing it closed would hand
    // that caller the least permissive one, and nothing at the call site would
    // show it.
    expect(edgeCacheControl(Number.POSITIVE_INFINITY)).toBe(edgeCacheControl());
    // -Infinity is NOT that request, and stays on the fail-closed path.
    expect(edgeCacheControl(Number.NEGATIVE_INFINITY)).toBe(NO_EDGE_CACHE);

    // The side channel is a STRING some producer wrote, and Number() maps four
    // different typos onto POSITIVE_INFINITY. Honouring it there would let one
    // broken value hand itself back the whole 25-hour policy on a route that
    // declared it cannot tolerate it -- the precise fail-open the branch exists
    // to close, arriving through the branch meant to be its exception. So the
    // permissive answer is available to a caller and to nothing else.
    for (const raw of ['Infinity', '+Infinity', '1e400', '9e999']) {
      expect(parseEdgeTtlBound(raw)).toBeNaN();
      expect(edgeCacheControl(parseEdgeTtlBound(raw))).toBe(NO_EDGE_CACHE);
      // Stated as the distinction, so a future rewrite cannot pass by making
      // these two collapse back into each other:
      expect(edgeCacheControl(parseEdgeTtlBound(raw))).not.toBe(edgeCacheControl());
    }
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

  it('never grants MORE than the unbounded policy, however large the bound', () => {
    // The other half of the clamp, and it was untested: every bound exercised
    // anywhere in this repo was <= 86400, and for all of those
    // min(90000, bound - 5) === bound - 5, so deleting the outer
    // `Math.min(EDGE_S_MAXAGE + EDGE_SWR, ...)` was a fully-green mutation
    // (verified: 44/44 still passed). A bound is a CAP on the default policy,
    // never a licence to exceed it, and four route modules now pass one --
    // the first to compute a multi-day span (a festival running a week is
    // 604800) would have been handed eight days of edge servability against an
    // intended 25-hour ceiling, with no test moving.
    const UNBOUNDED = totalServableSeconds(edgeCacheControl());
    // Values that overshoot the ceiling by MORE than the store margin, so the
    // clamp is the only thing that can produce the answer. EDGE_S_MAXAGE +
    // EDGE_SWR itself is NOT such a value -- the margin is subtracted before
    // the min, so edgeCacheControl(90000) is 89995 either way and would have
    // made this case look green while testing nothing. That is the same
    // fixture-not-assertion trap this describe block was just fixed for.
    for (const bound of [604_800, Number.MAX_SAFE_INTEGER]) {
      expect(totalServableSeconds(edgeCacheControl(bound))).toBe(UNBOUNDED);
    }
    // Distinct from the Infinity branch above, which is an explicit "no expiry"
    // from a caller; these are finite numbers that merely overshoot. The
    // distinction is carried by the loop above and by the separate Infinity
    // case -- an assertion over the literal would restate the fixture and could
    // never fail.
  });

  it('clamps a zero, negative or sub-margin bound to no caching', () => {
    expect(edgeCacheControl(0)).toBe(NO_EDGE_CACHE);
    expect(edgeCacheControl(-5)).toBe(NO_EDGE_CACHE);
    // Less time left than the margin: the entry cannot be stored in time, so
    // it must not be stored at all rather than wrapping to a huge number.
    expect(edgeCacheControl(EDGE_STORE_MARGIN_SECONDS - 1)).toBe(NO_EDGE_CACHE);
  });
});

describe('taggedData option shape', () => {
  it('does not throw when handed a positional number instead of an options object', () => {
    // The seconds-or-milliseconds confusion the named option exists to prevent.
    // tsc rejects it, but no workflow gates on general tsc output, so this is
    // the only thing standing between that slip and a TypeError thrown inside
    // the loader on every request -- a hard 500, not a wrong TTL.
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    try {
      const call = () => taggedData({ ok: true }, 'tag', 2400 as never);
      expect(call).not.toThrow();
      // ...and it FAILS CLOSED. Skipping silently was the first answer and it is
      // the worse of the two: no header means cacheHeaders reads "never asked"
      // and the route keeps the 25-hour policy, which is edgeCacheControl's own
      // forbidden collapse of "absent" into "corrupt" -- on a route that
      // declared it cannot tolerate it. An earlier revision of THIS case
      // asserted that fail-open as the contract.
      const headers = new Headers(
        (call() as { init: { headers: Record<string, string> } }).init.headers,
      );
      expect(headers.get('X-Edge-Ttl-Bound')).toBe('NaN');
      expect(edgeCacheControl(parseEdgeTtlBound(headers.get('X-Edge-Ttl-Bound')))).toBe(
        NO_EDGE_CACHE,
      );
      // NaN, not '2400': a positional number must not be honoured as seconds,
      // because seconds-or-milliseconds is the whole ambiguity being refused.
      expect(headers.get('X-Edge-Ttl-Bound')).not.toBe('2400');
      // ...and it is loud. The consequence (every request origin-renders) is
      // otherwise completely silent at the call site.
      expect(warn).toHaveBeenCalled();
    } finally {
      warn.mockRestore();
    }
  });
});

describe('parseEdgeTtlBound', () => {
  // Asserted HERE rather than through cacheHeaders on purpose: a corrupt bound
  // and a legitimate zero emit the SAME header, so a gate written at
  // the header is green whether or not the empty-string check exists. Only the
  // parser can tell the two apart, so only the parser can gate it.
  it('separates never-asked from asked-and-broke', () => {
    expect(parseEdgeTtlBound(null)).toBeUndefined();
    expect(parseEdgeTtlBound('2400')).toBe(2400);
    // A REAL zero, not the empty-string trap below -- '0'.trim() is truthy, so
    // a tidy to `raw.trim() ? Number(raw) : NaN` reads this as corrupt and
    // turns every "no cache" bound into "never asked".
    expect(parseEdgeTtlBound('0')).toBe(0);
    for (const corrupt of ['', '   ', 'NaN', 'undefined', 'not-a-number', 'Infinity', '1e400']) {
      expect(parseEdgeTtlBound(corrupt)).toBeNaN();
    }
  });

  it('spells a caller Infinity by OMITTING the header, byte-identically', () => {
    // The two halves of the rule have to meet. Since the parser now rejects
    // 'Infinity' off the wire, taggedData must never put it there, or a caller
    // legitimately asking for "no expiry" would be silently inverted into no
    // caching at all. Omission is EXACT rather than approximate here, because
    // edgeCacheControl(Infinity) and edgeCacheControl() are the same string.
    const headers = loaderHeadersOf(
      taggedData({ ok: true }, 'festival:abc', {
        edgeTtlBoundSeconds: Number.POSITIVE_INFINITY,
      }),
    );
    expect(headers.get('X-Edge-Ttl-Bound')).toBeNull();
    expect(cacheHeaders(headers)['Vercel-CDN-Cache-Control']).toBe(edgeCacheControl());
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
      expect(out['Vercel-CDN-Cache-Control']).toBe(NO_EDGE_CACHE);
    }
  });

  it('treats an explicitly-passed undefined as having asked, and fails closed', () => {
    // A caller who meant to supply a bound and computed nothing is NOT the same
    // as a caller who passed no options at all -- the untouched-route case
    // asserted at the end of this block.
    expect(cacheHeaders(bounded(undefined))['Vercel-CDN-Cache-Control']).toBe(NO_EDGE_CACHE);
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
