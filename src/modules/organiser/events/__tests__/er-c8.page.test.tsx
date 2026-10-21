// @vitest-environment jsdom
// ER-C8: the rebuilt event page, rendered. The server is faked (ER-INTERFACE: server not landed).
import { createElement, type ReactNode } from 'react';
import { MemoryRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { parseEventWorkspace } from '../eventModel';
import { TODAY, rawWorkspace } from './fixtures';

const h = vi.hoisted(() => ({
  send: vi.fn(),
  error: null as string | null,
  done: vi.fn(),
  role: 'owner' as 'owner' | 'manager' | null,
}));

vi.mock('@/modules/organiser/flows/add/useFlow', () => ({
  useFlowSend: () => ({ send: h.send, run: async (w: () => Promise<void>) => w(), busy: false, conflict: false, error: h.error }),
}));
vi.mock('@/modules/organiser/flows/doneState', () => ({ goDone: (...a: unknown[]) => h.done(...a) }));
vi.mock('@/modules/organiser/shared/publicVenues', async (orig) => ({
  ...(await orig<typeof import('@/modules/organiser/shared/publicVenues')>()),
  useVenueOptions: () => ({ data: [{ id: 'v1', name: 'Studio One', neighbourhood: 'Soho', city_name: 'London', address: null, postcode: null }], isError: false, isFetching: false, refetch: vi.fn() }),
}));
vi.mock('../programmeSeriesApi', () => ({ useSeriesRole: () => ({ role: h.role, loading: false, myPages: [] }) }));
vi.mock('../EventList', () => ({ EventList: () => null }));
vi.mock('@/modules/organiser/venue', () => ({ VenuePicker: () => null }));
vi.mock('../../dates/peoplePicker', () => ({ searchPickerRows: vi.fn(async () => []) }));

import { EventPage } from '../EventPage';

const item = (id: string, type: string, title: string, start: string, end: string) => ({ item: { id, type, title, start_time: start, end_time: end, level_keys: [] }, people: [] });
const PROGRAM = [{ day: { id: 'd1', day_index: 0 }, sections: [{ section: { id: 's1', kind: 'party' }, items: [item('i1', 'party', 'Party', '21:00', '23:30')] }] }];
const dates = (n: number) => Array.from({ length: n }, (_, i) => ({ id: `o${i}`, occurrence_date: `2026-11-${String(i + 1).padStart(2, '0')}`, lifecycle_status: 'scheduled', version: 1 }));

function ws(over: Record<string, unknown> = {}, occurrences: unknown[] = dates(3), program: unknown = PROGRAM) {
  const raw = rawWorkspace({ default_ticket_url: 'https://t.example/x', ...over }, occurrences);
  (raw.series as { program: unknown }).program = program;
  return parseEventWorkspace(raw);
}

function mount(w: ReturnType<typeof ws>) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const wrap = ({ children }: { children?: ReactNode }) => createElement(QueryClientProvider, { client }, createElement(MemoryRouter, null, children));
  return render(createElement(EventPage, { ws: w, today: TODAY }), { wrapper: wrap });
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
});
afterEach(cleanup);

describe('every status x format: what the page offers', () => {
  it.each([
    ['live', 'recurring', true], ['live', 'one_off', true], ['live', 'course', true], ['paused', 'recurring', true], ['draft', 'one_off', true],
    ['ended', 'recurring', false], ['archived', 'one_off', false],
  ] as const)('%s %s: editable=%s', (status, format, editable) => {
    mount(ws({ lifecycle_status: status, format }));
    expect(!!testId('org-event-page')).toBe(true);
    expect(!!testId('org-edit-bar')).toBe(editable);
    expect(screen.getByTestId('org-event-title').tagName).toBe(editable ? 'BUTTON' : 'H2');
    expect(!!testId('org-session-add')).toBe(editable);
    expect(!!testId('org-date-add')).toBe(editable);
    expect(!!testId('org-flyer-row') && testId('org-flyer-row')!.tagName === 'A').toBe(editable);
    expect(!!testId('org-dock')).toBe(status === 'draft');
  });

  it('an ended event says so and offers nothing to change', () => {
    mount(ws({ lifecycle_status: 'ended' }));
    expect(screen.getByTestId('org-event-ended-line').textContent).toBe('Ended events cannot be changed.');
    expect(testId('org-event-actions')).toBeNull();
  });

  it('the Edit bar is phone only and orange (kept as the prototype)', () => {
    mount(ws());
    const bar = screen.getByTestId('org-edit-bar');
    expect(bar.className).toContain('md:hidden');
    expect(within(bar).getByText('Edit').className).toContain('bg-[var(--gold)]');
  });

  it('always has + Add a date on an open event, even a one-off with a date', () => {
    mount(ws({ format: 'one_off' }, dates(1)));
    expect(screen.getByTestId('org-date-add').textContent).toContain('Add a date');
  });

  it('no time input anywhere on the page (rule 1)', () => {
    const { container } = mount(ws());
    expect(container.querySelector('input[type="time"]')).toBeNull();
    expect(screen.queryByText(/^Time$/)).toBeNull();
  });
});

