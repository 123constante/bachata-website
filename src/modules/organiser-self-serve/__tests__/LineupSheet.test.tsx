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
import type { WorkspaceDate, WorkspaceSeries } from '../seriesModel';

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
/** Replaces the reader's answer (the n-th read, from 1) when set. */
let reader: ((n: number) => unknown) | null;

const setCalls = () => rpc.mock.calls.filter(([fn]) => fn === 'organiser_set_occurrence_programme_v1');
const getCalls = () => rpc.mock.calls.filter(([fn]) => fn === 'organiser_get_occurrence_programme_v1');
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
  reader = null;
  s1People = [person(1, 'Ana', 'teaching'), person(2, 'Ben', 'teaching'), person(3, 'Cleo', 'djing'), person(4, 'Max', 'mc')];
  searchRows = [
    { id: P(1), display_name: 'Ana', dj_name: null, photo_url: null, city_name: 'Leeds', country_code: 'GB', roles: ['teaching'] },
    { id: P(9), display_name: 'Zed Ortiz', dj_name: 'DJ Zed', photo_url: null, city_name: null, country_code: null, roles: ['teaching', 'djing'] },
  ];
  setResult = () => ({ data: { ok: true, changed: true, occurrence_id: 'o1', version: 8, sessions: sessions() }, error: null });
  rpc.mockImplementation(async (fn: string) => {
    if (fn === 'event_view_p5') return { data: { occurrence: { id: 'o1', date: '2026-10-08', version: 1 }, event: {}, schedule: {} }, error: null };
    if (fn === 'organiser_get_occurrence_programme_v1') {
      if (reader) return { data: reader(getCalls().length), error: null };
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

describe('Line-up rebuild: search is a view, not a popover', () => {
  it('Add teacher turns the whole sheet into a full-height search (input on top, results below, Back)', async () => {
    await openLineup(0);
    expect(sheet().getAttribute('data-view')).toBe('list');
    expect(sheet().className).toMatch(/max-h-\[85dvh\]/);
    await search('teaching', 'ze');
    expect(sheet().getAttribute('data-view')).toBe('search');
    expect(sheet().className).toMatch(/(^|\s)h-\[85dvh\]/);
    // The list and its buttons are gone: nothing floats over Done, because Done is not there.
    expect(within(sheet()).queryByTestId('lineup-add-teaching')).toBeNull();
    expect(within(sheet()).queryByTestId('lineup-done')).toBeNull();
    const view = within(sheet()).getByTestId('person-picker');
    expect(view.className).not.toMatch(/absolute|top-full/);
    // Input first, results after it in the same column.
    const input = within(sheet()).getByTestId('person-picker-input');
    const results = within(sheet()).getByTestId('person-picker-results');
    expect(input.compareDocumentPosition(results) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(results.className).toMatch(/overflow-y-auto/);
    expect(input.className).toMatch(/text-\[16px\]/);
    fireEvent.click(within(sheet()).getByTestId('person-picker-back'));
    await waitFor(() => expect(sheet().getAttribute('data-view')).toBe('list'));
    expect(document.activeElement).toBe(within(sheet()).getByTestId('lineup-add-teaching'));
  });

  // A tap outside while searching (back to the list) is checked in a real browser: jsdom does not route Radix outside taps.
  it('Escape in the search goes back to the list; Escape on the list closes only the line-up sheet, not the date sheet', async () => {
    await openLineup(0);
    await search('djing', 'ze');
    fireEvent.keyDown(within(sheet()).getByTestId('person-picker-input'), { key: 'Escape' });
    await waitFor(() => expect(sheet().getAttribute('data-view')).toBe('list'));
    fireEvent.keyDown(within(sheet()).getByTestId('lineup-add-djing'), { key: 'Escape' });
    await waitFor(() => expect(screen.queryByTestId('lineup-sheet')).toBeNull());
    expect(screen.getByTestId('date-sheet')).toBeTruthy();
    await waitFor(() => expect(document.activeElement).toBe(lineupRow(0)));
  });

  it('the picked person pops into the list, and the focus goes back to the Add button', async () => {
    await openLineup(1);
    await search('djing', 'zed');
    fireEvent.click((await within(sheet()).findAllByTestId('person-picker-result'))[1]);
    const row = personNamed('DJ Zed');
    expect(row.querySelector('.animate-in')).toBeTruthy();
    expect(row.querySelector('.animate-in')?.className).toMatch(/duration-300/);
    expect(document.activeElement).toBe(within(sheet()).getByTestId('lineup-add-djing'));
  });

  it('someone removed in this draft is offered as "Put back" in the search, and comes back', async () => {
    searchRows = [{ id: P(2), display_name: 'Ben', dj_name: null, photo_url: null, city_name: null, country_code: null, roles: ['teaching'] }];
    await openLineup(0);
    fireEvent.click(within(personNamed('Ben')).getByTestId('lineup-remove'));
    await search('teaching', 'be');
    const [ben] = await within(sheet()).findAllByTestId('person-picker-result');
    expect((ben as HTMLButtonElement).disabled).toBe(false);
    expect(within(ben).getByTestId('person-picker-put-back')).toBeTruthy();
    fireEvent.click(ben);
    expect(personNamed('Ben').getAttribute('data-testid')).toBe('lineup-person');
    expect(screen.queryByTestId('programme-unsaved')).toBeNull();
  });
});

describe('Line-up rebuild: removal, greyed states and contrast classes', () => {
  it('an added person folds to nothing: the row track goes to 0fr and its box can shrink to 0 (min-h-0)', async () => {
    await openLineup(1);
    await search('teaching', 'zed');
    fireEvent.click((await within(sheet()).findAllByTestId('person-picker-result'))[1]);
    fireEvent.click(within(personNamed('Zed Ortiz')).getByTestId('lineup-remove'));
    const li = personNamed('Zed Ortiz');
    expect(li.className).toMatch(/grid-rows-\[0fr\]/);
    expect(li.className).toMatch(/opacity-0/);
    expect(li.className).toMatch(/duration-300/);
    expect(li.className).toMatch(/ease-in-out/);
    // The finding: a min-h-[48px] child kept a 48px gap. The fold box is min-h-0 and the 56px row lives inside it.
    const box = li.firstElementChild as HTMLElement;
    expect(box.className).toMatch(/min-h-0/);
    expect(box.className).toMatch(/overflow-hidden/);
    expect(li.className).not.toMatch(/min-h-/);
  });

  it('a removed stored person reads greyed through colour and strike-through, never opacity', async () => {
    await openLineup(0);
    fireEvent.click(within(personNamed('Ben')).getByTestId('lineup-remove'));
    const ben = personNamed('Ben');
    expect(ben.innerHTML).not.toMatch(/opacity-50|opacity-40/);
    expect(within(ben).getByTestId('lineup-name').className).toMatch(/text-muted-foreground/);
    expect(within(ben).getByTestId('lineup-name').className).toMatch(/line-through/);
    expect(ben.textContent).toMatch(/Removed\. Not saved yet\./);
  });

  it('the disabled remove button and "On this session" stay at full colour (no disabled:opacity)', async () => {
    s1People = Array.from({ length: 13 }, (_, i) => person(100 + i, `Person ${i}`, 'djing'));
    await openLineup(0);
    for (let i = 0; i < 12; i += 1) {
      act(() => { fireEvent.click(within(personNamed(`Person ${i}`)).getByTestId('lineup-remove')); });
    }
    const off = within(personNamed('Person 12')).getByTestId('lineup-remove');
    expect(off.className).not.toMatch(/opacity/);
    expect(off.className).toMatch(/text-muted-foreground/);
    expect(off.getAttribute('aria-describedby')).toBe('lineup-remove-reason');
  });

  it('MCs and performers say "Added by the team", have no remove, and are never offered in the search', async () => {
    s1People = [person(4, 'Max', 'mc'), person(5, 'Pia', 'performing')];
    await openLineup(0);
    expect(within(personNamed('Max')).getByTestId('lineup-readonly').textContent).toBe('Added by the team');
    expect(within(personNamed('Pia')).getByTestId('lineup-role').textContent).toBe('Performer');
    expect(within(sheet()).queryAllByTestId('lineup-remove')).toHaveLength(0);
    await search('teaching', 'ma');
    await within(sheet()).findAllByTestId('person-picker-result');
    expect(searchCalls().every(([, a]) => ['teaching', 'djing'].includes((a as { p_role: string }).p_role))).toBe(true);
  });

  it('adding up to 12 in one draft turns both Add buttons off with the reason tied to them', async () => {
    s1People = Array.from({ length: 11 }, (_, i) => person(100 + i, `Person ${i}`, 'teaching'));
    await openLineup(0);
    expect((within(sheet()).getByTestId('lineup-add-teaching') as HTMLButtonElement).disabled).toBe(false);
    await search('djing', 'zed');
    fireEvent.click((await within(sheet()).findAllByTestId('person-picker-result'))[1]);
    const add = within(sheet()).getByTestId('lineup-add-djing') as HTMLButtonElement;
    expect(add.disabled).toBe(true);
    expect(add.getAttribute('aria-describedby')).toBe('lineup-add-reason');
    expect(within(sheet()).getByTestId('lineup-add-reason').textContent).toMatch(/up to 12/);
  });

  it('the summary row is 48px tall with a 3:1 edge (muted-foreground/60) and the chevron', async () => {
    await openEditor();
    expect(lineupRow(0).className).toMatch(/min-h-\[48px\]/);
    expect(lineupRow(0).className).toMatch(/border-muted-foreground\/60/);
    expect(lineupRow(0).querySelector('svg')).toBeTruthy();
  });
});

describe('Line-up rebuild: read-only viewers and the re-read after save', () => {
  it('a date that cannot be changed still shows each session line-up, read only, with role chips', async () => {
    reader = () => ({
      occurrence_id: 'o1', series_id: 's1', occurrence_date: '2026-10-08', version: 7, editable: false, not_editable_reason: 'past_date',
      sessions: sessions(),
      session_people: [{ series_item_id: S1, people: s1People }, { added_session_id: A1, people: [] }],
    });
    mount();
    fireEvent.click(await screen.findByTestId('action-programme'));
    await screen.findByTestId('programme-readonly');
    const rows = screen.getAllByTestId('lineup-readonly-row');
    expect(rows).toHaveLength(2);
    const people = within(rows[0]).getAllByTestId('lineup-readonly-person');
    expect(people.map((p) => p.textContent)).toEqual(['AnaTeacher', 'BenTeacher', 'CleoDJ', 'MaxMC']);
    expect(rows[1].textContent).toMatch(/No teachers or DJs/);
    expect(screen.queryByTestId('lineup-row')).toBeNull();
    expect(screen.queryByTestId('lineup-remove')).toBeNull();
  });

  it('the menu says the programme step holds the line-up', async () => {
    mount();
    expect((await screen.findByTestId('action-programme')).textContent).toMatch(/line-up/);
  });

  it('REGRESSION (finding 3): after a title-only save the date-only session is re-read under its NEW id with its people', async () => {
    const A2 = '44444444-4444-4444-8444-444444444444';
    const before = { occurrence_id: 'o1', series_id: 's1', occurrence_date: '2026-10-08', version: 7, editable: true, not_editable_reason: null,
      sessions: sessions(),
      session_people: [{ series_item_id: S1, people: [] }, { added_session_id: A1, people: [person(1, 'Ana', 'teaching')] }] };
    // The writer re-creates a changed date-only session: it comes back as A2, with Ana still on it.
    const renamed = [sessions()[0], { ...sessions()[1], added_session_id: A2, title: 'Bootcamp XL' }];
    const after = { ...before, version: 8, sessions: renamed,
      session_people: [{ series_item_id: S1, people: [] }, { added_session_id: A2, people: [person(1, 'Ana', 'teaching')] }] };
    reader = (n) => (n <= 1 ? before : after);
    setResult = () => ({ data: { ok: true, changed: true, occurrence_id: 'o1', version: 8, sessions: renamed }, error: null });

    await openEditor();
    expect(within(lineupRow(1)).getByTestId('lineup-row-value').textContent).toBe('Ana');
    fireEvent.change(within(screen.getAllByTestId('programme-row')[1]).getByTestId('programme-title'), { target: { value: 'Bootcamp XL' } });
    fireEvent.click(screen.getByTestId('programme-save'));
    await screen.findByTestId('programme-done');
    // Read again after EVERY save, even one that sent no people.
    await waitFor(() => expect(getCalls()).toHaveLength(2));
    expect(sentSessions()[1]).not.toHaveProperty('people_add');

    fireEvent.click(screen.getByTestId('programme-edit-again'));
    await screen.findAllByTestId('programme-row');
    expect(within(lineupRow(1)).getByTestId('lineup-row-value').textContent).toBe('Ana');
    // Ana is ON the session under its new id: the search marks her, so she is never re-added.
    fireEvent.click(lineupRow(1));
    await screen.findByTestId('lineup-sheet');
    await search('teaching', 'an');
    const [ana] = await within(sheet()).findAllByTestId('person-picker-result');
    expect((ana as HTMLButtonElement).disabled).toBe(true);
    // A further save names the NEW id and the version the re-read returned.
    fireEvent.click(within(sheet()).getByTestId('person-picker-back'));
    fireEvent.click(within(personNamed('Ana')).getByTestId('lineup-remove'));
    fireEvent.click(within(sheet()).getByTestId('lineup-done'));
    await waitFor(() => expect(screen.queryByTestId('lineup-sheet')).toBeNull());
    fireEvent.click(screen.getByTestId('programme-save'));
    await waitFor(() => expect(setCalls()).toHaveLength(2));
    const second = setCalls()[1][1] as { p_expected_version: number; p_sessions: Record<string, unknown>[] };
    expect(second.p_expected_version).toBe(8);
    expect(second.p_sessions[1]).toMatchObject({ added_session_id: A2, people_remove: [P(1)] });
  });

  it('if the re-read after a save fails, the old draft is never shown: Edit again loads the date first', async () => {
    reader = (n) => {
      if (n === 2) throw new Error('offline');
      return { occurrence_id: 'o1', series_id: 's1', occurrence_date: '2026-10-08', version: n === 1 ? 7 : 8, editable: true, not_editable_reason: null,
        sessions: sessions(), session_people: [{ series_item_id: S1, people: s1People }, { added_session_id: A1, people: [] }] };
    };
    await openEditor();
    fireEvent.change(within(screen.getAllByTestId('programme-row')[0]).getByTestId('programme-title'), { target: { value: 'New name' } });
    fireEvent.click(screen.getByTestId('programme-save'));
    await screen.findByTestId('programme-done');
    await waitFor(() => expect(getCalls()).toHaveLength(2));
    fireEvent.click(screen.getByTestId('programme-edit-again'));
    await waitFor(() => expect(getCalls()).toHaveLength(3));
    await screen.findAllByTestId('programme-row');
    expect((within(screen.getAllByTestId('programme-row')[0]).getByTestId('programme-title') as HTMLInputElement).value).toBe('Bachata Basics');
    expect(screen.queryByTestId('programme-unsaved')).toBeNull();
  });
});

describe('Line-up rebuild: keyboard and reduced motion', () => {
  it('with the on-screen keyboard up, the search view sits on it and fits the visible height', async () => {
    const listeners: Record<string, () => void> = {};
    const vv = { height: 400, offsetTop: 0, addEventListener: (t: string, f: () => void) => { listeners[t] = f; }, removeEventListener: () => {} };
    Object.defineProperty(window, 'visualViewport', { configurable: true, value: vv });
    Object.defineProperty(window, 'innerHeight', { configurable: true, value: 844 });
    try {
      await openLineup(0);
      await search('teaching', 'ze');
      await waitFor(() => expect(sheet().style.bottom).toBe('444px'));
      expect(sheet().style.height).toBe('min(85dvh, 392px)');
      vv.height = 844;
      act(() => listeners.resize());
      await waitFor(() => expect(sheet().style.bottom).toBe(''));
    } finally {
      Object.defineProperty(window, 'visualViewport', { configurable: true, value: undefined });
    }
  });

  it('reduced motion: no slide, no pop, no fold, no shake', async () => {
    mockReducedMotion(true);
    await openLineup(1);
    expect(sheet().className).toMatch(/motion-reduce:!animate-none/);
    await search('teaching', 'zed');
    fireEvent.click((await within(sheet()).findAllByTestId('person-picker-result'))[1]);
    const popped = personNamed('Zed Ortiz').querySelector('.animate-in');
    expect(popped?.className ?? '').toMatch(/motion-reduce:animate-none/);
    expect(personNamed('Zed Ortiz').className).toMatch(/motion-reduce:transition-none/);
  });
});
