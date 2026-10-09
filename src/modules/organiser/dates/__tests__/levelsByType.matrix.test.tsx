// @vitest-environment jsdom
/**
 * LEVELS BY TYPE (owner rule 2026-10-08, ARC DOMAIN): levels are offered ONLY
 * for a class or a masterclass. A party or a performance never shows levels,
 * switching a new session to one clears the levels picked, and a stored one
 * that carries stray levels (4 prod party rows) shows none and saves them off.
 *
 * Every session type x levels none / one / many x stored vs new vs new-switched,
 * through the real date page: the sheet, the row summary and the save payload
 * must say the same thing. The expected table is written out here on purpose
 * (not imported from the mapping under test).
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

const rpc = vi.hoisted(() => vi.fn());
const from = vi.hoisted(() => vi.fn());
vi.mock('@/integrations/supabase/client', () => ({ supabase: { rpc, from } }));

import DatePage from '../index';

const TYPES = ['class', 'masterclass', 'party', 'performance'] as const;
const OFFERS_LEVELS: Record<(typeof TYPES)[number], boolean> = { class: true, masterclass: true, party: false, performance: false };
const LEVEL_SETS: Record<string, string[]> = { none: [], one: ['beginner'], many: ['improver', 'intermediate', 'advanced'] };
const LABEL: Record<string, string> = { beginner: 'Beginner', improver: 'Improver', intermediate: 'Intermediate', advanced: 'Advanced' };
const ITEM = '11111111-1111-4111-8111-111111111111';
const DATE = '2026-10-15';

let stored: Record<string, unknown>[];
const setCalls = () => rpc.mock.calls.filter(([f]) => f === 'organiser_set_occurrence_programme_v1');
const sent = (): Record<string, unknown>[] => {
  const args = setCalls()[0][1];
  return (args.p_sessions ?? args.p_programme) as Record<string, unknown>[];
};

beforeEach(() => {
  rpc.mockReset();
  from.mockReset();
  stored = [];
  rpc.mockImplementation(async (fn: string) => {
    if (fn === 'organiser_get_occurrence_programme_v1') {
      return { data: { occurrence_id: 'o1', series_id: 's1', occurrence_date: DATE, version: 3, editable: true, not_editable_reason: null, sessions: stored, session_people: [] }, error: null };
    }
    if (fn === 'organiser_set_occurrence_programme_v1') return { data: { ok: true, changed: true, version: 4, sessions: stored }, error: null };
    if (fn === 'event_view_p5') return { data: { occurrence: { id: 'o1', date: DATE, version: 1, lifecycle_status: 'scheduled' }, event: { venue_id: 'v1' }, schedule: {} }, error: null };
    if (fn === 'admin_event_workspace_p5') {
      return { data: { series: { series: { id: 's1', name: 'Thursday', lifecycle_status: 'live', version: 3, default_venue_id: 'v1', default_start_date: '2026-01-01', recurrence_rule: { mode: 'weekly', weekdays: [4] } }, program: [] }, occurrences: [] }, error: null };
    }
    if (fn === 'get_organiser_venue_options_v1') return { data: [{ id: 'v1', name: 'Salsa Club', city_name: 'Leeds' }], error: null };
    return { data: null, error: null };
  });
});
afterEach(() => cleanup());

function mount() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  render(
    <QueryClientProvider client={client}>
      <MemoryRouter initialEntries={['/account/o/events/s1/dates/o1']}>
        <Routes>
          <Route path="/account/o/events/:seriesId/dates/:occurrenceId" element={<DatePage />} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

const rowNamed = (name: string) => screen.getAllByTestId('session-row').find((r) => within(r).getByTestId('session-row-name').textContent === name)!;
const metaOf = (name: string) => within(rowNamed(name)).queryByTestId('session-row-meta')?.textContent ?? '';
const saveButton = () => screen.getByTestId('date-preview-bar-action') as HTMLButtonElement;
const doneSheet = async () => {
  fireEvent.click(screen.getByTestId('date-sheet-done'));
  await waitFor(() => expect(screen.queryByTestId('date-sheet')).toBeNull());
};

/** The sheet offers levels exactly when the type takes them, labelled as optional. */
function expectSheetLevels(type: (typeof TYPES)[number], selected: string[]) {
  const field = screen.queryByTestId('session-levels');
  if (!OFFERS_LEVELS[type]) {
    expect(field).toBeNull();
    expect(screen.queryByTestId('session-level-beginner')).toBeNull();
    return;
  }
  expect(field).not.toBeNull();
  expect(within(field!).getByText('Levels (optional)')).toBeTruthy();
  const on = Object.keys(LABEL).filter((l) => screen.getByTestId(`session-level-${l}`).getAttribute('aria-pressed') === 'true');
  expect(on.sort()).toEqual([...selected].sort());
}

