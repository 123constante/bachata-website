// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { SHAPES, occ, program, item, weekly, wsRaw } from './wsFixtures';
import { REPEAT_COPY, REPEAT_FAIL, REPEAT_WHY } from '../../model/repeat';

/*
 * P3 W3c-1 Repeat through the REAL page and send path (EventPage -> RepeatSheet -> data/repeat
 * previewRepeat / useRunCommands -> selfServeApi runSeriesCommand -> envelope()); only
 * supabase.rpc is stood in for. Asserts what goes over the wire: an untouched sheet sends
 * nothing (no preview either), a change asks for ONE dry run per settled draft, Save sends
 * the same payload without dry_run against the version the page showed.
 */

const rpc = vi.hoisted(() => vi.fn());
vi.mock('@/integrations/supabase/client', () => ({ supabase: { rpc, auth: {}, from: vi.fn() } }));
vi.mock('@/lib/londonDate', async (orig) => ({ ...(await orig<typeof import('@/lib/londonDate')>()), londonTodayKey: () => '2026-10-25' }));
vi.mock('../../data/useP3Data', () => ({ useP3Home: () => ({ isPending: true, data: undefined }) }));

import { EventPage } from '../EventPage';

type Env = { target_id: string; expected_version?: number; idempotency_key: string; command: { kind: string; payload: Record<string, unknown> } };
const DRY = {
  recurrence_rule: {}, materialise: null, dry_run: true, date_cap: null, dates_considered: 12,
  will_add: ['2026-10-26', '2026-11-02'], will_remove: ['2026-11-20'], will_cancel_booked: [], keeps_own_changes: ['2026-11-13'],
  next_8: ['2026-10-26', '2026-10-30', '2026-11-02', '2026-11-13', '2026-11-16'],
};

let sent: Env[];
function serve(raw: unknown, answer: (e: Env) => { data?: unknown; error?: unknown } = () => ({ data: { ok: true, new_version: 7, data: DRY, dry_run: true } })) {
  sent = [];
  rpc.mockImplementation(async (name: string, args: Record<string, unknown>) => {
    if (name === 'admin_event_workspace_p5') return { data: raw, error: null };
    if (name === 'series_command_p5') {
      const env = args.p_envelope as Env;
      sent.push(env);
      const a = answer(env);
      return { data: a.data ?? null, error: a.error ?? null };
    }
    return { data: [], error: null };
  });
}

