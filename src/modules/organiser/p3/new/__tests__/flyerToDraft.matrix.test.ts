import { describe, expect, it, vi } from 'vitest';

vi.mock('@/integrations/supabase/client', () => ({ supabase: { rpc: vi.fn(), from: vi.fn(), storage: { from: vi.fn() } } }));

import { flyerToDraft, applySessionChoices } from '../flyerToDraft';
import { parseFlyerRead } from '../flyerReadShape';
import { DATES_MAX, isUntouched } from '../model';
import { ROWS, TODAY, VENUES, mk } from './flyerReadFixtures';

const dd = (a: string | null, b: string | null = null, wd: number | null = null) => ({ date_start: a, date_end: b, year_printed: true, weekday_printed: wd, recurrence_text: null });

describe('flyerToDraft.matrix', () => {
  it.each(ROWS)('$n', (r) => {
    const out = flyerToDraft(r.read, VENUES, TODAY);
    expect(out.draft.kind).toBe(r.kind);
    expect(out.draft.firstDate).toBe(r.firstDate);
    expect(out.draft.extraDates).toHaveLength(r.extra);
    expect(out.draft.venue?.id ?? null).toBe(r.venue);
    expect(out.venueSaid).toBe(r.said);
    expect(out.sessionChoices).toHaveLength(r.sessions);
    expect([...out.doubtful].sort()).toEqual([...r.doubtful].sort());
    expect(out.notes.map((n) => n.code)).toEqual(r.notes);
    expect(isUntouched(out.draft)).toBe(!r.touched);
    expect(out.draft.sessions.every((s) => !s.start && !s.end)).toBe(true); // sessions are never added by the mapping
  });

  it('a read with nothing in it leaves the draft untouched', () => {
    const out = flyerToDraft(mk({ kind: 'not_enough' }), VENUES, TODAY);
    expect(isUntouched(out.draft)).toBe(true);
  });

  it('never moves a past date to next year', () => {
    expect(flyerToDraft(mk({ dates: [dd('2026-10-31')] }), VENUES, TODAY).draft.firstDate).toBe('2026-10-31');
  });

  it('single price is one Ticket row in pounds; no price means no rows', () => {
    const one = flyerToDraft(mk({ price: { amount_pence: 1250, currency: 'GBP' } }), VENUES, TODAY);
    expect(one.draft.prices).toHaveLength(1);
    expect(one.draft.prices[0]).toMatchObject({ name: 'Ticket', price: '12.50', currency: 'GBP' });
    expect(one.doubtful).toContain('prices');
    expect(flyerToDraft(mk({}), VENUES, TODAY).draft.prices).toHaveLength(0);
  });

  it('strips an injected link from the title; keeps a valid ticket link only', () => {
    const out = flyerToDraft(mk({ title: '  Salsa   night https://evil.example/x  ', ticket_url_visible: 'www.tickets.example/a' }), VENUES, TODAY);
    expect(out.draft.name).toBe('Salsa night');
    expect(out.draft.ticketUrl).toBe('https://www.tickets.example/a');
    expect(out.doubtful).toContain('ticketUrl');
    expect(flyerToDraft(mk({ ticket_url_visible: 'tickets at the door' }), VENUES, TODAY).draft.ticketUrl).toBe('');
  });

  it('venue: exactly one match sets it, two or none leave it null and doubtful', () => {
    expect(flyerToDraft(mk({ venue_name: 'Thames Boat' }), VENUES, TODAY).draft.venue?.id).toBe('v-boat');
    const two = flyerToDraft(mk({ venue_name: 'Fire Station' }), VENUES, TODAY);
    expect(two.draft.venue).toBeNull(); expect(two.doubtful).toContain('venue'); expect(two.venueSaid).toBe('Fire Station');
    const none = flyerToDraft(mk({ venue_name: 'Unknown Place', venue_address: '9 Road' }), VENUES, TODAY);
    expect(none.draft.venue).toBeNull(); expect(none.venueSaid).toBe('Unknown Place, 9 Road');
  });

  it('caps a long range at DATES_MAX and says so', () => {
    const out = flyerToDraft(mk({ kind: 'festival', dates: [dd('2027-01-01', '2027-03-31')] }), VENUES, TODAY);
    expect(out.draft.extraDates).toHaveLength(DATES_MAX);
    expect(out.notes.map((n) => n.code)).toContain('too_many_dates');
  });

  it('read-listed doubtful fields carry through and unticks sessions', () => {
    const out = flyerToDraft(mk({ title: 'X', doubtful_fields: ['title', 'sessions'], sessions: [{ type: 'party', start: '20:00', end: '01:00', label: 'P' }] }), VENUES, TODAY);
    expect(out.doubtful).toEqual(expect.arrayContaining(['name', 'sessions']));
    expect(out.sessionChoices[0].ticked).toBe(false);
  });

  it('applySessionChoices adds only ticked ones and keeps a next-day end as an earlier end', () => {
    const out = flyerToDraft(mk({ sessions: [{ type: 'class', start: '19:00', end: '20:00', label: 'C' }, { type: 'party', start: '21:00', end: '01:00', label: 'P' }] }), VENUES, TODAY);
    const choices = out.sessionChoices.map((c, i) => ({ ...c, ticked: i === 1 }));
    const d = applySessionChoices(out.draft, choices);
    expect(d.sessions).toHaveLength(1);
    expect(d.sessions[0]).toMatchObject({ type: 'party', title: 'P', start: '21:00', end: '01:00' });
  });

  it('parseFlyerRead returns null for garbage and never throws', () => {
    for (const bad of [null, undefined, 5, 'x', [], {}, { kind: 'nope' }, { kind: 'weekly', dates: 'x' }, { kind: 'weekly', start_time: '7pm' }, { kind: 'one_off', sessions: [{ type: 'bogus' }] }]) {
      expect(parseFlyerRead(bad)).toBeNull();
    }
    expect(parseFlyerRead({ kind: 'not_enough' })?.kind).toBe('not_enough');
  });
});
