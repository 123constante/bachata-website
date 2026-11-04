// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { SHAPES } from './wsFixtures';
import { blankDraft } from '../../model/repeat';
import { KEPT_COPY, KEPT_MAX_AGE_MS, dropKept, keepDraft, keptDraft, keptKey } from '../../onboarding/keptDraft';

/*
 * fix-gate-lost-edit item 3, red first on main: a Repeat edit the onboarding gate refused is kept for THAT event
 * (sessionStorage, 60 minutes), and the event page it comes back to reopens the sheet pre-filled with
 * "We kept your changes", Save ready, and NOTHING saved until the person taps Save. Real page and send path
 * (EventPage -> RepeatSheet -> series_command_p5); only supabase.rpc is stood in for.
 */

const rpc = vi.hoisted(() => vi.fn());
vi.mock('@/integrations/supabase/client', () => ({ supabase: { rpc, auth: {}, from: vi.fn() } }));
vi.mock('@/lib/londonDate', async (orig) => ({ ...(await orig<typeof import('@/lib/londonDate')>()), londonTodayKey: () => '2026-10-25' }));
vi.mock('../../data/useP3Data', () => ({ useP3Home: () => ({ isPending: true, data: undefined }) }));

import { EventPage } from '../EventPage';

type Env = { command: { kind: string; payload: Record<string, unknown> } };
const DRY = { recurrence_rule: {}, materialise: null, dry_run: true, date_cap: null, dates_considered: 12, will_add: ['2026-10-26'], will_remove: [], will_cancel_booked: [], keeps_own_changes: [], next_8: ['2026-10-26', '2026-10-30'] };
const REFUSAL = { code: 'P0001', message: 'onboarding_incomplete', details: JSON.stringify({ missing: ['nationality'], organiser_id: 'o1' }), hint: 'Finish your details' };

let saves: Env[];
function serve(save: 'refuse' | 'ok') {
  saves = [];
  rpc.mockImplementation(async (name: string, args: Record<string, unknown>) => {
    if (name === 'admin_event_workspace_p5') return { data: SHAPES.weekly, error: null };
    if (name === 'series_command_p5') {
      const env = args.p_envelope as Env;
      if (env.command.payload.dry_run) return { data: { ok: true, new_version: 7, data: DRY, dry_run: true }, error: null };
      saves.push(env);
      return save === 'refuse' ? { data: null, error: REFUSAL } : { data: { ok: true, new_version: 8, data: {} }, error: null };
    }
    return { data: [], error: null };
  });
}
function show(id = 'ser-1') {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={qc}>
      <MemoryRouter initialEntries={[`/account/p3/events/${id}`]}>
        <Routes><Route path="/account/p3/events/:seriesId" element={<EventPage />} /></Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  );
}
async function refusedMondayEdit() {
  serve('refuse');
  show();
  fireEvent.click(await screen.findByTestId('p3-open-repeat'));
  fireEvent.click(screen.getByRole('button', { name: 'Monday' }));
  await screen.findByTestId('p3-repeat-next');
  fireEvent.click(screen.getByTestId('p3-repeat-save'));
  await waitFor(() => expect(saves).toHaveLength(1));
}

beforeEach(() => { rpc.mockReset(); window.sessionStorage.clear(); });
afterEach(cleanup);

describe('keptDraft store: one event, 60 minutes, this tab only', () => {
  const d = { ...blankDraft(5), weekdays: [1, 5] };
  const T = 1_800_000_000_000;
  it.each([
    ['same event, just kept', 'ser-1', 0, true],
    ['same event, 59 minutes', 'ser-1', KEPT_MAX_AGE_MS - 60_000, true],
    ['same event, 61 minutes', 'ser-1', KEPT_MAX_AGE_MS + 60_000, false],
    ['another event', 'ser-9', 0, false],
    ['a clock gone backwards', 'ser-1', -60_000, false],
  ] as const)('%s', (_n, id, dt, found) => {
    keepDraft('ser-1', { screen: 'repeat', draft: d }, T);
    expect(keptDraft(id, T + dt)).toEqual(found ? { screen: 'repeat', draft: d } : null);
  });
  it('an empty count box (NaN) comes back as NaN, not 0', () => {
    keepDraft('ser-1', { screen: 'repeat', draft: { ...d, end: 'after_count', count: Number.NaN } }, T);
    expect(Number.isNaN(keptDraft('ser-1', T)?.draft.count)).toBe(true);
  });
  it.each(['not json', '{"v":2}', JSON.stringify({ v: 1, screen: 'details', draft: {}, at: T }), JSON.stringify({ v: 1, screen: 'repeat', draft: { freq: 'daily' }, at: T })])('a stored %s is ignored', (raw) => {
    window.sessionStorage.setItem(keptKey('ser-1'), raw);
    expect(keptDraft('ser-1', T)).toBeNull();
  });
  it('storage that throws keeps and finds nothing, and never throws', () => {
    const bad = { getItem: () => { throw new Error('x'); }, setItem: () => { throw new Error('x'); }, removeItem: () => { throw new Error('x'); } };
    expect(() => keepDraft('ser-1', { screen: 'repeat', draft: d }, T, bad)).not.toThrow();
    expect(keptDraft('ser-1', T, bad)).toBeNull();
    expect(() => dropKept('ser-1', bad)).not.toThrow();
  });
  it('lives in sessionStorage only (gone with the tab), never localStorage', () => {
    window.localStorage.clear();
    keepDraft('ser-1', { screen: 'repeat', draft: d }, T);
    expect(window.localStorage.length).toBe(0);
    expect(window.sessionStorage.getItem(keptKey('ser-1'))).not.toBeNull();
  });
});

