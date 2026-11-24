// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

/* RAFFLE card on the create screen (look on): starts Off, toggles, series_set after the create, failure never fails the save. */

const rpc = vi.hoisted(() => vi.fn());
vi.mock('@/integrations/supabase/client', () => ({ supabase: { rpc, from: vi.fn(), storage: { from: vi.fn() } } }));
vi.mock('@/hooks/useAuth', () => ({ useAuth: () => ({ user: { id: 'u1' } }) }));
vi.mock('@/hooks/useLondonToday', () => ({ useLondonToday: () => '2026-11-02' }));
vi.mock('../../../events/media', () => ({ uploadEventPicture: vi.fn() }));
vi.mock('../../../shared/createCity', () => ({ resolveCreateCityId: async () => 'c1' }));
vi.mock('../../../home/onboarding/golive/profileLeft', () => ({ profileQuestionsLeft: async () => false }));

import { P3_BASE, P3_PATHS } from '../../shell/paths';
import { RESULT_COPY } from '../model';
import { rawWorkspace } from '../../../events/__tests__/fixtures';

const pages = [{ id: 'org1', name: 'Latin Nights', slug: null, avatar_url: null, city_id: 'c1', lifecycle_status: 'live', role: 'owner', latest_decision: null, series: [] }];
let landed = 0;
let raffleFails = false;
let sent: Array<{ target_id: string }> = [];

beforeEach(() => {
  landed = 0; sent = []; raffleFails = false;
  try { window.sessionStorage.clear(); } catch { /* none */ }
  rpc.mockReset();
  rpc.mockImplementation(async (fn: string, args: { p_envelope?: { target_id: string }; p_series_id?: string }) => {
    if (fn === 'organiser_home_v1') return { data: { today: '2026-11-02', organisers: pages }, error: null };
    if (fn === 'get_organiser_venue_options_v1') return { data: [], error: null };
    if (fn === 'admin_event_workspace_p5') return landed ? { data: rawWorkspace({ id: args.p_series_id, lifecycle_status: 'draft', version: landed }, []), error: null } : { data: null, error: { message: 'not found' } };
    if (fn === 'series_command_p5') { sent.push(args.p_envelope!); landed += 1; return { data: { ok: true, new_version: landed }, error: null }; }
    if (fn === 'organiser_raffle_series_set_v1') return raffleFails ? { data: null, error: { message: 'no' } } : { data: { ok: true }, error: null };
    return { data: null, error: { message: 'unexpected ' + fn } };
  });
});
afterEach(() => { cleanup(); vi.unstubAllEnvs(); });

function Where() {
  const { pathname, state } = useLocation();
  return <output data-testid="where" data-toast={(state as { p3Toast?: string } | null)?.p3Toast ?? ''}>{pathname}</output>;
}

async function open() {
  vi.stubEnv('VITE_ENABLE_ORGANISER_CREATE_LOOK', 'true');
  vi.resetModules();
  const { default: Flow } = await import('../CreateFlow');
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  render(
    <QueryClientProvider client={qc}>
      <div className="p3-theme p3-frame">
        <MemoryRouter initialEntries={[P3_PATHS.createStep('form', 'one_date', null)]}>
          <Routes><Route path={`${P3_BASE}/create`} element={<Flow />} /><Route path="*" element={<span />} /></Routes>
          <Where />
        </MemoryRouter>
      </div>
    </QueryClientProvider>,
  );
  await screen.findByTestId('p3-look-when');
}
const raffleCalls = () => rpc.mock.calls.filter((c) => c[0] === 'organiser_raffle_series_set_v1');
async function saveDraft() {
  fireEvent.change(screen.getByTestId('p3-new-name'), { target: { value: 'Salsa Sunday' } });
  fireEvent.click(screen.getByTestId('p3-new-save-draft'));
  await waitFor(() => expect(screen.getByTestId('where').textContent).toMatch(/^\/account\/p3\/events\//));
}

describe('RAFFLE card on the create screen', () => {
  it('sits between PRICE and DESCRIPTION, starts Off, and the switch toggles the label', async () => {
    await open();
    const ids = Array.from(document.querySelectorAll('[data-testid^="p3-look-"]')).map((e) => e.getAttribute('data-testid'));
    expect(ids).toEqual(['p3-look-when', 'p3-look-sessions', 'p3-look-where', 'p3-look-price', 'p3-look-raffle', 'p3-look-description']);
    expect(screen.getByText('Dancers can enter a free draw for your guest list.')).toBeTruthy();
    const sw = screen.getByTestId('p3-new-raffle-switch');
    expect(sw.getAttribute('aria-checked')).toBe('false');
    expect(screen.getByTestId('p3-new-raffle-label').textContent).toBe('Raffle: Off');
    fireEvent.click(sw);
    expect(sw.getAttribute('aria-checked')).toBe('true');
    expect(screen.getByTestId('p3-new-raffle-label').textContent).toBe('Raffle: On');
    fireEvent.click(sw);
    expect(screen.getByTestId('p3-new-raffle-label').textContent).toBe('Raffle: Off');
  });

  it('On: series_set once with the new series id and true, after the create', async () => {
    await open();
    fireEvent.click(screen.getByTestId('p3-new-raffle-switch'));
    await saveDraft();
    expect(raffleCalls()).toHaveLength(1);
    expect(raffleCalls()[0][1]).toEqual({ p_series_id: sent[0].target_id, p_enabled: true });
    expect(screen.getByTestId('where').getAttribute('data-toast')).toBe(RESULT_COPY.savedDraft);
  });

  it('Off: series_set is never called', async () => {
    await open();
    await saveDraft();
    expect(raffleCalls()).toHaveLength(0);
  });

  it('series_set failure: the create still succeeds, with the raffle toast', async () => {
    raffleFails = true;
    await open();
    fireEvent.click(screen.getByTestId('p3-new-raffle-switch'));
    await saveDraft();
    expect(screen.getByTestId('where').getAttribute('data-toast')).toBe('Event created. Raffle could not be switched on. Turn it on from the event’s Raffle page.');
  });

  it('keep-list: every other card and control is still on the screen', async () => {
    await open();
    for (const id of ['p3-look-when', 'p3-look-sessions', 'p3-look-where', 'p3-look-price', 'p3-look-description', 'p3-new-name', 'p3-new-row-price', 'p3-new-row-description', 'p3-new-row-sessions', 'p3-new-row-venue', 'p3-new-save-draft']) {
      expect(screen.getByTestId(id), id).toBeTruthy();
    }
  });
});
