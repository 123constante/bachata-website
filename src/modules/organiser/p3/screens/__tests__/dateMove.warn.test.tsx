// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { REASONS } from './cancelFixtures';
import { SHAPES } from './wsFixtures';

/*
 * Q10: moving a date that has people on it, through the REAL send path. The first tap sends
 * WITHOUT acknowledge_people; a `date_has_people:` refusal opens the confirm step in the same
 * sheet; "Move it anyway" resends with the flag and a NEW idempotency key; "Choose another day"
 * goes back to the day field with the typed day kept. Other refusals never reach the confirm.
 */

const rpc = vi.hoisted(() => vi.fn());
vi.mock('@/integrations/supabase/client', () => ({ supabase: { rpc, auth: {}, from: vi.fn() } }));
vi.mock('@/lib/londonDate', async (orig) => ({ ...(await orig<typeof import('@/lib/londonDate')>()), londonTodayKey: () => '2026-10-25' }));
vi.mock('../../../shared/selfServeApi', async (orig) => ({
  ...(await orig<typeof import('../../../shared/selfServeApi')>()),
  fetchCancellationReasons: async () => REASONS,
}));
vi.mock('../../../shared/publicVenues', async (orig) => ({
  ...(await orig<typeof import('../../../shared/publicVenues')>()),
  useVenueOptions: () => ({ isPending: false, isError: false, data: [] }),
}));
vi.mock('../../data/useP3Data', () => ({ useP3Home: () => ({ isPending: true, data: undefined }) }));

import { EventPage } from '../EventPage';

afterEach(cleanup);

type Env = { command: { kind: string; payload: Record<string, unknown> }; idempotency_key?: string; [k: string]: unknown };
let sent: Env[];
let replies: unknown[]; // consumed one per occurrence_command_p5 call: { error } | { data } | Error

beforeEach(() => {
  sent = [];
  replies = [];
  rpc.mockReset();
  rpc.mockImplementation(async (name: string, args: Record<string, unknown>) => {
    if (name === 'admin_event_workspace_p5') return { data: SHAPES.weekly, error: null };
    if (name === 'event_view_p5') {
      const id = (args.p_target as { occurrence_id: string }).occurrence_id;
      return { data: { event: {}, occurrence: { id, date: id.slice(2), version: 3, lifecycle_status: 'scheduled', materialised_start_utc: `${id.slice(2)}T20:00:00Z` }, schedule: {} }, error: null };
    }
    if (name === 'occurrence_command_p5') {
      sent.push(args.p_envelope as Env);
      const r = replies.shift() as { error?: unknown; data?: unknown } | Error | undefined;
      if (r instanceof Error) throw r;
      if (r?.error) return { data: null, error: r.error };
      return { data: r?.data ?? { ok: true, new_version: 4 }, error: null };
    }
    return { data: null, error: null };
  });
});

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

async function openMove(day = '2026-12-01') {
  show();
  await waitFor(() => screen.getAllByTestId('p3-open-date'));
  fireEvent.click(screen.getAllByTestId('p3-open-date')[0]);
  await waitFor(() => screen.getByTestId('p3-date-actions'));
  fireEvent.click(screen.getByTestId('p3-date-act-move'));
  fireEvent.change(screen.getByTestId('p3-move-day'), { target: { value: day } });
}

const refuse = (message: string, details?: unknown) => ({ error: { message, code: 'P0001', ...(details === undefined ? {} : { details }) } });
const PEOPLE = 'date_has_people: this date has people on it';
const text = (id: string) => screen.getByTestId(id).textContent;

