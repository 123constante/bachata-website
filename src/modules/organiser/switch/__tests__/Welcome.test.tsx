// @vitest-environment jsdom
/**
 * Arc 1 flows 1d and 7c: an accepted invite to the FIRST page says "You manage
 * X" and offers its first event (1d); to a SECOND page it says "You now manage
 * X. You also manage Y." (7c). Table-driven: pages on the login x the page joined.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { home } from '../../events/__tests__/fixtures';

const rpc = vi.hoisted(() => vi.fn());
vi.mock('@/integrations/supabase/client', () => ({ supabase: { rpc, from: vi.fn(), storage: { from: vi.fn() } } }));
vi.mock('@/hooks/useAuth', () => ({ useAuth: () => ({ user: { id: 'u1' } }) }));

import WelcomePage from '../Welcome';
import { joinedWelcome, namesList } from '../welcomeModel';
import { ORG_PATHS } from '../../shell/paths';

const page = (id: string, name: string) => ({ ...home().organisers[0], id, name });
let pages = [page('org1', 'Salsa Norte')];

beforeEach(() => {
  window.localStorage.clear();
  rpc.mockReset();
  rpc.mockImplementation(async (fn: string) =>
    fn === 'organiser_home_v1' ? { data: { ...home(), organisers: pages }, error: null } : { data: null, error: { message: 'unexpected ' + fn } });
});
afterEach(cleanup);

function Where() {
  const l = useLocation();
  return <span data-testid="where">{l.pathname + l.search}</span>;
}

function mount(joinedId: string) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  render(
    <QueryClientProvider client={client}>
      <MemoryRouter initialEntries={[ORG_PATHS.welcome(joinedId)]}>
        <Routes>
          <Route path={`${ORG_PATHS.home}/welcome`} element={<WelcomePage />} />
          <Route path={ORG_PATHS.home} element={<span data-testid="at-home" />} />
          <Route path={ORG_PATHS.newWhat} element={<span data-testid="at-new" />} />
        </Routes>
        <Where />
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

describe('joinedWelcome', () => {
  it.each([
    ['Bachata Club', [], { screen: '1d', title: 'You manage Bachata Club', sub: 'Add your first event whenever you are ready.' }],
    ['Bachata Club', ['Salsa Norte'], { screen: '7c', title: 'You now manage Bachata Club', sub: 'You also manage Salsa Norte. Switch any time from Home.' }],
    ['C', ['A', 'B'], { screen: '7c', title: 'You now manage C', sub: 'You also manage A and B. Switch any time from Home.' }],
    ['D', ['A', 'B', 'C'], { screen: '7c', title: 'You now manage D', sub: 'You also manage A, B and C. Switch any time from Home.' }],
  ] as const)('%s with %j', (name, others, expected) => {
    expect(joinedWelcome(name, [...others])).toEqual(expected);
  });

  it('names lists', () => {
    expect(namesList([])).toBe('');
    expect(namesList(['A'])).toBe('A');
    expect(namesList(['A', 'B'])).toBe('A and B');
  });
});

describe('/account/o/welcome', () => {
  it('second page: the welcome variant, then Home on that page', async () => {
    pages = [page('org1', 'Salsa Norte'), page('org2', 'Bachata Club')];
    mount('org2');
    expect((await screen.findByTestId('org-welcome-title')).textContent).toBe('You now manage Bachata Club');
    expect(screen.getByTestId('org-welcome-sub').textContent).toBe('You also manage Salsa Norte. Switch any time from Home.');
    fireEvent.click(screen.getByTestId('org-welcome-home'));
    expect(await screen.findByTestId('at-home')).toBeTruthy();
    expect(screen.getByTestId('where').textContent).toBe(`${ORG_PATHS.home}?o=org2`);
  });

  it('first page (1d): You manage X, Look around first goes to Home on it', async () => {
    pages = [page('org1', 'Salsa Norte')];
    mount('org1');
    expect((await screen.findByTestId('org-welcome-title')).textContent).toBe('You manage Salsa Norte');
    expect(screen.getByTestId('org-welcome-sub').textContent).toBe('Add your first event whenever you are ready.');
    expect(screen.getByTestId('org-welcome-add-event').textContent).toBe('Add an event');
    expect(screen.getByTestId('org-welcome-home').textContent).toBe('Look around first');
    fireEvent.click(screen.getByTestId('org-welcome-home'));
    expect(await screen.findByTestId('at-home')).toBeTruthy();
    expect(screen.getByTestId('where').textContent).toBe(`${ORG_PATHS.home}?o=org1`);
  });

  it('first page (1d): Add an event opens New event on that page', async () => {
    pages = [page('org1', 'Salsa Norte')];
    mount('org1');
    fireEvent.click(await screen.findByTestId('org-welcome-add-event'));
    expect(await screen.findByTestId('at-new')).toBeTruthy();
    expect(screen.getByTestId('where').textContent).toBe(ORG_PATHS.newWhatFor('org1'));
  });

  it('second page (7c) offers no Add an event (one primary, Go to Home)', async () => {
    pages = [page('org1', 'Salsa Norte'), page('org2', 'Bachata Club')];
    mount('org2');
    await screen.findByTestId('org-welcome-title');
    expect(screen.queryByTestId('org-welcome-add-event')).toBeNull();
    expect(screen.getByTestId('org-welcome-home').textContent).toBe('Go to Home');
  });

  it('a page not (yet) on the login: Home, never a welcome naming nothing', async () => {
    pages = [page('org1', 'Salsa Norte'), page('org2', 'Bachata Club')];
    mount('org9');
    expect(await screen.findByTestId('at-home')).toBeTruthy();
    expect(screen.getByTestId('where').textContent).toBe(ORG_PATHS.home);
  });

  it('Home did not load: Go to Home still works (no dead end)', async () => {
    rpc.mockImplementation(async () => ({ data: null, error: { message: 'boom' } }));
    mount('org2');
    expect((await screen.findByTestId('org-welcome-sub')).textContent).toBe('You joined the team. Your pages are on Home.');
    fireEvent.click(screen.getByTestId('org-welcome-home'));
    expect(await screen.findByTestId('at-home')).toBeTruthy();
  });
});
