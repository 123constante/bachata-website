// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import type { ReactNode } from 'react';

/*
 * p3-create review round 1 (findings 1-10): each test failed on the code before its fix.
 * A landed create is never sent twice (a remount, a lost reply), a retry keeps Go live and reads
 * the version again, a double tap sends once, Back to the kinds keeps the draft, a rule with no
 * first date is named, an open sheet locks the page, and the old bridge URLs keep format and page.
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
import P3Routes from '../../shell/P3Routes';
import { P3_BASE, P3_PATHS } from '../../shell/paths';
import { P3_SURFACE } from '../../you/surface';
import { rawWorkspace } from '../../../events/__tests__/fixtures';
import { COPY, blankCreate, draftBlock, savePlan, withFirstDate } from '../model';

const page = (id: string, name: string) => ({ id, name, slug: null, avatar_url: null, city_id: 'c1', lifecycle_status: 'live', role: 'owner', latest_decision: null, series: [] });
type Env = { target_id: string; expected_version?: number; idempotency_key: string; command: { kind: string; payload: Record<string, unknown> } };

let pages = [page('org1', 'Latin Nights')];
let sent: Env[] = [];
/** What the server answers each command; default ok with the next version. */
let answer: (env: Env, n: number) => { data?: unknown; error?: { message: string } } | null = () => null;
/** What admin_event_workspace_p5 returns (null = the row does not exist). */
let workspace: { version: number } | null = null;
let version = 0;

beforeEach(() => {
  pages = [page('org1', 'Latin Nights')];
  sent = [];
  answer = () => null;
  workspace = null;
  version = 0;
  try { window.sessionStorage.clear(); } catch { /* none */ }
  rpc.mockReset();
  rpc.mockImplementation(async (fn: string, args: { p_envelope?: Env; p_series_id?: string }) => {
    if (fn === 'organiser_home_v1') return { data: { today: '2026-11-02', organisers: pages }, error: null };
    if (fn === 'get_organiser_venue_options_v1') return { data: [{ id: 'v1', name: 'Studio One', neighbourhood: 'Soho', city_name: 'London', address: null, postcode: null }], error: null };
    if (fn === 'admin_event_workspace_p5') {
      return workspace ? { data: rawWorkspace({ id: args.p_series_id, lifecycle_status: 'draft', version: workspace.version }, []), error: null } : { data: null, error: { message: 'not found' } };
    }
    if (fn === 'series_command_p5') {
      const env = args.p_envelope!;
      sent.push(env);
      const a = answer(env, sent.length);
      if (a) return { data: a.data ?? null, error: a.error ?? null };
      version += 1;
      return { data: { ok: true, new_version: version }, error: null };
    }
    return { data: null, error: { message: 'unexpected ' + fn } };
  });
});
afterEach(cleanup);

function Where() {
  const { pathname, search } = useLocation();
  return <output data-testid="where">{pathname + search}</output>;
}
function mount(path: string, routes = false) {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={qc}>
      <MemoryRouter initialEntries={[path]}>
        <Routes>
          {routes ? <Route path={`${P3_BASE}/*`} element={<P3Routes />} /> : <Route path={`${P3_BASE}/create`} element={<CreateFlow />} />}
          {!routes && <Route path="*" element={<span data-testid="elsewhere" />} />}
        </Routes>
        <Where />
      </MemoryRouter>
    </QueryClientProvider>,
  );
}
const where = () => screen.getByTestId('where').textContent;
const form = (kind: string, o: string | null = null) => P3_PATHS.createStep('form', kind, o);
const creates = () => sent.filter((e) => e.command.kind === 'series.upsert');

async function named(kind = 'one_date', name = 'Salsa Sunday') {
  mount(form(kind));
  fireEvent.change(await screen.findByTestId('p3-new-name'), { target: { value: name } });
}

async function readyOneDate() {
  await named('one_date');
  fireEvent.click(screen.getByTestId('p3-new-row-venue'));
  fireEvent.click(await screen.findByTestId('p3-new-venue-row'));
  fireEvent.change(screen.getByTestId('p3-new-first'), { target: { value: '2026-11-07' } });
  fireEvent.click(screen.getByTestId('p3-new-row-sessions'));
  fireEvent.change(screen.getByTestId('p3-new-sess-start'), { target: { value: '21:00' } });
  fireEvent.change(screen.getByTestId('p3-new-sess-end'), { target: { value: '23:00' } });
  fireEvent.click(screen.getByTestId('p3-new-sess-done'));
  fireEvent.click(screen.getByTestId('p3-new-row-price'));
  fireEvent.click(screen.getByTestId('p3-new-pay-door'));
  fireEvent.click(screen.getByTestId('p3-new-price-done'));
}

