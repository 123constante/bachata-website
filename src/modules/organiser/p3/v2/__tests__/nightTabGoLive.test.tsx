// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import type { EventWorkspace } from '../../../events/eventModel';

const check = vi.hoisted(() => ({ value: { data: undefined, isError: false } as { data?: unknown; isError: boolean } }));
vi.mock('../../../shared/goLiveCheck', async (orig) => ({ ...((await orig()) as object), useGoLiveCheck: () => check.value }));
vi.mock('../../../shared/runCommands', () => ({ eventWorkspaceQueryKey: (id: string) => ['ws', id], useSendOnce: () => vi.fn(), useRunCommands: () => vi.fn() }));
vi.mock('../../screens/Toast', () => ({ useToast: () => ({ run: vi.fn(), show: vi.fn(), node: null }) }));
vi.mock('../../screens/StatusSheet', () => ({ StatusSheet: () => <div data-testid="status-sheet" /> }));
vi.mock('../../../shared/selfServeApi', () => ({
  dateDetailQueryKey: (id: string) => ['d', id], occurrenceProgrammeQueryKey: (id: string) => ['p', id],
  runOccurrenceCommand: vi.fn(), saveOccurrenceProgramme: vi.fn(), fetchDateDetail: () => new Promise(() => undefined),
}));
vi.mock('../../../shared/publicVenues', () => ({ useVenueOptions: () => ({ data: [], isPending: false }) }));
vi.mock('../../../events/programmeSeriesApi', () => ({ fetchOrganiserPages: async () => [], useSeriesRole: () => ({ role: 'owner', loading: false, myPages: [] }) }));
vi.mock('@/modules/organiser/shared/publicCache', () => ({ invalidatePublicEventCaches: () => undefined }));
vi.mock('@/lib/londonDate', async (orig) => ({ ...((await orig()) as object), londonTodayKey: () => '2026-11-22' }));
import { EditorV2 } from '../EditorV2';
import { COVER_REASON } from '../GoLiveBar';

const date = (id: string, d: string) => ({ id, occurrence_date: d, lifecycle_status: 'scheduled', has_override: false, override_keys: [], session_overrides_count: 0, added_sessions_count: 0 });
const ws = (life: string, format = 'recurring') => ({
  series: { id: 's1', version: 7, format, name: 'Thursdays', lifecycle_status: life, recurrence_rule: { mode: 'weekly', interval: 1, weekdays: [4], end: { kind: 'none' } }, default_venue_id: null, default_description: null, default_cover_image_url: null, default_ticket_url: null, default_local_start_time: null, default_duration: null, passes: null, default_start_date: '2026-01-01', created_at: null },
  gallery: [], musicStyles: [], organiserIds: [], endedOn: null, dates: [date('o0', '2026-11-26'), date('o1', '2026-12-03')],
}) as unknown as EventWorkspace;
const at = (w: EventWorkspace, url: string) => render(<QueryClientProvider client={new QueryClient()}><MemoryRouter initialEntries={[url]}><EditorV2 ws={w} /></MemoryRouter></QueryClientProvider>);
afterEach(() => { cleanup(); check.value = { data: undefined, isError: false }; });

describe('This night tab go-live bar', () => {
  it('draft weekly, night tab: one bar, greyed with first reason', () => {
    check.value = { data: { ready: false, eventMissing: [{ code: 'no_flyer', section: 'cover' }], recommended: [], profileRuleApplies: false, profileMissing: [] }, isError: false };
    at(ws('draft'), '/e');
    expect(screen.getAllByTestId('golive-bar')).toHaveLength(1);
    expect((screen.getByTestId('golive-btn') as HTMLButtonElement).disabled).toBe(true);
    expect(screen.getByTestId('golive-reason').textContent).toBe(COVER_REASON);
  });
  it('draft weekly, night tab, ready: opens the status sheet', () => {
    check.value = { data: { ready: true, eventMissing: [], recommended: [], profileRuleApplies: false, profileMissing: [] }, isError: false };
    at(ws('draft'), '/e');
    fireEvent.click(screen.getByTestId('golive-btn'));
    expect(screen.getByTestId('status-sheet')).toBeTruthy();
  });
  it('draft weekly, Every tab: still exactly one bar', () => {
    at(ws('draft'), '/e?tab=every');
    expect(screen.getAllByTestId('golive-bar')).toHaveLength(1);
  });
  it('draft one-off: still exactly one bar', () => {
    at(ws('draft', 'one_off'), '/e');
    expect(screen.getAllByTestId('golive-bar')).toHaveLength(1);
  });
  it.each(['live', 'paused', 'ended', 'cancelled'])('%s weekly night tab: no bar', (life) => {
    at(ws(life), '/e');
    expect(screen.queryByTestId('golive-bar')).toBeNull();
  });
});