function show() {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={qc}>
      <MemoryRouter initialEntries={['/account/p3/events/ser-1']}>
        <Routes><Route path="/account/p3/events/:seriesId" element={<EventPage />} /></Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

async function openRepeat() {
  fireEvent.click(await screen.findByTestId('p3-open-repeat'));
  return screen.findByTestId('p3-sheet');
}

beforeEach(() => rpc.mockReset());
afterEach(cleanup);

describe('W3c-1 Repeat sheet, real send path', () => {
  it('RED FIRST guard: opening, looking and closing sends nothing, and the sheet is on document.body', async () => {
    serve(SHAPES.weekly);
    show();
    expect((await screen.findByTestId('p3-repeat-row')).textContent).toContain('Every Friday, keeps going.');
    const sheet = await openRepeat();
    expect(sheet.closest('[data-testid="p3-event"]')).toBeNull();
    expect(sheet.closest('.p3-theme.p3-portal')?.parentElement).toBe(document.body);
    const save = screen.getByTestId('p3-repeat-save');
    expect((save as HTMLButtonElement).disabled).toBe(true);
    expect((save).textContent).toContain(REPEAT_COPY.nothing);
    fireEvent.click(save);
    await new Promise((r) => setTimeout(r, 450));
    fireEvent.click(within(sheet).getByRole('button', { name: 'Close' }));
    expect(sent).toEqual([]);
  });

  it('a change asks for one dry run, shows what moves, and Save sends the same rule once without dry_run', async () => {
    serve(SHAPES.weekly);
    show();
    await openRepeat();
    fireEvent.click(screen.getByRole('button', { name: 'Monday' }));
    expect((await screen.findByTestId('p3-repeat-line-removed')).textContent).toContain('This removes 1 date already on the calendar.');
    expect(screen.getByTestId('p3-repeat-line-removed').classList.contains('p3-error')).toBe(true);
    expect((screen.getByTestId('p3-repeat-line-added')).textContent).toContain('2 dates added.');
    expect((screen.getByTestId('p3-repeat-line-keeps')).textContent).toContain('1 date keeps its own changes.');
    expect(within(screen.getByTestId('p3-repeat-next')).getAllByRole('listitem')).toHaveLength(5);
    expect((screen.getByTestId('p3-repeat-sentence')).textContent).toContain('Every Monday and Friday, keeps going.');
    expect(sent).toHaveLength(1);
    expect(sent[0].target_id).toBe('ser-1');
    expect(sent[0].expected_version).toBe(7);
    expect(sent[0].command).toEqual({ kind: 'series.set_recurrence', payload: { mode: 'weekly', interval: 1, weekdays: [1, 5], end: { kind: 'none' }, dry_run: true } });

    serve(SHAPES.weekly, () => ({ data: { ok: true, new_version: 8, data: {} } }));
    const save = screen.getByTestId('p3-repeat-save');
    expect((save as HTMLButtonElement).disabled).toBe(false);
    fireEvent.click(save);
    await waitFor(() => expect(screen.queryByTestId('p3-sheet')).toBeNull());
    expect(sent).toHaveLength(1);
    expect(sent[0].expected_version).toBe(7);
    expect(sent[0].command).toEqual({ kind: 'series.set_recurrence', payload: { mode: 'weekly', interval: 1, weekdays: [1, 5], end: { kind: 'none' } } });
    expect(await screen.findByText(REPEAT_COPY.saved)).toBeTruthy();
  });

  it('Undo my changes puts the stored rule back and sends nothing more', async () => {
    serve(SHAPES.weekly);
    show();
    await openRepeat();
    fireEvent.click(screen.getByRole('button', { name: 'Monday' }));
    await screen.findByTestId('p3-repeat-line-removed');
    fireEvent.click(screen.getByTestId('p3-repeat-undo'));
    expect((screen.getByTestId('p3-repeat-save') as HTMLButtonElement).disabled).toBe(true);
    expect(screen.queryByTestId('p3-repeat-preview')).toBeNull();
    expect(sent).toHaveLength(1);
  });

  it('a problem is said before anything is sent (over 500 times)', async () => {
    serve(SHAPES.weekly);
    show();
    await openRepeat();
    fireEvent.click(screen.getByRole('button', { name: 'Stops after' }));
    fireEvent.change(screen.getByLabelText(/How many times in all/), { target: { value: '501' } });
    expect((screen.getByTestId('p3-repeat-save-why')).textContent).toContain(REPEAT_FAIL.count_over_cap);
    expect((screen.getByTestId('p3-repeat-save') as HTMLButtonElement).disabled).toBe(true);
    await new Promise((r) => setTimeout(r, 450));
    expect(sent).toEqual([]);
  });

  it('RED FIRST: a refused dry run and a refused save each show their one sentence', async () => {
    serve(SHAPES.weekly, () => ({ error: { code: '22023', message: 'invalid_recurrence_payload: count_over_cap: the rule makes more than 500 dates' } }));
    show();
    await openRepeat();
    fireEvent.click(screen.getByRole('button', { name: 'Monday' }));
    expect((await screen.findByTestId('p3-repeat-preview-error')).textContent).toContain(REPEAT_FAIL.count_over_cap);

    serve(SHAPES.weekly, (e) => (e.command.payload.dry_run ? { data: { ok: true, new_version: 7, data: DRY } } : { error: { code: '22023', message: 'invalid_recurrence_payload: until_too_far' } }));
    fireEvent.click(screen.getByRole('button', { name: REPEAT_COPY.retry }));
    await screen.findByTestId('p3-repeat-line-removed');
    fireEvent.click(screen.getByTestId('p3-repeat-save'));
    expect((await screen.findByTestId('p3-sheet-error')).textContent).toContain(REPEAT_FAIL.until_too_far);
    expect(screen.getByTestId('p3-sheet')).toBeTruthy();
  });

  it('RED FIRST: a course shows the editor greyed, says what to do instead, and sends nothing', async () => {
    const course = wsRaw({ name: 'Beginners Course', format: 'course', category: 'class', recurrence_rule: { mode: 'weekly', interval: 1, weekdays: [3], end: { kind: 'after_count', count: 8 } } },
      program([item('c', 'class', 'Week by week', '19:00', '20:00')]), weekly('2026-10-07', 8).map((d) => occ(d)), { class_count: 8, last_class_date: '2026-11-25' });
    serve(course);
    show();
    await openRepeat();
    expect((screen.getByTestId('p3-repeat-why')).textContent).toContain(REPEAT_WHY.course);
    expect((screen.getByTestId('p3-repeat-course')).textContent).toContain('Class 4 of 8 is next, Wednesday 28 October. Last class Wednesday 25 November.');
    const monday = screen.getByRole('button', { name: 'Monday' });
    expect((monday as HTMLButtonElement).disabled).toBe(true);
    fireEvent.click(monday);
    expect((screen.getByTestId('p3-repeat-save') as HTMLButtonElement).disabled).toBe(true);
    await new Promise((r) => setTimeout(r, 450));
    expect(sent).toEqual([]);
  });

  it.each([
    ['oneoff', 'Doesn\u2019t repeat', REPEAT_WHY.oneoff],
    ['festival', 'Doesn\u2019t repeat', REPEAT_WHY.festival],
    ['custom', 'Dates you pick', REPEAT_WHY.custom],
    ['ended', 'Doesn\u2019t repeat', REPEAT_WHY.ended],
  ] as const)('%s: the pattern and why, an OK button, no editor', async (shape, words, why) => {
    serve(SHAPES[shape]);
    show();
    await openRepeat();
    expect((screen.getByTestId('p3-repeat-current')).textContent).toContain(words);
    expect((screen.getByTestId('p3-repeat-why')).textContent).toContain(why);
    expect(screen.queryByTestId('p3-repeat-editor')).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'OK' }));
    expect(screen.queryByTestId('p3-sheet')).toBeNull();
    expect(sent).toEqual([]);
  });

  it('a recurring event with no rule yet opens with no day, says how to start, and Save waits for a day', async () => {
    serve(wsRaw({ recurrence_rule: null }, program([item('p', 'party', 'Social', '21:00', '01:00')]), weekly('2026-10-30', 3).map((d) => occ(d))));
    show();
    expect((await screen.findByTestId('p3-repeat-row')).textContent).toContain('Doesn\u2019t repeat');
    await openRepeat();
    expect((screen.getByTestId('p3-repeat-norule')).textContent).toContain(REPEAT_COPY.noRule);
    expect((screen.getByTestId('p3-repeat-save') as HTMLButtonElement).disabled).toBe(true);
    fireEvent.click(screen.getByRole('button', { name: 'Friday' }));
    await screen.findByTestId('p3-repeat-line-added');
    expect(sent[0].command.payload).toEqual({ mode: 'weekly', interval: 1, weekdays: [5], end: { kind: 'none' }, dry_run: true });
  });
});
