import { describe, expect, it } from 'vitest';
import { parseEventWorkspace, type EventWorkspace } from '../../../events/eventModel';
import { wsRaw } from '../../screens/__tests__/wsFixtures';
import { changedKeys, trayLines } from '../../model/saveModel';
import { detailsDraftOf, detailsPlan } from '../details';
import { isFree, pricesDraftOf, pricesPlan, pricesSpecs, type PricesDraft } from '../prices';

/*
 * Review round 1 on PR #1082 (docs/reviews/1082-r1.md), the pure half: each row was RED on
 * 4da101f. The send-path half is in screens/__tests__ (editScreens.send, w2dNits).
 */

const ws = (raw: unknown): EventWorkspace => parseEventWorkspace(raw);
const UUID1 = '11111111-1111-4111-8111-111111111111';
const owner = ws(wsRaw({ passes: [{ id: UUID1, name: 'Class', price: 15, currency: 'GBP' }] }, [], []));
const festival = (methods: string) => ws(wsRaw({ format: 'festival', recurrence_rule: null, passes: [], payment_methods: methods }, [], []));

describe('r1 #2: a change the builder would not send is no change', () => {
  const base = pricesDraftOf(owner);
  const row = (patch: Partial<PricesDraft['rows'][number]>): PricesDraft => ({ ...base, rows: [{ ...base.rows[0], ...patch }] });
  it.each([
    ['a trailing space in a price name', row({ name: 'Class ' })],
    ['15 typed as 15.0', row({ price: '15.0' })],
    ['15 typed as 015', row({ price: '015' })],
  ])('%s: no changed field, nothing sent', (_n, draft) => {
    expect(changedKeys(pricesSpecs(owner), base, draft)).toEqual([]);
    expect(pricesPlan(owner, base, draft)).toEqual([]);
  });
  it('a real price change is still a change, and sends the list', () => {
    const draft = row({ price: '16' });
    expect(changedKeys(pricesSpecs(owner), base, draft)).toEqual(['rows']);
    expect(pricesPlan(owner, base, draft)).toHaveLength(1);
  });
  it('a festival with a stored door code: a list that differs only in codes it cannot offer is no change', () => {
    const w = festival('door');
    const b = pricesDraftOf(w);
    expect(b.methods).toEqual(['door']);
    expect(changedKeys(pricesSpecs(w), b, { ...b, methods: [] })).toEqual([]);
    expect(pricesPlan(w, b, { ...b, methods: [] })).toEqual([]);
    expect(pricesPlan(w, b, { ...b, methods: ['door', 'ticket_link'] })[0].payload).toEqual({ name: 'Sensual Fridays', payment_methods: 'ticket_link' });
  });
  it('belt and braces: changes the plan would not send read as no changes (Save off, "Nothing changed yet")', () => {
    expect(trayLines(['Prices: x'], [], null)).toEqual([]);
    // a blocked change keeps its line: the Save button names the problem instead
    expect(trayLines(['Prices: x'], [], 'Give every price a name')).toEqual(['Prices: x']);
    expect(trayLines(['Prices: x'], [{ kind: 'series.upsert', payload: { name: 'A' } }], null)).toEqual(['Prices: x']);
  });
});

describe('r1 #3: a new place always says its city', () => {
  const w = ws(wsRaw({}, [], []));
  const base = detailsDraftOf(w);
  it('a city that cannot be found goes as null, never left as the old place\'s city', () => {
    expect(detailsPlan(base, { ...base, venueId: 'v2' }, null)[0].payload).toEqual({ name: 'Sensual Fridays', default_venue_id: 'v2', default_city_id: null });
    expect(detailsPlan(base, { ...base, venueId: 'v2' }, 'city-9')[0].payload).toEqual({ name: 'Sensual Fridays', default_venue_id: 'v2', default_city_id: 'city-9' });
  });
  it('no place change sends no city', () => {
    expect(detailsPlan(base, { ...base, description: 'x' }, null)[0].payload).not.toHaveProperty('default_city_id');
  });
});

describe('r1 #5: a festival with a stored free code (0 on prod, 2026-10-27, all 13 festivals read)', () => {
  // No UI change (brief): the row pins today's behaviour so a future stored `free` is not a surprise.
  const w = festival('free,ticket_link');
  const b = pricesDraftOf(w);
  it('reads as free and an untouched save sends nothing', () => {
    expect(isFree(b)).toBe(true);
    expect(pricesPlan(w, b, b)).toEqual([]);
  });
  it('the ticket link chip is still a control: turning it off sends the festival list, which drops free', () => {
    expect(pricesPlan(w, b, { ...b, methods: ['free'] })[0].payload).toEqual({ name: 'Sensual Fridays', payment_methods: '' });
  });
});
