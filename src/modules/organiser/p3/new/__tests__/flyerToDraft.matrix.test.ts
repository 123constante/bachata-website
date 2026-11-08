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

  describe('N1: printed date kept on repeating flyers', () => {
    const rd = (a: string | null, wd: number | null, rt: string | null = null) => ({ date_start: a, date_end: null, year_printed: true, weekday_printed: wd, recurrence_text: rt });
    it('flyer 5 (monthly 1st Saturday, no date): next 1st Saturday, rule nth 1, marked doubtful', () => {
      const out = flyerToDraft(ROWS[4].read, VENUES, TODAY);
      expect(out.draft.firstDate).toBe('2026-12-05');
      expect(out.draft.repeat).toMatchObject({ freq: 'monthly', monthBy: 'nth', nths: [1], weekday: 6 });
      expect(out.doubtful).toContain('firstDate');
    });
    it('flyers 1 and 4 (weekly, no date): computed date is doubtful, rule on the printed weekday', () => {
      for (const [i, wd] of [[0, 6], [3, 3]] as const) {
        const out = flyerToDraft(ROWS[i].read, VENUES, TODAY);
        expect(out.draft.repeat.weekdays).toEqual([wd]);
        expect(out.doubtful).toContain('firstDate');
      }
    });
    it('a dated past weekly keeps the printed date, doubtful, "this date has passed"', () => {
      const out = flyerToDraft(mk({ kind: 'weekly', title: 'W', dates: [rd('2026-10-03', 6)] }), VENUES, TODAY);
      expect(out.draft.firstDate).toBe('2026-10-03');
      expect(out.draft.repeat.weekdays).toEqual([6]);
      expect(out.doubtful).toContain('firstDate');
      expect(out.notes.map((n) => n.code)).toEqual(expect.arrayContaining(['repeats', 'past_date']));
    });
    it('a dated past monthly keeps the printed date and its nth', () => {
      const out = flyerToDraft(mk({ kind: 'monthly', title: 'M', dates: [rd('2026-10-03', 6, '1st Saturday')] }), VENUES, TODAY);
      expect(out.draft.firstDate).toBe('2026-10-03');
      expect(out.draft.repeat).toMatchObject({ monthBy: 'nth', nths: [1], weekday: 6 });
      expect(out.doubtful).toContain('firstDate');
      expect(out.notes.map((n) => n.code)).toContain('past_date');
    });
    it('a dated future monthly keeps the printed date, not doubtful', () => {
      const out = flyerToDraft(mk({ kind: 'monthly', title: 'M', venue_name: 'Thames Boat', dates: [rd('2026-12-05', 6, 'first Saturday')] }), VENUES, TODAY);
      expect(out.draft.firstDate).toBe('2026-12-05');
      expect(out.draft.repeat).toMatchObject({ nths: [1], weekday: 6 });
      expect(out.doubtful).not.toContain('firstDate');
    });
    it('a "last Friday" monthly builds a last-week rule', () => {
      const out = flyerToDraft(mk({ kind: 'monthly', title: 'M', dates: [rd(null, 5, 'Last Friday of the month')] }), VENUES, TODAY);
      expect(out.draft.firstDate).toBe('2026-11-27');
      expect(out.draft.repeat).toMatchObject({ nths: [-1], weekday: 5 });
      expect(out.doubtful).toContain('firstDate');
    });
    it('a monthly with a weekday but no week of the month sets no date (never a guessed nth)', () => {
      const out = flyerToDraft(mk({ kind: 'monthly', title: 'M', dates: [rd(null, 6)] }), VENUES, TODAY);
      expect(out.draft.firstDate).toBe('');
      expect(out.doubtful).toContain('firstDate');
      expect(out.notes.map((n) => n.code)).toEqual(expect.arrayContaining(['repeats', 'no_date']));
    });
    it('week-of-month words: one week only, "last" only before a weekday', async () => {
      const { nthFromText } = await import('../flyerToDraft');
      expect(nthFromText('First Saturday of every month, last entry 1am')).toBe(1);
      expect(nthFromText('Every 1st and 3rd Friday')).toBeNull();
      expect(nthFromText('last Sunday')).toBe(-1);
      expect(nthFromText(null)).toBeNull();
    });
    it('a printed date on a different weekday from the printed weekday is doubtful', () => {
      const out = flyerToDraft(mk({ kind: 'weekly', title: 'W', dates: [rd('2026-12-04', 6)] }), VENUES, TODAY);
      expect(out.draft.firstDate).toBe('2026-12-04');
      expect(out.doubtful).toContain('firstDate');
    });
  });

  it('a course with a known venue and no date keeps the venue and says no date', () => {
    const out = flyerToDraft(mk({ kind: 'course', title: 'Beginners Course', venue_name: 'The Ritz Club' }), VENUES, TODAY);
    expect(out.draft.venue?.id).toBe('v-ritz');
    expect(out.draft.firstDate).toBe('');
    expect(out.notes.map((n) => n.code)).toEqual(['no_date']);
  });

  it('bare domain stripped from flyer text; the ticket link field is unchanged', () => {
    const out = flyerToDraft(mk({ title: 'Night bachata.co.uk/tix Social', venue_name: 'see salsa.london', venue_address: 'Hall, WWW.Dance.ORG', ticket_url_visible: 'bachata.co.uk/tix' }), VENUES, TODAY);
    expect(out.draft.name).toBe('Night Social');
    expect(out.venueSaid).toBe('see, Hall');
    expect(out.draft.ticketUrl).toBe('');
    expect(flyerToDraft(mk({ title: 'BACHATA.CO.UK/TIX Gala' }), VENUES, TODAY).draft.name).toBe('Gala');
    for (const t of ['Doors 10.30pm, St. Ives, 1.5 hours', 'Salsa Night.Live DJs', 'Studio.Dance Hall: Social']) {
      expect(flyerToDraft(mk({ title: t }), VENUES, TODAY).draft.name).toBe(t);
    }
  });

  it('unknown currency no row', () => {
    const out = flyerToDraft(mk({ price: { amount_pence: 2000, currency: 'CHF' } }), VENUES, TODAY);
    expect(out.draft.prices).toHaveLength(0);
    expect(out.doubtful).not.toContain('prices');
    expect(out.notes.map((n) => n.code)).toContain('price_currency');
    for (const [c, want] of [['\u00a3', 'GBP'], [' gbp ', 'GBP'], ['\u20ac', 'EUR'], ['$', 'USD']] as const) {
      expect(flyerToDraft(mk({ price: { amount_pence: 2000, currency: c } }), VENUES, TODAY).draft.prices[0]?.currency).toBe(want);
    }
    expect(flyerToDraft(mk({ price: { amount_pence: 2000, currency: 'eur' } }), VENUES, TODAY).draft.prices[0].currency).toBe('EUR');
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
