// @vitest-environment jsdom
/**
 * The /account page shells' non-happy states: offline (a PAUSED first read is
 * not "no organisers"), load failure, refusal and empty, each with a page h1
 * and a way on.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider, onlineManager } from '@tanstack/react-query';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import type { ReactNode } from 'react';

const api = vi.hoisted(() => ({ home: vi.fn(), mine: vi.fn(), incoming: vi.fn(), workspace: vi.fn() }));
vi.mock('@/integrations/supabase/client', () => ({ supabase: { auth: {} } }));
vi.mock('@/hooks/useAuth', () => ({
  useAuth: () => ({ user: { id: 'u1', email: 'me@x.example' }, session: null, signOut: vi.fn() }),
}));
vi.mock('@/components/auth/AuthGuard', () => ({ AuthGuard: ({ children }: { children: ReactNode }) => <>{children}</> }));
vi.mock('@/components/layout/GlobalLayout', () => ({ default: ({ children }: { children: ReactNode }) => <main>{children}</main> }));
vi.mock('@/hooks/useNoindexMeta', () => ({ useNoindexMeta: () => undefined }));
vi.mock('@/modules/organiser-self-serve/components/OrganiserOnboarding', () => ({ OrganiserOnboarding: () => <div data-testid="onboarding" /> }));
vi.mock('@/modules/organiser-self-serve/components/OrganiserHome', () => ({ OrganiserHome: () => <div data-testid="organiser-home" /> }));
vi.mock('@/modules/organiser-self-serve/components/CreateEventForm', () => ({ CreateEventForm: () => <div data-testid="create-form" /> }));
vi.mock('@/modules/organiser-self-serve/components/SeriesEditor', () => ({ SeriesEditor: () => <div data-testid="series-editor" /> }));
vi.mock('@/modules/organiser-self-serve/components/TeamPanel', () => ({ TeamPanel: () => <div data-testid="team-panel" /> }));
vi.mock('@/modules/organiser-self-serve/selfServeApi', async () => ({
  ...(await vi.importActual<object>('@/modules/organiser-self-serve/selfServeApi')),
  fetchOrganiserHome: api.home,
  fetchMyAccessRequests: api.mine,
  fetchIncomingAccessRequests: api.incoming,
  fetchSeriesWorkspace: api.workspace,
}));

import Account from '../Account';
import AccountNew from '../AccountNew';
import AccountTeam from '../AccountTeam';
import AccountSeries from '../AccountSeries';

const ORG = { id: 'org-1', name: 'Ritmo', slug: 'ritmo', avatar_url: null, city_id: null, lifecycle_status: 'live', role: 'owner', latest_decision: null, series: [], team: [] };

function mount(path: string) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={client}>
      <MemoryRouter initialEntries={[path]}>
        <Routes>
          <Route path="/account" element={<Account />} />
          <Route path="/account/new" element={<AccountNew />} />
          <Route path="/account/team/:organiserId?" element={<AccountTeam />} />
          <Route path="/account/series/:seriesId" element={<AccountSeries />} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

const h1 = () => screen.getByRole('heading', { level: 1 });

beforeEach(() => {
  Object.values(api).forEach((fn) => fn.mockReset());
  api.home.mockResolvedValue({ today: '2026-10-07', organisers: [] });
  api.mine.mockResolvedValue([]);
  api.incoming.mockResolvedValue([]);
});
afterEach(() => {
  cleanup();
  onlineManager.setOnline(true);
});

describe('offline before the first answer', () => {
  beforeEach(() => onlineManager.setOnline(false));

  it('/account says offline and never offers onboarding, then loads when back online', async () => {
    mount('/account');
    expect((await screen.findByTestId('page-offline')).textContent).toContain('You\u2019re offline');
    expect(screen.queryByTestId('onboarding')).toBeNull();
    expect(screen.queryByTestId('account-browse-events')).toBeNull();
    expect(api.home).not.toHaveBeenCalled();
    onlineManager.setOnline(true);
    expect(await screen.findByTestId('onboarding')).toBeTruthy();
    expect(screen.queryByTestId('page-offline')).toBeNull();
  });

  it('/account/new does not tell an offline organiser to set one up', async () => {
    mount('/account/new');
    expect(await screen.findByTestId('page-offline')).toBeTruthy();
    expect(screen.queryByTestId('create-no-organiser')).toBeNull();
  });

  it('/account/team does not call the team "not yours" offline, and keeps a page h1', async () => {
    mount('/account/team/org-1');
    expect(await screen.findByTestId('page-offline')).toBeTruthy();
    expect(screen.queryByTestId('team-unavailable')).toBeNull();
    expect(screen.queryByTestId('team-no-organiser')).toBeNull();
    expect(h1().textContent).toContain('You\u2019re offline');
  });

  it('/account/series says offline, not "could not load"', async () => {
    mount('/account/series/ser-1');
    expect(await screen.findByTestId('page-offline')).toBeTruthy();
    expect(screen.queryByTestId('page-load-error')).toBeNull();
  });
});

describe('loading', () => {
  it('announces what is loading', async () => {
    api.home.mockReturnValue(new Promise(() => {}));
    mount('/account/team/org-1');
    expect((await screen.findByTestId('page-loading')).textContent).toContain('Loading your team');
    expect(screen.getByTestId('page-loading').getAttribute('role')).toBe('status');
  });
});

describe('load failure', () => {
  it('says what happened and what to do, with Try again that re-reads', async () => {
    api.home.mockRejectedValueOnce(new Error('boom'));
    mount('/account/new');
    const box = await screen.findByTestId('page-load-error');
    expect(box.textContent).toContain('We couldn\u2019t load your organisers.');
    expect(box.textContent).toContain('Check your connection, then try again.');
    fireEvent.click(screen.getByRole('button', { name: 'Try again' }));
    expect(await screen.findByTestId('create-no-organiser')).toBeTruthy();
    expect(api.home).toHaveBeenCalledTimes(2);
  });

  it('the series page keeps an h1 when the read fails (after its own two retries)', async () => {
    api.workspace.mockRejectedValue(new Error('boom'));
    mount('/account/series/ser-1');
    await screen.findByTestId('page-load-error', undefined, { timeout: 6000 });
    expect(h1().textContent).toContain('We couldn\u2019t load this event.');
  });
});

describe('refused and empty', () => {
  it("another organiser's series: an h1 and a way back to the account", async () => {
    api.workspace.mockRejectedValue(new Error('permission_denied: not a member'));
    mount('/account/series/ser-1');
    const box = await screen.findByTestId('series-unavailable');
    expect(h1().textContent).toContain('You can\u2019t edit this event.');
    expect(box.querySelector('a')?.getAttribute('href')).toBe('/account');
  });

  it('a team page with no organiser says so and points to setting one up', async () => {
    mount('/account/team');
    const box = await screen.findByTestId('team-no-organiser');
    expect(h1().textContent).toContain('You don\u2019t run an organiser yet.');
    expect(box.textContent).toContain('Claim yours or create one');
    expect(screen.queryByTestId('team-unavailable')).toBeNull();
  });

  it("a team that is not the caller's keeps the refusal, with an h1", async () => {
    api.home.mockResolvedValue({ today: '2026-10-07', organisers: [ORG] });
    mount('/account/team/org-zzz');
    await screen.findByTestId('team-unavailable');
    expect(h1().textContent).toContain('This team isn\u2019t yours to see.');
  });

  it('back links name where they go, as the breadcrumb does', async () => {
    mount('/account/new');
    await screen.findByTestId('create-no-organiser');
    expect(screen.getAllByRole('link', { name: 'Your account' })[0].getAttribute('href')).toBe('/account');
  });
});

describe('account links', () => {
  it('the team link and "Add another organiser" sit in one wrapping row, not run together', async () => {
    api.home.mockResolvedValue({ today: '2026-10-07', organisers: [ORG] });
    mount('/account');
    const row = await screen.findByTestId('account-links');
    expect(row.className).toContain('flex-wrap');
    expect(row.querySelector('[data-testid="team-link"]')).toBeTruthy();
    expect(row.querySelector('[data-testid="add-another-organiser"]')).toBeTruthy();
    fireEvent.click(screen.getByTestId('add-another-organiser'));
    expect(screen.getByTestId('onboarding')).toBeTruthy();
    expect(screen.queryByTestId('add-another-organiser')).toBeNull();
  });
});
