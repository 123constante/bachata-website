// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter, useLocation } from 'react-router-dom';
import type { EventWorkspace } from '../../../events/eventModel';

const net = vi.hoisted(() => ({ series: vi.fn(), occ: vi.fn(), detail: vi.fn() }));
vi.mock('../../tickets/data', () => ({
  useSeriesTypes: () => ({ data: [{ id: 't1', occurrenceId: null }, { id: 't2', occurrenceId: 'o2' }] }),
  useSummary: () => ({ data: { ok: true, types: [{ id: 't1', ticketsSold: 4, grossPence: 5000 }, { id: 't2', ticketsSold: 3, grossPence: 1000 }] } }),
}));
vi.mock('../../../shared/runCommands', () => ({
  eventWorkspaceQueryKey: (id: string) => ['ws', id],
  useSendOnce: () => (c: unknown, v: number | null, k: string) => net.series(c, v, k),
}));
vi.mock('../../../shared/selfServeApi', () => ({
  dateDetailQueryKey: (id: string) => ['d', id],
  occurrenceProgrammeQueryKey: (id: string) => ['p', id],
  runOccurrenceCommand: (env: unknown) => net.occ(env),
  saveOccurrenceProgramme: vi.fn(),
  fetchDateDetail: (id: string) => net.detail(id),
  fetchCancellationReasons: async () => [],
}));
vi.mock('../../../shared/publicVenues', () => ({ useVenueOptions: () => ({ data: [{ id: 'v1', name: 'Club Uno', neighbourhood: 'Soho', city_name: 'London' }] }) }));
vi.mock('@/modules/organiser/shared/publicCache', () => ({ invalidatePublicEventCaches: () => undefined }));
vi.mock('@/lib/londonDate', async (orig) => ({ ...((await orig()) as object), londonTodayKey: () => '2026-11-22' }));
import { EditorV2 } from '../EditorV2';
import { inverseOf, type WriteStep } from '../editorModel';
import { undoPlan } from '../saveNow';

const date = (id: string, d: string) => ({ id, occurrence_date: d, version: 3, lifecycle_status: 'scheduled', has_override: false, override_keys: [], session_overrides_count: 0, added_sessions_count: 0 });
const detail = () => ({ start: '19:30', end: '00:00', venueId: 'v1', venueOverride: null, descriptionOverride: null, coverImageOverride: null, ticketUrlOverride: null, titleOverride: null, passesOverride: null, coverImageUrl: null, ticketUrl: null });
const ws = () => ({ series: { id: 's1', version: 7, format: 'one_off', name: 'Salsa Special', lifecycle_status: 'live', default_venue_id: 'v1', default_description: null, default_cover_image_url: null, default_ticket_url: null, default_local_start_time: '19:30', passes: null }, dates: [date('o1', '2026-12-05')], organiserIds: ['org1'], musicStyles: ['Bachata'] }) as unknown as EventWorkspace;
const step = (): WriteStep => ({ target: 'occurrence', id: 'o1', version: 3, part: 'x', order: 1, command: { kind: 'occurrence.move_date', payload: { to_date: '2026-12-20' } } }) as WriteStep;
beforeEach(() => { net.series.mockReset(); net.occ.mockReset().mockResolvedValue({ ok: true, new_version: 4 }); net.detail.mockReset().mockResolvedValue(detail()); window.scrollTo = vi.fn() as never; });
afterEach(cleanup);

describe('row 36.1 Save the date Undo', () => {
  it('inverseOf move_date puts the old date back', () => {
    expect(inverseOf(step(), { to_date: '2026-12-03' })?.command).toEqual({ kind: 'occurrence.move_date', payload: { to_date: '2026-12-03' } });
  });
  it('inverseOf move_date without an old date is null', () => {
    expect(inverseOf(step(), { other: 1 })).toBeNull();
  });
  it('undoPlan re-bases the occurrence version', () => {
    const plan = undoPlan([step()], [{ to_date: '2026-12-03' }]);
    expect(plan).toHaveLength(1);
    expect(plan![0]).toMatchObject({ id: 'o1', version: 4 });
  });
  it('round trip: save shows Undo, Undo moves back and says Undone', async () => {
    render(
      <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
        <MemoryRouter initialEntries={['/e']}><EditorV2 ws={ws()} /></MemoryRouter>
      </QueryClientProvider>);
    await screen.findByTestId('night-name');
    fireEvent.click(screen.getAllByRole('button').find((b) => /^(When|Date)/.test(b.textContent ?? ''))!);
    fireEvent.change(document.getElementById('w-date')!, { target: { value: '2026-12-20' } });
    fireEvent.click(screen.getByRole('button', { name: 'Save the date' }));
    await waitFor(() => expect(screen.getByTestId('v2-toast').textContent).toContain('Saved'));
    expect(net.occ.mock.calls[0][0]).toMatchObject({ command: { kind: 'occurrence.move_date', payload: { to_date: '2026-12-20' } } });
    fireEvent.click(screen.getByTestId('v2-toast-undo'));
    await waitFor(() => expect(screen.getByTestId('v2-toast').textContent).toContain('Undone'));
    expect(net.occ.mock.calls[1][0]).toMatchObject({ command: { kind: 'occurrence.move_date', payload: { to_date: '2026-12-05' } } });
  });
});
