// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import type { ReactNode } from 'react';

vi.mock('@/components/auth/AuthGuard', () => ({ AuthGuard: ({ children }: { children: ReactNode }) => <>{children}</> }));
vi.mock('@/hooks/useNoindexMeta', () => ({ useNoindexMeta: () => undefined }));
// The W1 screens read data (their own matrix: screens/__tests__); here they are stand-ins so the frame is tested alone.
vi.mock('../../screens/HomeScreen', () => ({ HomeScreen: () => <div data-testid="p3-screen-home" /> }));
vi.mock('../../screens/EventsScreen', () => ({ EventsScreen: () => <div data-testid="p3-screen-events" /> }));
vi.mock('../../screens/StatsScreen', () => ({ StatsScreen: () => <div data-testid="p3-screen-stats" /> }));
vi.mock('../../you/YouScreen', () => ({ YouScreen: () => <div data-testid="p3-screen-you" /> }));
// A pushed screen (W4a): draws the frame the surface gives it, as the real Team screen does.
vi.mock('../../../team', async () => {
  const { useOrgSurface } = await import('../../../shell/surface');
  return { default: function Team() { const { Shell, hub } = useOrgSurface(); return <Shell title="Team" back={hub}><div data-testid="p3-screen-team" /></Shell>; } };
});

import P3Routes from '../P3Routes';
import { P3_BASE, P3_PATHS, P3_TABS } from '../paths';

afterEach(cleanup);

function at(entry: string) {
  return render(
    <MemoryRouter initialEntries={[entry]}>
      <Routes>
        <Route path={`${P3_BASE}/*`} element={<P3Routes />} />
      </Routes>
    </MemoryRouter>,
  );
}

describe('P3 shell: Home / Events / Stats / You (C3 tab bar)', () => {
  it.each(P3_TABS.map((t) => [t, P3_PATHS[t]] as const))('%s at %s: its screen, its title, its tab current', async (tab, path) => {
    at(path);
    // You is a lazy chunk (P3Routes): wait for it to arrive.
    expect(await screen.findByTestId(`p3-screen-${tab}`)).toBeTruthy();
    const nav = screen.getByRole('navigation', { name: 'Main' });
    const links = [...nav.querySelectorAll('a')];
    expect(links.map((a) => a.textContent)).toEqual(['Home', 'Events', 'Stats', 'You']);
    expect(links.filter((a) => a.getAttribute('aria-current') === 'page').map((a) => a.dataset.tab)).toEqual([tab]);
    expect(screen.getByRole('heading', { level: 1 }).textContent).toBe(links.find((a) => a.dataset.tab === tab)!.textContent);
  });

  it('every tab links inside the P3 area', () => {
    at(P3_BASE);
    for (const a of screen.getByRole('navigation', { name: 'Main' }).querySelectorAll('a')) {
      expect(a.getAttribute('href')!.startsWith(P3_BASE)).toBe(true);
    }
  });

  it('an unknown P3 path lands on Home', () => {
    at(`${P3_BASE}/nope`);
    expect(screen.getByTestId('p3-screen-home')).toBeTruthy();
  });

  it('the frame carries the P3 theme', () => {
    at(P3_PATHS.you);
    expect(screen.getByTestId('p3-shell').className).toContain('p3-theme');
  });

  it('a screen You pushes draws ONE top bar: its title and the way back to You; the You tab stays current', async () => {
    at(P3_PATHS.youTeam);
    // The pushed screens are lazy chunks (P3Routes): wait for this one to arrive.
    expect(await screen.findByTestId('p3-screen-team')).toBeTruthy();
    expect(screen.getAllByRole('heading', { level: 1 }).map((h) => h.textContent)).toEqual(['Team']);
    expect(screen.getByTestId('org-back').getAttribute('href')).toBe(P3_PATHS.you);
    expect(screen.getByTestId('org-back').textContent).toContain('You');
    const nav = screen.getByRole('navigation', { name: 'Main' });
    expect([...nav.querySelectorAll('a')].filter((a) => a.getAttribute('aria-current') === 'page').map((a) => a.dataset.tab)).toEqual(['you']);
  });
});
