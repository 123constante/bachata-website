// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter } from 'react-router-dom';
import type { EventWorkspace } from '../../../events/eventModel';
import type { WorkspaceDate } from '../../../shared/seriesModel';

const net = vi.hoisted(() => ({ series: vi.fn(), occ: vi.fn(), detail: vi.fn() }));
vi.mock('../../../shared/runCommands', () => ({
  eventWorkspaceQueryKey: (id: string) => ['ws', id],
  useSendOnce: () => (c: unknown, v: number | null, k: string) => net.series(c, v, k),
}));
vi.mock('../../../shared/selfServeApi', async (orig) => ({
  ...((await orig()) as object),
  dateDetailQueryKey: (id: string) => ['d', id],
  occurrenceProgrammeQueryKey: (id: string) => ['p', id],
  runOccurrenceCommand: (env: unknown) => net.occ(env),
  saveOccurrenceProgramme: vi.fn(),
  fetchDateDetail: (id: string) => net.detail(id),
  fetchCancellationReasons: async () => [],
}));
vi.mock('../../../shared/publicVenues', () => ({ useVenueOptions: () => ({ data: [], isPending: false }) }));
vi.mock('../../../events/programmeSeriesApi', () => ({ fetchOrganiserPages: async () => [], useSeriesRole: () => ({ role: 'owner', loading: false, myPages: [] }) }));
vi.mock('@/modules/organiser/shared/publicCache', () => ({ invalidatePublicEventCaches: () => undefined }));
vi.mock('@/lib/londonDate', async (orig) => ({ ...((await orig()) as object), londonTodayKey: () => '2026-11-22' }));
const PROG = vi.hoisted(() => ({ n: 2 }));
vi.mock('../../data/sessions', async (orig) => ({
  ...(await orig<typeof import('../../data/sessions')>()),
  useDateProgramme: (id: string | null) => ({ data: id ? { occurrenceId: 'o1', seriesId: 's1', occurrenceDate: '2026-11-26', version: 5, editable: true, notEditableReason: null,
    sessions: Array.from({ length: PROG.n }, (_, i) => ({ id: `i${i}`, type: 'class', title: `Salsa ${i}`, start_time: `19:${30 + i}:00`, end_time: '20:45:00', level_keys: [], sort_order: i })),
    sessionPeople: [] } : undefined, isPending: false }),
}));
import { EditorV2 } from '../EditorV2';
import { WhenSheet } from '../WhenSheet';
import { undoPlan } from '../saveNow';

const PASS = [{ id: '11111111-1111-4111-8111-111111111111', name: 'Door', price: 10 }];
const night = { id: 'o1', occurrence_date: '2026-11-26', version: 3, lifecycle_status: 'scheduled', has_override: false, override_keys: [], session_overrides_count: 0, added_sessions_count: 0, materialised_start_utc: null } as unknown as WorkspaceDate;
const detail = () => ({ start: '19:30', end: '00:00', venueId: null, venueOverride: null, descriptionOverride: null, coverImageOverride: null, ticketUrlOverride: null, titleOverride: null, passesOverride: null, coverImageUrl: null, ticketUrl: null });
const ws = (series: Record<string, unknown>) => ({ series: { id: 's1', version: 7, format: 'recurring', name: 'Thursdays', lifecycle_status: 'live', default_venue_id: null, default_description: null, default_cover_image_url: null, default_ticket_url: null, default_local_start_time: '19:30', passes: null, ...series }, dates: [night] }) as unknown as EventWorkspace;
const at = (w: EventWorkspace) => render(
  <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
    <MemoryRouter initialEntries={['/e?night=o1']}><EditorV2 ws={w} /></MemoryRouter>
  </QueryClientProvider>);
beforeEach(() => { net.series.mockReset(); net.occ.mockReset().mockResolvedValue({ ok: true, new_version: 4 }); net.detail.mockReset().mockResolvedValue(detail()); window.scrollTo = vi.fn() as never; PROG.n = 2; });
afterEach(cleanup);

describe('row 83.1 End with no date', () => {
  it('series.end_run has no safe inverse from the before snapshot: no Undo is claimed (UNBUILT, see handover)', () => {
    const step = { target: 'series' as const, id: 's1', version: 7, part: 'x', order: 1, command: { kind: 'series.end_run', payload: {} } };
    expect(undoPlan([step as never], [{ to: 'live' }])).toBeNull();
  });
});

describe('X-09 night Price fact', () => {
  it('a pay-at-the-door night says Pay at the door', async () => {
    at(ws({ passes: PASS })); fireEvent.click(screen.getByTestId('ev2-tab-night'));
    await waitFor(() => expect(screen.getByTestId('fact-price').textContent).toContain('Pay at the door'));
    expect(within(screen.getByTestId('fact-price')).getByText('£10')).toBeTruthy();
  });
  it('a night with a ticket link is unchanged', async () => {
    at(ws({ passes: PASS, default_ticket_url: 'https://x.co' })); fireEvent.click(screen.getByTestId('ev2-tab-night'));
    await waitFor(() => expect(within(screen.getByTestId('fact-price')).getByText('Tickets on another site')).toBeTruthy());
    expect(screen.queryByText('Pay at the door')).toBeNull();
  });
});

describe('row 48 Remove this one', () => {
  const mount = () => {
    const onSave = vi.fn(async () => ({ ok: true, error: null }));
    const onClose = vi.fn();
    render(<QueryClientProvider client={new QueryClient()}><WhenSheet date={night} oneOff={false} today="2026-11-22" onSave={onSave} onClose={onClose} /></QueryClientProvider>);
    return { onSave, onClose };
  };
  const remove = () => { fireEvent.click(screen.getAllByTestId('when-row')[0]); fireEvent.click(screen.getByRole('button', { name: /remove/i })); };
  it('saves (toast + Undo come from onSave) and closes the When sheet back to the tab', async () => {
    const { onSave, onClose } = mount(); remove();
    await waitFor(() => expect(onSave).toHaveBeenCalledTimes(1));
    const [steps, before] = onSave.mock.calls[0] as unknown as [Parameters<typeof undoPlan>[0], Parameters<typeof undoPlan>[1]];
    expect(undoPlan(steps, before)).not.toBeNull();
    await waitFor(() => expect(onClose).toHaveBeenCalled());
  });
  it('stays open when the save fails', async () => {
    const { onSave, onClose } = mount();
    onSave.mockResolvedValueOnce({ ok: false, error: 'nope' });
    remove();
    await waitFor(() => expect(onSave).toHaveBeenCalled());
    expect(onClose).not.toHaveBeenCalled();
  });
  it('is disabled when it is the only session', () => {
    PROG.n = 1; mount();
    fireEvent.click(screen.getAllByTestId('when-row')[0]);
    expect((screen.getByRole('button', { name: /remove/i }) as HTMLButtonElement).disabled).toBe(true);
  });
});
