// @vitest-environment jsdom
/**
 * F1 (restyle slice A, fix pass 2): the same fact reads the same on every screen. For each teacher / DJ shape
 * (held complete, held to finish, chosen at sign-up and not saved, not added, declined, progress failed to load,
 * loading) x surface (Your areas row, switcher entry, area page, details page): the status words agree, no surface
 * shows a details count or Edit for a role that is not added, and nothing points at a control that is not on screen.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter, Route, Routes } from 'react-router-dom';

const rpc = vi.hoisted(() => vi.fn());
vi.mock('@/integrations/supabase/client', () => ({ supabase: { auth: {}, rpc, from: vi.fn() } }));

import YourAreasPage from '../home/YourAreasPage';
import { SwitcherAreas } from '../home/SwitcherAreas';
import TeacherAreaPage from '../teacher/TeacherAreaPage';
import TeacherProfilePage from '../teacher/TeacherProfilePage';
import DjAreaPage from '../dj/DjAreaPage';
import DjProfilePage from '../dj/DjProfilePage';
import { COMPLETE_WORDS, DECLINED_WORDS, NOT_HELD_WORDS, UNFINISHED_WORDS } from '../home/areaStatus';
import { ROLE_FIELDS, type Role } from '../shared/fieldRegistry';
import { requiredLeftText } from '@/modules/organiser/shared/profileProgress';

type Load = 'ok' | 'progress-fails' | 'loading';
interface Shape { name: string; held: boolean; complete: boolean; intentOnly?: boolean; declined?: boolean; load: Load; words: (n: number) => string; added: boolean }
const SHAPES: Shape[] = [
  { name: 'held complete', held: true, complete: true, load: 'ok', words: () => COMPLETE_WORDS, added: true },
  { name: 'held to finish', held: true, complete: false, load: 'ok', words: () => requiredLeftText(2), added: true },
  { name: 'chosen at sign-up, not saved', held: false, complete: false, intentOnly: true, load: 'ok', words: (n) => requiredLeftText(n), added: true },
  { name: 'not added', held: false, complete: false, load: 'ok', words: () => NOT_HELD_WORDS, added: false },
  { name: 'declined', held: false, complete: false, declined: true, load: 'ok', words: () => DECLINED_WORDS, added: false },
  { name: 'held, progress failed to load', held: true, complete: false, load: 'progress-fails', words: () => UNFINISHED_WORDS, added: true },
  { name: 'chosen at sign-up, progress failed to load', held: false, complete: false, intentOnly: true, load: 'progress-fails', words: () => NOT_HELD_WORDS, added: false },
];

const never = () => new Promise<never>(() => undefined);

function serve(role: Role, s: Shape) {
  const rows = (['dancer', 'organiser', 'teacher', 'dj'] as const).map((r) => ({
    role: r, active: r === role ? s.held : true, complete: r === role ? s.complete : true,
  }));
  const open = ROLE_FIELDS[role].map((f) => ({ area: role, field: f.key, required: false, done: false }));
  const steps = s.intentOnly ? open : s.held && !s.complete ? open.slice(0, 2) : [];
  const details: Record<string, unknown> = {};
  rpc.mockReset().mockImplementation((fn: string) => {
    if (s.load === 'loading' && (fn === 'my_roles_v1' || fn === 'my_profile_progress_v1')) return never();
    if (fn === 'my_roles_v1') return Promise.resolve({ data: rows, error: null });
    if (fn === 'my_profile_progress_v1') {
      return Promise.resolve(s.load === 'progress-fails'
        ? { data: null, error: { message: 'boom' } }
        : { data: { percent: 50, required_left: 0, publish_ready: true, steps, declined: s.declined ? [role] : [] }, error: null });
    }
    if (fn === 'my_role_details_v1') return Promise.resolve({ data: { role, person_id: 'p', details }, error: null });
    if (fn === 'my_lineup_appearances_v1') return Promise.resolve({ data: [], error: null });
    return Promise.resolve({ data: null, error: { message: `unexpected ${fn}` } });
  });
  return open.length;
}

function mount(node: React.ReactNode, path = '/') {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  render(<QueryClientProvider client={qc}><MemoryRouter initialEntries={[path]}>{node}</MemoryRouter></QueryClientProvider>);
  return qc;
}
const settled = (qc: QueryClient) => waitFor(() => expect(qc.isFetching()).toBe(0));
beforeEach(() => rpc.mockReset());
afterEach(cleanup);

const PAGES = { teacher: [TeacherAreaPage, TeacherProfilePage], dj: [DjAreaPage, DjProfilePage] } as const;

describe.each(['teacher', 'dj'] as const)('%s', (role) => {
  const [Area, Details] = PAGES[role];
  it.each(SHAPES.filter((s) => s.load !== 'loading'))('$name: every surface agrees', async (s) => {
    const n = serve(role, s);
    const words = s.words(n);
    await settled(mount(<YourAreasPage />));
    expect((await screen.findByTestId(`area-status-${role}`)).textContent).toBe(words);
    cleanup();

    serve(role, s);
    await settled(mount(<SwitcherAreas rowClass="" mutedClass="" onPick={() => undefined} />));
    await screen.findByTestId('profile-switcher-your-areas');
    expect(screen.queryByTestId(`profile-switcher-area-status-${role}`)?.textContent ?? null).toBe(s.added ? words : null);
    cleanup();

    serve(role, s);
    await settled(mount(<Area />));
    if (s.added) {
      expect(await screen.findByTestId('completeness-line')).toBeTruthy();
      expect(screen.getByTestId('edit-details')).toBeTruthy();
      expect(screen.queryByTestId('not-added-card')).toBeNull();
    } else {
      // The same words and the same action Your areas offers; no count, no Edit.
      expect((await screen.findByTestId(`area-status-${role}`)).textContent).toBe(words);
      expect(screen.queryByTestId('completeness-line')).toBeNull();
      expect(screen.queryByRole('progressbar')).toBeNull();
      expect(screen.queryByTestId('edit-details')).toBeNull();
      expect(screen.getAllByRole('button').map((b) => b.textContent)).toEqual(['Add']);
      expect(screen.queryByText(/details added|of \d+/i)).toBeNull();
    }
    cleanup();

    serve(role, s);
    await settled(mount(
      <Routes>
        <Route path="/details" element={<Details areaPath="/area" />} />
        <Route path="/area" element={<p data-testid="area-landing">area page</p>} />
      </Routes>,
      '/details',
    ));
    if (s.added) {
      expect(await screen.findByTestId(`${role}-profile`)).toBeTruthy();
      expect(screen.queryByTestId('area-landing')).toBeNull();
    } else {
      // Sent to the area page (replace), never the form.
      expect(await screen.findByTestId('area-landing')).toBeTruthy();
      expect(screen.queryByTestId(`${role}-profile`)).toBeNull();
    }
  });

  it('loading: the area page and the details page show a skeleton, no count, no Edit, no redirect', async () => {
    serve(role, { name: 'loading', held: false, complete: false, load: 'loading', words: () => '', added: false });
    mount(<Area />);
    await screen.findByLabelText(/Loading your/);
    expect(screen.queryByTestId('completeness-line')).toBeNull();
    expect(screen.queryByTestId('edit-details')).toBeNull();
    expect(screen.queryByTestId('not-added-card')).toBeNull();
    cleanup();
    serve(role, { name: 'loading', held: false, complete: false, load: 'loading', words: () => '', added: false });
    mount(
      <Routes>
        <Route path="/details" element={<Details areaPath="/area" />} />
        <Route path="/area" element={<p data-testid="area-landing">area page</p>} />
      </Routes>,
      '/details',
    );
    await screen.findByLabelText(/Loading your/);
    expect(screen.queryByTestId('area-landing')).toBeNull();
  });

  it('Skip for now on the area page stores the No through the same writer Your areas uses', async () => {
    const s = SHAPES.find((x) => x.name === 'not added')!;
    serve(role, s);
    const writers = { fetchIntent: vi.fn().mockResolvedValue({ roles: [], declined: [] }), setIntent: vi.fn(), setDeclined: vi.fn().mockResolvedValue(undefined) };
    mount(<Area writers={writers} />);
    fireEvent.click(await screen.findByTestId('area-action-ask'));
    fireEvent.click(await screen.findByTestId(`do-you-${role}-skip`));
    await waitFor(() => expect(writers.setDeclined).toHaveBeenCalledWith(role, true));
  });
});
