import { describe, expect, it } from 'vitest';
import { parseDoorList } from '../../door/data';
import { chipCounts, filterGuests, guestRowOf, guestViewOf } from '../r4GuestListModel';

const row = (i: number, inAt: string | null, extra: Record<string, unknown> = {}) =>
  ({ ticket_id: `t${i}`, first_name: `Guest${i}`, quantity_in_order: 2, ticket_type_name: 'General', checked_in_at: inAt, ...extra });
const ok = (rows: unknown[], extra: Record<string, unknown> = {}) => parseDoorList({ result: 'ok', rows, truncated: false, in_count: 1, total_count: rows.length, ...extra });
const mixed = [row(1, '2026-11-20T21:30:00Z'), row(2, null), row(3, null), row(4, '2026-11-20T22:05:00Z')];

describe('R4 guest list', () => {
  it.each([
    ['all', 4], ['in', 2], ['not_yet', 2],
  ] as const)('chip %s keeps %i rows', (chip, n) => {
    const d = ok(mixed);
    expect(filterGuests(d.rows, chip)).toHaveLength(n);
    expect(chipCounts(d.rows)[chip]).toBe(n);
  });
  it('has no Refunded state and no money on a row (owner and door staff see the same list)', () => {
    const r = guestRowOf(ok([row(1, null, { amount_pence: 900, refunded: true })]).rows[0]);
    expect(Object.keys(r).sort()).toEqual(['isIn', 'name', 'status', 'tickets', 'type']);
    expect(r.status).toBe('Not yet');
  });
  it('row words: name, tickets, type, In (time)', () => {
    expect(guestRowOf(ok(mixed).rows[0])).toMatchObject({ name: 'Guest1', tickets: '2 tickets', type: 'General', status: 'In 21:30' });
    expect(guestRowOf(ok([row(5, null, { first_name: null, quantity_in_order: 1, ticket_type_name: null })]).rows[0])).toMatchObject({ name: 'No name given', tickets: '1 ticket', type: null });
  });
  it('truncated says the first N of M', () => {
    const v = guestViewOf(ok(mixed, { truncated: true, total_count: 612 }));
    expect(v).toMatchObject({ kind: 'rows', truncated: 'Showing the first 4 of 612.' });
  });
  it('not_allowed hides the list', () => expect(guestViewOf(parseDoorList({ result: 'not_allowed', rows: [] }))).toEqual({ kind: 'hidden' }));
  it('wrong_night says no night', () => expect(guestViewOf(parseDoorList({ result: 'wrong_night', rows: [] })).kind).toBe('no_night'));
  it('empty says No tickets yet', () => expect(guestViewOf(ok([])).kind).toBe('empty'));
  it('a malformed answer throws so the screen shows Try again', () => expect(() => parseDoorList(null)).toThrow());
});
