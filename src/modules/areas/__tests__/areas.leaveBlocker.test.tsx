// @vitest-environment jsdom
/**
 * Review RESTYLE-A B4: under the production data router, EVERY way out of a dirty form asks "Discard changes?" first,
 * not only the area's own links. Table: leave path x (dirty, clean). Keep editing stays; Discard goes.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Link, Outlet, RouterProvider, createMemoryRouter, useLocation } from 'react-router-dom';

const rpc = vi.hoisted(() => vi.fn());
vi.mock('@/integrations/supabase/client', () => ({ supabase: { auth: {}, rpc, from: vi.fn() } }));

import TeacherProfilePage from '../teacher/TeacherProfilePage';
import { SwitcherAreas } from '../home/SwitcherAreas';

const ROWS = [
  { role: 'dancer', active: true, complete: true }, { role: 'organiser', active: false, complete: false },
  { role: 'teacher', active: true, complete: true }, { role: 'dj', active: true, complete: false },
];
const details = { years_teaching: 6, teaching_styles: [], offers_private: null, private_lesson_types: [], private_lesson_locations: [], private_travel_distance: null, partner_role: null };

beforeEach(() => {
  rpc.mockReset().mockImplementation(async (fn: string, args?: Record<string, unknown>) => {
    if (fn === 'my_roles_v1') return { data: ROWS, error: null };
    if (fn === 'my_profile_progress_v1') return { data: { percent: 50, required_left: 0, publish_ready: true, steps: [], declined: [] }, error: null };
    if (fn === 'my_role_details_v1') return { data: { role: args?.p_role, person_id: 'p', details }, error: null };
    return { data: null, error: { message: `unexpected ${fn}` } };
  });
});
afterEach(cleanup);

const DETAILS = '/account/t/details';
const Where = () => <p data-testid="where">{useLocation().pathname}</p>;
/** The site chrome around the area: a header link and the switcher (a dancer side row and the area entries). */
function Chrome() {
  return (
    <>
      <Link to="/parties" data-testid="header-link">Parties</Link>
      <Link to="/account/dancer" data-testid="switcher-dancer">Dancer</Link>
      <SwitcherAreas rowClass="" mutedClass="" onPick={() => undefined} />
      <Outlet />
    </>
  );
}

function mount() {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const router = createMemoryRouter(
    [{ element: <Chrome />, children: [{ path: DETAILS, element: <TeacherProfilePage /> }, { path: '*', element: <Where /> }] }],
    { initialEntries: ['/start', DETAILS], initialIndex: 1 },
  );
  render(
    <QueryClientProvider client={qc}>
      <RouterProvider router={router} />
    </QueryClientProvider>,
  );
  return router;
}

type Leave = (router: ReturnType<typeof mount>) => void | Promise<void>;
const PATHS: [string, Leave, string][] = [
  ['back link', () => { fireEvent.click(screen.getByTestId('area-back')); }, '/account/t'],
  ['home link', () => { fireEvent.click(screen.getByTestId('site-home-link')); }, '/'],
  ['switcher teacher', () => { fireEvent.click(screen.getByTestId('profile-switcher-area-dj')); }, '/account/dj'],
  ['switcher dancer', () => { fireEvent.click(screen.getByTestId('switcher-dancer')); }, '/account/dancer'],
  ['header link', () => { fireEvent.click(screen.getByTestId('header-link')); }, '/parties'],
  ['history back', (r) => { void r.navigate(-1); }, '/start'],
];

async function ready() {
  await screen.findByLabelText(/years/i);
  await screen.findByTestId('profile-switcher-area-dj');
}
const makeDirty = async () => fireEvent.change(await screen.findByLabelText(/years/i), { target: { value: '9' } });

describe('B4: every leave path asks when the form is dirty, and only then', () => {
  it.each(PATHS)('%s, dirty: Keep editing stays, Discard leaves', async (_name, leave, lands) => {
    const router = mount();
    await ready();
    await makeDirty();
    await act(async () => { await leave(router); });
    expect(await screen.findByText('Discard changes?')).toBeTruthy();
    expect(router.state.location.pathname).toBe(DETAILS);
    fireEvent.click(screen.getByTestId('discard-keep'));
    await waitFor(() => expect(screen.queryByText('Discard changes?')).toBeNull());
    expect(router.state.location.pathname).toBe(DETAILS);
    expect((screen.getByLabelText(/years/i) as HTMLInputElement).value).toBe('9');
    await act(async () => { await leave(router); });
    fireEvent.click(await screen.findByTestId('discard-leave'));
    await waitFor(() => expect(router.state.location.pathname).toBe(lands));
    expect(screen.queryByText('Discard changes?')).toBeNull();
  });

  it.each(PATHS)('%s, clean: no sheet, it just goes', async (_name, leave, lands) => {
    const router = mount();
    await ready();
    await act(async () => { await leave(router); });
    await waitFor(() => expect(router.state.location.pathname).toBe(lands));
    expect(screen.queryByText('Discard changes?')).toBeNull();
  });
});

describe('B4: closing the tab while dirty', () => {
  it('beforeunload sets returnValue (Safari and older Chromium need it)', async () => {
    mount();
    await ready();
    await makeDirty();
    const e = new Event('beforeunload', { cancelable: true }) as BeforeUnloadEvent;
    Object.defineProperty(e, 'returnValue', { value: undefined, writable: true });
    window.dispatchEvent(e);
    expect(e.defaultPrevented).toBe(true);
    expect(e.returnValue).toBe('');
  });
});
