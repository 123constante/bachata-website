// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

/*
 * Create look slice 2 keep-list (flag on). Original header:
 * p3-create slice 1: P3's New event, rendered. 0 / 1 / 2+ pages, the kind picker, the form, an
 * untouched save (nothing sent), a draft, going live (the fixed order, versions chained), the
 * onboarding refusal (organiser_onboarding_gate on) against success (off), a failure midway
 * (Open the draft / Discard it / Try again), venue not found, and Cancel. Copy never points at a
 * control that is not on screen.
 */

const rpc = vi.hoisted(() => vi.fn());
const upload = vi.hoisted(() => vi.fn());
const profileLeft = vi.hoisted(() => ({ value: false }));
vi.mock('@/integrations/supabase/client', () => ({ supabase: { rpc, from: vi.fn(), storage: { from: vi.fn() } } }));
vi.mock('@/hooks/useAuth', () => ({ useAuth: () => ({ user: { id: 'u1' } }) }));
vi.mock('@/hooks/useLondonToday', () => ({ useLondonToday: () => '2026-11-02' }));
vi.mock('../../../events/media', () => ({ uploadEventPicture: upload }));
vi.mock('../../../shared/createCity', () => ({ resolveCreateCityId: async () => 'c1' }));
vi.mock('../../../home/onboarding/golive/profileLeft', () => ({ profileQuestionsLeft: async () => profileLeft.value }));

import { P3_BASE, P3_PATHS, p3StartReview } from '../../shell/paths';
import { COPY, RESULT_COPY } from '../model';
import { rawWorkspace } from '../../../events/__tests__/fixtures';
import { closeGate, getGate, subscribeGate } from '../../onboarding/gate';

const page = (id: string, name: string, lifecycle = 'live') => ({ id, name, slug: null, avatar_url: null, city_id: 'c1', lifecycle_status: lifecycle, role: 'owner', latest_decision: null, series: [] });
const VENUES = [
  { id: 'v1', name: 'Studio One', neighbourhood: 'Soho', city_name: 'London', address: null, postcode: null },
  { id: 'v2', name: 'Salsa Hall', neighbourhood: 'Leith', city_name: 'Edinburgh', address: null, postcode: null },
];

let pages: ReturnType<typeof page>[] = [];
/** How many commands had been sent when each upload ran (F-15: never before the create). */
let uploadedAfter: number[] = [];
let commandFails: (env: { command: { kind: string } }, n: number) => { message: string } | null = () => null;
/** Commands the server took (the series' version); 0 = no row yet. */
let landed = 0;
let sent: Array<{ target_id: string; expected_version?: number; idempotency_key: string; command: { kind: string; payload: Record<string, unknown> } }> = [];

beforeEach(() => {
  pages = [page('org1', 'Latin Nights')];
  commandFails = () => null;
  sent = [];
  landed = 0;
  profileLeft.value = false;
  upload.mockReset();
  upload.mockImplementation(async () => { uploadedAfter.push(sent.length); return 'https://img.example/cover.jpg'; });
  uploadedAfter = [];
  try { window.sessionStorage.clear(); } catch { /* none */ }
  rpc.mockReset();
  rpc.mockImplementation(async (fn: string, args: { p_envelope?: (typeof sent)[number] }) => {
    if (fn === 'organiser_home_v1') return { data: { today: '2026-11-02', organisers: pages }, error: null };
    if (fn === 'get_organiser_venue_options_v1') return { data: VENUES, error: null };
    // the series as the server has it now (a retry reads its version again): one version per command that landed
    if (fn === 'admin_event_workspace_p5') {
      return landed ? { data: rawWorkspace({ id: (args as { p_series_id?: string }).p_series_id, lifecycle_status: 'draft', version: landed }, []), error: null } : { data: null, error: { message: 'not found' } };
    }
    if (fn === 'series_command_p5') {
      const env = args.p_envelope!;
      sent.push(env);
      const fail = commandFails(env, sent.length);
      if (fail) return { data: null, error: fail };
      landed += 1;
      return { data: { ok: true, new_version: landed }, error: null };
    }
    return { data: null, error: { message: 'unexpected ' + fn } };
  });
});
afterEach(cleanup);

const form = (kind: string, o: string | null = null) => P3_PATHS.createStep('form', kind, o);

/** Every link and every control a line of copy names is on screen (the "points at a missing control" guard). */
function namedControlsOnScreen(text: string) {
  const names: Array<[RegExp, string]> = [
    [/Skip for now/, 'Skip for now'], [/Save draft/, 'Save draft'], [/Try again/, 'Try again'], [/open Help|Open Help/, 'Open Help'],
    [/Open the draft|open the draft/, 'Open the draft'], [/discard it|Discard it/, 'Discard it'], [/tap Add/, 'Add'],
  ];
  for (const [re, label] of names) {
    if (re.test(text)) expect(screen.getAllByText(label, { exact: true }).length, `"${label}" is named but not on screen`).toBeGreaterThan(0);
  }
}


describe('create look (flag on): the form step keeps everything', () => {
  it('renders every card, the helper, the Go live line and Back', async () => {
    vi.stubEnv('VITE_ENABLE_ORGANISER_CREATE_LOOK', 'true');
    vi.resetModules();
    const { default: Flow } = await import('../CreateFlow');
    const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    render(
      <QueryClientProvider client={qc}>
        <div className="p3-theme p3-frame">
          <MemoryRouter initialEntries={[form('one_date')]}>
            <Routes><Route path={`${P3_BASE}/create`} element={<Flow />} /></Routes>
          </MemoryRouter>
        </div>
      </QueryClientProvider>,
    );
    await screen.findByTestId('p3-look-when');
    for (const id of ['p3-look-when', 'p3-look-sessions', 'p3-look-where', 'p3-look-price', 'p3-look-description']) expect(screen.getByTestId(id)).toBeTruthy();
    for (const label of ['WHEN', 'CLASSES AND PARTIES', 'WHERE', 'PRICE', 'DESCRIPTION']) expect(screen.getAllByText(label).length).toBeGreaterThan(0);
    expect(screen.getByText('No description')).toBeTruthy();
    expect(screen.getByText('Up to 120 letters. Needed to save.')).toBeTruthy();
    expect((screen.getByTestId('p3-new-name') as HTMLInputElement).maxLength).toBe(120);
    expect(screen.getAllByText(/Save draft/).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/Go live/).length).toBeGreaterThan(0);
    expect(screen.getByText(/Go live needs/)).toBeTruthy();
    expect(screen.getByTestId('org-back').getAttribute('href')).toBeTruthy();
    // the Description sheet: Save keeps the text, the card shows its first line
    fireEvent.click(screen.getByTestId('p3-new-row-description'));
    fireEvent.change(screen.getByTestId('p3-new-desc'), { target: { value: 'Social dancing\nAll levels' } });
    expect(screen.getByTestId('p3-new-desc-count').textContent).toBe('25/500');
    fireEvent.click(screen.getByTestId('p3-new-desc-save'));
    expect(screen.getByText('Social dancing')).toBeTruthy();
    vi.unstubAllEnvs();
  });
});
