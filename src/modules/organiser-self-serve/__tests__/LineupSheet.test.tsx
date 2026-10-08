// @vitest-environment jsdom
/**
 * The Line-up row and sheet inside the programme editor: who teaches or DJs each
 * session. The sheet edits the draft only; "Save the programme" sends the
 * people_add / people_remove deltas. Selectors are data-testids.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

const rpc = vi.hoisted(() => vi.fn());
const from = vi.hoisted(() => vi.fn());
vi.mock('@/integrations/supabase/client', () => ({ supabase: { rpc, from } }));

import { DateActionSheet } from '../components/DateActionSheet';
import type { WorkspaceDate, WorkspaceSeries } from '@/modules/organiser/shared/seriesModel';

const S1 = '11111111-1111-4111-8111-111111111111';
const A1 = '33333333-3333-4333-8333-333333333333';
const P = (n: number) => `aaaaaaaa-0000-4000-8000-${String(n).padStart(12, '0')}`;

const series = {
  id: 's1', name: 'Thursday Class', slug: 'thursday-class', format: 'recurring', category: 'class',
  lifecycle_status: 'live', version: 3, default_venue_id: null, default_local_start_time: '20:00:00',
  default_duration: '02:00:00', default_level: null, default_ticket_url: null, default_description: null,
  default_cover_image_url: null, default_start_date: null, instagram_url: null, passes: null, created_at: null,
  recurrence_rule: null, removed_dates: [],
} as WorkspaceSeries;
const date: WorkspaceDate = {
  id: 'o1', occurrence_date: '2026-10-08', lifecycle_status: 'scheduled', version: 1, has_override: false,
  session_overrides_count: 0, added_sessions_count: 0, materialised_start_utc: null,
};

const sessions = () => [
  { series_item_id: S1, type: 'class', title: 'Bachata Basics', start_time: '19:00', end_time: '20:00', ends_next_day: false, level_keys: ['beginner'], removed: false },
  { added_session_id: A1, type: 'class', title: 'Bootcamp', start_time: '18:00', end_time: '18:45', ends_next_day: false, level_keys: ['improver'], removed: false },
];
const person = (n: number, name: string, role: string) => ({ profile_id: P(n), profile_type: role === 'djing' ? 'dj' : 'teacher', display_name: name, role });
let s1People: ReturnType<typeof person>[];
let searchRows: Record<string, unknown>[];
let setResult: () => { data: unknown; error: unknown };

const setCalls = () => rpc.mock.calls.filter(([fn]) => fn === 'organiser_set_occurrence_programme_v1');
const searchCalls = () => rpc.mock.calls.filter(([fn]) => fn === 'organiser_search_people_v1');
const lastSearch = () => searchCalls()[searchCalls().length - 1]?.[1];
const sentSessions = () => (setCalls()[0][1] as { p_sessions: Record<string, unknown>[] }).p_sessions;

function mount() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  render(
    <QueryClientProvider client={client}>
      <MemoryRouter>
        <DateActionSheet open onOpenChange={() => {}} seriesId="s1" series={series} date={date} hasSessions today="2026-10-05" />
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

async function openEditor() {
  mount();
  fireEvent.click(await screen.findByTestId('action-programme'));
  await screen.findAllByTestId('programme-row');
}
const lineupRow = (i: number) => screen.getAllByTestId('lineup-row')[i];
async function openLineup(i = 0) {
  await openEditor();
  fireEvent.click(lineupRow(i));
  return screen.findByTestId('lineup-sheet');
}
const sheet = () => screen.getByTestId('lineup-sheet');
const personNamed = (name: string) =>
  within(sheet()).getAllByTestId(/^lineup-person/).find((li) => li.textContent?.includes(name)) as HTMLElement;
async function search(role: 'teaching' | 'djing', text: string) {
  fireEvent.click(within(sheet()).getByTestId(`lineup-add-${role}`));
  const input = await within(sheet()).findByTestId('person-picker-input');
  fireEvent.change(input, { target: { value: text } });
  return input;
}

function mockReducedMotion(reduce: boolean) {
  Object.defineProperty(window, 'matchMedia', {
    configurable: true,
    writable: true,
    value: (query: string) => ({
      matches: reduce && query.includes('prefers-reduced-motion'),
      media: query, addEventListener: () => {}, removeEventListener: () => {}, addListener: () => {}, removeListener: () => {}, onchange: null, dispatchEvent: () => false,
    }),
  });
}

beforeEach(() => {
  rpc.mockReset();
  from.mockReset();
  from.mockReturnValue({ select: () => ({ is: () => ({ order: async () => ({ data: [], error: null }) }) }) });
  mockReducedMotion(false);
  s1People = [person(1, 'Ana', 'teaching'), person(2, 'Ben', 'teaching'), person(3, 'Cleo', 'djing'), person(4, 'Max', 'mc')];
  searchRows = [
    { id: P(1), display_name: 'Ana', dj_name: null, photo_url: null, city_name: 'Leeds', country_code: 'GB', roles: ['teaching'] },
    { id: P(9), display_name: 'Zed Ortiz', dj_name: 'DJ Zed', photo_url: null, city_name: null, country_code: null, roles: ['teaching', 'djing'] },
  ];
  setResult = () => ({ data: { ok: true, changed: true, occurrence_id: 'o1', version: 8, sessions: sessions() }, error: null });
  rpc.mockImplementation(async (fn: string) => {
    if (fn === 'event_view_p5') return { data: { occurrence: { id: 'o1', date: '2026-10-08', version: 1 }, event: {}, schedule: {} }, error: null };
    if (fn === 'organiser_get_occurrence_programme_v1') {
      return { data: {
        occurrence_id: 'o1', series_id: 's1', occurrence_date: '2026-10-08', version: 7, editable: true, not_editable_reason: null,
        sessions: sessions(),
        session_people: [{ series_item_id: S1, people: s1People }, { added_session_id: A1, people: [] }],
      }, error: null };
    }
    if (fn === 'organiser_search_people_v1') return { data: searchRows, error: null };
    if (fn === 'organiser_set_occurrence_programme_v1') return setResult();
    return { data: { ok: true }, error: null };
  });
});
afterEach(() => {
  cleanup();
  vi.useRealTimers();
  vi.restoreAllMocks();
});

describe('Line-up row', () => {
  it('summarises the names, or offers to add when nobody is on the session', async () => {
    await openEditor();
    expect(within(lineupRow(0)).getByTestId('lineup-row-value').textContent).toBe('Ana, Ben +2');
    const empty = within(lineupRow(1)).getByTestId('lineup-row-value');
    expect(empty.textContent).toBe('Add teachers & DJs');
    expect(empty.className).toMatch(/text-muted-foreground/);
    expect(lineupRow(0).className).toMatch(/min-h-\[48px\]/);
  });

  it('opens the sheet, and the focus comes back to the row on close', async () => {
    await openLineup(0);
    expect(within(sheet()).getAllByTestId('lineup-person')).toHaveLength(4);
    fireEvent.click(within(sheet()).getByTestId('lineup-done'));
    await waitFor(() => expect(screen.queryByTestId('lineup-sheet')).toBeNull());
    await waitFor(() => expect(document.activeElement).toBe(lineupRow(0)));
  });
});

describe('Line-up sheet', () => {
  it('shows role chips; an MC is read-only with no remove button', async () => {
    await openLineup(0);
    expect(within(personNamed('Ana')).getByTestId('lineup-role').textContent).toBe('Teacher');
    expect(within(personNamed('Cleo')).getByTestId('lineup-role').textContent).toBe('DJ');
    const max = personNamed('Max');
    expect(within(max).getByTestId('lineup-role').textContent).toBe('MC');
    expect(within(max).getByTestId('lineup-readonly')).toBeTruthy();
    expect(within(max).queryByTestId('lineup-remove')).toBeNull();
    expect(within(personNamed('Ana')).getByTestId('lineup-remove').getAttribute('aria-label')).toBe('Remove Ana');
  });

  it('Add teacher searches with the role fixed, after 2 characters, and adds to the draft only', async () => {
    await openLineup(0);
    const input = await search('teaching', 'z');
    expect(document.activeElement).toBe(input);
    expect(within(sheet()).getByTestId('person-picker-hint')).toBeTruthy();
    fireEvent.change(input, { target: { value: 'ze' } });
    // Skeleton rows while the search settles and loads, not a spinner.
    expect(within(sheet()).getAllByTestId('person-picker-skeleton').length).toBeGreaterThan(0);
    const results = await within(sheet()).findAllByTestId('person-picker-result');
    expect(lastSearch()).toEqual({ p_query: 'ze', p_role: 'teaching', p_limit: 20 });
    expect(searchCalls().every(([, a]) => (a as { p_query: string }).p_query.length >= 2)).toBe(true);
    // Ana is already on the session.
    expect((results[0] as HTMLButtonElement).disabled).toBe(true);
    expect(within(results[0]).getByTestId('person-picker-on-session')).toBeTruthy();
    fireEvent.click(results[1]);
    expect(screen.queryByTestId('person-picker')).toBeNull();
    expect(within(personNamed('Zed Ortiz')).getByTestId('lineup-role').textContent).toBe('Teacher');
    expect(within(sheet()).getByTestId('lineup-announce').textContent).toMatch(/Zed Ortiz added as teacher/);
    expect(setCalls()).toHaveLength(0);

    fireEvent.click(within(sheet()).getByTestId('lineup-done'));
    await waitFor(() => expect(screen.queryByTestId('lineup-sheet')).toBeNull());
    fireEvent.click(screen.getByTestId('programme-save'));
    await waitFor(() => expect(setCalls()).toHaveLength(1));
    expect(sentSessions()[0].people_add).toEqual([{ profile_id: P(9), role: 'teaching' }]);
    expect(sentSessions()[0]).not.toHaveProperty('people_remove');
    expect(sentSessions()[1]).toEqual(sessions()[1]);
  });

  it('Add DJ searches as djing and shows the DJ name', async () => {
    await openLineup(1);
    await search('djing', 'zed');
    const results = await within(sheet()).findAllByTestId('person-picker-result');
    expect(lastSearch()).toMatchObject({ p_role: 'djing' });
    expect(results[1].textContent).toMatch(/DJ Zed/);
    fireEvent.click(results[1]);
    fireEvent.click(within(sheet()).getByTestId('lineup-done'));
    await waitFor(() => expect(screen.queryByTestId('lineup-sheet')).toBeNull());
    fireEvent.click(screen.getByTestId('programme-save'));
    await waitFor(() => expect(setCalls()).toHaveLength(1));
    expect(sentSessions()[1].people_add).toEqual([{ profile_id: P(9), role: 'djing' }]);
  });

  it('Escape closes the search, not the sheet', async () => {
    await openLineup(0);
    await search('teaching', 'ze');
    fireEvent.keyDown(within(sheet()).getByTestId('person-picker-input'), { key: 'Escape' });
    await waitFor(() => expect(screen.queryByTestId('person-picker')).toBeNull());
    expect(screen.getByTestId('lineup-sheet')).toBeTruthy();
    expect(document.activeElement).toBe(within(sheet()).getByTestId('lineup-add-teaching'));
  });

  it('remove keeps the person greyed with Undo until the save; Undo puts them back', async () => {
    await openLineup(0);
    fireEvent.click(within(personNamed('Ben')).getByTestId('lineup-remove'));
    const ben = personNamed('Ben');
    expect(ben.getAttribute('data-testid')).toBe('lineup-person-removed');
    expect(document.activeElement).toBe(within(ben).getByTestId('lineup-undo'));
    expect(within(sheet()).getByTestId('lineup-announce').textContent).toMatch(/Ben removed/);
    fireEvent.click(within(ben).getByTestId('lineup-undo'));
    expect(personNamed('Ben').getAttribute('data-testid')).toBe('lineup-person');
    expect(screen.queryByTestId('programme-unsaved')).toBeNull();

    fireEvent.click(within(personNamed('Ben')).getByTestId('lineup-remove'));
    fireEvent.click(within(sheet()).getByTestId('lineup-done'));
    await waitFor(() => expect(screen.queryByTestId('lineup-sheet')).toBeNull());
    expect(within(lineupRow(0)).getByTestId('lineup-row-value').textContent).toBe('Ana, Cleo +1');
    fireEvent.click(screen.getByTestId('programme-save'));
    await waitFor(() => expect(setCalls()).toHaveLength(1));
    expect(sentSessions()[0].people_remove).toEqual([P(2)]);
    expect(sentSessions()[0]).not.toHaveProperty('people_add');
  });

  it('someone added here fades and folds out over 0.3s, then is gone', async () => {
    await openLineup(1);
    await search('teaching', 'zed');
    fireEvent.click((await within(sheet()).findAllByTestId('person-picker-result'))[1]);
    fireEvent.click(within(personNamed('Zed Ortiz')).getByTestId('lineup-remove'));
    expect(personNamed('Zed Ortiz').getAttribute('data-leaving')).toBe('true');
    await waitFor(() => expect(within(sheet()).queryByTestId('lineup-person')).toBeNull());
    expect(within(sheet()).getByTestId('lineup-empty')).toBeTruthy();
  });

  it('with reduced motion nothing slides or fades: an added person goes at once', async () => {
    mockReducedMotion(true);
    await openLineup(1);
    expect(sheet().getAttribute('data-reduced-motion')).toBe('true');
    expect(sheet().className).toMatch(/motion-reduce:!animate-none/);
    await search('teaching', 'zed');
    fireEvent.click((await within(sheet()).findAllByTestId('person-picker-result'))[1]);
    fireEvent.click(within(personNamed('Zed Ortiz')).getByTestId('lineup-remove'));
    expect(within(sheet()).queryByTestId('lineup-person')).toBeNull();
  });

  it('at 12 people the add buttons are off with the reason beside them', async () => {
    s1People = Array.from({ length: 12 }, (_, i) => person(100 + i, `Person ${i}`, 'teaching'));
    await openLineup(0);
    expect((within(sheet()).getByTestId('lineup-add-teaching') as HTMLButtonElement).disabled).toBe(true);
    expect((within(sheet()).getByTestId('lineup-add-djing') as HTMLButtonElement).disabled).toBe(true);
    expect(within(sheet()).getByTestId('lineup-add-reason').textContent).toMatch(/up to 12/);
  });

  it('after 12 removals the other remove buttons are off with the reason', async () => {
    s1People = Array.from({ length: 13 }, (_, i) => person(100 + i, `Person ${i}`, 'djing'));
    await openLineup(0);
    for (let i = 0; i < 12; i += 1) {
      act(() => { fireEvent.click(within(personNamed(`Person ${i}`)).getByTestId('lineup-remove')); });
    }
    expect(within(sheet()).getByTestId('lineup-remove-reason').textContent).toMatch(/up to 12/);
    expect((within(personNamed('Person 12')).getByTestId('lineup-remove') as HTMLButtonElement).disabled).toBe(true);
  });

  it('a refused line-up save shows calm copy that names nobody, and reloads', async () => {
    setResult = () => ({ data: null, error: { message: 'invalid_payload: people_remove names a person who is not on that session', code: 'P0001' } });
    await openLineup(0);
    fireEvent.click(within(personNamed('Ben')).getByTestId('lineup-remove'));
    fireEvent.click(within(sheet()).getByTestId('lineup-done'));
    await waitFor(() => expect(screen.queryByTestId('lineup-sheet')).toBeNull());
    fireEvent.click(screen.getByTestId('programme-save'));
    const error = await screen.findByTestId('programme-error');
    expect(error.textContent).toMatch(/line-up of this date changed/);
    expect(error.textContent).not.toMatch(/Ben|Ana|Cleo/);
  });
});
