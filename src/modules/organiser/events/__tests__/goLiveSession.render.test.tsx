// @vitest-environment jsdom
/**
 * Go live needs a session, RENDERED on both screens (R-GOLIVE-SESSION F1). D90: the
 * event card shows the server's `session` row (series_go_live_check_v1) and no second
 * client line; the New event last step keeps hasUpcomingSession. Also N2 (the leave
 * link). N3 (A1-off wording of the client reason) and N4 (festival client reason) left
 * with the client card rule: the server list is the card's one list.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { rawWorkspace } from './fixtures';

const rpc = vi.hoisted(() => vi.fn());
vi.mock('@/integrations/supabase/client', () => ({ supabase: { rpc, from: vi.fn(), storage: { from: vi.fn() } } }));
vi.mock('@/hooks/useAuth', () => ({ useAuth: () => ({ user: { id: 'u1' } }) }));
vi.mock('@/hooks/useLondonToday', () => ({ useLondonToday: () => '2026-10-20' }));

import { LifecycleActions } from '../LifecycleActions';
import { parseEventWorkspace } from '../eventModel';
import { GO_LIVE_LABEL } from '../../shared/goLiveCheck';
import NewFlow from '../../flows/new/NewFlow';
import { NO_SESSION_NEW_REASON } from '../../flows/new/model';
import { ORG_PATHS } from '../../shell/paths';

const TODAY = '2026-10-20';
const COVER = 'https://x/c.jpg';
const PROGRAM = [{ day: { id: 'd' }, sections: [{ section: { id: 's' }, items: [{ item: { id: 'i', start_time: '20:00:00' }, people: [] }] }] }];
const occ = { id: 'o1', occurrence_date: '2026-11-17', lifecycle_status: 'scheduled', version: 1, added_sessions_count: 0 };

/** The zz-test shape: one_off draft, venue, cover, a future date, NO session. */
const draft = (withSession: boolean, over: Record<string, unknown> = {}) => {
  const raw = rawWorkspace({ format: 'one_off', lifecycle_status: 'draft', default_cover_image_url: COVER, default_start_date: '2026-11-17', recurrence_rule: null, ...over }, [occ]);
  if (withSession) raw.series.program = PROGRAM as never[];
  return raw;
};

/** The server's answer (series_go_live_check_v1): with or without the `session` code. */
const check = (withSession: boolean) => ({
  ready: withSession,
  event_missing: withSession ? [] : [{ code: 'session', section: 'programme' }],
  recommended: [],
  profile_rule_applies: false,
  profile_missing: [],
});

let workspace: ReturnType<typeof draft>;
let serverSession = false;
beforeEach(() => {
  rpc.mockReset();
  rpc.mockImplementation(async (fn: string) => {
    if (fn === 'admin_event_workspace_p5') return { data: workspace, error: null };
    if (fn === 'series_go_live_check_v1') return { data: check(serverSession), error: null };
    return { data: null, error: { message: 'unexpected ' + fn } };
  });
});
afterEach(cleanup);

function Where() {
  return <span data-testid="where">{useLocation().pathname}</span>;
}
const client = () => new QueryClient({ defaultOptions: { queries: { retry: false } } });

function card(raw: ReturnType<typeof draft>) {
  render(
    <QueryClientProvider client={client()}>
      <MemoryRouter><LifecycleActions ws={parseEventWorkspace(raw)} today={TODAY} /></MemoryRouter>
    </QueryClientProvider>,
  );
}

function newCover() {
  render(
    <QueryClientProvider client={client()}>
      <MemoryRouter initialEntries={['/account/o/new/s1/cover']}>
        <Routes>
          <Route path="/account/o/new/:seriesId/cover" element={<NewFlow />} />
          <Route path="*" element={<span data-testid="elsewhere" />} />
        </Routes>
        <Where />
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

describe('event card: Go live and the session (the server list, D90)', () => {
  it('zz-test shape: Go live is off, and the server session row opens the programme', async () => {
    serverSession = false;
    card(draft(false));
    const row = await screen.findByTestId('org-life-item-session');
    expect(row.textContent).toContain(GO_LIVE_LABEL.session);
    expect(row.getAttribute('href')?.startsWith(ORG_PATHS.eventProgramme('s1'))).toBe(true);
    expect(screen.getByTestId('org-life-golive').getAttribute('aria-disabled')).toBe('true');
    expect(screen.getByTestId('org-life-golive-reason').textContent).toBeTruthy();
    // One list: no second, client-side session line beside the server row.
    expect(screen.queryByTestId('org-life-add-session')).toBeNull();
    expect(screen.getAllByText(/session/i)).toHaveLength(1);
  });

  it('the server says ready: Go live is a pressable button and no session row shows', async () => {
    serverSession = true;
    card(draft(true));
    await waitFor(() => expect(screen.getByTestId('org-life-golive').getAttribute('data-goes')).toBe('send'));
    expect(screen.queryByTestId('org-life-item-session')).toBeNull();
    expect(screen.queryByTestId('org-life-golive-reason')).toBeNull();
  });
});

describe('New event last step: Go live and the session', () => {
  it('a session-less draft: Go live is off with NO_SESSION_NEW_REASON, and Save as draft goes to the programme', async () => {
    workspace = draft(false);
    newCover();
    await waitFor(() => expect(screen.getByTestId('org-new-live-reason').textContent).toBe(NO_SESSION_NEW_REASON));
    expect((screen.getByTestId('org-new-live') as HTMLButtonElement).disabled).toBe(true);
    fireEvent.click(screen.getByTestId('org-new-leave'));
    await waitFor(() => expect(screen.getByTestId('where').textContent).toBe(ORG_PATHS.eventProgramme('s1')));
  });

  it('with a programme session Go live is on, and Save as draft still goes Home', async () => {
    workspace = draft(true);
    newCover();
    await waitFor(() => expect((screen.getByTestId('org-new-live') as HTMLButtonElement).disabled).toBe(false));
    expect(screen.queryByTestId('org-new-live-reason')).toBeNull();
    fireEvent.click(screen.getByTestId('org-new-leave'));
    await waitFor(() => expect(screen.getByTestId('where').textContent).toBe(ORG_PATHS.home));
  });

  it('no photo yet: the photo reason stays and the leave link still goes Home', async () => {
    workspace = draft(false, { default_cover_image_url: null });
    newCover();
    await waitFor(() => expect(screen.getByTestId('org-new-live-reason').textContent).toMatch(/photo/));
    fireEvent.click(screen.getByTestId('org-new-leave'));
    await waitFor(() => expect(screen.getByTestId('where').textContent).toBe(ORG_PATHS.home));
  });
});
