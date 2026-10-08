import { describe, expect, it } from 'vitest';
import {
  cardPreview, changedFields, conflictingFields, draftFromWorkspace, draftProblem, listedUntil, parseEventWorkspace, repeatsLabel, savePlan,
} from '../eventModel';
import { TODAY, rawWorkspace } from './fixtures';

const ws = parseEventWorkspace(rawWorkspace());
const base = draftFromWorkspace(ws, TODAY);

describe('eventModel', () => {
  it('reads styles, gallery and videos the old parser drops', () => {
    expect(ws.musicStyles).toEqual(['Bachata']);
    expect(ws.gallery).toEqual(['https://cdn.example/g1.webp']);
    expect(base).toMatchObject({ name: 'Friday Party', shape: 'weekly', startDate: '2026-10-09', until: '2026-11-27' });
    expect(repeatsLabel(base)).toBe('Every Friday');
    expect(listedUntil(base, ws, TODAY)).toBe('2026-11-27');
  });

  it('a save sends name plus ONLY the changed fields', () => {
    const draft = { ...base, description: 'New words', styles: ['Bachata', 'Salsa'] };
    expect(changedFields(base, draft)).toEqual(['description', 'styles']);
    expect(savePlan(base, draft, ws, TODAY)).toEqual([
      { kind: 'series.upsert', payload: { name: 'Friday Party', default_description: 'New words', default_music_styles: ['Bachata', 'Salsa'] } },
    ]);
  });

  it('nothing changed sends nothing', () => {
    expect(savePlan(base, { ...base }, ws, TODAY)).toEqual([]);
  });

  it('a new venue carries its city (city is automatic)', () => {
    expect(savePlan(base, { ...base, venueId: 'v2' }, ws, TODAY, 'c9')[0].payload).toEqual({ name: 'Friday Party', default_venue_id: 'v2', default_city_id: 'c9' });
  });

  it('a new end sends the owner weekly rule with an until date', () => {
    expect(savePlan(base, { ...base, until: '2027-01-22' }, ws, TODAY)).toEqual([
      { kind: 'series.set_recurrence', payload: { mode: 'weekly', weekdays: [5], end: { kind: 'until_date', date: '2027-01-22' } } },
    ]);
  });

  it('weekly to one date keeps the start date', () => {
    expect(savePlan(base, { ...base, shape: 'single' }, ws, TODAY)).toEqual([
      { kind: 'series.stop_repeating', payload: { keep_occurrence_ids: ['o1'] } },
    ]);
  });

  it('moving a one-date event adds the new date and removes the old one', () => {
    const single = { ...base, shape: 'single' as const, until: null };
    const plan = savePlan(single, { ...single, startDate: '2026-10-20' }, ws, TODAY);
    expect(plan.map((c) => c.kind)).toEqual(['series.upsert', 'series.add_date', 'series.remove_date']);
    expect(plan[2].payload).toEqual({ occurrence_id: 'o1' });
  });

  it('refuses a save past 30 upcoming dates, and other plain problems', () => {
    expect(draftProblem({ ...base, until: '2027-05-07' }, ws, TODAY)).toMatch(/more than 30 upcoming dates/);
    expect(draftProblem({ ...base, name: ' ' }, ws, TODAY)).toBe('Give your event a name.');
    expect(draftProblem({ ...base, ticketUrl: 'tickets.com' }, ws, TODAY)).toMatch(/https:/);
    expect(draftProblem(base, ws, TODAY)).toBeNull();
  });

  it('finds a field someone else changed meanwhile, only where this screen changed it too', () => {
    const fresh = { ...base, description: 'Changed elsewhere', ticketUrl: 'https://t.example' };
    expect(conflictingFields(base, fresh, { ...base, description: 'Mine' })).toEqual(['description']);
    expect(conflictingFields(base, fresh, { ...base, name: 'Mine' })).toEqual([]);
  });

  it('previews the public card', () => {
    expect(cardPreview(base, ws, TODAY, 'Studio One')).toEqual({ title: 'Friday Party', coverUrl: null, when: 'Fri 9 Oct', where: 'Studio One' });
  });
});
