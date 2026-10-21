// @vitest-environment jsdom
/**
 * D118 consistency: for each teacher / DJ shape (held x complete x filled count x declined x progress not
 * loaded) the Your areas row, the switcher entry, the Account home row and the area meter agree, and the
 * meter never says "left" and never contradicts a "Complete" status.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter } from 'react-router-dom';

const rpc = vi.hoisted(() => vi.fn());
vi.mock('@/integrations/supabase/client', () => ({ supabase: { auth: {}, rpc, from: vi.fn() } }));

import YourAreasPage from '../home/YourAreasPage';
import { SwitcherAreas } from '../home/SwitcherAreas';
import { AccountAreasRow } from '../home/AccountAreasRow';
import TeacherAreaPage from '../teacher/TeacherAreaPage';
import DjAreaPage from '../dj/DjAreaPage';
import { OPEN_OR_ADD_WORDS, OPEN_YOUR_AREAS_WORDS } from '../home/areaStatus';
import { SavedToast } from '../shared/SavedToast';
import { roleDetailsQueryKey } from '../shared/areaApi';
import { ROLE_FIELDS, type Role } from '../shared/fieldRegistry';

interface Shape { name: string; held: boolean; complete: boolean; filled: number; declined: boolean; progressLoads: boolean; intentOnly?: boolean }
const SHAPES: Shape[] = [
  { name: 'held complete, 0 filled', held: true, complete: true, filled: 0, declined: false, progressLoads: true },
  { name: 'held complete, some filled', held: true, complete: true, filled: 3, declined: false, progressLoads: true },
  { name: 'held complete, all filled', held: true, complete: true, filled: 99, declined: false, progressLoads: true },
  { name: 'held complete, progress not loaded', held: true, complete: true, filled: 2, declined: false, progressLoads: false },
  // N1: every detail filled but the server's status is not Complete: the meter counts, the row says what is left.
  { name: 'held not complete, all filled', held: true, complete: false, filled: 99, declined: false, progressLoads: true },
  { name: 'held not complete, some filled', held: true, complete: false, filled: 2, declined: false, progressLoads: true },
  { name: 'held not complete, progress not loaded', held: true, complete: false, filled: 2, declined: false, progressLoads: false },
  { name: 'intent only, 0 filled', held: false, complete: false, filled: 0, declined: false, progressLoads: true, intentOnly: true },
  { name: 'not held', held: false, complete: false, filled: 0, declined: false, progressLoads: true },
  { name: 'declined', held: false, complete: false, filled: 0, declined: true, progressLoads: true },
];

function serve(role: Role, s: Shape) {
  const total = ROLE_FIELDS[role].length;
  const filled = Math.min(s.filled, total);
  const details: Record<string, unknown> = {};
  ROLE_FIELDS[role].forEach((f, i) => {
    if (i < filled) details[f.key] = f.kind === 'years' ? 3 : f.kind === 'list' ? ['x'] : f.kind === 'yesno' ? true : 'x';
  });
  const rows = (['dancer', 'organiser', 'teacher', 'dj'] as const).map((r) => ({
    role: r, active: r === role ? s.held : true, complete: r === role ? s.complete : true,
  }));
  const open = ROLE_FIELDS[role].map((f) => ({ area: role, field: f.key, required: false, done: false }));
  const steps = s.intentOnly ? open : s.held && !s.complete ? open.slice(0, 2) : [];
  rpc.mockImplementation(async (fn: string) => {
    if (fn === 'my_roles_v1') return { data: rows, error: null };
    if (fn === 'my_profile_progress_v1') {
      return s.progressLoads
        ? { data: { percent: 50, required_left: 0, publish_ready: true, steps, declined: s.declined ? [role] : [] }, error: null }
        : { data: null, error: { message: 'boom' } };
    }
    if (fn === 'my_role_details_v1') return { data: { role, person_id: 'p', details }, error: null };
    if (fn === 'my_lineup_appearances_v1') return { data: [], error: null };
    return { data: null, error: { message: `unexpected ${fn}` } };
  });
  return { total, filled };
}

function mount(node: React.ReactNode) {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  render(<QueryClientProvider client={qc}><MemoryRouter>{node}</MemoryRouter></QueryClientProvider>);
  return qc;
}
/** Every query has settled: the words on screen are the final ones (no fixed sleeps, N1). */
const settled = (qc: QueryClient) => waitFor(() => expect(qc.isFetching()).toBe(0));
beforeEach(() => rpc.mockReset());
afterEach(cleanup);

