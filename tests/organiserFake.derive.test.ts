/**
 * The e2e organiser fake (tests/e2e/helpers/organiserFake.ts) must derive a series' category
 * the way the server does (event-truth P3, admin #780): the UNION of the series programme and
 * EVERY date's date-only sessions, removed rows excluded, keep-if-agrees, through the lib. A fake
 * that derived from the one saved date would let an e2e spec pass against a Type row the server
 * would never show (review A, FIX-2). Red on 572612e1: the fake derived from the saved date alone.
 */
import { describe, expect, it } from 'vitest';
import { OrganiserFake, SUNDAY } from './e2e/helpers/organiserFake';

const session = (type: string, over: Record<string, unknown> = {}) =>
  ({ new: true, type, title: type, start_time: '20:00', end_time: '22:00', ends_next_day: false, level_keys: [], ...over });

/** A series the organiser create makes: no series programme, two dates, no session yet. */
const fresh = () => {
  const fake = new OrganiserFake();
  const s = fake.addSeries(fake.organisers[0], {
    id: 'ab000000-0000-4000-8000-000000000001', name: 'New', category: null, lifecycle_status: 'draft',
    default_start_date: '2026-10-15', extra_dates: ['2026-10-15', '2026-10-22'], recurrence_rule: null,
  });
  return { fake, s, d1: fake.occId(s, '2026-10-15'), d2: fake.occId(s, '2026-10-22') };
};

describe('the organiser fake derives category like the server: union over every date, keep-if-agrees', () => {
  it('a class seeded on date 1, then a party added on date 2: the union {class, party} still agrees with "class"', () => {
    const { fake, s, d1, d2 } = fresh();
    expect(s.category).toBeNull();
    fake.saveProgramme(d1, [session('class')]);
    expect(s.category).toBe('class');
    fake.saveProgramme(d2, [session('party')]);
    // The server keeps a mirror that still agrees; a fake reading only date 2 would say "party".
    expect(s.category).toBe('class');
  });

  it('a date-only session re-sent with removed: true leaves the union; the other dates still count', () => {
    const { fake, s, d1, d2 } = fresh();
    const saved = fake.saveProgramme(d1, [session('party')]).sessions[0];
    expect(s.category).toBe('party');
    fake.saveProgramme(d2, [session('class')]);
    expect(s.category).toBe('party');
    fake.saveProgramme(d1, [{ ...saved, removed: true }]);
    // Date 1 is empty now; date 2's class is still there, so the mirror is "class", not null.
    expect(fake.programme(d1).sessions).toEqual([]);
    expect(s.category).toBe('class');
  });

  it('the series programme is in the union on every date: a per-date removal of the series party moves nothing', () => {
    const fake = new OrganiserFake();
    const sun = fake.series.get(SUNDAY)!;
    const d = fake.occId(sun, '2026-10-11');
    const [party] = fake.programme(d).sessions;
    expect(party.series_item_id).toBeTruthy();
    fake.saveProgramme(d, [{ ...party, removed: true }, session('class')]);
    // The series programme (party) still stands: {party, class} agrees with the stored "party".
    expect(sun.category).toBe('party');
  });

  it('a series made in this run has no series programme: its dates read empty until a session is saved', () => {
    const { fake, s, d1, d2 } = fresh();
    expect(s.series_items).toEqual([]);
    expect(fake.programme(d1).sessions).toEqual([]);
    expect(fake.programme(d2).sessions).toEqual([]);
  });
});
