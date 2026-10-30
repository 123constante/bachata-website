// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { lazy } from 'react';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { home, rawWorkspace } from '../../../events/__tests__/fixtures';

/*
 * p3-shell-exits fix round (review 1202 r1 S1, S2): the P3-only ends of New event.
 * Cover "Go live" with profile questions left goes to P3's own Review for the page (never the
 * bare event page, never R1's Almost live), and Done after New event leads back to the event made,
 * by its name ("Back to Friday Party"), with "Back to You" second.
 */

const rpc = vi.hoisted(() => vi.fn());
vi.mock('@/integrations/supabase/client', () => ({ supabase: { rpc, from: vi.fn(), storage: { from: vi.fn() } } }));
vi.mock('@/hooks/useAuth', () => ({ useAuth: () => ({ user: { id: 'u1' } }) }));
vi.mock('@/hooks/useLondonToday', () => ({ useLondonToday: () => '2026-10-08' }));

import NewFlow from '../../../flows/new/NewFlow';
import Done from '../../../flows/Done';
import { GO_BACK_LABEL, returnToSeriesId } from '../../../flows/doneState';
import { OrgSurfaceProvider } from '../../../shell/surface';
import { ORG_PATHS } from '../../../shell/paths';
import { P3PushedSurface, P3_SURFACE } from '../../you/surface';
import { P3_BASE, P3_PATHS, p3StartReview } from '../paths';

let profileLeft = false;
beforeEach(() => {
  profileLeft = false;
  rpc.mockReset();
  rpc.mockImplementation(async (fn: string) => {
    if (fn === 'organiser_home_v1') return { data: home(), error: null };
    if (fn === 'admin_event_workspace_p5') {
      return { data: rawWorkspace({ format: 'recurring', version: 3, default_cover_image_url: 'https://img.example/flyer.jpg' }, [{ id: 'o1', occurrence_date: '2026-10-09', lifecycle_status: 'scheduled', version: 1, added_sessions_count: 1 }]), error: null };
    }
    if (fn === 'series_go_live_check_v1') {
      return { data: { ready: !profileLeft, event_missing: [], recommended: [], profile_rule_applies: true, profile_missing: profileLeft ? [{ area: 'dancer', [['organiser', 'id'].join('_')]: null, fields: ['nationality'] }] : [] }, error: null };
    }
    if (fn === 'series_command_p5') return { data: { ok: true, new_version: 4 }, error: null };
    return { data: null, error: { message: 'unexpected ' + fn } };
  });
});
afterEach(cleanup);

function Where() {
  const { pathname, search } = useLocation();
  return <output data-testid="where">{pathname + search}</output>;
}

function mountCover() {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  render(
    <QueryClientProvider client={qc}>
      <OrgSurfaceProvider value={P3_SURFACE}>
        <MemoryRouter initialEntries={[P3_PATHS.newCover('s1')]}>
          <Routes>
            <Route path={`${P3_BASE}/new/:seriesId/cover`} element={<NewFlow />} />
            <Route path={P3_PATHS.youDone} element={<Done />} />
            <Route path="*" element={<span data-testid="elsewhere" />} />
          </Routes>
          <Where />
        </MemoryRouter>
      </OrgSurfaceProvider>
    </QueryClientProvider>,
  );
}

async function tapGoLive() {
  const live = (await screen.findByTestId('org-new-live')) as HTMLButtonElement;
  await waitFor(() => expect(live.disabled).toBe(false));
  fireEvent.click(live);
}

describe('P3 New event: the Cover step’s exits', () => {
  it('Go live with profile questions left goes to P3’s Review for the page and sends nothing (S1)', async () => {
    profileLeft = true;
    mountCover();
    await tapGoLive();
    await waitFor(() => expect(screen.getByTestId('where').textContent).toBe(p3StartReview('org1')));
    expect(rpc.mock.calls.filter(([fn]) => fn === 'series_command_p5')).toHaveLength(0);
  });

  it('Go live with nothing left ends on P3 Done: "Back to <event name>" to the event first, "Back to You" second', async () => {
    mountCover();
    await tapGoLive();
    await screen.findByTestId('org-done');
    expect(screen.getByTestId('where').textContent).toBe(P3_PATHS.youDone);
    await waitFor(() => expect(screen.getByTestId('org-done-back').textContent).toBe('Back to Friday Party'));
    expect(screen.getByTestId('org-done-home').textContent).toBe('Back to You');
    fireEvent.click(screen.getByTestId('org-done-back'));
    expect(screen.getByTestId('where').textContent).toBe(P3_PATHS.event('s1'));
  });
});

describe('returnToSeriesId: which returnTo names an event (Done says its name, else "Go back")', () => {
  it.each([
    ['R1 event page', ORG_PATHS.event('s1'), 's1'],
    ['R1 event sub-screen', ORG_PATHS.eventDetails('s1'), 's1'],
    ['P3 event page', P3_PATHS.event('s1'), 's1'],
    ['P3 event sub-screen', P3_PATHS.eventOrganisers('s 1'), 's 1'],
    ['R1 go live', `${ORG_PATHS.goLive}?series=s2&o=org1`, 's2'],
    ['P3 Events list', P3_PATHS.events, null],
    ['P3 You', P3_PATHS.you, null],
    ['R1 Home', ORG_PATHS.home, null],
    ['nothing', null, null],
  ])('%s', (_n, returnTo, id) => {
    expect(returnToSeriesId(returnTo)).toBe(id);
  });

  it('the generic label is "Go back"', () => {
    expect(GO_BACK_LABEL).toBe('Go back');
  });
});

describe('P3PushedSurface while its screen loads (review 1202 N4)', () => {
  it('the loading frame keeps a way out: back to Events', async () => {
    const Never = lazy(() => new Promise<{ default: () => null }>(() => undefined));
    render(
      <MemoryRouter initialEntries={[P3_PATHS.newWhat]}>
        <P3PushedSurface back={() => ({ to: P3_PATHS.events, label: 'Events' })}><Never /></P3PushedSurface>
      </MemoryRouter>,
    );
    await screen.findByTestId('p3-pushed-route-loading-card');
    const back = screen.getByTestId('org-back');
    expect(back.getAttribute('href')).toBe(P3_PATHS.events);
  });
});