describe('edit, then ONE Update', () => {
  it('untouched: no dock, nothing sent', () => {
    mount(ws());
    expect(testId('org-update')).toBeNull();
    expect(h.send).not.toHaveBeenCalled();
  });

  it('a live event: Update live event, the scope count under it, one command, then Done', async () => {
    mount(ws({}, [...dates(14).map((d, i) => (i < 2 ? { ...d, session_overrides_count: 1 } : d))]));
    await rename('Friday Social');
    expect(screen.getByTestId('org-update').textContent).toBe('Update live event');
    expect(screen.getByTestId('org-update-scope').textContent).toBe('Updates 12 coming dates. 2 dates with their own changes keep them.');
    fireEvent.click(screen.getByTestId('org-update'));
    await waitFor(() => expect(h.done).toHaveBeenCalled());
    expect(h.send).toHaveBeenCalledTimes(1);
    expect(h.send.mock.calls[0][1]).toBe(3);
    expect(h.send.mock.calls[0][2]).toEqual({ kind: 'series.upsert', payload: { name: 'Friday Social' } });
  });

  it('a paused event says Save changes and no scope line', async () => {
    mount(ws({ lifecycle_status: 'paused' }));
    await rename('Friday Social');
    expect(screen.getByTestId('org-update').textContent).toBe('Save changes');
    expect(testId('org-update-scope')).toBeNull();
  });

  it('Discard changes puts everything back', async () => {
    mount(ws());
    await rename('Friday Social');
    fireEvent.click(screen.getByTestId('org-discard'));
    expect(testId('org-update')).toBeNull();
    expect(screen.getByTestId('org-event-title').textContent).toContain('Friday Party');
  });

  it('the name and a way to pay ride ONE upsert (payment_methods), against the loaded version', async () => {
    mount(ws({ default_ticket_url: null }));
    await rename('Friday Social');
    fireEvent.click(screen.getByTestId('org-detail-pay'));
    fireEvent.click(await screen.findByTestId('org-pay-door'));
    fireEvent.click(screen.getByTestId('org-pay-done'));
    await waitFor(() => expect(testId('org-pay-door')).toBeNull());
    fireEvent.click(screen.getByTestId('org-update'));
    await waitFor(() => expect(h.done).toHaveBeenCalled());
    expect(h.send.mock.calls[0][2]).toEqual({ kind: 'series.upsert', payload: { name: 'Friday Social', payment_methods: 'door' } });
  });

  it('a refused update keeps the changes and offers Try again, which sends the same command', async () => {
    h.send.mockResolvedValue(null);
    h.error = 'Could not reach the server';
    mount(ws());
    await rename('Friday Social');
    expect(screen.getByTestId('org-update-failed').textContent).toContain('Your changes are still here.');
    fireEvent.click(screen.getByTestId('org-update-retry'));
    await waitFor(() => expect(h.send).toHaveBeenCalledTimes(1));
    expect(screen.getByTestId('org-update')).toBeTruthy();
    expect(h.done).not.toHaveBeenCalled();
  });

  it('leaving with pending changes asks first; with none it just goes', async () => {
    mount(ws());
    fireEvent.click(screen.getByTestId('org-event-back'));
    expect(testId('org-leave-update')).toBeNull();
    await rename('Friday Social');
    fireEvent.click(screen.getByTestId('org-event-back'));
    expect(await screen.findByText('Update before you leave?')).toBeTruthy();
    expect(screen.getByText('Your changes are not live yet.')).toBeTruthy();
    expect(screen.getByTestId('org-leave-update').textContent).toBe('Update live event');
  });
});

