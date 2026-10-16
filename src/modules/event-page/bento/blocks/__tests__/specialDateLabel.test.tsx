/**
 * "Special tonight" says tonight only when the date IS today in London
 * (owner walk 2026-10-08: a one-date party a week away read "Special tonight").
 * Fixed clocks: today, tomorrow, +7 days, past, and the London/UTC midnight edge.
 */
import { afterEach, describe, expect, it, vi } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { MemoryRouter } from 'react-router-dom';
import type { ScheduleSession } from '../../../sections/EventScheduleGrid';

vi.mock('@/integrations/supabase/client', () => ({
  supabase: { rpc: () => ({ data: null, error: null }) },
}));

const program = vi.hoisted(() => ({ items: [] as unknown[] }));

vi.mock('@/modules/event-page/sections/EventScheduleGrid', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../../sections/EventScheduleGrid')>();
  return {
    ...actual,
    useProgramItems: () => ({ data: program.items, isLoading: false, isSuccess: true }),
    useOccurrenceProgram: () => ({ data: program.items, isLoading: false, isSuccess: true }),
    useProgramSections: () => ({ data: [] }),
  };
});

import { ScheduleBlock, SPECIAL_TONIGHT_TEXT, specialDateLabel } from '../ScheduleBlock';

const STAR = '\u2605';

// The organiser one-date party shape: every session added for the date only.
const party = (day: string | null): ScheduleSession => ({
  id: 'p1', title: 'Party', type: 'party', day, startMins: 21 * 60, endMins: 26 * 60, programIndex: 0,
  levels: [], room: null, people: [], sectionId: null, sectionKind: null, sectionLabel: null, addedOnly: true,
});

const chipText = (now: string, occurrenceDate: string | null, day: string | null = occurrenceDate) => {
  vi.useFakeTimers({ toFake: ['Date'] });
  vi.setSystemTime(new Date(now));
  program.items = [party(day)];
  const html = renderToStaticMarkup(
    <MemoryRouter>
      <ScheduleBlock eventId="evt-1" occurrenceId="occ-1" occurrenceDate={occurrenceDate} />
    </MemoryRouter>,
  );
  const m = /data-testid="schedule-special-tonight"[^>]*>(.*?)<\/div>/.exec(html);
  return m ? m[1].replace(/<[^>]+>/g, '') : null;
};

afterEach(() => { vi.useRealTimers(); });

describe('specialDateLabel', () => {
  it.each([
    ['today', '2026-10-08', '2026-10-08', SPECIAL_TONIGHT_TEXT],
    ['tomorrow', '2026-10-09', '2026-10-08', `${STAR} Special tomorrow`],
    ['+7 days', '2026-10-15', '2026-10-08', `${STAR} Special on Thu 15 Oct`],
    ['past', '2026-10-01', '2026-10-08', `${STAR} Special on Thu 1 Oct`],
    ['unknown date', null, '2026-10-08', `${STAR} Special on this date`],
    ['junk date', '2026-13-40', '2026-10-08', `${STAR} Special on this date`],
  ] as const)('%s', (_name, date, today, label) => {
    expect(specialDateLabel(date, today)).toBe(label);
  });
});

describe('ScheduleBlock chip on a fixed clock', () => {
  it('the date is today in London: Special tonight', () => {
    expect(chipText('2026-10-08T19:00:00Z', '2026-10-08')).toBe(SPECIAL_TONIGHT_TEXT);
  });
  it('the date is tomorrow: never "tonight"', () => {
    expect(chipText('2026-10-08T19:00:00Z', '2026-10-09')).toBe(`${STAR} Special tomorrow`);
  });
  it('the date is a week away (the owner walk): names the date', () => {
    expect(chipText('2026-10-08T19:00:00Z', '2026-10-15')).toBe(`${STAR} Special on Thu 15 Oct`);
  });
  it('a past date: names the date', () => {
    expect(chipText('2026-10-08T19:00:00Z', '2026-10-01')).toBe(`${STAR} Special on Thu 1 Oct`);
  });
  it('London, not UTC: 23:30 UTC on 8 Oct is already 9 Oct in London (BST)', () => {
    expect(chipText('2026-10-08T23:30:00Z', '2026-10-09')).toBe(SPECIAL_TONIGHT_TEXT);
  });
  it('the page has no occurrence date: the sessions\u2019 day decides', () => {
    expect(chipText('2026-10-08T19:00:00Z', null, '2026-10-15')).toBe(`${STAR} Special on Thu 15 Oct`);
  });
});
