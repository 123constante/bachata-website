// @vitest-environment jsdom
/** S1 Switch page (C35): the login's pages as rows (name, role, Live chip); tap = choose, back = Home. */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom';

const rpc = vi.hoisted(() => vi.fn());
vi.mock('@/integrations/supabase/client', () => ({ supabase: { auth: {}, rpc, from: vi.fn() } }));
vi.mock('@/hooks/useAuth', () => ({ useAuth: () => ({ user: { id: 'u1', email: 'me@x.example' }, session: null }) }));

import { ORG_PATHS } from '@/modules/organiser/shell/paths';
import SwitchPage from '../index';

const org = (id: string, name: string, role: 'owner' | 'manager', lifecycle_status = 'live') => ({
  id, name, slug: null, avatar_url: null, city_id: null, lifecycle_status, role, latest_decision: null, series: [], team: [],
});

beforeEach(() => {
  rpc.mockReset();
  rpc.mockImplementation(async (fn: string) => {
    if (fn === 'organiser_home_v1') {
      return { data: { today: '2026-10-20', organisers: [org('a', 'Ritmo', 'owner'), org('b', 'Latino Nights', 'manager', 'draft')] }, error: null };
    }
    return { data: null, error: { message: `unexpected ${fn}` } };
  });
  try { window.localStorage.clear(); } catch { /* none */ }
});
afterEach(cleanup);

function Where() {
  const loc = useLocation();
  return <p data-testid="where">{loc.pathname}{loc.search}</p>;
}
function mount() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={client}>
      <MemoryRouter initialEntries={[ORG_PATHS.switch]}>
        <Routes>
          <Route path={ORG_PATHS.switch} element={<SwitchPage />} />
          <Route path="*" element={<Where />} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

describe('Switch page (C35)', () => {
  it('lists each page with its role and a Live chip only when live; back goes Home', async () => {
    mount();
    await waitFor(() => expect(screen.getAllByTestId('switch-row')).toHaveLength(2));
    const [a, b] = screen.getAllByTestId('switch-row');
    expect(a.tagName).toBe('BUTTON');
    expect(a.textContent).toContain('Ritmo');
    expect(a.textContent).toContain('Owner');
    expect(a.textContent).toContain('Live');
    expect(b.textContent).toContain('Latino Nights');
    expect(b.textContent).toContain('Manager');
    expect(b.textContent).not.toContain('Live');
    expect(screen.getByTestId('org-back').getAttribute('href')).toBe(ORG_PATHS.home);
  });

  it('tap = choose: Home opens on that page', async () => {
    mount();
    await waitFor(() => expect(screen.getAllByTestId('switch-row')).toHaveLength(2));
    fireEvent.click(screen.getAllByTestId('switch-row')[1]);
    expect(screen.getByTestId('where').textContent).toBe(`${ORG_PATHS.home}?o=b`);
  });
});
