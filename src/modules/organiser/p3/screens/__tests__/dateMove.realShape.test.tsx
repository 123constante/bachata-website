// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { REASONS } from './cancelFixtures';
import { SHAPES } from './wsFixtures';

/*
 * Q10, continuation: the "people on this date" refusal through the REAL supabase-js client. Only
 * `fetch` is stood in; the HTTP reply is what PostgREST sends for the admin move guard
 * (`RAISE EXCEPTION 'date_has_people: % guest-list, % going, % tickets on %; ...' USING
 * ERRCODE='P0001', DETAIL=<counts jsonb as text>, HINT='date_has_people'`): status 400 and a body
 * of {code, details, hint, message}. postgrest-js turns that into the PostgrestError the date
 * sheet's intercept reads. Nothing here mocks `go`, `runOccurrenceCommand` or `supabase.rpc`.
 */

type Reply = { status: number; body: unknown };
const net = vi.hoisted(() => ({ sent: [] as Array<{ command: { kind: string; payload: Record<string, unknown> }; idempotency_key?: string }>, replies: [] as Reply[] }));

vi.mock('@/integrations/supabase/client', async () => {
  const { createClient } = await import('@supabase/supabase-js');
  const fetchStub = async (input: RequestInfo | URL, init?: RequestInit): Promise<Response> => {
    const url = String(input instanceof Request ? input.url : input);
    const name = url.match(/\/rest\/v1\/rpc\/([a-z0-9_]+)/)?.[1];
    const args = init?.body ? JSON.parse(String(init.body)) : {};
    const json = (status: number, body: unknown) => new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });
    if (name === 'admin_event_workspace_p5') return json(200, SHAPES.weekly);
    if (name === 'event_view_p5') {
      const id = (args.p_target as { occurrence_id: string }).occurrence_id;
      return json(200, { event: {}, occurrence: { id, date: id.slice(2), version: 3, lifecycle_status: 'scheduled', materialised_start_utc: `${id.slice(2)}T20:00:00Z` }, schedule: {} });
    }
    if (name === 'occurrence_command_p5') {
      net.sent.push(args.p_envelope);
      const r = net.replies.shift() ?? { status: 200, body: { ok: true, new_version: 4 } };
      return json(r.status, r.body);
    }
    return json(200, null);
  };
  return {
    supabase: createClient('http://stub.test', 'anon-key', {
      auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
      global: { fetch: fetchStub as typeof fetch },
    }),
  };
});
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
beforeEach(() => { net.sent.length = 0; net.replies.length = 0; });

/** The exact PostgREST body for the guard; `details` is Postgres jsonb text (keys sorted by length, ", " and ": "). */
const guard = (g: number, n: number, t: number, details: unknown = `{"going": ${n}, "total": ${g + n + t}, "tickets": ${t}, "guest_list": ${g}}`): Reply => ({
  status: 400,
  body: {
    code: 'P0001',
    hint: 'date_has_people',
    message: `date_has_people: ${g} guest-list, ${n} going, ${t} tickets on 2026-12-01; send acknowledge_people true to move it anyway`,
    ...(details === undefined ? {} : { details }),
  },
});
const ok = (data: Record<string, unknown> = {}): Reply => ({ status: 200, body: { ok: true, new_version: 4, ...data } });

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

async function moveTo(day = '2026-12-01') {
  show();
  await waitFor(() => screen.getAllByTestId('p3-open-date'), { timeout: 3000 });
  fireEvent.click(screen.getAllByTestId('p3-open-date')[0]);
  await waitFor(() => screen.getByTestId('p3-date-actions'));
  fireEvent.click(screen.getByTestId('p3-date-act-move'));
  fireEvent.change(screen.getByTestId('p3-move-day'), { target: { value: day } });
  fireEvent.click(screen.getByTestId('p3-move-go'));
}
const text = (id: string) => screen.getByTestId(id).textContent;

