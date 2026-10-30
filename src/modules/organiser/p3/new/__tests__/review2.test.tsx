// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, fireEvent, render, renderHook, screen, waitFor } from '@testing-library/react';
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import type { ReactNode } from 'react';

/*
 * p3-create review round 2 (R2-1..6): each test failed on the code before its fix.
 * (Harness as in review1.) p3-create review round 1 (findings 1-10): each test failed on the code before its fix.
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
import { rawWorkspace } from '../../../events/__tests__/fixtures';
import { DRAFT_STORE_KEY, RESULT_COPY, blankCreate } from '../model';
import { useCreateSave } from '../useCreateSave';

const page = (id: string, name: string) => ({ id, name, slug: null, avatar_url: null, city_id: 'c1', lifecycle_status: 'live', role: 'owner', latest_decision: null, series: [] });
type Env = { target_id: string; expected_version?: number; idempotency_key: string; command: { kind: string; payload: Record<string, unknown> } };

let pages = [page('org1', 'Latin Nights')];
let sent: Env[] = [];
/** What the server answers each command; default ok with the next version. */
let answer: (env: Env, n: number) => { data?: unknown; error?: { message: string } } | null = () => null;
/** What admin_event_workspace_p5 returns (null = the row does not exist). */
let workspace: { version: number } | null | 'empty' = null;
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
      if (workspace === 'empty') return { data: null, error: null };
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


const stored = () => { try { return JSON.parse(window.sessionStorage.getItem(DRAFT_STORE_KEY) ?? 'null'); } catch { return null; } };
const createdDraft = (kind: 'one_date' | 'weekly', id = 'old-1') => ({ ...blankCreate(kind, id), name: 'Old one', created: true });

/** Holds every series_command_p5 of one kind until release() (the save is in flight). */
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

async function readyLive(goLiveReady = true) {
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
  if (goLiveReady) fireEvent.change(screen.getByTestId('p3-new-cover-input'), { target: { files: [new File(['x'], 'f.jpg', { type: 'image/jpeg' })] } });
}

