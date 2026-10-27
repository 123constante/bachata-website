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
  it.each(P3_TABS.map((t) => [t, P3_PATHS[t]] as const))('%s at %s: its screen, its title, its tab current', (tab, path) => {
    at(path);
    expect(screen.getByTestId(tab === 'you' ? 'p3-placeholder-you' : `p3-screen-${tab}`)).toBeTruthy();
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

  it('the frame carries the P3 theme; You is still a placeholder', () => {
    at(P3_PATHS.you);
    const shell = screen.getByTestId('p3-shell');
    expect(shell.className).toContain('p3-theme');
    expect(shell.textContent).toContain('Coming soon');
  });
});