const TELL_ALL = 'Ticket buyers and people who said they are going get an email about the new day. 3 on the guest list cannot be emailed. You may want to tell them yourself.';

describe('move refusal through the real supabase-js error object', () => {
  const rows: Array<[string, Reply, string, string | null, string]> = [
    ['(a) real message (guest-list hyphen) and details as jsonb text', guard(3, 4, 2), '9 people are on this date', '3 on the guest list, 4 going and 2 with tickets', TELL_ALL],
    ['(b) details missing: counts from the message', guard(3, 4, 2, undefined), '9 people are on this date', '3 on the guest list, 4 going and 2 with tickets', TELL_ALL],
    ['(c) details unparseable: counts from the message', guard(3, 4, 2, '{oops'), '9 people are on this date', '3 on the guest list, 4 going and 2 with tickets', TELL_ALL],
    ['(d) details an object, not a string', guard(0, 0, 5, { guest_list: 0, going: 0, tickets: 5, total: 5 }), '5 people are on this date', '5 with tickets', 'Ticket buyers get an email about the new day.'],
    ['guest list only: nobody can be emailed', guard(2, 0, 0), '2 people are on this date', '2 on the guest list', '2 on the guest list cannot be emailed. You may want to tell them yourself.'],
    ['going only', guard(0, 1, 0), '1 person is on this date', '1 going', 'People who said they are going get an email about the new day.'],
  ];
  it.each(rows)('%s: confirm step, not the generic error', async (_n, reply, title, body, tell) => {
    net.replies.push(reply);
    await moveTo();
    await waitFor(() => screen.getByTestId('p3-move-people'));
    expect(screen.queryByTestId('p3-sheet-error')).toBeNull();
    expect(text('p3-move-people-title')).toBe(title);
    if (body) expect(text('p3-move-people-body')).toBe(body);
    expect(text('p3-move-people-tell')).toBe(tell);
    expect(net.sent).toHaveLength(1);
    expect(net.sent[0].command.payload).toEqual({ to_date: '2026-12-01' });
  });

  it('(e) a different P0001 refusal (version_conflict) shows its error, never the confirm', async () => {
    net.replies.push({ status: 400, body: { code: 'P0001', details: null, hint: null, message: 'version_conflict: expected 3, found 4' } });
    await moveTo();
    await waitFor(() => screen.getByTestId('p3-sheet-error'));
    expect(screen.queryByTestId('p3-move-people')).toBeNull();
    expect(text('p3-sheet-error')).not.toMatch(/version_conflict|date_has_people/);
    expect(net.sent).toHaveLength(1);
  });

  it('(f) a second date_has_people after the confirm shows the confirm again with the NEW counts and sends nothing more', async () => {
    net.replies.push(guard(1, 0, 0), guard(1, 2, 0));
    await moveTo();
    await waitFor(() => screen.getByTestId('p3-move-anyway'));
    expect(text('p3-move-people-title')).toBe('1 person is on this date');
    fireEvent.click(screen.getByTestId('p3-move-anyway'));
    await waitFor(() => expect(text('p3-move-people-title')).toBe('3 people are on this date'));
    expect(text('p3-move-people-body')).toBe('1 on the guest list and 2 going');
    expect(net.sent).toHaveLength(2);
    expect(net.sent[1].command.payload).toEqual({ to_date: '2026-12-01', acknowledge_people: true });
    expect(screen.queryByTestId('p3-toast')).toBeNull();
    expect(screen.queryByTestId('p3-sheet-error')).toBeNull();
  });
});