describe('R2-1: while it saves nothing on the form can change, and the landed create stays marked', () => {
  it('every row and the date buttons are off while saving; storage keeps created', async () => {
    const release = gate('series.set_program');
    mount(form('other_dates'));
    fireEvent.change(await screen.findByTestId('p3-new-name'), { target: { value: 'Pop-ups' } });
    fireEvent.change(screen.getByTestId('p3-new-add-date'), { target: { value: '2026-11-21' } });
    fireEvent.click(screen.getByTestId('p3-new-add-date-go'));
    fireEvent.change(screen.getByTestId('p3-new-add-date'), { target: { value: '2026-11-28' } });
    fireEvent.click(screen.getByTestId('p3-new-save-draft'));
    await waitFor(() => expect(creates().length).toBe(1));
    await waitFor(() => expect(stored()?.created).toBe(true));
    for (const id of ['p3-new-row-venue', 'p3-new-row-sessions', 'p3-new-row-price', 'p3-new-add-date-go']) {
      expect((screen.getByTestId(id) as HTMLButtonElement).disabled, id).toBe(true);
    }
    for (const b of screen.getAllByText('Remove')) expect((b as HTMLButtonElement).disabled).toBe(true);
    fireEvent.click(screen.getByTestId('p3-new-row-price'));
    if (screen.queryByTestId('p3-new-pay-cash')) fireEvent.click(screen.getByTestId('p3-new-pay-cash'));
    expect(stored()?.created).toBe(true);
    release();
    await waitFor(() => expect(where()).toMatch(/^\/account\/p3\/events\//));
  });
});

describe('R2-2: a created draft left in storage never takes over the next New event', () => {
  it('picking the same kind again starts blank (no jump to the old event)', async () => {
    window.sessionStorage.setItem(DRAFT_STORE_KEY, JSON.stringify(createdDraft('weekly')));
    mount(P3_PATHS.create);
    fireEvent.click(await screen.findByTestId('p3-new-kind-weekly'));
    expect(((await screen.findByTestId('p3-new-name')) as HTMLInputElement).value).toBe('');
    expect(where()).toBe(form('weekly'));
  });

  it('a direct link to the form (createForFormat) starts blank and forgets it', async () => {
    window.sessionStorage.setItem(DRAFT_STORE_KEY, JSON.stringify(createdDraft('weekly')));
    mount(P3_PATHS.createForFormat('recurring'));
    expect(((await screen.findByTestId('p3-new-name')) as HTMLInputElement).value).toBe('');
    expect(where()).toBe(form('weekly'));
    expect(stored()?.created).toBeUndefined();
  });

  it('the same screen opened again (its URL names the draft): it goes to that draft, nothing sent', async () => {
    answer = (e) => (e.command.kind === 'series.set_program' ? { error: { message: 'Failed to fetch' } } : null);
    await named();
    fireEvent.click(screen.getByTestId('p3-new-save-draft'));
    await screen.findByTestId('p3-new-partial-error');
    const id = sent[0].target_id;
    const url = where()!;
    expect(url).toContain(`sid=${id}`);
    const keep = window.sessionStorage.getItem(DRAFT_STORE_KEY);
    cleanup();
    window.sessionStorage.setItem(DRAFT_STORE_KEY, keep!); // a reload runs no unmount
    mount(url);
    await waitFor(() => expect(where()).toBe(P3_PATHS.event(id)));
    expect(creates().length).toBe(1);
  });

  it('leaving the partial screen (Events) forgets the draft', async () => {
    answer = (e) => (e.command.kind === 'series.set_program' ? { error: { message: 'Failed to fetch' } } : null);
    await named();
    fireEvent.click(screen.getByTestId('p3-new-save-draft'));
    await screen.findByTestId('p3-new-partial-error');
    fireEvent.click(screen.getByTestId('org-back'));
    expect(where()).toBe(P3_PATHS.events);
    expect(stored()).toBeNull();
  });
});

describe('R2-3: the readback after a lost create reply needs THIS series', () => {
  it('an empty answer is not a row: Nothing was saved', async () => {
    answer = (e) => (e.command.kind === 'series.upsert' ? { error: { message: 'Failed to fetch' } } : null);
    workspace = 'empty';
    await named();
    fireEvent.click(screen.getByTestId('p3-new-save-draft'));
    await screen.findByTestId('p3-new-failed-error');
    expect(screen.queryByTestId('p3-new-partial-error')).toBeNull();
  });
});

describe('R2-4: a failed version read at retry start names the steps still to save', () => {
  it('not "the photo"', async () => {
    answer = (e) => (e.command.kind === 'series.set_program' ? { error: { message: 'Failed to fetch' } } : null);
    await named();
    fireEvent.click(screen.getByTestId('p3-new-save-draft'));
    await screen.findByTestId('p3-new-partial-error');
    workspace = null; // the read fails
    fireEvent.click(screen.getByTestId('p3-new-retry'));
    await waitFor(() => expect(screen.getByTestId('p3-new-partial-left').textContent).toBe('Not saved yet: the sessions.'));
  });
});

describe('R2-5: a retry with nothing left to plan is never a dead button', () => {
  it('the draft exists: it opens the event page', async () => {
    answer = (e) => (e.command.kind === 'series.set_program' ? { error: { message: 'Failed to fetch' } } : null);
    const qc = new QueryClient();
    const wrapper = ({ children }: { children: ReactNode }) => (
      <QueryClientProvider client={qc}><MemoryRouter initialEntries={[form('one_date')]}>{children}<Where /></MemoryRouter></QueryClientProvider>
    );
    const draft = { ...blankCreate('one_date', 'ser-x'), name: 'Salsa' };
    const { result, rerender } = renderHook(({ d }) => useCreateSave({ draft: d, cover: null, organiser: page('org1', 'Latin Nights') as never, today: '2026-11-02' }), { wrapper, initialProps: { d: draft } });
    await act(async () => { await result.current.run(false); });
    expect(result.current.state.s).toBe('partial');
    rerender({ d: { ...draft, name: '' } }); // nothing to plan any more
    await act(async () => { await result.current.retry(); });
    expect(where()).toBe(P3_PATHS.event('ser-x'));
  });
});

describe('R2-6: Try again on "Nothing was saved" keeps Go live', () => {
  it('the create is refused once, Try again goes live', async () => {
    answer = (e, n) => (e.command.kind === 'series.upsert' && n === 1 ? { error: { message: 'rate_limited: too many' } } : null);
    await readyLive();
    fireEvent.click(screen.getByTestId('p3-new-go-live'));
    const card = await screen.findByTestId('p3-new-failed-error');
    expect(card.textContent).toContain(RESULT_COPY.nothingSaved);
    workspace = { version: 0 };
    fireEvent.click(screen.getByText('Try again'));
    await waitFor(() => expect(where()).toMatch(/^\/account\/p3\/events\//));
    expect(sent[sent.length - 1].command).toEqual({ kind: 'series.set_lifecycle', payload: { to: 'live' } });
  });
});