describe('Repeat: refused Save -> kept -> back on the event, pre-filled, nothing saved', () => {
  it('RED FIRST: the refused edit is kept for this event only', async () => {
    await refusedMondayEdit();
    const k = keptDraft('ser-1');
    expect(k?.screen).toBe('repeat');
    expect(k?.draft.weekdays).toEqual([1, 5]);
    expect(keptDraft('ser-9')).toBeNull();
  });

  it('RED FIRST: coming back reopens the sheet pre-filled, says it once, and sends no save', async () => {
    await refusedMondayEdit();
    cleanup();
    serve('ok');
    show();
    const kept = await screen.findByTestId('p3-repeat-kept');
    expect(kept.textContent).toBe(KEPT_COPY.line);
    expect(screen.getByTestId('p3-repeat-sentence').textContent).toContain('Every Monday and Friday, keeps going.');
    await screen.findByTestId('p3-repeat-next');
    const save = screen.getByTestId('p3-repeat-save') as HTMLButtonElement;
    await waitFor(() => expect(save.disabled).toBe(false));
    await new Promise((r) => setTimeout(r, 450));
    expect(saves).toEqual([]);
    // once: the kept edit is let go as it is shown
    expect(keptDraft('ser-1')).toBeNull();
    fireEvent.click(save);
    await waitFor(() => expect(saves).toHaveLength(1));
    expect(saves[0].command.payload.weekdays).toEqual([1, 5]);
    cleanup();
    show();
    await screen.findByTestId('p3-open-repeat');
    expect(screen.queryByTestId('p3-sheet')).toBeNull();
  });

  it('editing the kept draft drops the line; Undo goes back to the stored rule', async () => {
    await refusedMondayEdit();
    cleanup();
    serve('ok');
    show();
    await screen.findByTestId('p3-repeat-kept');
    fireEvent.click(screen.getByRole('button', { name: 'Tuesday' }));
    expect(screen.queryByTestId('p3-repeat-kept')).toBeNull();
    fireEvent.click(screen.getByTestId('p3-repeat-undo'));
    expect(screen.getByTestId('p3-repeat-sentence').textContent).toContain('Every Friday, keeps going.');
  });

  it('closing the sheet by hand lets the kept edit go', async () => {
    await refusedMondayEdit();
    fireEvent.click(within(screen.getByTestId('p3-sheet')).getByRole('button', { name: 'Close' }));
    expect(keptDraft('ser-1')).toBeNull();
  });

  it('a save that works keeps nothing; an untouched sheet keeps nothing (0 left: the gate never opens)', async () => {
    serve('ok');
    show();
    fireEvent.click(await screen.findByTestId('p3-open-repeat'));
    expect(keptDraft('ser-1')).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'Monday' }));
    await screen.findByTestId('p3-repeat-next');
    fireEvent.click(screen.getByTestId('p3-repeat-save'));
    await waitFor(() => expect(saves).toHaveLength(1));
    expect(keptDraft('ser-1')).toBeNull();
  });

  it("another event's kept edit never opens here", async () => {
    keepDraft('ser-9', { screen: 'repeat', draft: { ...blankDraft(5), weekdays: [1, 5] } });
    serve('ok');
    show('ser-1');
    await screen.findByTestId('p3-open-repeat');
    expect(screen.queryByTestId('p3-sheet')).toBeNull();
    expect(keptDraft('ser-9')).not.toBeNull();
  });
});
