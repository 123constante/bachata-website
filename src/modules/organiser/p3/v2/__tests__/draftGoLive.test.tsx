// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import type { EventWorkspace } from '../../../events/eventModel';

const check = vi.hoisted(() => ({ value: { data: undefined, isError: false } as { data?: unknown; isError: boolean } }));
vi.mock('../../../shared/goLiveCheck', async (orig) => ({ ...((await orig()) as object), useGoLiveCheck: () => check.value }));
vi.mock('../../../shared/runCommands', () => ({ useSendOnce: () => vi.fn(), useRunCommands: () => vi.fn(), eventWorkspaceQueryKey: (id: string) => ['ws', id] }));
vi.mock('../../screens/Toast', () => ({ useToast: () => ({ run: vi.fn(), show: vi.fn(), node: null }) }));
vi.mock('../../screens/StatusSheet', () => ({ StatusSheet: () => <div data-testid="status-sheet" /> }));
vi.mock('../../../shared/publicVenues', () => ({ useVenueOptions: () => ({ data: [], isPending: false }) }));
vi.mock('../../../events/programmeSeriesApi', () => ({ fetchOrganiserPages: async () => [], useSeriesRole: () => ({ role: 'owner', loading: false, myPages: [] }) }));
vi.mock('@/lib/londonDate', async (orig) => ({ ...((await orig()) as object), londonTodayKey: () => '2026-11-22' }));
import { EveryBody } from '../EveryBody';
import { OneOffBody } from '../OneOffBody';
import { firstGoLiveReason, COVER_REASON, DRAFT_NOTE } from '../GoLiveBar';

const ws = (life: string, format = 'recurring') => ({
  series: { id: 's1', version: 7, format, name: 'Thursdays', lifecycle_status: life, recurrence_rule: { mode: 'weekly', interval: 1, weekdays: [4], end: { kind: 'none' } }, default_venue_id: null, default_description: null, default_cover_image_url: null, default_ticket_url: null, default_local_start_time: null, default_duration: null, passes: null, default_start_date: '2026-01-01', created_at: null },
  gallery: [], musicStyles: [], organiserIds: [], endedOn: null, dates: [],
}) as unknown as EventWorkspace;
const wrap = (n: React.ReactNode) => render(<QueryClientProvider client={new QueryClient()}>{n}</QueryClientProvider>);
const every = (life: string) => wrap(<EveryBody ws={ws(life)} day="Thursday" saveNow={vi.fn(async () => ({ ok: true, error: null }))} />);
afterEach(() => { cleanup(); check.value = { data: undefined, isError: false }; });

describe('draft go-live', () => {
  it('cover reason says where to fix it, others use the shared label', () => {
    expect(firstGoLiveReason([{ code: 'cover', section: 'cover' }, { code: 'venue', section: 'venue' }])).toBe(COVER_REASON);
    expect(firstGoLiveReason([{ code: 'venue', section: 'venue' }])).toBe('Add a venue');
    expect(firstGoLiveReason([])).toBeNull();
  });
  it('draft: Draft pill, note, no status card, greyed button with first reason', () => {
    check.value = { data: { ready: false, eventMissing: [{ code: 'no_flyer', section: 'cover' }], recommended: [], profileRuleApplies: false, profileMissing: [] }, isError: false };
    every('draft');
    expect(screen.getByTestId('draft-pill').textContent).toBe('Draft');
    expect(screen.getByTestId('draft-note').textContent).toBe(DRAFT_NOTE);
    expect(screen.queryByTestId('every-end')).toBeNull();
    expect((screen.getByTestId('golive-btn') as HTMLButtonElement).disabled).toBe(true);
    expect(screen.getByTestId('golive-reason').textContent).toBe(COVER_REASON);
  });
  it('draft ready: button enabled and opens the status sheet', () => {
    check.value = { data: { ready: true, eventMissing: [], recommended: [], profileRuleApplies: false, profileMissing: [] }, isError: false };
    every('draft');
    expect(screen.queryByTestId('golive-reason')).toBeNull();
    fireEvent.click(screen.getByTestId('golive-btn'));
    expect(screen.getByTestId('status-sheet')).toBeTruthy();
  });
  it('one-off draft: no Pause/End, bar shown', () => {
    wrap(<OneOffBody ws={ws('draft', 'one_off')} saveNow={vi.fn(async () => ({ ok: true, error: null }))} />);
    expect(screen.queryByTestId('oneoff-end')).toBeNull();
    expect(screen.getByTestId('golive-bar')).toBeTruthy();
  });
  it.each(['live', 'paused', 'ended', 'pending', 'hidden', 'cancelled'])('%s renders as today (no draft pieces, status card kept)', (life) => {
    every(life);
    expect(screen.queryByTestId('draft-pill')).toBeNull();
    expect(screen.queryByTestId('draft-note')).toBeNull();
    expect(screen.queryByTestId('golive-bar')).toBeNull();
    expect(screen.getByTestId('every-end')).toBeTruthy();
  });
  it.each(['archived', 'rejected'])('%s renders no draft pieces and no status card (nothing on it works)', (life) => {
    every(life);
    expect(screen.queryByTestId('draft-pill')).toBeNull();
    expect(screen.queryByTestId('golive-bar')).toBeNull();
    expect(screen.queryByTestId('every-end')).toBeNull();
  });
  it('live keeps pill and Pause / End / Cancel', () => {
    every('live');
    expect(screen.getByText('Live')).toBeTruthy();
    ['end-pause', 'end-end', 'end-cancel'].forEach((id) => expect(screen.getByTestId(id)).toBeTruthy());
  });
});
