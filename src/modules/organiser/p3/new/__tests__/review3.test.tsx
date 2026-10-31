// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter, Route, Routes, useLocation, useNavigate } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import type { ReactNode } from 'react';

/*
 * p3-create review r1 F1 (fix round r3): the save keeps running after the person leaves the screen,
 * but it never moves them and never sets state on the gone screen. Failed on the code before the fix
 * (the URL became the new event page, or the create screen again with ?sid=).
 * (Harness as in review2.)
 */

const rpc = vi.hoisted(() => vi.fn());
vi.mock('@/integrations/supabase/client', () => ({ supabase: { rpc, from: vi.fn(), storage: { from: vi.fn() } } }));
vi.mock('@/hooks/useAuth', () => ({ useAuth: () => ({ user: { id: 'u1' } }) }));
vi.mock('@/hooks/useLondonToday', () => ({ useLondonToday: () => '2026-11-02' }));
vi.mock('@/components/auth/AuthGuard', () => ({ AuthGuard: ({ children }: { children: ReactNode }) => <>{children}</> }));
vi.mock('@/hooks/useNoindexMeta', () => ({ useNoindexMeta: () => undefined }));
vi.mock('../../../events/media', () => ({ uploadEventPicture: async () => 'https://img.example/cover.jpg' }));
vi.mock('../../../shared/createCity', () => ({ resolveCreateCityId: async () => 'c1' }));
vi.mock('../../../home/onboarding/golive/profileLeft', () => ({ profileQuestionsLeft: async () => false }));

import CreateFlow from '../CreateFlow';
import { P3_BASE, P3_PATHS } from '../../shell/paths';
import { ORGANISER_HOME_KEY } from '../../../shared/selfServeApi';
import { DRAFT_STORE_KEY } from '../model';

const page = (id: string, name: string) => ({ id, name, slug: null, avatar_url: null, city_id: 'c1', lifecycle_status: 'live', role: 'owner', latest_decision: null, series: [] });
type Env = { target_id: string; expected_version?: number; idempotency_key: string; command: { kind: string; payload: Record<string, unknown> } };

let sent: Env[] = [];
let answer: (env: Env) => { error: { message: string } } | null = () => null;
let version = 0;

beforeEach(() => {
  sent = [];
  answer = () => null;
  version = 0;
  try { window.sessionStorage.clear(); } catch { /* none */ }
  rpc.mockReset();
  rpc.mockImplementation(async (fn: string, args: { p_envelope?: Env }) => {
    if (fn === 'organiser_home_v1') return { data: { today: '2026-11-02', organisers: [page('org1', 'Latin Nights')] }, error: null };
    if (fn === 'series_command_p5') {
      const env = args.p_envelope!;
      sent.push(env);
      const a = answer(env);
      if (a) return { data: null, error: a.error };
      version += 1;
      return { data: { ok: true, new_version: version }, error: null };
    }
    return { data: null, error: { message: 'unexpected ' + fn } };
  });
});
afterEach(() => { cleanup(); vi.restoreAllMocks(); });

function Where() {
  const { pathname, search } = useLocation();
  const navigate = useNavigate();
  return (
    <>
      <output data-testid="where">{pathname + search}</output>
      {/* the tab bar / browser Back: a way off the screen that is not the (disabled) Cancel */}
      <button type="button" data-testid="tab-events" onClick={() => navigate(P3_PATHS.events)}>Events</button>
    </>
  );
}
function mount(qc: QueryClient) {
  return render(
    <QueryClientProvider client={qc}>
      <MemoryRouter initialEntries={[P3_PATHS.createStep('form', 'one_date', null)]}>
        <Routes>
          <Route path={`${P3_BASE}/create`} element={<CreateFlow />} />
          <Route path="*" element={<span data-testid="elsewhere" />} />
        </Routes>
        <Where />
      </MemoryRouter>
    </QueryClientProvider>,
  );
}
const where = () => screen.getByTestId('where').textContent;
const stored = () => { try { return JSON.parse(window.sessionStorage.getItem(DRAFT_STORE_KEY) ?? 'null'); } catch { return null; } };

/** Holds every series_command_p5 of one kind until release(). */
function gate(kind: string) {
  let release: () => void = () => {};
  const held = new Promise<void>((r) => { release = r; });
  const before = rpc.getMockImplementation()!;
  rpc.mockImplementation(async (fn: string, args: { p_envelope?: Env }) => {
    if (fn === 'series_command_p5' && args.p_envelope?.command.kind === kind) await held;
    return before(fn, args);
  });
  return () => release();
}

async function saveThenLeave(qc: QueryClient) {
  const release = gate('series.upsert');
  mount(qc);
  fireEvent.change(await screen.findByTestId('p3-new-name'), { target: { value: 'Salsa Sunday' } });
  fireEvent.click(screen.getByTestId('p3-new-save-draft'));
  // the create is in flight (held before the server answers)
  await waitFor(() => expect(rpc.mock.calls.some(([fn, a]) => fn === 'series_command_p5' && a?.p_envelope?.command.kind === 'series.upsert')).toBe(true));
  fireEvent.click(screen.getByTestId('tab-events'));
  expect(where()).toBe(P3_PATHS.events);
  expect(screen.queryByTestId('p3-new-name')).toBeNull();
  await act(async () => { release(); });
}

describe('F1: leaving while it saves', () => {
  it('the create lands after the screen is gone: the person stays on Events, no state on the gone screen', async () => {
    const errors = vi.spyOn(console, 'error').mockImplementation(() => {});
    const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    await saveThenLeave(qc);
    // the rest of the save still goes (the draft is finished on the server)
    await waitFor(() => expect(stored()).toBeNull());
    await act(async () => { await new Promise((r) => setTimeout(r, 20)); });
    expect(where()).toBe(P3_PATHS.events);
    expect(screen.getByTestId('elsewhere')).toBeTruthy();
    expect(errors.mock.calls.filter((c) => /unmounted|state update/i.test(String(c[0])))).toEqual([]);
  });

  it('a step fails after the screen is gone: no error card anywhere, the draft is kept as created and Home is refreshed (Needs you)', async () => {
    const errors = vi.spyOn(console, 'error').mockImplementation(() => {});
    answer = (e) => (e.command.kind !== 'series.upsert' ? { error: { message: 'Failed to fetch' } } : null);
    const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    const invalidate = vi.spyOn(qc, 'invalidateQueries');
    await saveThenLeave(qc);
    await waitFor(() => expect(sent.length).toBeGreaterThan(1));
    await waitFor(() => expect(invalidate).toHaveBeenCalledWith({ queryKey: ORGANISER_HOME_KEY }));
    await act(async () => { await new Promise((r) => setTimeout(r, 20)); });
    expect(where()).toBe(P3_PATHS.events);
    expect(screen.queryByTestId('p3-new-partial-error')).toBeNull();
    expect(screen.queryByText(/Not saved yet/i)).toBeNull();
    expect(stored()?.created).toBe(true);
    expect(errors.mock.calls.filter((c) => /unmounted|state update/i.test(String(c[0])))).toEqual([]);
  });
});