describe('move a date: the people warning', () => {
  it('no people: one send, no flag, as today', async () => {
    await openMove();
    fireEvent.click(screen.getByTestId('p3-move-go'));
    await waitFor(() => screen.getByTestId('p3-toast'));
    expect(sent).toHaveLength(1);
    expect(sent[0].command).toEqual({ kind: 'occurrence.move_date', payload: { to_date: '2026-12-01' } });
    expect(screen.queryByTestId('p3-move-people')).toBeNull();
    expect(screen.getByTestId('p3-toast').textContent).toMatch(/^Moved to .*December/);
    expect(screen.getByTestId('p3-toast').textContent).not.toContain('Tell the people');
  });

  const shapes: Array<[string, unknown, string, string]> = [
    ['all three', JSON.stringify({ guest_list: 3, going: 2, tickets: 1, total: 6 }), '6 people are on this date', '3 on the guest list, 2 going and 1 with tickets'],
    ['guest list only', { guest_list: 4, going: 0, tickets: 0, total: 4 }, '4 people are on this date', '4 on the guest list'],
    ['going only', { guest_list: 0, going: 2, tickets: 0, total: 2 }, '2 people are on this date', '2 going'],
    ['tickets only', { guest_list: 0, going: 0, tickets: 5, total: 5 }, '5 people are on this date', '5 with tickets'],
    ['one person', { guest_list: 1, going: 0, tickets: 0, total: 1 }, '1 person is on this date', '1 on the guest list'],
  ];
  it.each(shapes)('refusal with details (%s): confirm step in the same sheet, nothing sent twice', async (_n, details, title, body) => {
    replies = [refuse(PEOPLE, details)];
    await openMove();
    fireEvent.click(screen.getByTestId('p3-move-go'));
    await waitFor(() => screen.getByTestId('p3-move-people'));
    expect(text('p3-move-people-title')).toBe(title);
    expect(text('p3-move-people-body')).toBe(body);
    expect(text('p3-move-people-tell')).toBe('They are not told automatically. Tell them yourself.');
    expect(sent).toHaveLength(1);
    expect(sent[0].command.payload).toEqual({ to_date: '2026-12-01' });
    expect(screen.queryByTestId('p3-sheet-error')).toBeNull();
    expect(screen.getByTestId('p3-move-anyway').className).toContain('min-h-[44px]');
    expect(screen.getByTestId('p3-move-another').className).toContain('min-h-[44px]');
  });

  it('refusal with only the message numbers, and with garbled details, still shows the counts', async () => {
    replies = [refuse('date_has_people: 3 guest list, 2 going, 1 tickets', '{not json')];
    await openMove();
    fireEvent.click(screen.getByTestId('p3-move-go'));
    await waitFor(() => screen.getByTestId('p3-move-people'));
    expect(text('p3-move-people-title')).toBe('6 people are on this date');
    expect(text('p3-move-people-body')).toBe('3 on the guest list, 2 going and 1 with tickets');
  });

  it('refusal with no numbers anywhere: "People are on this date", no body', async () => {
    replies = [refuse(PEOPLE)];
    await openMove();
    fireEvent.click(screen.getByTestId('p3-move-go'));
    await waitFor(() => screen.getByTestId('p3-move-people'));
    expect(text('p3-move-people-title')).toBe('People are on this date');
    expect(screen.queryByTestId('p3-move-people-body')).toBeNull();
  });

  it('Move it anyway: same move, acknowledge_people true, a NEW idempotency key; success says they are not told (no notices)', async () => {
    replies = [refuse(PEOPLE, { guest_list: 1, going: 1, tickets: 0, total: 2 })];
    await openMove();
    fireEvent.click(screen.getByTestId('p3-move-go'));
    await waitFor(() => screen.getByTestId('p3-move-anyway'));
    fireEvent.click(screen.getByTestId('p3-move-anyway'));
    await waitFor(() => screen.getByTestId('p3-toast'));
    expect(sent).toHaveLength(2);
    expect(sent[1].command).toEqual({ kind: 'occurrence.move_date', payload: { to_date: '2026-12-01', acknowledge_people: true } });
    expect(sent[1].idempotency_key).toBeTruthy();
    expect(sent[1].idempotency_key).not.toBe(sent[0].idempotency_key);
    expect(screen.getByTestId('p3-toast').textContent).toContain('Moved. Tell the people on it yourself: they are not told automatically.');
  });

  it('Move it anyway with notices on the reply: says how many were emailed and who was not reached', async () => {
    replies = [refuse(PEOPLE, { guest_list: 2, going: 1, tickets: 0, total: 3 }), { data: { ok: true, new_version: 4, notices: { queued: 2, guest_list_unreached: 1 } } }];
    await openMove();
    fireEvent.click(screen.getByTestId('p3-move-go'));
    await waitFor(() => screen.getByTestId('p3-move-anyway'));
    fireEvent.click(screen.getByTestId('p3-move-anyway'));
    await waitFor(() => screen.getByTestId('p3-toast'));
    expect(screen.getByTestId('p3-toast').textContent).toContain('Moved. We emailed 2 people about the new date. 1 guest-list person has no contact details, so please tell them yourself.');
  });

  it('a second date_has_people after the confirm shows the confirm again with the NEW counts, and sends nothing more', async () => {
    replies = [refuse(PEOPLE, { guest_list: 1, going: 0, tickets: 0, total: 1 }), refuse(PEOPLE, { guest_list: 1, going: 1, tickets: 0, total: 2 })];
    await openMove();
    fireEvent.click(screen.getByTestId('p3-move-go'));
    await waitFor(() => screen.getByTestId('p3-move-anyway'));
    fireEvent.click(screen.getByTestId('p3-move-anyway'));
    await waitFor(() => expect(text('p3-move-people-title')).toBe('2 people are on this date'));
    expect(sent).toHaveLength(2);
    expect(screen.queryByTestId('p3-toast')).toBeNull();
  });

  it('Choose another day: back to the day field, the typed day kept, nothing sent', async () => {
    replies = [refuse(PEOPLE, { guest_list: 1, going: 0, tickets: 0, total: 1 })];
    await openMove('2026-12-08');
    fireEvent.click(screen.getByTestId('p3-move-go'));
    await waitFor(() => screen.getByTestId('p3-move-another'));
    fireEvent.click(screen.getByTestId('p3-move-another'));
    expect((screen.getByTestId('p3-move-day') as HTMLInputElement).value).toBe('2026-12-08');
    expect(screen.queryByTestId('p3-move-people')).toBeNull();
    expect(sent).toHaveLength(1);
  });

  const others: Array<[string, unknown, string | null]> = [
    ['date_taken', refuse('invalid_transition: date_taken: this event already has a date on 2026-12-01'), 'This event already has a date on that day (a cancelled one counts too). Pick another day.'],
    ['cancelled', refuse('invalid_transition: occurrence_cancelled: this date is cancelled'), null],
    ['festival', refuse('invalid_transition: festival_extra_date: a festival holds one date'), 'A festival holds one date. Ask the Bachata Calendar team to change its days.'],
    ['network error', new Error('Failed to fetch'), null],
  ];
  it.each(others)('%s never reaches the confirm step and keeps its own copy', async (_n, reply, copy) => {
    replies = [reply];
    await openMove();
    fireEvent.click(screen.getByTestId('p3-move-go'));
    await waitFor(() => screen.getByTestId('p3-sheet-error'));
    expect(screen.queryByTestId('p3-move-people')).toBeNull();
    expect(sent).toHaveLength(1);
    if (copy) expect(text('p3-sheet-error')).toBe(copy);
    expect(text('p3-sheet-error')).not.toMatch(/date_has_people/);
  });
});
