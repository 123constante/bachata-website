// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom';
import type { EventWorkspace } from '../../../events/eventModel';

const fl = vi.hoisted(() => ({ on: true }));
vi.mock('@/lib/featureFlags', () => ({ flags: { get organiserHomeClassesWeek() { return fl.on; } } }));
vi.mock('../../../shared/runCommands', () => ({ eventWorkspaceQueryKey: (id: string) => ['ws', id], useSendOnce: () => vi.fn() }));
vi.mock('../../../shared/selfServeApi', () => ({
  dateDetailQueryKey: (id: string) => ['d', id],
  occurrenceProgrammeQueryKey: (id: string) => ['p', id],
  runOccurrenceCommand: vi.fn(),
  saveOccurrenceProgramme: vi.fn(),
  fetchDateDetail: async () => ({ start: '19:30', end: '00:00', venueId: null, venueOverride: null, descriptionOverride: null, coverImageOverride: null, ticketUrlOverride: null, titleOverride: null, passesOverride: null, coverImageUrl: null, ticketUrl: null }),
  fetchCancellationReasons: async () => [],
}));
vi.mock('../../../shared/publicVenues', () => ({ useVenueOptions: () => ({ data: [] }) }));
vi.mock('@/modules/organiser/shared/publicCache', () => ({ invalidatePublicEventCaches: () => undefined }));
vi.mock('@/lib/londonDate', async (orig) => ({ ...((await orig()) as object), londonTodayKey: () => '2026-11-22' }));
import { EditorV2 } from '../EditorV2';
import { ToEditor } from '../../shell/P3Routes';

const date = (id: string, d: string) => ({ id, occurrence_date: d, version: 3, lifecycle_status: 'scheduled', has_override: false, override_keys: [], session_overrides_count: 0, added_sessions_count: 0 });
const ws = { series: { id: 's1', version: 7, format: 'recurring', name: 'Thursdays', lifecycle_status: 'live', default_venue_id: null, default_description: null, default_cover_image_url: null, default_ticket_url: null, passes: null }, program: [], dates: [date('o1', '2026-11-26'), date('o2', '2026-12-03')] } as unknown as EventWorkspace;
function Where() { const l = useLocation(); return <output data-testid="where">{l.search}</output>; }
const editor = (url: string) => render(
  <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
    <MemoryRouter initialEntries={[url]}><EditorV2 ws={ws} /><Where /></MemoryRouter>
  </QueryClientProvider>);
const redirect = (url: string) => render(
  <MemoryRouter initialEntries={[url]}>
    <Routes><Route path="events/:seriesId/night/:occurrenceId" element={<ToEditor />} /><Route path="*" element={<Where />} /></Routes>
  </MemoryRouter>);
beforeEach(() => { fl.on = true; window.scrollTo = vi.fn() as never; });
afterEach(cleanup);

describe('ToEditor open=when', () => {
  it('keeps open=when', () => {
    redirect('/events/s1/night/o1?open=when');
    expect(screen.getByTestId('where').textContent).toBe('?night=o1&open=when');
  });
  it('drops any other open value', () => {
    redirect('/events/s1/night/o1?open=other');
    expect(screen.getByTestId('where').textContent).toBe('?night=o1');
  });
  it('flag off drops it', () => {
    fl.on = false;
    redirect('/events/s1/night/o1?open=when');
    expect(screen.getByTestId('where').textContent).toBe('?night=o1');
  });
});

describe('EditorV2 open=when', () => {
  it('flag on: opens the When sheet for o1, removes open, no reopen after close', async () => {
    editor('/e?night=o1&open=when');
    await screen.findByTestId('v2-sheet');
    await waitFor(() => expect(screen.getByTestId('where').textContent).toBe('?night=o1'));
    fireEvent.click(screen.getByTestId('v2-sheet-close'));
    await waitFor(() => expect(screen.queryByTestId('v2-sheet')).toBeNull());
    await new Promise((r) => setTimeout(r, 20));
    expect(screen.queryByTestId('v2-sheet')).toBeNull();
  });
  it('flag off: no sheet, URL untouched', async () => {
    fl.on = false;
    editor('/e?night=o1&open=when');
    await screen.findByTestId('ev2-page');
    await new Promise((r) => setTimeout(r, 20));
    expect(screen.queryByTestId('v2-sheet')).toBeNull();
    expect(screen.getByTestId('where').textContent).toBe('?night=o1&open=when');
  });
  it('no night param: no sheet', async () => {
    editor('/e?open=when');
    await screen.findByTestId('ev2-page');
    await new Promise((r) => setTimeout(r, 20));
    expect(screen.queryByTestId('v2-sheet')).toBeNull();
  });
});
