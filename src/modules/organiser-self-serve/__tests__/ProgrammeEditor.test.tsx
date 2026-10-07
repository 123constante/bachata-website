// @vitest-environment jsdom
/**
 * The per-date programme editor, reached from the date sheet. The save sends
 * the COMPLETE programme the reader returned (plus new sessions) with the
 * reader's version; removing a session needs a hard confirm; a version
 * conflict reloads.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

const rpc = vi.hoisted(() => vi.fn());
const from = vi.hoisted(() => vi.fn());
vi.mock('@/integrations/supabase/client', () => ({ supabase: { rpc, from } }));

import { DateActionSheet } from '../components/DateActionSheet';
import type { WorkspaceDate, WorkspaceSeries } from '../seriesModel';

const S1 = '11111111-1111-4111-8111-111111111111';
const S2 = '22222222-2222-4222-8222-222222222222';
const A1 = '33333333-3333-4333-8333-333333333333';

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
  { series_item_id: S2, type: 'party', title: 'Party', start_time: '22:00', end_time: '02:00', ends_next_day: true, level_keys: [], removed: false },
  { added_session_id: A1, type: 'class', title: 'Bootcamp', start_time: '18:00', end_time: '18:45', ends_next_day: false, level_keys: ['improver'], removed: false },
];
let programme: Record<string, unknown>;
let setResult: () => { data: unknown; error: unknown };

const setCalls = () => rpc.mock.calls.filter(([fn]) => fn === 'organiser_set_occurrence_programme_v1');
const getCalls = () => rpc.mock.calls.filter(([fn]) => fn === 'organiser_get_occurrence_programme_v1');

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

const rowAt = (i: number) => screen.getAllByTestId('programme-row')[i];

beforeEach(() => {
  rpc.mockReset();
  from.mockReset();
  from.mockReturnValue({ select: () => ({ is: () => ({ order: async () => ({ data: [], error: null }) }) }) });
  programme = { occurrence_id: 'o1', series_id: 's1', occurrence_date: '2026-10-08', version: 7, editable: true, not_editable_reason: null, sessions: sessions() };
  setResult = () => ({ data: { ok: true, changed: true, occurrence_id: 'o1', version: 8, audit_id: 'a', counts: {}, added_ids: [], sessions: sessions() }, error: null });
  rpc.mockImplementation(async (fn: string) => {
    if (fn === 'event_view_p5') return { data: { occurrence: { id: 'o1', date: '2026-10-08', version: 1 }, event: {}, schedule: {} }, error: null };
    if (fn === 'organiser_get_occurrence_programme_v1') return { data: programme, error: null };
    if (fn === 'organiser_set_occurrence_programme_v1') return setResult();
    return { data: { ok: true }, error: null };
  });
});
afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

describe('ProgrammeEditor', () => {
  it('loads every session; Save stays off and nothing is sent until something changes', async () => {
    await openEditor();
    expect(getCalls()[0][1]).toEqual({ p_occurrence_id: 'o1' });
    expect(screen.getAllByTestId('programme-row')).toHaveLength(3);
    expect((screen.getByTestId('programme-save') as HTMLButtonElement).disabled).toBe(true);
    fireEvent.click(screen.getByTestId('programme-save'));
    expect(setCalls()).toHaveLength(0);
    // The type of an existing session is shown, not editable; "Party", never the other word.
    expect(within(rowAt(1)).getByTestId('programme-type').textContent).toBe('Party');
    expect(within(rowAt(1)).queryByTestId('programme-type-select')).toBeNull();
  });

  it('Save sends EVERY session the reader returned, once each, with the reader version', async () => {
    await openEditor();
    fireEvent.change(within(rowAt(0)).getByTestId('programme-title'), { target: { value: 'Bachata Basics 2' } });
    fireEvent.click(screen.getByTestId('programme-save'));
    await waitFor(() => expect(setCalls()).toHaveLength(1));
    const args = setCalls()[0][1] as { p_occurrence_id: string; p_expected_version: number; p_sessions: Record<string, unknown>[] };
    expect(args.p_occurrence_id).toBe('o1');
    expect(args.p_expected_version).toBe(7);
    expect(args.p_sessions).toHaveLength(3);
    const ids = args.p_sessions.map((s) => s.series_item_id ?? s.added_session_id);
    expect(ids).toEqual([S1, S2, A1]);
    expect(args.p_sessions[0]).toMatchObject({ title: 'Bachata Basics 2', removed: false });
    expect(args.p_sessions.slice(1)).toEqual(sessions().slice(1));

    const done = await screen.findByTestId('programme-done');
    expect(done.textContent).toMatch(/live on Bachata Calendar now/);
    expect(screen.getByTestId('programme-view-on-site').getAttribute('href')).toBe('/event/thursday-class');
  });

  it('times: the end before the start says it finishes after midnight and sends ends_next_day', async () => {
    await openEditor();
    expect(within(rowAt(1)).getByTestId('programme-overnight').textContent).toMatch(/Finishes after midnight/);
    expect(within(rowAt(0)).queryByTestId('programme-overnight')).toBeNull();
    fireEvent.change(within(rowAt(0)).getByTestId('programme-end'), { target: { value: '01:00' } });
    expect(within(rowAt(0)).getByTestId('programme-overnight')).toBeTruthy();
    fireEvent.click(screen.getByTestId('programme-save'));
    await waitFor(() => expect(setCalls()).toHaveLength(1));
    expect((setCalls()[0][1] as { p_sessions: unknown[] }).p_sessions[0]).toMatchObject({ end_time: '01:00', ends_next_day: true });
  });

  it('levels are toggle chips; the payload carries the chosen keys', async () => {
    await openEditor();
    const chip = within(rowAt(0)).getByTestId('programme-level-improver');
    expect(chip.getAttribute('aria-pressed')).toBe('false');
    fireEvent.click(chip);
    expect(chip.getAttribute('aria-pressed')).toBe('true');
    fireEvent.click(screen.getByTestId('programme-save'));
    await waitFor(() => expect(setCalls()).toHaveLength(1));
    expect((setCalls()[0][1] as { p_sessions: Array<{ level_keys: string[] }> }).p_sessions[0].level_keys).toEqual(['beginner', 'improver']);
  });

  it('remove: hard confirm before the save; the removed session is sent with removed:true', async () => {
    await openEditor();
    fireEvent.click(within(rowAt(0)).getByTestId('programme-remove'));
    expect(screen.getByTestId('programme-row-removed').textContent).toMatch(/Not saved yet/);
    fireEvent.click(screen.getByTestId('programme-save'));
    const panel = await screen.findByTestId('programme-remove-confirm');
    expect(panel.textContent).toContain('Bachata Basics');
    expect(setCalls()).toHaveLength(0);
    const go = screen.getByTestId('confirm-go') as HTMLButtonElement;
    expect(go.disabled).toBe(true);
    fireEvent.click(screen.getByTestId('confirm-ack'));
    fireEvent.click(go);
    await waitFor(() => expect(setCalls()).toHaveLength(1));
    const sent = (setCalls()[0][1] as { p_sessions: Record<string, unknown>[] }).p_sessions;
    expect(sent).toHaveLength(3);
    expect(sent[0]).toEqual({ ...sessions()[0], removed: true });
  });

  it('a removed session can be put back before saving, and then nothing is left to save', async () => {
    await openEditor();
    fireEvent.click(within(rowAt(1)).getByTestId('programme-remove'));
    fireEvent.click(screen.getByTestId('programme-restore'));
    expect(screen.getAllByTestId('programme-row')).toHaveLength(3);
    expect((screen.getByTestId('programme-save') as HTMLButtonElement).disabled).toBe(true);
  });

  it('add a session: kind picker, then new:true after the existing sessions', async () => {
    await openEditor();
    fireEvent.click(screen.getByTestId('programme-add'));
    const row = rowAt(3);
    expect(document.activeElement).toBe(within(row).getByTestId('programme-title'));
    fireEvent.change(within(row).getByTestId('programme-type-select'), { target: { value: 'masterclass' } });
    fireEvent.change(within(row).getByTestId('programme-title'), { target: { value: 'Footwork' } });
    fireEvent.change(within(row).getByTestId('programme-start'), { target: { value: '17:00' } });
    fireEvent.change(within(row).getByTestId('programme-end'), { target: { value: '17:45' } });
    fireEvent.click(screen.getByTestId('programme-save'));
    await waitFor(() => expect(setCalls()).toHaveLength(1));
    const sent = (setCalls()[0][1] as { p_sessions: Record<string, unknown>[] }).p_sessions;
    expect(sent).toHaveLength(4);
    expect(sent[3]).toEqual({ new: true, type: 'masterclass', title: 'Footwork', start_time: '17:00', end_time: '17:45', ends_next_day: false, level_keys: [] });
  });

  it('client validation stops the call with plain words', async () => {
    await openEditor();
    fireEvent.change(within(rowAt(0)).getByTestId('programme-title'), { target: { value: '   ' } });
    fireEvent.change(within(rowAt(2)).getByTestId('programme-end'), { target: { value: '18:02' } });
    fireEvent.click(screen.getByTestId('programme-save'));
    expect(setCalls()).toHaveLength(0);
    expect(screen.getByTestId('programme-problems').textContent).toMatch(/Fix the highlighted sessions/);
    expect(within(rowAt(0)).getByTestId('programme-row-error').textContent).toBe('Give this session a name.');
    expect(within(rowAt(2)).getByTestId('programme-row-error').textContent).toBe('A session must last between 5 minutes and 12 hours.');
  });

  it('version conflict: says so, reloads the reader and starts the draft from it', async () => {
    await openEditor();
    setResult = () => ({ data: null, error: { message: 'version_conflict: expected 7, got 8', code: 'P0001' } });
    programme = { ...programme, version: 8, sessions: [{ ...sessions()[0], title: 'Changed elsewhere' }, ...sessions().slice(1)] };
    fireEvent.change(within(rowAt(0)).getByTestId('programme-title'), { target: { value: 'Mine' } });
    fireEvent.click(screen.getByTestId('programme-save'));
    expect((await screen.findByTestId('programme-error')).textContent).toMatch('This date was changed elsewhere. Reload to see the latest.');
    await waitFor(() => expect(getCalls()).toHaveLength(2));
    await waitFor(() => expect((within(rowAt(0)).getByTestId('programme-title') as HTMLInputElement).value).toBe('Changed elsewhere'));

    // The next save carries the new version.
    setResult = () => ({ data: { ok: true, changed: true, version: 9, sessions: sessions() }, error: null });
    fireEvent.change(within(rowAt(0)).getByTestId('programme-title'), { target: { value: 'Mine again' } });
    fireEvent.click(screen.getByTestId('programme-save'));
    await waitFor(() => expect(setCalls()).toHaveLength(2));
    expect((setCalls()[1][1] as { p_expected_version: number }).p_expected_version).toBe(8);
  });

  it('a server refusal is shown in plain words, never the raw text', async () => {
    await openEditor();
    setResult = () => ({ data: null, error: { message: 'invalid_payload: the programme of this date would span more than 20 hours', code: 'P0001' } });
    fireEvent.change(within(rowAt(0)).getByTestId('programme-title'), { target: { value: 'x' } });
    fireEvent.click(screen.getByTestId('programme-save'));
    const e = await screen.findByTestId('programme-error');
    expect(e.textContent).toMatch(/more than 20 hours\. Check the times/);
    expect(e.textContent).not.toMatch(/invalid_payload/);
  });

  it.each([
    ['multi_day', /Ask the Bachata Calendar team/],
    ['past_date', /already happened/],
  ])('read only when not editable (%s): reason shown, no inputs, no save', async (reason, copy) => {
    programme = { ...programme, editable: false, not_editable_reason: reason };
    mount();
    fireEvent.click(await screen.findByTestId('action-programme'));
    expect((await screen.findByTestId('programme-readonly-reason')).textContent).toMatch(copy);
    expect(screen.getByTestId('programme-readonly').textContent).toContain('Bachata Basics');
    expect(screen.queryByTestId('programme-title')).toBeNull();
    expect(screen.queryByTestId('programme-save')).toBeNull();
  });

  it('unsaved changes: Back asks first, and staying keeps the edit', async () => {
    const confirm = vi.spyOn(window, 'confirm').mockReturnValue(false);
    await openEditor();
    fireEvent.change(within(rowAt(0)).getByTestId('programme-title'), { target: { value: 'Edited' } });
    expect(screen.getByTestId('programme-unsaved')).toBeTruthy();
    fireEvent.click(screen.getByTestId('programme-back'));
    expect(confirm).toHaveBeenCalled();
    expect((within(rowAt(0)).getByTestId('programme-title') as HTMLInputElement).value).toBe('Edited');
    confirm.mockReturnValue(true);
    fireEvent.click(screen.getByTestId('programme-back'));
    expect(await screen.findByTestId('action-programme')).toBeTruthy();
  });

  it('inputs are labelled', async () => {
    await openEditor();
    expect(screen.getAllByLabelText('Name')).toHaveLength(3);
    expect(screen.getAllByLabelText('Starts')).toHaveLength(3);
    expect(screen.getAllByLabelText('Ends')).toHaveLength(3);
  });
});
