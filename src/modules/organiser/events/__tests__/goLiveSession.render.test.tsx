// @vitest-environment jsdom
/**
 * Go live needs a session, RENDERED on both screens (R-GOLIVE-SESSION F1): the pure
 * functions have their own matrix; these tests fail if either screen stops calling
 * the shared rule. Also N2 (the leave link), N3 (A1-off wording), N4 (festival).
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
import { goLiveReason } from '../lifecycleModel';
import NewFlow from '../../flows/new/NewFlow';
import { NO_SESSION_NEW_REASON } from '../../flows/new/model';
import { ORG_PATHS } from '../../shell/paths';

const TODAY = '2026-10-20';
const COVER = 'https://x/c.jpg';
const PROGRAM = [{ day: { id: 'd' }, sections: [{ section: { id: 's' }, items: [{ item: { id: 'i', start_time: '20:00:00' }, people: [] }] }] }];
const occ = { id: 'o1', occurrence_date: '2026-11-17', lifecycle_status: 'scheduled', version: 1, added_sessions_count: 0 };
const NO_SESSION = 'Add at least one session first.';

/** The zz-test shape: one_off draft, venue, cover, a future date, NO session. */
const draft = (withSession: boolean, over: Record<string, unknown> = {}) => {
  const raw = rawWorkspace({ format: 'one_off', lifecycle_status: 'draft', default_cover_image_url: COVER, default_start_date: '2026-11-17', recurrence_rule: null, ...over }, [occ]);
  if (withSession) raw.series.program = PROGRAM as never[];
  return raw;
};

let workspace: ReturnType<typeof draft>;
beforeEach(() => {
  rpc.mockReset();
  rpc.mockImplementation(async (fn: string) => (fn === 'admin_event_workspace_p5' ? { data: workspace, error: null } : { data: null, error: { message: 'unexpected ' + fn } }));
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

describe('event card: Go live and the session', () => {
  it('zz-test shape: Go live is off with the reason, and Add a session opens the programme', () => {
    card(draft(false));
    expect(screen.getByTestId('org-life-golive').getAttribute('aria-disabled')).toBe('true');
    expect(screen.getByTestId('org-life-golive-reason').textContent).toBe(NO_SESSION);
    expect(screen.getByTestId('org-life-add-session').getAttribute('href')).toBe(ORG_PATHS.eventProgramme('s1'));
  });

  it('with a session Go live is a pressable button and the link is gone', () => {
    card(draft(true));
    const live = screen.getByTestId('org-life-golive') as HTMLButtonElement;
    expect(live.tagName).toBe('BUTTON');
    expect(live.disabled).toBe(false);
    expect(screen.queryByTestId('org-life-add-session')).toBeNull();
    expect(screen.queryByTestId('org-life-golive-reason')).toBeNull();
  });

  it('N4 a festival draft with no session says the team does it, with no Add a session link', () => {
    card(draft(false, { format: 'festival' }));
    expect(screen.getByTestId('org-life-golive-reason').textContent).toBe('Festival days are edited with the platform team for now.');
    expect(screen.queryByTestId('org-life-add-session')).toBeNull();
  });
});

describe('N3 the A1-off reason reads as one sentence', () => {
  const ws = (raw: ReturnType<typeof draft>) => parseEventWorkspace(raw);
  it('session only: lower case after "Before then,"', () => {
    expect(goLiveReason(ws(draft(false)), TODAY, false)).toBe('Needs the next platform update. Before then, add at least one session first.');
  });
  it('Details item and session: the session starts a new sentence', () => {
    expect(goLiveReason(ws(draft(false, { default_venue_id: null })), TODAY, false)).toBe(
      'Needs the next platform update. Before then, add a venue in Details. Add at least one session first.',
    );
  });
  it('A1 on keeps its text', () => {
    expect(goLiveReason(ws(draft(false)), TODAY, true)).toBe(NO_SESSION);
    expect(goLiveReason(ws(draft(false, { default_venue_id: null })), TODAY, true)).toBe('To go live, add a venue in Details. Add at least one session first.');
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
