// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter, useLocation } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import type { EventWorkspace } from '../../../events/eventModel';

const check = vi.hoisted(() => ({ value: { data: undefined, isError: false } as { data?: unknown; isError: boolean } }));
const nav = vi.hoisted(() => vi.fn());
vi.mock('react-router-dom', async (orig) => ({ ...((await orig()) as object), useNavigate: () => nav }));
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
import { EveryBody } from '../EveryBody';
import { OneOffBody } from '../OneOffBody';
import { EditorV2 } from '../EditorV2';
import { goLiveFixHref } from '../../../shared/goLiveCheck';
import { goLiveFixParam } from '../GoLiveBar';

const date = (id: string, d: string) => ({ id, occurrence_date: d, lifecycle_status: 'scheduled', has_override: false, override_keys: [], session_overrides_count: 0, added_sessions_count: 0 });
const ws = (format = 'recurring') => ({
  series: { id: 's1', version: 7, format, name: 'Thursdays', lifecycle_status: 'draft', recurrence_rule: { mode: 'weekly', interval: 1, weekdays: [4], end: { kind: 'none' } }, default_venue_id: null, default_description: null, default_cover_image_url: null, default_ticket_url: null, default_local_start_time: null, default_duration: null, passes: null, default_start_date: '2026-01-01', created_at: null },
  gallery: [], musicStyles: [], organiserIds: [], endedOn: null, dates: [date('o0', '2026-11-26'), date('o1', '2026-12-03')],
}) as unknown as EventWorkspace;
const first = (code: string, section: string) => {
  check.value = { data: { ready: false, eventMissing: [{ code, section }], recommended: [], profileRuleApplies: false, profileMissing: [] }, isError: false };
};
const save = vi.fn(async () => ({ ok: true, error: null }));
function Probe() { const l = useLocation(); return <output data-testid="loc">{l.pathname + l.search}</output>; }
const wrap = (n: React.ReactNode, url = '/e') => render(<QueryClientProvider client={new QueryClient()}><MemoryRouter initialEntries={[url]}>{n}<Probe /></MemoryRouter></QueryClientProvider>);
const every = (url = '/e?tab=every', extra: { onOpenTickets?: () => void; onOpenDates?: () => void } = {}) => wrap(<EveryBody ws={ws()} day="Thursday" saveNow={save} {...extra} />, url);
const tap = () => fireEvent.click(screen.getByTestId('golive-fix'));
afterEach(() => { cleanup(); vi.unstubAllEnvs(); vi.clearAllMocks(); check.value = { data: undefined, isError: false }; });

describe('EveryBody blocker taps open the sheet in place', () => {
  it('venue -> Where sheet, no navigation', () => {
    first('venue', 'venue'); every(); tap();
    expect(screen.getByTestId('where-rows')).toBeTruthy();
    expect(nav).not.toHaveBeenCalled();
  });
  it('about -> About sheet', () => { first('description', 'about'); every(); tap(); expect(screen.getByTestId('v2-sheet')).toBeTruthy(); expect(screen.queryByTestId('where-rows')).toBeNull(); expect(nav).not.toHaveBeenCalled(); });
  it('name -> Name sheet', () => { first('name', 'basics'); every(); tap(); expect(screen.getByTestId('name-done')).toBeTruthy(); });
  it('organisers -> Organisers sheet', () => { first('organiser', 'organisers'); every(); tap(); expect(screen.getByTestId('org-done')).toBeTruthy(); });
  it('programme -> Programme sheet', () => { first('session', 'programme'); every(); tap(); expect(screen.getByTestId('v2-sheet')).toBeTruthy(); expect(nav).not.toHaveBeenCalled(); });
  it('flyer -> Flyer sheet', () => { first('cover', 'cover'); every(); tap(); expect(screen.getByTestId('v2-sheet')).toBeTruthy(); expect(nav).not.toHaveBeenCalled(); });
  it('tickets -> onOpenTickets once', () => {
    const onOpenTickets = vi.fn(); first('ticket_link', 'tickets'); every('/e?tab=every', { onOpenTickets }); tap();
    expect(onOpenTickets).toHaveBeenCalledTimes(1);
    expect(nav).not.toHaveBeenCalled();
  });
  it('dates with onOpenDates -> called', () => {
    const onOpenDates = vi.fn(); first('upcoming_date', 'dates'); every('/e?tab=every', { onOpenDates }); tap();
    expect(onOpenDates).toHaveBeenCalledTimes(1);
    expect(nav).not.toHaveBeenCalled();
  });
  it('dates without onOpenDates -> old fix screen', () => {
    first('upcoming_date', 'dates'); every(); tap();
    expect(nav).toHaveBeenCalledWith(goLiveFixHref('dates', 's1'));
  });
});

describe('?fix= on arrival', () => {
  it('opens the sheet, drops fix, keeps tab and night', () => {
    first('venue', 'venue'); every('/e?tab=every&night=o1&fix=where');
    expect(screen.getByTestId('where-rows')).toBeTruthy();
    const loc = screen.getByTestId('loc').textContent ?? '';
    expect(loc).not.toContain(`${goLiveFixParam}=`);
    expect(loc).toContain('tab=every');
    expect(loc).toContain('night=o1');
  });
  it('unknown value: nothing opens, param removed', () => {
    first('venue', 'venue'); every('/e?tab=every&fix=bogus');
    expect(screen.queryByTestId('v2-sheet')).toBeNull();
    expect(screen.getByTestId('loc').textContent).not.toContain('fix=');
  });
  it('flag off: no fix button, ?fix=where opens nothing', () => {
    vi.stubEnv('VITE_ENABLE_GOLIVE_FIX', 'false');
    first('venue', 'venue'); every('/e?tab=every&fix=where');
    expect(screen.queryByTestId('golive-fix')).toBeNull();
    expect(screen.queryByTestId('where-rows')).toBeNull();
  });
});

describe('EditorV2 This night tab', () => {
  it('venue blocker -> Every tab with the Where sheet open', () => {
    first('venue', 'venue');
    wrap(<EditorV2 ws={ws()} />, '/e?night=o1'); tap();
    expect(screen.getByTestId('where-rows')).toBeTruthy();
    const loc = screen.getByTestId('loc').textContent ?? '';
    expect(loc).toContain('tab=every');
    expect(loc).toContain('night=o1');
    expect(loc).not.toContain('fix=');
    expect(nav).not.toHaveBeenCalled();
  });
  it('dates blocker -> Dates sheet in place', () => {
    first('upcoming_date', 'dates');
    wrap(<EditorV2 ws={ws()} />); tap();
    expect(screen.getAllByTestId('dates-row').length).toBeGreaterThan(0);
  });
});

describe('OneOffBody', () => {
  const oneOff = () => wrap(<OneOffBody ws={ws('one_off')} saveNow={save} />);
  it('name -> Name sheet', () => { first('name', 'basics'); oneOff(); tap(); expect(screen.getByTestId('name-done')).toBeTruthy(); });
  it('venue -> old fix screen', () => {
    first('venue', 'venue'); oneOff(); tap();
    expect(nav).toHaveBeenCalledWith(goLiveFixHref('venue', 's1'));
  });
});