const expectRowLevels = (name: string, levels: string[]) => {
  const meta = metaOf(name);
  for (const l of Object.values(LABEL)) expect(meta.includes(l)).toBe(levels.some((k) => LABEL[k] === l));
};

const cases = TYPES.flatMap((type) => Object.entries(LEVEL_SETS).map(([set, levels]) => ({ type, set, levels })));

describe('a STORED session: sheet, row and save agree', () => {
  it.each(cases)('$type with $set level(s)', async ({ type, levels }) => {
    stored = [{ series_item_id: ITEM, type, title: 'Thing', start_time: '20:00', end_time: '21:00', ends_next_day: false, level_keys: levels, removed: false }];
    mount();
    await screen.findAllByTestId('session-row');
    const shown = OFFERS_LEVELS[type] ? levels : [];
    expectRowLevels('Thing', shown);
    // Nothing touched: nothing to save, even for a party carrying stray levels.
    expect(saveButton().disabled).toBe(true);

    fireEvent.click(within(rowNamed('Thing')).getByTestId('session-row-open'));
    await screen.findByTestId('date-session-view');
    expectSheetLevels(type, shown);
    fireEvent.change(screen.getByTestId('session-name'), { target: { value: 'Thing 2' } });
    await doneSheet();
    expectRowLevels('Thing 2', shown);

    fireEvent.click(saveButton());
    await waitFor(() => expect(setCalls()).toHaveLength(1));
    expect(sent()).toHaveLength(1);
    expect(sent()[0]).toMatchObject({ series_item_id: ITEM, type, title: 'Thing 2' });
    expect([...(sent()[0].level_keys as string[])].sort()).toEqual([...shown].sort());
  });
});

describe('a NEW session: sheet, row and save agree', () => {
  it.each(cases)('$type, then $set level(s) where offered', async ({ type, levels }) => {
    mount();
    await screen.findByTestId('date-add-session');
    fireEvent.click(screen.getByTestId('date-add-session'));
    await screen.findByTestId('date-session-view');
    fireEvent.click(screen.getByTestId(`session-type-${type}`));
    expectSheetLevels(type, []);
    if (OFFERS_LEVELS[type]) for (const l of levels) fireEvent.click(screen.getByTestId(`session-level-${l}`));
    const shown = OFFERS_LEVELS[type] ? levels : [];
    expectSheetLevels(type, shown);
    fireEvent.change(screen.getByTestId('session-name'), { target: { value: 'Fresh' } });
    fireEvent.change(screen.getByTestId('session-start'), { target: { value: '20:00' } });
    fireEvent.change(screen.getByTestId('session-end'), { target: { value: '21:00' } });
    await doneSheet();
    expectRowLevels('Fresh', shown);

    fireEvent.click(saveButton());
    await waitFor(() => expect(setCalls()).toHaveLength(1));
    expect(sent()[0]).toMatchObject({ new: true, type, title: 'Fresh' });
    expect([...(sent()[0].level_keys as string[])].sort()).toEqual([...shown].sort());
  });

  it.each(cases)('levels picked as a class ($set), then switched to $type', async ({ type, levels }) => {
    mount();
    await screen.findByTestId('date-add-session');
    fireEvent.click(screen.getByTestId('date-add-session'));
    await screen.findByTestId('date-session-view');
    fireEvent.click(screen.getByTestId('session-type-class'));
    for (const l of levels) fireEvent.click(screen.getByTestId(`session-level-${l}`));
    expectSheetLevels('class', levels);
    fireEvent.click(screen.getByTestId(`session-type-${type}`));
    // A class -> masterclass switch keeps the levels; a party or performance clears them.
    const kept = OFFERS_LEVELS[type] ? levels : [];
    expectSheetLevels(type, kept);
    // Back to a class: the cleared levels stay cleared (nothing hidden comes back).
    fireEvent.click(screen.getByTestId('session-type-class'));
    expectSheetLevels('class', kept);
    fireEvent.click(screen.getByTestId(`session-type-${type}`));
    fireEvent.change(screen.getByTestId('session-name'), { target: { value: 'Switched' } });
    fireEvent.change(screen.getByTestId('session-start'), { target: { value: '20:00' } });
    fireEvent.change(screen.getByTestId('session-end'), { target: { value: '21:00' } });
    await doneSheet();
    expectRowLevels('Switched', kept);

    fireEvent.click(saveButton());
    await waitFor(() => expect(setCalls()).toHaveLength(1));
    expect(sent()[0]).toMatchObject({ new: true, type });
    expect([...(sent()[0].level_keys as string[])].sort()).toEqual([...kept].sort());
  });
});
