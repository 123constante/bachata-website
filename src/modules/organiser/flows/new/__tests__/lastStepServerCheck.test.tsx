// @vitest-environment jsdom
/**
 * D91: the New event last step reads the SAME server answer as the event card
 * (series_go_live_check_v1 through shared/goLiveCheck), not the client rule
 * hasUpcomingSession. The two prod shapes where they disagreed: (1) a session
 * with a start but no title or end; (2) an added session on one date with no
 * programme. #885's intent stays: Go live is off, with the reason, while the
 * server says a session is missing.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { home, rawWorkspace, venues } from '../../../events/__tests__/fixtures';

const rpc = vi.hoisted(() => vi.fn());
vi.mock('@/integrations/supabase/client', () => ({ supabase: { rpc, from: vi.fn(), storage: { from: vi.fn() } } }));
vi.mock('@/hooks/useAuth', () => ({ useAuth: () => ({ user: { id: 'u1' } }) }));
vi.mock('@/hooks/useLondonToday', () => ({ useLondonToday: () => '2026-10-08' }));

import NewFlow from '../NewFlow';
import { NO_SESSION_NEW_REASON } from '../model';

const COVER = 'https://cdn.example/c.webp';
const occ = (id: string, date: string, extra: Record<string, unknown> = {}) =>
  ({ id, occurrence_date: date, lifecycle_status: 'scheduled', version: 1, has_override: false, session_overrides_count: 0, added_sessions_count: 0, materialised_start_utc: null, ...extra });
// Shape 1: a programme item with a start, no title, no end.
const START_ONLY = [{ day: { id: 'd' }, sections: [{ section: { id: 's' }, items: [{ item: { id: 'i', start_time: '20:00:00' }, people: [] }] }] }];

interface Shape { name: string; program: unknown[]; dates: unknown[] }
const SHAPES: Shape[] = [
  { name: '(1) a session with a start but no title or end', program: START_ONLY, dates: [occ('o1', '2026-10-16')] },
  { name: '(2) an added session on one date, no programme', program: [], dates: [occ('o1', '2026-10-16', { added_sessions_count: 1 })] },
];

let shape: Shape;
let check: unknown;
const sessionMissing = { ready: false, event_missing: [{ code: 'session', section: 'programme' }], recommended: [], profile_rule_applies: false, profile_missing: [] };
const ready = { ready: true, event_missing: [], recommended: [], profile_rule_applies: false, profile_missing: [] };

beforeEach(() => {
  rpc.mockReset();
  rpc.mockImplementation(async (fn: string) => {
    if (fn === 'organiser_home_v1') return { data: home(), error: null };
    if (fn === 'get_organiser_venue_options_v1') return { data: venues, error: null };
    if (fn === 'admin_event_workspace_p5') {
      const raw = rawWorkspace({ lifecycle_status: 'draft', default_cover_image_url: COVER }, shape.dates);
      raw.series.program = shape.program as never[];
      return { data: raw, error: null };
    }
    if (fn === 'series_go_live_check_v1') return check instanceof Error ? { data: null, error: { message: check.message } } : { data: check, error: null };
    return { data: null, error: { message: 'unexpected ' + fn } };
  });
});
afterEach(cleanup);

function mount() {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={qc}>
      <MemoryRouter initialEntries={['/account/o/new/s1/cover']}>
        <Routes>
          <Route path="/account/o/new/:seriesId/cover" element={<NewFlow />} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

const live = () => screen.getByTestId('org-new-live') as HTMLButtonElement;

describe('D91: the last step reads series_go_live_check_v1', () => {
  it.each(SHAPES)('$name: server says a session is missing -> Go live off, with the no-session reason', async (s) => {
    shape = s;
    check = sessionMissing;
    mount();
    await waitFor(() => expect(screen.getByTestId('org-new-live-reason').textContent).toBe(NO_SESSION_NEW_REASON));
    expect(live().disabled).toBe(true);
    expect(rpc.mock.calls.some(([fn]) => fn === 'series_go_live_check_v1')).toBe(true);
  });

  it.each(SHAPES)('$name: server says ready -> Go live on', async (s) => {
    shape = s;
    check = ready;
    mount();
    await waitFor(() => expect(live().disabled).toBe(false));
    expect(screen.queryByTestId('org-new-live-reason')).toBeNull();
  });

  it('no session at all (zz test): off with the reason (#885 intent kept)', async () => {
    shape = { name: 'none', program: [], dates: [occ('o1', '2026-10-16')] };
    check = sessionMissing;
    mount();
    await waitFor(() => expect(screen.getByTestId('org-new-live-reason').textContent).toBe(NO_SESSION_NEW_REASON));
    expect(live().disabled).toBe(true);
  });
});
