// @vitest-environment jsdom
/** More (C29), Help (C41), roles x support x the one Leave rule (plan 4.5 Consistency, S7). */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom';

const api = vi.hoisted(() => ({ home: vi.fn(), entity: vi.fn(), remove: vi.fn(), support: vi.fn(), rpc: vi.fn() }));
vi.mock('@/integrations/supabase/client', () => ({ supabase: { auth: {}, rpc: api.rpc } }));
vi.mock('@/hooks/useAuth', () => ({ useAuth: () => ({ user: { id: 'u1', email: 'me@x.example' }, signOut: vi.fn() }) }));
vi.mock('@/modules/organiser/shared/support', () => ({ supportLinks: api.support }));
vi.mock('@/modules/organiser/shared/selfServeApi', async () => ({
  ...(await vi.importActual<object>('@/modules/organiser/shared/selfServeApi')),
  fetchOrganiserHome: api.home,
  removeOrganiserMember: api.remove,
}));
vi.mock('@/modules/profile/organiserPublicProfile', async () => ({
  ...(await vi.importActual<object>('@/modules/profile/organiserPublicProfile')),
  fetchOwnOrganiserEntity: api.entity,
}));

import MorePage from '../index';
import HelpPage from '../help';
import { HELP_ROWS } from '../help/helpRows';
import { ORG_PATHS } from '../../shell/paths';

const ORG = (role: 'owner' | 'manager') => ({ id: 'org-1', name: 'Ritmo', slug: 'ritmo', avatar_url: null, city_id: 'c1', lifecycle_status: 'live', role, latest_decision: null, series: [] });
const ENTITY = { id: 'org-1', name: 'Ritmo', avatar_url: null, bio: null, socials: null, city_id: 'c1', instagram: null, website: null, organisation_category: null, founded_year: null, cities: { name: 'Leeds', slug: 'leeds' } };

function Where() {
  const l = useLocation();
  return <p data-testid="where" data-state={JSON.stringify(l.state ?? null)}>{l.pathname}{l.search}</p>;
}

function mount(path = ORG_PATHS.more) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={client}>
      <MemoryRouter initialEntries={[path]}>
        <Routes>
          <Route path={ORG_PATHS.more} element={<MorePage />} />
          <Route path={ORG_PATHS.help} element={<HelpPage />} />
          <Route path="*" element={<Where />} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

beforeEach(() => {
  window.localStorage.clear();
  api.home.mockReset();
  api.entity.mockReset().mockResolvedValue(ENTITY);
  api.remove.mockReset().mockResolvedValue({ userId: 'u1', memberRole: 'manager', selfRemoved: true, removedRows: 1 });
  api.support.mockReset().mockReturnValue({ whatsapp: null, email: null });
  api.rpc.mockReset().mockResolvedValue({ data: null, error: { message: 'not mocked' } });
});
afterEach(cleanup);

const tap = (el: HTMLElement) => el.className;
const homeAs = (role: 'owner' | 'manager') => api.home.mockResolvedValue({ today: '2026-10-07', organisers: [ORG(role)] });

describe('roles x Leave / Hand over', () => {
  it('owner: Hand over present and linked; Leave aria-disabled with the visible reason and sends nothing', async () => {
    homeAs('owner');
    mount();
    const leave = await screen.findByTestId('more-leave');
    expect(leave.getAttribute('aria-disabled')).toBe('true');
    const reason = screen.getByTestId('more-leave-reason');
    expect(reason.textContent).toBe('Hand over first');
    expect(leave.getAttribute('aria-describedby')).toBe(reason.id);
    fireEvent.click(leave);
    expect(screen.queryByTestId('more-leave-sheet')).toBeNull();
    expect(api.remove).not.toHaveBeenCalled();
    expect(screen.getByTestId('more-hand-over').getAttribute('href')).toBe(ORG_PATHS.handover);
  });

  it('manager: Hand over absent; Leave enabled, confirms, sends ONE remove for themself and lands on Done', async () => {
    homeAs('manager');
    mount();
    const leave = await screen.findByTestId('more-leave');
    expect(leave.getAttribute('aria-disabled')).toBeNull();
    expect(screen.queryByTestId('more-hand-over')).toBeNull();
    expect(screen.queryByTestId('more-leave-reason')).toBeNull();
    fireEvent.click(leave);
    expect(api.remove).not.toHaveBeenCalled();
    fireEvent.click(await screen.findByTestId('more-leave-yes'));
    await waitFor(() => expect(api.remove).toHaveBeenCalledTimes(1));
    expect(api.remove).toHaveBeenCalledWith('org-1', 'u1');
    const where = await screen.findByTestId('where');
    expect(where.textContent).toBe(ORG_PATHS.done);
    expect(JSON.parse(where.getAttribute('data-state')!)).toMatchObject({ message: 'You left Ritmo' });
  });
});

describe('support rows follow the env (D7)', () => {
  it('absent: no support rows at all', async () => {
    homeAs('owner');
    mount();
    await screen.findByTestId('more-help');
    expect(screen.queryByTestId('more-support-whatsapp')).toBeNull();
    expect(screen.queryByTestId('more-support-email')).toBeNull();
  });

  it('set: each row links to its value', async () => {
    api.support.mockReturnValue({ whatsapp: 'https://wa.me/447700900123', email: 'help@x.example' });
    homeAs('manager');
    mount();
    expect((await screen.findByTestId('more-support-whatsapp')).getAttribute('href')).toBe('https://wa.me/447700900123');
    expect(screen.getByTestId('more-support-email').getAttribute('href')).toBe('mailto:help@x.example');
  });
});

describe('every row names a control that exists', () => {
  it.each(['owner', 'manager'] as const)('%s: links, 44px+ targets, no tab / swipe / menu copy', async (role) => {
    homeAs(role);
    const { container } = mount();
    await screen.findByTestId('more-help');
    expect(screen.getByTestId('more-add-page').getAttribute('href')).toBe(`${ORG_PATHS.home}?add=1`);
    expect(screen.getByTestId('more-help').getAttribute('href')).toBe(ORG_PATHS.help);
    expect(screen.getByTestId('more-account-settings').getAttribute('href')).toBe('/account/settings');
    expect(screen.getByTestId('more-privacy').getAttribute('href')).toBe('/privacy');
    expect(screen.getByTestId('more-terms').getAttribute('href')).toBe('/terms');
    expect(container.textContent ?? '').not.toMatch(/\b(tab|swipe|menu)\b/i);
    for (const el of container.querySelectorAll<HTMLElement>('a, button')) {
      if (el.closest('[data-eip-layer], [data-testid="more-contact"]')) continue;
      expect(tap(el)).toMatch(/\b(min-)?h-\[(4[4-9]|5\d)px\]/);
    }
  });

  it('Add a page is for every login: never disabled', async () => {
    homeAs('owner');
    mount();
    const add = await screen.findByTestId('more-add-page');
    expect(add.getAttribute('aria-disabled')).toBeNull();
    expect(add.tagName).toBe('A');
  });
});

describe('Help (C41)', () => {
  it('is a short list of job names, each a link into its flow, with no paragraphs', async () => {
    homeAs('owner');
    const { container } = mount(ORG_PATHS.help);
    for (const row of HELP_ROWS) {
      const a = await screen.findByTestId(`help-${row.id}`);
      expect(a.getAttribute('href')).toBe(row.to);
      expect(a.className).toMatch(/min-h-\[52px\]/);
    }
    expect(container.querySelectorAll('p')).toHaveLength(0);
  });
});