describe('F1: a landed create is never re-sent after a remount', () => {
  it('sessions failed, the screen is left and opened again: it goes to the draft, no second create', async () => {
    answer = (e) => (e.command.kind === 'series.set_program' ? { error: { message: 'Failed to fetch' } } : null);
    await named();
    fireEvent.click(screen.getByTestId('p3-new-save-draft'));
    await screen.findByTestId('p3-new-partial-error');
    const id = sent[0].target_id;
    cleanup();
    mount(form('one_date'));
    await waitFor(() => expect(where()).toBe(P3_PATHS.event(id)));
    expect(creates().length).toBe(1);
  });
});

describe('F2: the create landed but its reply was lost', () => {
  it('the row exists: it is the partial state (no "Nothing was saved"), and Try again does not create again', async () => {
    answer = (e, n) => (e.command.kind === 'series.upsert' && n === 1 ? { error: { message: 'Failed to fetch' } } : null);
    workspace = { version: 1 };
    version = 1;
    await named();
    fireEvent.click(screen.getByTestId('p3-new-save-draft'));
    await screen.findByTestId('p3-new-partial-error');
    expect(screen.queryByTestId('p3-new-failed-error')).toBeNull();
    fireEvent.click(screen.getByTestId('p3-new-retry'));
    await waitFor(() => expect(where()).toMatch(/^\/account\/p3\/events\//));
    expect(creates().length).toBe(1);
    expect(sent[1].command.kind).toBe('series.set_program');
    expect(sent[1].expected_version).toBe(1);
  });
});

describe('F3: Try again keeps Go live', () => {
  it('going live, the sessions fail; Try again sends the sessions AND going live', async () => {
    let fail = true;
    answer = (e) => (fail && e.command.kind === 'series.set_program' ? { error: { message: 'Failed to fetch' } } : null);
    await readyOneDate();
    fireEvent.change(screen.getByTestId('p3-new-cover-input'), { target: { files: [new File(['x'], 'f.jpg', { type: 'image/jpeg' })] } });
    fireEvent.click(screen.getByTestId('p3-new-go-live'));
    await screen.findByTestId('p3-new-partial-error');
    fail = false;
    workspace = { version };
    fireEvent.click(screen.getByTestId('p3-new-retry'));
    await waitFor(() => expect(where()).toMatch(/^\/account\/p3\/events\//));
    expect(sent.map((e) => e.command.kind).slice(-2)).toEqual(['series.set_program', 'series.set_lifecycle']);
    expect(sent[sent.length - 1].command.payload).toEqual({ to: 'live' });
  });
});

describe('F4: a double tap sends once, and the buttons are off while it saves', () => {
  it('two taps on Save draft: one create', async () => {
    await named();
    const b = screen.getByTestId('p3-new-save-draft');
    await act(async () => { fireEvent.click(b); fireEvent.click(b); });
    await waitFor(() => expect(where()).toMatch(/^\/account\/p3\/events\//));
    expect(creates().length).toBe(1);
  });

  it('while saving: Save draft, Go live and Cancel are off', async () => {
    let release: () => void = () => {};
    await named();
    const gate = new Promise<void>((r) => { release = r; });
    const before = rpc.getMockImplementation()!;
    rpc.mockImplementation(async (fn: string, args: unknown) => { if (fn === 'series_command_p5') await gate; return before(fn, args); });
    fireEvent.click(screen.getByTestId('p3-new-save-draft'));
    await waitFor(() => expect((screen.getByTestId('p3-new-save-draft') as HTMLButtonElement).disabled).toBe(true));
    expect((screen.getByTestId('p3-new-go-live') as HTMLButtonElement).disabled).toBe(true);
    expect((screen.getByTestId('p3-new-cancel') as HTMLButtonElement).disabled).toBe(true);
    release();
    await waitFor(() => expect(where()).toMatch(/^\/account\/p3\/events\//));
  });
});

describe('F5: Back to the kind picker keeps the draft for the same kind', () => {
  it('Back, the same kind again: what was typed is still there; another kind starts blank', async () => {
    await named('weekly', 'Friday Bachata');
    fireEvent.click(screen.getByTestId('org-back'));
    fireEvent.click(await screen.findByTestId('p3-new-kind-weekly'));
    expect(((await screen.findByTestId('p3-new-name')) as HTMLInputElement).value).toBe('Friday Bachata');
    fireEvent.click(screen.getByTestId('org-back'));
    fireEvent.click(await screen.findByTestId('p3-new-kind-monthly'));
    expect(((await screen.findByTestId('p3-new-name')) as HTMLInputElement).value).toBe('');
  });
});

describe('F6: the version is read again before a retry or a discard after a failure', () => {
  it('Discard after a failure uses the version the server has now', async () => {
    answer = (e) => (e.command.kind === 'series.set_program' ? { error: { message: 'Failed to fetch' } } : null);
    await named();
    fireEvent.click(screen.getByTestId('p3-new-save-draft'));
    await screen.findByTestId('p3-new-partial-error');
    workspace = { version: 5 };
    fireEvent.click(screen.getByTestId('p3-new-discard'));
    await waitFor(() => expect(where()).toBe(P3_PATHS.events));
    expect(sent[sent.length - 1].command).toEqual({ kind: 'series.set_lifecycle', payload: { to: 'archived' } });
    expect(sent[sent.length - 1].expected_version).toBe(5);
  });

  it('a reply without new_version: the next step reads the version instead of reusing a stale one', async () => {
    answer = (e) => (e.command.kind === 'series.set_recurrence' ? { data: { ok: true } } : null);
    workspace = { version: 7 };
    mount(form('weekly'));
    fireEvent.change(await screen.findByTestId('p3-new-name'), { target: { value: 'Friday Bachata' } });
    fireEvent.change(screen.getByTestId('p3-new-first'), { target: { value: '2026-11-06' } });
    fireEvent.click(screen.getByTestId('p3-new-save-draft'));
    await waitFor(() => expect(where()).toMatch(/^\/account\/p3\/events\//));
    expect(sent.map((e) => e.command.kind)).toEqual(['series.upsert', 'series.set_recurrence', 'series.set_program']);
    expect(sent[2].expected_version).toBe(7);
  });
});

describe('F7: a repeat rule with no first date is never dropped silently', () => {
  it('model: an edited rule without a first date blocks with what to do, and sends nothing', () => {
    const d = { ...blankCreate('weekly'), name: 'x', repeat: { ...blankCreate('weekly').repeat, weekdays: [2, 5] } };
    expect(draftBlock(d, '2026-11-02')).toBe(COPY.repeatNeedsFirst);
    expect(savePlan(d, { organiserId: 'o', today: '2026-11-02', hasCover: false, coverUrl: null, cityId: null, goLive: false })).toEqual([]);
    expect(draftBlock(withFirstDate(d, '2026-11-06'), '2026-11-02')).toBeNull();
  });

  it('screen: the Repeats row says the pattern saves from the first date', async () => {
    await named('weekly');
    fireEvent.click(screen.getByTestId('p3-new-row-repeat'));
    fireEvent.click(screen.getByRole('button', { name: 'Tuesday' }));
    fireEvent.click(screen.getByTestId('p3-new-repeat-done'));
    expect(screen.getByTestId('p3-new-when-problem').textContent).toBe(COPY.repeatNeedsFirst);
    expect(screen.getByTestId('p3-new-draft-why').textContent).toBe(COPY.repeatNeedsFirst);
  });
});

describe('F8: an open sheet locks the page behind it', () => {
  it('the scrolling main is overflow hidden while a sheet is open, and back after', async () => {
    await named();
    const main = document.querySelector('main')!;
    fireEvent.click(screen.getByTestId('p3-new-row-price'));
    expect(main.style.overflow).toBe('hidden');
    fireEvent.click(screen.getByTestId('p3-new-price-done'));
    expect(main.style.overflow).toBe('');
  });
});

describe('F9 / F10: the old bridge URLs keep the format and the page', () => {
  it('the surface maps R1 newName(format) to the P3 form for that kind', () => {
    expect(P3_SURFACE.paths.newName('one_off')).toBe(P3_PATHS.createStep('form', 'one_date', null));
    expect(P3_SURFACE.paths.newName('recurring')).toBe(P3_PATHS.createStep('form', 'weekly', null));
  });

  it.each([
    [`${P3_BASE}/new/name?format=recurring&o=org1`, P3_PATHS.createStep('form', 'weekly', 'org1')],
    [`${P3_BASE}/new/name?format=one_off`, P3_PATHS.createStep('form', 'one_date', null)],
  ])('%s -> %s', async (from, to) => {
    mount(from, true);
    await waitFor(() => expect(where()).toBe(to));
  });

  it('new/what?o= with 2 pages: the kind goes straight to that page\u2019s form (no page question again)', async () => {
    pages = [page('org1', 'Latin Nights'), page('org2', 'Bachata Lab')];
    mount(`${P3_BASE}/new/what?o=org2`, true);
    fireEvent.click(await screen.findByTestId('p3-new-kind-weekly'));
    await waitFor(() => expect(where()).toBe(form('weekly', 'org2')));
  });
});
