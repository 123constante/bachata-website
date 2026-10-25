// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import type { ReactNode } from 'react';

vi.mock('@/components/auth/AuthGuard', () => ({ AuthGuard: ({ children }: { children: ReactNode }) => <>{children}</> }));
vi.mock('@/hooks/useNoindexMeta', () => ({ useNoindexMeta: () => undefined }));

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
  it.each(P3_TABS.map((t) => [t, P3_PATHS[t]] as const))('%s at %s: its placeholder, its title, its tab current', (tab, path) => {
    at(path);
    expect(screen.getByTestId(`p3-placeholder-${tab}`)).toBeTruthy();
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
    expect(screen.getByTestId('p3-placeholder-home')).toBeTruthy();
  });

  it('the frame carries the P3 theme and reads no data (placeholders only)', () => {
    at(P3_BASE);
    const shell = screen.getByTestId('p3-shell');
    expect(shell.className).toContain('p3-theme');
    expect(shell.textContent).toContain('Coming soon');
  });
});