describe('a draft', () => {
  const ready = { lifecycle_status: 'draft', default_cover_image_url: 'https://cdn.example/f.webp' };

  it('shows the checklist and Publish stays off with the first missing thing as its reason', () => {
    mount(ws({ lifecycle_status: 'draft', default_venue_id: null, default_ticket_url: null }, []));
    expect(screen.getByTestId('org-checklist')).toBeTruthy();
    expect((screen.getByTestId('org-publish') as HTMLButtonElement).disabled).toBe(true);
    expect(screen.getByTestId('org-publish-reason').textContent).toBe('Pick a venue');
  });

  it('a ready draft publishes with ONE set_lifecycle live', async () => {
    mount(ws(ready));
    const btn = screen.getByTestId('org-publish') as HTMLButtonElement;
    expect(btn.disabled).toBe(false);
    fireEvent.click(btn);
    await waitFor(() => expect(h.done).toHaveBeenCalled());
    expect(h.send.mock.calls[0][2]).toEqual({ kind: 'series.set_lifecycle', payload: { to: 'live' } });
  });

  it('only a draft can be deleted (Delete draft asks first, then archives)', async () => {
    mount(ws(ready));
    fireEvent.click(screen.getByTestId('org-action-delete'));
    fireEvent.click(await screen.findByTestId('org-delete-confirm'));
    await waitFor(() => expect(h.done).toHaveBeenCalled());
    expect(h.send.mock.calls[0][2]).toEqual({ kind: 'series.set_lifecycle', payload: { to: 'archived' } });
  });

  it.each(['live', 'paused', 'ended'])('%s has no Delete draft', (status) => {
    mount(ws({ lifecycle_status: status }));
    expect(testId('org-action-delete')).toBeNull();
  });
});

describe('live events: payment nudge and Stop repeating', () => {
  it('a live event with no way to pay shows Add how to pay; one with a ticket link does not', () => {
    mount(ws({ default_ticket_url: null }));
    expect(screen.getByTestId('org-pay-nudge-add').textContent).toContain('Add how to pay');
    cleanup();
    mount(ws());
    expect(testId('org-pay-nudge')).toBeNull();
  });

  it('Stop repeating = pick the last night: off until one is picked, then keeps every date up to it', async () => {
    mount(ws({}, dates(5)));
    fireEvent.click(screen.getByTestId('org-action-stop'));
    const confirm = (await screen.findByTestId('org-stop-confirm')) as HTMLButtonElement;
    expect(confirm.disabled).toBe(true);
    expect(screen.getByTestId('org-stop-reason').textContent).toBe('Pick the last night');
    fireEvent.click(screen.getAllByTestId('org-stop-night')[2]);
    expect(confirm.disabled).toBe(false);
    fireEvent.click(confirm);
    await waitFor(() => expect(h.done).toHaveBeenCalled());
    expect(h.send.mock.calls[0][2]).toEqual({ kind: 'series.stop_repeating', payload: { keep_occurrence_ids: ['o0', 'o1', 'o2'] } });
  });

  it('a co-organiser sees Pause only: no End, Stop repeating or Delete', () => {
    h.role = null;
    mount(ws());
    expect(screen.getByTestId('org-action-pause')).toBeTruthy();
    for (const a of ['end', 'stop', 'delete']) expect(testId(`org-action-${a}`)).toBeNull();
  });

  it('See it live is a link only on a live event', () => {
    mount(ws());
    expect(screen.getByTestId('org-event-seelive').getAttribute('href')).toMatch(/\//);
    cleanup();
    mount(ws({ lifecycle_status: 'paused' }));
    expect(testId('org-event-seelive')).toBeNull();
  });
});

describe('sessions on the page', () => {
  it('lists the stored sessions with their times and opens the C4 sheet from + Add a session', async () => {
    mount(ws());
    expect(screen.getByTestId('org-session').textContent).toContain('21:00 to 23:30');
    fireEvent.click(screen.getByTestId('org-session-add'));
    expect(await screen.findByTestId('sessions-list')).toBeTruthy();
  });
});
