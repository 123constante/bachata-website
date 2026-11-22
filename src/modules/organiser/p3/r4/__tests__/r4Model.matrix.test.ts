import { describe, expect, it } from 'vitest';
import { r4HomeOf, type R4NextNight } from '../r4Model';
import { r4TabOf } from '../R4Shell';
import type { PastNight } from '../../dash/dashModel';

const next = (o: Partial<R4NextNight> = {}): R4NextNight => ({
  seriesId: 's1', name: 'Friday Social', when: 'Friday 20 November, 9pm', place: 'Soho Dance Studio', draft: false, link: 'https://x/event/a', ...o,
});
const last = (o: Partial<PastNight> = {}): PastNight => ({
  key: 'k', seriesId: 's1', occurrenceId: 'o1', date: '2026-11-13', name: 'Friday Social', when: 'Friday 13 November', cancelled: false, cameIn: 54, ticketsSold: 61, raffle: null, ...o,
});

describe('R4 Home: every real shape', () => {
  it.each([
    // [case, input, face, tile keys, primary kind, primary disabled]
    ['before, ticketed, sold', { clock: 'before', next: next(), door: { sold: 41, cameIn: 0 }, last: null }, 'before', ['sold'], 'share', false],
    ['before, not ticketed (no door read)', { clock: 'before', next: next(), door: null, last: null }, 'before', [], 'share', false],
    ['before, ticketed, none sold yet: no zero claim', { clock: 'before', next: next(), door: { sold: 0, cameIn: 0 }, last: null }, 'before', [], 'share', false],
    ['before, draft', { clock: 'before', next: next({ draft: true }), door: null, last: null }, 'before', [], 'share', true],
    ['before, no public link', { clock: 'before', next: next({ link: null }), door: null, last: null }, 'before', [], 'share', true],
    ['night, ticketed', { clock: 'night', next: next({ when: 'Tonight, 9pm' }), door: { sold: 41, cameIn: 12 }, last: null }, 'night', ['sold', 'in'], 'door', false],
    ['night, not ticketed', { clock: 'night', next: next({ when: 'Tonight, 9pm' }), door: null, last: null }, 'night', [], 'door', false],
    ['after, counts read', { clock: 'after', next: next(), door: null, last: last() }, 'after', ['came', 'sold'], 'share', false],
    ['after, no counts (not ticketed)', { clock: 'after', next: null, door: null, last: last({ cameIn: null, ticketsSold: null }) }, 'after', [], 'new', false],
    ['nothing coming, nothing past', { clock: 'before', next: null, door: null, last: null }, 'empty', [], 'new', false],
  ] as const)('%s', (_c, input, face, tiles, kind, disabled) => {
    const m = r4HomeOf(input as Parameters<typeof r4HomeOf>[0]);
    expect(m.face).toBe(face);
    expect(m.tiles.map((t) => t.key)).toEqual(tiles);
    expect(m.primary.kind).toBe(kind);
    expect(m.primary.disabled).toBe(disabled);
    if (m.primary.disabled) expect(m.primary.reason).toBeTruthy();
  });

  it('before: pill is the day word, sub joins when and where', () => {
    const m = r4HomeOf({ clock: 'before', next: next(), door: null, last: null });
    expect(m.pill).toEqual({ word: 'Friday 20 November', tone: 'ok' });
    expect(m.sub).toBe('Friday 20 November, 9pm at Soho Dance Studio');
  });
  it('night: checked in reads against sold', () => {
    const m = r4HomeOf({ clock: 'night', next: next(), door: { sold: 41, cameIn: 12 }, last: null });
    expect(m.tiles[1]).toMatchObject({ label: 'Checked in', value: '12', of: 'of 41' });
  });
  it('after: raffle words become a line', () => {
    expect(r4HomeOf({ clock: 'after', next: null, door: null, last: last({ raffle: 'Raffle winner: Ana' }) }).lines).toEqual(['Raffle winner: Ana']);
  });
  it.each([
    ['/account/p3', 'home'], ['/account/p3/events', 'events'], ['/account/p3/events/x/dates', 'events'], ['/account/p3/create', 'events'],
    ['/account/p3/tickets', 'tickets'], ['/account/p3/you/team', 'team'], ['/account/p3/you/team/add', 'team'], ['/account/p3/compare', 'home'],
  ])('tab of %s is %s', (p, t) => expect(r4TabOf(p)).toBe(t));
});
