// @vitest-environment jsdom
/**
 * P3 W4b: Welcome / Add a page x every prod shape (survey 2026-10-28: 28 brand new, 2 open
 * request, 1 declined, 10 unfinished, 2 no dancer row, pages already held), plus P3 Home's
 * redirect and the claim / create confirmation. Text never points at a control that is not on
 * screen; opening and closing a sheet sends nothing; sheets are portalled and in P3's theme.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { createContext } from 'react';

const h = vi.hoisted(() => ({
  home: { isPending: false, isError: false, data: { today: '2026-10-28', organisers: [] as unknown[] }, refetch: vi.fn() },
  mine: vi.fn(),
  search: vi.fn(),
  claim: vi.fn(),
  request: vi.fn(),
  create: vi.fn(),
}));
vi.mock('@/integrations/supabase/client', () => ({ supabase: { auth: {}, rpc: vi.fn() } }));
vi.mock('@/hooks/useAuth', () => ({
  useAuth: () => ({ user: { id: 'u1', email: 'sam@example.com' }, session: null }),
  ProfileGateContext: createContext(null),
}));
vi.mock('../../data/useP3Data', () => ({ useP3Home: () => h.home, useP3Views: () => ({ data: null }) }));
vi.mock('@/modules/organiser/shared/selfServeApi', async () => {
  const actual = await vi.importActual<typeof import('@/modules/organiser/shared/selfServeApi')>('@/modules/organiser/shared/selfServeApi');
  return {
    ...actual,
    fetchMyAccessRequests: h.mine,
    searchClaimableOrganisers: h.search,
    claimOrganiser: h.claim,
    requestOrganiserAccess: h.request,
    createOrganiserProfile: h.create,
  };
});

import AddPageScreen from '../AddPageScreen';
import { HomeScreen } from '../../screens/HomeScreen';
import { P3_PATHS } from '../../shell/paths';
import { P3_SURFACE } from '../surface';
import { OrgSurfaceProvider } from '../../../shell/surface';

const page = (id: string) => ({ id, name: `Page ${id}`, series: [], role: 'owner' });
const req = (status: 'open' | 'declined') => ({
  requestId: `r-${status}`, organiserId: `o-${status}`, organiserName: `Org ${status}`, status,
  createdAt: '2026-10-20T10:00:00Z', resolvedAt: status === 'declined' ? '2026-10-21T10:00:00Z' : null,
});

type Shape = { name: string; organisers: unknown[]; requests: unknown[]; title: string; back: boolean };
const SHAPES: Shape[] = [
  { name: 'brand new (28 of 42)', organisers: [], requests: [], title: 'Welcome', back: false },
  { name: 'open request (2)', organisers: [], requests: [req('open')], title: 'Welcome', back: false },
  { name: 'declined request', organisers: [], requests: [req('declined')], title: 'Welcome', back: false },
  { name: 'one page already (Add a page)', organisers: [page('a')], requests: [], title: 'Add a page', back: true },
];

function mount(path: string = P3_PATHS.youAdd, state?: unknown) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  render(
    <QueryClientProvider client={client}>
      <MemoryRouter initialEntries={[{ pathname: path, state }]}>
        <div className="p3-theme" data-testid="frame">
          <Routes>
            <Route path={P3_PATHS.home} element={<HomeScreen />} />
            <Route path={P3_PATHS.youAdd} element={<OrgSurfaceProvider value={P3_SURFACE}><AddPageScreen /></OrgSurfaceProvider>} />
          </Routes>
        </div>
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

beforeEach(() => {
  [h.mine, h.search, h.claim, h.request, h.create, h.home.refetch].forEach((f) => f.mockReset());
  h.home = { ...h.home, isPending: false, isError: false, data: { today: '2026-10-28', organisers: [] } };
});
afterEach(cleanup);

describe.each(SHAPES)('Welcome / Add a page, shape: $name', (shape) => {
  beforeEach(() => {
    h.home = { ...h.home, data: { today: '2026-10-28', organisers: shape.organisers } };
    h.mine.mockResolvedValue(shape.requests);
  });

  it('title, way back, and every control the copy names is on screen', async () => {
    mount();
    expect(screen.getByRole('heading', { level: 1 }).textContent).toBe(shape.title);
    expect(!!screen.queryByTestId('org-back')).toBe(shape.back);
    const view = screen.getByTestId('org-onboarding');
    expect(view.getAttribute('data-look')).toBe('p3');
    expect(view.className).toContain('p3-onb');
    // Search first, then Create (option A, today's order).
    const search = screen.getByTestId('onboarding-search');
    const create = screen.getByTestId('onboarding-create');
    expect(search.compareDocumentPosition(create) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(view.textContent).toContain(shape.title === 'Welcome' ? 'Find your page' : 'Add another page');
    // Steps and Browse only on a first run.
    expect(!!screen.queryByTestId('onboarding-browse')).toBe(shape.title === 'Welcome');
    if (shape.requests.length) {
      const card = await screen.findByTestId(shape.requests[0] && (shape.requests[0] as { status: string }).status === 'open' ? 'onboarding-pending' : 'onboarding-declined');
      // "search for it above" points at the search box, which is above the card.
      if (card.textContent?.includes('search for it above')) {
        expect(search.compareDocumentPosition(card) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
      }
    }
    // Never "Message us" on a normal shape (owner rule: unfinished profiles get Finish profile).
    expect(view.textContent).not.toMatch(/message us/i);
  });

  it('opening and closing a sheet sends nothing; the sheet is portalled, in P3 theme, page not scrolled', async () => {
    mount();
    const scrollBefore = window.scrollY;
    fireEvent.click(screen.getByTestId('onboarding-create'));
    const sheet = await screen.findByTestId('onboarding-sheet');
    expect(screen.getByTestId('frame').contains(sheet)).toBe(false);
    expect(sheet.className).toContain('p3-theme');
    expect(sheet.className).not.toContain('org-theme');
    expect(window.scrollY).toBe(scrollBefore);
    fireEvent.click(within(sheet).getByTestId('onboarding-sheet-close'));
    expect(h.create).not.toHaveBeenCalled();
    expect(h.claim).not.toHaveBeenCalled();
    expect(h.request).not.toHaveBeenCalled();
  });
});

describe('Welcome read states', () => {
  it('loading says so', () => {
    h.home = { ...h.home, isPending: true, data: undefined as never };
    mount();
    expect(screen.getByTestId('p3-add-page-loading')).toBeTruthy();
  });
  it('failed says what to do and retries', () => {
    h.home = { ...h.home, isError: true, data: undefined as never };
    mount();
    fireEvent.click(within(screen.getByTestId('p3-add-page-error')).getByText('Try again'));
    expect(h.home.refetch).toHaveBeenCalled();
  });
});

describe('P3 Home', () => {
  it('no page yet: Home is the Welcome', async () => {
    h.mine.mockResolvedValue([]);
    mount(P3_PATHS.home);
    expect((await screen.findByRole('heading', { level: 1 })).textContent).toBe('Welcome');
  });
  it('a claim landing on Home shows its confirmation once, in-flow', () => {
    h.home = { ...h.home, data: { today: '2026-10-28', organisers: [page('a')] } };
    mount(P3_PATHS.home, { confirmation: 'Page a is yours. You can now manage it.' });
    const line = screen.getByTestId('p3-home-confirmation');
    expect(line.textContent).toBe('Page a is yours. You can now manage it.');
    expect(line.getAttribute('role')).toBe('status');
  });
  it('a claim landing before the home read refetched waits, never bounces back to Welcome', () => {
    h.home = { ...h.home, isFetching: true, data: { today: '2026-10-28', organisers: [] } } as typeof h.home;
    mount(P3_PATHS.home, { confirmation: 'Page a is yours. You can now manage it.' });
    expect(screen.getByTestId('p3-home-loading')).toBeTruthy();
    expect(screen.queryByTestId('p3-add-page')).toBeNull();
  });
  it('no confirmation without one', () => {
    h.home = { ...h.home, data: { today: '2026-10-28', organisers: [page('a')] } };
    mount(P3_PATHS.home);
    expect(screen.queryByTestId('p3-home-confirmation')).toBeNull();
  });
});
