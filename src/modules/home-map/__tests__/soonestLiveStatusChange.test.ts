/**
 * REGRESSION GATE: the homepage's edge TTL must expire when its BADGE expires,
 * not merely when its day does.
 *
 * app/routes/home.tsx pins one instant and the feed server-renders an
 * "On now" / "Soon" badge from it. The document is edge-cached, and time passing
 * is not a content edit, so nothing evicts it: rendered at 22:55 while a social
 * ran, it is otherwise still served at 23:30 claiming the social is on -- inside
 * the SAME calendar day, which is precisely why secondsUntilKeyRollsOver cannot
 * reach this and the SEO landings needed nothing more.
 *
 * WHY THE CASES ARE WRITTEN AGAINST todayLiveStatus RATHER THAN AGAINST THE
 * ARITHMETIC. An expiry derived from a rule is only correct if it agrees with
 * the rule, and asserting the minute offsets (0, +1) here would restate the
 * implementation in a second place and pass whether or not either matched the
 * badge. So every case below asserts the PROPERTY that makes the bound sound:
 * at the instant returned, todayLiveStatus has moved a row into or out of
 * ON-NOW -- and one minute earlier it has not. Change the split-time precedence
 * in mapTypes and these stay green because BOTH sides move; break the link
 * between them and they red.
 *
 * ON-NOW, NOT THE WHOLE STATUS. The null -> 'soon' edge is deliberately outside
 * the bound: a cached document that has not yet started saying "Soon" omits an
 * advance warning, where one still saying "Soon" mid-event or "On now" after
 * closing states something untrue. Bounding all three collapsed this route's TTL
 * to minutes through its busiest hours to buy the one that cannot be wrong.
 */
import { describe, it, expect } from 'vitest';
import { soonestLiveStatusChangeMs, todayLiveStatus, type MapEvent } from '../mapTypes';

const TODAY = '2026-09-06';

/** 20:00-23:00 on the pinned London day. Wall-clock stamped '+00' per the
 *  local-as-UTC convention -- 20:00 here IS 20:00 in London, which in BST is
 *  19:00Z. A helper that treated the stamp as UTC would place every edge an
 *  hour early, all summer. */
const base: MapEvent = {
  occurrence_id: 'o1',
  event_id: 'e1',
  name: 'Sensual Social',
  cover_image_url: null,
  venue_name: null,
  area: null,
  city_slug: 'london-gb',
  lat: null,
  lng: null,
  instance_date: TODAY,
  start_time: `${TODAY} 20:00:00+00`,
  end_time: `${TODAY} 23:00:00+00`,
  type: 'standard',
  has_party: true,
  has_class: false,
  class_start: null,
  class_end: null,
  party_start: null,
  party_end: null,
  created_at: null,
  updated_at: null,
  freshness_kind: null,
  is_cancelled: false,
  cancellation_reason_label: null,
} as MapEvent;

const at = (utc: string) => new Date(utc).getTime();

/** The property the bound rests on: the returned instant is the FIRST minute at
 *  which some row's ON-NOW membership stops agreeing with what it was at the
 *  pin. Read off todayLiveStatus, never off the offsets. */
const expectIsFirstOnNowChange = (events: MapEvent[], pinned: number) => {
  const edge = soonestLiveStatusChangeMs(events, TODAY, pinned);
  expect(edge).not.toBeNull();
  const onNowAt = (t: number) =>
    events.map((e) => todayLiveStatus(e, new Date(t), TODAY) === 'on-now').join('|');
  expect(onNowAt(edge as number)).not.toBe(onNowAt(pinned));
  // ...and not a minute sooner than it had to be, which would be a bound that
  // expires documents while they are still true.
  expect(onNowAt((edge as number) - 60_000)).toBe(onNowAt(pinned));
  return edge as number;
};

