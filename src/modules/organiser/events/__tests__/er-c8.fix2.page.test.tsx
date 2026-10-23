// @vitest-environment jsdom
// ER-FIX2-S5: the rebuilt event page after the audit, rendered (EP-1..EP-10, the per-event switch).
// The server is faked; every test here ran RED on the unfixed page first (handover ER-FIX2-S5).
import { createElement, type ReactNode } from 'react';
import { MemoryRouter, Route, RouterProvider, Routes, createMemoryRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { parseEventWorkspace } from '../eventModel';
import { ORG_PATHS } from '../../shell';
import { RebuildSwitchContext } from '../../shell/rebuildSwitch';
import { TODAY, rawWorkspace } from './fixtures';

const h = vi.hoisted(() => ({
  send: vi.fn(),
  error: null as string | null,
  done: vi.fn(),
  role: 'owner' as 'owner' | 'manager' | null,
  ws: { data: undefined as unknown, isError: false, isFetching: false, refetch: vi.fn(), error: null },
  check: undefined as unknown,
}));

vi.mock('@/modules/organiser/flows/add/useFlow', () => ({
  useFlowSend: () => ({ send: h.send, run: async (w: () => Promise<void>) => w(), busy: false, conflict: false, error: h.error }),
  useFlowHome: () => ({ data: undefined, isError: false, isFetching: false, refetch: vi.fn() }),
}));
vi.mock('@/modules/organiser/flows/doneState', () => ({ goDone: (...a: unknown[]) => h.done(...a) }));
vi.mock('@/modules/organiser/shared/publicVenues', async (orig) => ({
  ...(await orig<typeof import('@/modules/organiser/shared/publicVenues')>()),
  useVenueOptions: () => ({ data: [{ id: 'v1', name: 'Studio One', neighbourhood: 'Soho', city_name: 'London', address: null, postcode: null }], isError: false, isFetching: false, refetch: vi.fn() }),
}));
vi.mock('@/modules/organiser/shared/goLiveCheck', async (orig) => ({
  ...(await orig<object>()),
  useGoLiveCheck: () => ({ data: h.check, isError: false }),
}));
vi.mock('../programmeSeriesApi', () => ({ useSeriesRole: () => ({ role: h.role, loading: false, myPages: [] }) }));
vi.mock('../EventList', () => ({ EventList: () => null }));
vi.mock('@/modules/organiser/venue', () => ({ VenuePicker: () => null }));
vi.mock('../../dates/peoplePicker', () => ({ searchPickerRows: vi.fn(async () => []) }));
vi.mock('../../shared/useOrganiserSeries', async (orig) => ({ ...(await orig<object>()), useOrganiserSeries: () => ({ state: 'found' }) }));
vi.mock('../eventsApi', async (orig) => ({ ...(await orig<object>()), useEventWorkspace: () => h.ws }));
vi.mock('../ProfileLock', async (orig) => ({ ...(await orig<object>()), useEventLock: () => ({ locked: false, reason: null }) }));

import { EventPage } from '../EventPage';
import OneEvent from '../OneEvent';

const item = (id: string, start: string, end: string) => ({ item: { id, type: 'party', title: 'Party', start_time: start, end_time: end, level_keys: [] }, people: [] });
const PROGRAM = [{ day: { id: 'd1', day_index: 0 }, sections: [{ section: { id: 's1', kind: 'party' }, items: [item('i1', '21:00', '23:30')] }] }];
const dates = (n: number, from = 1) => Array.from({ length: n }, (_, i) => {
  const d = new Date(Date.UTC(2026, 10, from + i));
  return { id: `o${i}`, occurrence_date: d.toISOString().slice(0, 10), lifecycle_status: 'scheduled', version: 1 };
});

function ws(over: Record<string, unknown> = {}, occurrences: unknown[] = dates(3)) {
  const raw = rawWorkspace({ default_ticket_url: 'https://t.example/x', ...over }, occurrences);
  (raw.series as { program: unknown }).program = PROGRAM;
  return parseEventWorkspace(raw);
}

const client = () => new QueryClient({ defaultOptions: { queries: { retry: false } } });
function mount(w: ReturnType<typeof ws>) {
  const wrap = ({ children }: { children?: ReactNode }) => createElement(QueryClientProvider, { client: client() }, createElement(MemoryRouter, null, children));
  return render(createElement(EventPage, { ws: w, today: TODAY }), { wrapper: wrap });
}
/** The page under a data router, so leaving through any link can be seen (EP-5). */
function mountRouted(w: ReturnType<typeof ws>) {
  const router = createMemoryRouter([
    { path: ORG_PATHS.event('s1'), element: createElement(EventPage, { ws: w, today: TODAY }) },
    { path: '*', element: createElement('div', { 'data-testid': 'elsewhere' }) },
  ], { initialEntries: [ORG_PATHS.event('s1')] });
  render(createElement(QueryClientProvider, { client: client() }, createElement(RouterProvider, { router })));
  return router;
}
/** The whole route (OneEvent -> RebuiltEvent -> EventPage), switch context given. */
function mountRoute(raw: string | undefined, on = false) {
  const value = { raw, on, pending: false };
  const qc = client();
  // A fresh element each time, so a rerender really renders OneEvent again (a new read of the event).
  const tree = () => createElement(QueryClientProvider, { client: qc }, createElement(RebuildSwitchContext.Provider, { value },
    createElement(MemoryRouter, { initialEntries: ['/e/s1'] }, createElement(Routes, null, createElement(Route, { path: '/e/:seriesId', element: createElement(OneEvent) })))));
  const out = render(tree());
  return { ...out, again: () => out.rerender(tree()) };
}

const testId = (id: string) => screen.queryByTestId(id);
async function rename(name: string) {
  fireEvent.click(screen.getByTestId('org-event-title'));
  fireEvent.change(await screen.findByTestId('org-rename-input'), { target: { value: name } });
  fireEvent.click(screen.getByTestId('org-rename-done'));
  await waitFor(() => expect(testId('org-rename-input')).toBeNull());
}

beforeEach(() => {
  h.send.mockReset().mockResolvedValue({ ok: true, new_version: 9 });
  h.done.mockReset();
  h.error = null;
  h.role = 'owner';
  h.check = undefined;
  h.ws = { data: undefined, isError: false, isFetching: false, refetch: vi.fn(), error: null };
});
afterEach(cleanup);

describe('EP-1: owner and co-organiser get the same actions', () => {
  it.each([
    ['live', 'recurring', ['pause', 'stop']],
    ['paused', 'recurring', ['end', 'resume']],
    ['draft', 'recurring', ['delete']],
  ] as const)('%s %s', (status, format, expected) => {
    for (const role of ['owner', null] as const) {
      h.role = role;
      mount(ws({ lifecycle_status: status, format }));
      for (const a of ['pause', 'end', 'stop', 'delete', 'resume']) expect(!!testId(`org-action-${a}`), `${role} ${a}`).toBe((expected as readonly string[]).includes(a));
      cleanup();
    }
  });
});

describe('EP-2: a new read of the event keeps the person’s changes', () => {
  it('a refetch with a new version (another save) keeps the pending rename and its Update', async () => {
    h.ws.data = ws();
    const r = mountRoute('*');
    await rename('Renamed night');
    expect(screen.getByTestId('org-update')).toBeTruthy();
    h.ws.data = ws({ version: 4, default_description: 'Changed by the other organiser' });
    r.again();
    expect(screen.getByTestId('org-event-title').textContent).toContain('Renamed night');
    expect(screen.getByTestId('org-update')).toBeTruthy();
  });

  it('half a save went through: the error and Try again stay, the landed part stops being pending', async () => {
    h.ws.data = ws();
    const r = mountRoute('*');
    await rename('Saved name');
    fireEvent.click(screen.getByTestId('org-detail-pay'));
    fireEvent.click(await screen.findByTestId('org-pay-cash'));
    fireEvent.click(screen.getByTestId('org-pay-done'));
    // The name landed on the server, the rest failed.
    h.error = 'The update did not go through.';
    h.ws.data = ws({ version: 4, name: 'Saved name' });
    r.again();
    expect(screen.getByTestId('org-update-failed')).toBeTruthy();
    expect(screen.getByTestId('org-update-retry')).toBeTruthy();
    fireEvent.click(screen.getByTestId('org-update-retry'));
    await waitFor(() => expect(h.send).toHaveBeenCalled());
    const [, version, cmd] = h.send.mock.calls[0];
    expect(version).toBe(4);
    expect(h.send).toHaveBeenCalledTimes(1);
    expect(cmd.payload.payment_methods).toBe('ticket_link,cash');
  });
});

describe('EP-3: a ticket link as the way to pay needs the link', () => {
  it('picking Ticket link with no URL shows the Ticket link row and holds the save with the reason', async () => {
    mount(ws({ default_ticket_url: null, payment_methods: 'cash' }));
    fireEvent.click(screen.getByTestId('org-detail-pay'));
    fireEvent.click(await screen.findByTestId('org-pay-ticket_link'));
    fireEvent.click(screen.getByTestId('org-pay-done'));
    expect(screen.getByTestId('org-detail-ticket').textContent).toContain('Add the ticket link');
    expect((screen.getByTestId('org-update') as HTMLButtonElement).disabled).toBe(true);
    expect(screen.getByTestId('org-update-reason').textContent).toBe('Add the ticket link');
    fireEvent.click(screen.getByTestId('org-detail-ticket'));
    fireEvent.change(await screen.findByTestId('org-ticket-input'), { target: { value: 'https://tickets.example/night' } });
    expect((screen.getByTestId('org-update') as HTMLButtonElement).disabled).toBe(false);
  });

  it('no ticket link chosen: no Ticket link row', () => {
    mount(ws({ default_ticket_url: null, payment_methods: 'cash' }));
    expect(testId('org-detail-ticket')).toBeNull();
  });
});

describe('EP-4: the organisers are reachable from the page, for everyone on it', () => {
  it.each(['owner', null] as const)('role %s', (role) => {
    h.role = role;
    mount(ws());
    expect(screen.getByTestId('org-detail-organisers').getAttribute('href')).toBe(ORG_PATHS.eventOrganisers('s1'));
  });
});

describe('EP-5: leaving through ANY link with pending changes asks first', () => {
  it('a date row: the leave sheet opens and the page stays; Discard then goes', async () => {
    const router = mountRouted(ws());
    await rename('Not saved yet');
    fireEvent.click(screen.getAllByTestId('org-date')[0]);
    expect(await screen.findByTestId('org-leave-discard')).toBeTruthy();
    expect(router.state.location.pathname).toBe(ORG_PATHS.event('s1'));
    fireEvent.click(screen.getByTestId('org-leave-discard'));
    await waitFor(() => expect(router.state.location.pathname).toBe(ORG_PATHS.changeDate('s1', 'o0')));
  });

  it('Keep editing stays with the changes', async () => {
    const router = mountRouted(ws());
    await rename('Not saved yet');
    fireEvent.click(screen.getByTestId('org-date-add'));
    fireEvent.click(await screen.findByTestId('org-leave-keep'));
    expect(router.state.location.pathname).toBe(ORG_PATHS.event('s1'));
    expect(screen.getByTestId('org-update')).toBeTruthy();
  });

  it('nothing pending: a link just goes', async () => {
    const router = mountRouted(ws());
    fireEvent.click(screen.getAllByTestId('org-date')[0]);
    await waitFor(() => expect(router.state.location.pathname).toBe(ORG_PATHS.changeDate('s1', 'o0')));
  });
});

describe('EP-7: Pause, End, Resume are sheets on the page; a one-off says Cancel the event', () => {
  it('Pause asks, then sends set_lifecycle paused', async () => {
    mount(ws());
    fireEvent.click(screen.getByTestId('org-action-pause'));
    fireEvent.click(await screen.findByTestId('org-pause-confirm'));
    await waitFor(() => expect(h.done).toHaveBeenCalled());
    expect(h.send.mock.calls[0][2]).toEqual({ kind: 'series.set_lifecycle', payload: { to: 'paused' } });
  });

  it('End (a course) shows the v7 line and sends the end command', async () => {
    mount(ws({ format: 'course' }));
    fireEvent.click(screen.getByTestId('org-action-end'));
    expect((await screen.findByTestId('org-end-line')).textContent).toBe('Coming dates come off the calendar. Past dates stay.');
    fireEvent.click(screen.getByTestId('org-end-confirm'));
    await waitFor(() => expect(h.done).toHaveBeenCalled());
    expect(h.send.mock.calls[0][2]).toEqual({ kind: 'series.end_run', payload: {} });
  });

  it('a one-off: "Cancel the event" is shown, off, with Not available yet, and sends nothing', async () => {
    mount(ws({ format: 'one_off', recurrence_rule: null }, dates(1)));
    const end = screen.getByTestId('org-action-end');
    expect(end.textContent).toContain('Cancel the event');
    expect(end.getAttribute('aria-disabled')).toBe('true');
    expect(screen.getByTestId('org-action-end-reason').textContent).toBe('Not available yet');
    fireEvent.click(end);
    expect(testId('org-end-confirm')).toBeNull();
    expect(h.send).not.toHaveBeenCalled();
  });

  it('a pending rename is saved before Pause (never lost)', async () => {
    mount(ws());
    await rename('Renamed');
    fireEvent.click(screen.getByTestId('org-action-pause'));
    fireEvent.click(await screen.findByTestId('org-pause-confirm'));
    await waitFor(() => expect(h.send).toHaveBeenCalledTimes(2));
    expect(h.send.mock.calls[0][2].kind).toBe('series.upsert');
    expect(h.send.mock.calls[1][2]).toEqual({ kind: 'series.set_lifecycle', payload: { to: 'paused' } });
  });

  it('Resume sends set_lifecycle live', async () => {
    mount(ws({ lifecycle_status: 'paused' }));
    fireEvent.click(screen.getByTestId('org-action-resume'));
    await waitFor(() => expect(h.done).toHaveBeenCalled());
    expect(h.send.mock.calls[0][2]).toEqual({ kind: 'series.set_lifecycle', payload: { to: 'live' } });
  });
});

describe('EP-8: Stop repeating offers every coming date', () => {
  it('20 coming dates: 20 last nights to pick from', async () => {
    mount(ws({}, dates(20)));
    fireEvent.click(screen.getByTestId('org-action-stop'));
    await screen.findByTestId('org-stop-confirm');
    expect(screen.getAllByTestId('org-stop-night')).toHaveLength(20);
  });
});

describe('EP-9: the status tag is the shared lifecycle tag', () => {
  it.each([['live', 'Live'], ['paused', 'Paused'], ['draft', 'Draft'], ['rejected', 'Changes needed'], ['pending_review', 'In review'], ['ended', 'Ended']])('%s reads %s', (status, word) => {
    mount(ws({ lifecycle_status: status }));
    expect(screen.getByTestId('org-event-status').textContent).toBe(word);
  });
});

describe('EP-10: live with no coming date', () => {
  it('ONE Add a date, and End beside it (prototype v7)', () => {
    mount(ws({ format: 'course', recurrence_rule: null }, [{ id: 'p1', occurrence_date: '2026-09-01', lifecycle_status: 'scheduled', version: 1 }]));
    const card = screen.getByTestId('org-no-coming');
    expect(screen.getAllByText('Add a date')).toHaveLength(1);
    expect(within(card).getByTestId('org-no-coming-end').textContent).toContain('End event');
  });
});

describe('EP-13: the server go-live check can hold Publish', () => {
  it('client says ready, server says description: Publish off with Write a description', () => {
    h.check = { ready: false, eventMissing: [{ code: 'description', section: 'details' }], recommended: [], profileRuleApplies: false, profileMissing: [] };
    mount(ws({ lifecycle_status: 'draft', default_cover_image_url: 'https://cdn.example/f.webp', payment_methods: 'ticket_link' }));
    expect((screen.getByTestId('org-publish') as HTMLButtonElement).disabled).toBe(true);
    expect(screen.getByTestId('org-publish-reason').textContent).toBe('Write a description');
  });
});

describe('decision 2: the rebuilt page is chosen PER EVENT', () => {
  it.each([
    ['owner page on the allowlist', 'pA', ['pA', 'pB'], true],
    ['a co page only on the allowlist', 'pB', ['pA', 'pB'], false],
    ['*', '*', ['pA'], true],
    ['unset', undefined, ['pA'], false],
  ] as const)('%s', (_n, raw, ids, rebuilt) => {
    const w = ws();
    h.ws.data = { ...w, organiserIds: [...ids] };
    // The login-level answer is deliberately the opposite: only the event's own owner page decides.
    mountRoute(raw, !rebuilt);
    expect(!!testId('org-event-page')).toBe(rebuilt);
  });
});

// act is imported for React's warnings in rerender paths.
void act;