describe.each([['teacher', TeacherAreaPage], ['dj', DjAreaPage]] as const)('%s', (role, Area) => {
  it.each(SHAPES)('$name', async (s) => {
    const { total, filled } = serve(role, s);
    await settled(mount(<YourAreasPage />));
    await screen.findByTestId(`area-status-${role}`);
    const words = screen.getByTestId(`area-status-${role}`).textContent!;
    cleanup();

    serve(role, s);
    await settled(mount(<SwitcherAreas rowClass="" mutedClass="" onPick={() => undefined} />));
    await screen.findByTestId('profile-switcher-your-areas');
    const entry = screen.queryByTestId(`profile-switcher-area-status-${role}`);
    const shown = s.held || s.intentOnly;
    expect(entry?.textContent ?? null).toBe(shown ? words : null);
    cleanup();

    serve(role, s);
    await settled(mount(<AccountAreasRow />));
    const acct = await screen.findByTestId('account-areas-row');
    const unfinished = shown && words !== 'Complete';
    const name = role === 'teacher' ? 'Teacher' : 'DJ';
    expect(acct.textContent).toContain(unfinished ? `${name}: ${words}` : OPEN_OR_ADD_WORDS);
    cleanup();

    if (!shown) return;
    serve(role, s);
    mount(<Area />);
    const line = (await screen.findByTestId('completeness-line')).textContent!;
    expect(line).not.toMatch(/left/i);
    if (filled === 0 && !s.complete) expect(line).toBe('No details added yet');
    else expect(line).toContain(String(filled === total ? `All ${total}` : `${filled} of ${total}`));
    if (words === 'Complete') expect(line).not.toMatch(/^No details/);
    if (s.name === 'held not complete, all filled') {
      expect(line).toBe(`All ${total} details added`);
      expect(words).toMatch(/left/);
    }
  });
});

/** A query that never answers: the "loading" shape. */
const never = () => new Promise<never>(() => undefined);

describe.each([['teacher', TeacherAreaPage], ['dj', DjAreaPage]] as const)('%s: roles pending / roles error (S4, S7)', (role, Area) => {
  const unfinished = { held: true, complete: false, filled: 2, declined: false, progressLoads: true };
  it('roles pending: the Account row claims nothing, the meter waits (no "No details" flip)', async () => {
    serve(role, { name: 'x', ...unfinished, complete: true, filled: 0 });
    const base = rpc.getMockImplementation()!;
    rpc.mockImplementation((fn: string, ...rest: unknown[]) => (fn === 'my_roles_v1' ? never() : base(fn, ...rest)));
    mount(<AccountAreasRow />);
    const acct = await screen.findByTestId('account-areas-row');
    await waitFor(() => expect(rpc.mock.calls.some(([fn]) => fn === 'my_profile_progress_v1')).toBe(true));
    expect(acct.textContent).not.toContain(OPEN_OR_ADD_WORDS);
    expect(acct.textContent).not.toContain(OPEN_YOUR_AREAS_WORDS);
    cleanup();
    const qc = mount(<Area />);
    // The details have answered; only my_roles_v1 is still out.
    await waitFor(() => expect(qc.getQueryState(roleDetailsQueryKey(role))?.status).toBe('success'));
    await screen.findByLabelText(/Loading your/);
    expect(screen.queryByTestId('completeness-line')).toBeNull();
  });
  it('roles error: the Account row says the neutral "Open Your areas", never "Open or add a role"', async () => {
    serve(role, { name: 'x', ...unfinished });
    const base = rpc.getMockImplementation()!;
    rpc.mockImplementation((fn: string, ...rest: unknown[]) => (fn === 'my_roles_v1' ? Promise.resolve({ data: null, error: { message: 'boom' } }) : base(fn, ...rest)));
    const qc = mount(<AccountAreasRow />);
    await settled(qc);
    const acct = screen.getByTestId('account-areas-row');
    expect(acct.textContent).toContain(OPEN_YOUR_AREAS_WORDS);
    expect(acct.textContent).not.toContain(OPEN_OR_ADD_WORDS);
  });
});

describe('B3: the Saved toast is a solid pill', () => {
  it('a solid token ground with dark text, no translucent ok-bg and no blur', () => {
    render(<SavedToast show onDone={() => undefined} />);
    const pill = screen.getByTestId('saved-toast').firstElementChild as HTMLElement;
    expect(pill.className).toContain('bg-[var(--ok-fg)]');
    expect(pill.className).toContain('text-[var(--btnfg)]');
    expect(pill.className).not.toMatch(/ok-bg|backdrop-blur|bg-opacity|\/\d+\]?\b/);
  });
});