describe('soonestLiveStatusChangeMs', () => {
  it('bounds a quiet morning at the START, not at the soon decoration', () => {
    // 12:00 London. A document cached here is still honest at 18:31 -- it shows
    // no badge for a row that reads "Soon", which is an omission -- and stops
    // being honest at 20:00, when it shows no badge for a row that is ON.
    const edge = expectIsFirstOnNowChange([base], at('2026-09-06T11:00:00Z'));
    expect(edge).toBe(at('2026-09-06T19:00:00Z')); // 20:00 London, not 18:30
  });

  it('finds the soon -> on-now edge from inside the soon window', () => {
    // 19:00 London: already "Soon", so the day bound would grant five more
    // hours of a badge that goes wrong in one.
    expectIsFirstOnNowChange([base], at('2026-09-06T18:00:00Z'));
  });

  it('finds the on-now -> null edge from mid-event', () => {
    // 22:55 London -- the motivating scenario. Same calendar day as 23:30, so
    // this is the case a day bound provably cannot close.
    const edge = expectIsFirstOnNowChange([base], at('2026-09-06T21:55:00Z'));
    expect(edge - at('2026-09-06T21:55:00Z')).toBeLessThan(10 * 60_000);
  });

  it('reads the stamps as London wall clock, not as UTC', () => {
    // The whole BST-season trap in one assertion: 20:00 in the row means 19:00Z.
    // A helper parsing the '+00' literally would return 20:00Z here.
    expect(soonestLiveStatusChangeMs([base], TODAY, at('2026-09-06T11:00:00Z'))).toBe(
      at('2026-09-06T19:00:00Z'),
    );
  });

  it('returns null when nothing changes again today', () => {
    // Past the end: the badge is null for the rest of the day, so the day bound
    // is the only expiry left and this must not invent a shorter one.
    expect(soonestLiveStatusChangeMs([base], TODAY, at('2026-09-06T22:30:00Z'))).toBeNull();
    // A cancelled row never shows a badge, so it never expires one.
    expect(
      soonestLiveStatusChangeMs(
        [{ ...base, is_cancelled: true }],
        TODAY,
        at('2026-09-06T11:00:00Z'),
      ),
    ).toBeNull();
    // Nor does a row on a different day -- the 90-day feed is mostly these.
    expect(
      soonestLiveStatusChangeMs(
        [{ ...base, instance_date: '2026-09-07' }],
        TODAY,
        at('2026-09-06T11:00:00Z'),
      ),
    ).toBeNull();
  });

  it('takes the SOONEST edge across rows, not the first one found', () => {
    const later = { ...base, occurrence_id: 'o2', start_time: `${TODAY} 22:00:00+00` };
    const earlier = { ...base, occurrence_id: 'o3', start_time: `${TODAY} 19:00:00+00` };
    // Ordered late-first so a min() replaced by "the first row's edge" reds.
    expect(soonestLiveStatusChangeMs([later, earlier], TODAY, at('2026-09-06T11:00:00Z'))).toBe(
      at('2026-09-06T18:00:00Z'), // 19:00 London, the earlier row's start
    );
  });

  it('resolves the AMBIGUOUS October hour to the earlier instant', () => {
    // 2026-10-25: 02:00 BST rewinds to 01:00 GMT, so 01:30 happens twice and a
    // plain wall-clock fixed point converges on the SECOND. That is an hour LATE
    // -- the direction that keeps a document servable after its badge went
    // false, and the direction secondsUntilKeyRollsOver's "never once long"
    // invariant exists to forbid. The badge flips at the FIRST 01:30.
    const day = '2026-10-25';
    const row = { ...base, instance_date: day, start_time: `${day} 01:30:00+00`, end_time: null };
    const pin = at('2026-10-24T23:00:00Z'); // 00:00 BST on the 25th
    const edge = soonestLiveStatusChangeMs([row as MapEvent], day, pin);

    expect(edge).toBe(at('2026-10-25T00:30:00Z')); // 01:30 BST, not 01:30 GMT
    // The same property the other cases assert: the row is not on at the pin and
    // is on at the returned instant. Taking the GMT 01:30 would have kept a
    // document that shows "Soon" servable for the whole hour the row was ON.
    expect(todayLiveStatus(row as MapEvent, new Date(pin), day)).toBe('soon');
    expect(todayLiveStatus(row as MapEvent, new Date(edge as number), day)).toBe('on-now');
  });

  it('never overshoots the March hour that does not exist', () => {
    // 2026-03-29: 01:00 GMT jumps to 02:00 BST, so the 01:30 start edge is never
    // on the clock at all and the fixed point lands after the jump. Same
    // failure direction, so the same resolution: never later than the instant
    // the badge actually changes, which here is the jump itself (02:00 BST).
    const day = '2026-03-29';
    const row = { ...base, instance_date: day, start_time: `${day} 01:30:00+00`, end_time: null };
    const edge = soonestLiveStatusChangeMs([row as MapEvent], day, at('2026-03-29T00:00:00Z'));

    expect(edge).not.toBeNull();
    expect(edge as number).toBeLessThanOrEqual(at('2026-03-29T01:00:00Z'));
  });

  it('ignores an edge the pin has already passed', () => {
    // 21:00 London: this row's soon and start edges are spent. Returning one
    // would hand the caller a negative bound for a document that is still true.
    const edge = soonestLiveStatusChangeMs([base], TODAY, at('2026-09-06T20:00:00Z'));
    expect(edge).toBeGreaterThan(at('2026-09-06T20:00:00Z'));
  });
});