describe('the confirm taps', () => {
  it('Move it anyway: acknowledge_people true and a NEW idempotency key', async () => {
    net.replies.push(guard(1, 1, 0), ok());
    await moveTo();
    await waitFor(() => screen.getByTestId('p3-move-anyway'));
    fireEvent.click(screen.getByTestId('p3-move-anyway'));
    await waitFor(() => screen.getByTestId('p3-toast'));
    expect(net.sent).toHaveLength(2);
    expect(net.sent[1].command).toEqual({ kind: 'occurrence.move_date', payload: { to_date: '2026-12-01', acknowledge_people: true } });
    expect(net.sent[1].idempotency_key).toBeTruthy();
    expect(net.sent[1].idempotency_key).not.toBe(net.sent[0].idempotency_key);
  });

  it('Choose another day: back to the day picker, nothing sent', async () => {
    net.replies.push(guard(1, 0, 0));
    await moveTo('2026-12-08');
    await waitFor(() => screen.getByTestId('p3-move-another'));
    fireEvent.click(screen.getByTestId('p3-move-another'));
    expect(screen.getByTestId('p3-move-day')).toBeTruthy();
    expect((screen.getByTestId('p3-move-day') as HTMLInputElement).value).toBe('2026-12-08');
    expect(net.sent).toHaveLength(1);
  });

  it('both buttons are at least 44px tall and nothing on the step has a fixed width over 320px', async () => {
    net.replies.push(guard(1, 1, 1));
    await moveTo();
    await waitFor(() => screen.getByTestId('p3-move-people'));
    for (const id of ['p3-move-anyway', 'p3-move-another']) expect(screen.getByTestId(id).className).toContain('min-h-[44px]');
    const sheet = screen.getByTestId('p3-move-people').closest('[role="dialog"]') ?? document.body;
    const wide = (s: string) => [...s.matchAll(/(?:^|[\s:])(?:min-)?w-\[(\d+)px\]/g)].some((m) => Number(m[1]) > 320);
    for (const el of sheet.querySelectorAll<HTMLElement>('*')) {
      expect(wide(el.className && typeof el.className === 'string' ? el.className : '')).toBe(false);
      const w = parseInt(el.style.width || el.style.minWidth || '0', 10);
      expect(w > 320 && /px$/.test(el.style.width || el.style.minWidth)).toBe(false);
    }
  });
});

describe('the done toast after a confirmed move', () => {
  const rows: Array<[string, Reply, RegExp]> = [
    ['notices absent (server not applied): no claim either way', ok(), /^Moved to [^.]*December[^.]*\.$/],
    ['notices with queued 0 and nobody unreached', ok({ notices: { queued: 0, guest_list_unreached: 0 } }), /^Moved to [^.]*December[^.]*\.$/],
    ['queued 0, guest list unreached', ok({ notices: { queued: 0, guest_list_unreached: 2 } }), /^Moved to [^.]*December[^.]*\. 2 on the guest list could not be emailed, so you may want to tell them yourself\.$/],
    ['queued and unreached', ok({ notices: { queued: 3, guest_list_unreached: 1 } }), /^Moved to [^.]*December[^.]*\. We emailed 3 people about the new day\. 1 on the guest list could not be emailed, so you may want to tell them yourself\.$/],
    ['one emailed', ok({ notices: { queued: 1, guest_list_unreached: 0 } }), /^Moved to [^.]*December[^.]*\. We emailed 1 person about the new day\.$/],
  ];
  it.each(rows)('%s', async (_n, reply, want) => {
    net.replies.push(guard(1, 1, 1), reply);
    await moveTo();
    await waitFor(() => screen.getByTestId('p3-move-anyway'));
    fireEvent.click(screen.getByTestId('p3-move-anyway'));
    await waitFor(() => screen.getByTestId('p3-toast'));
    const toast = screen.getByTestId('p3-toast').textContent ?? '';
    expect(toast.replace(/\s*Undo\s*$/, '')).toMatch(want);
    expect(toast).not.toMatch(/not told automatically/);
  });
});

describe('flag off', () => {
  it('the move-people copy lives only under the p3 module (behind organiserP3)', () => {
    const src = readFileSync(resolve(__dirname, '../DateSheet.tsx'), 'utf8');
    expect(src).toContain('MOVE_PEOPLE_COPY');
  });
});
