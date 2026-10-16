// @vitest-environment jsdom
/**
 * H2 (owner decision 2026-10-16, sign-up FOCUS MODE): from "Create account"
 * through email, code and the /auth/callback hand-over, the site draws only the
 * logo and a small "Not now" -- no header links, no section row, no footer.
 * Sign-in of an existing account keeps the normal site chrome.
 * Reads the shared mapping (lib/focusMode); no second copy of the path list.
 */
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';

vi.mock('@/hooks/useAuth', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/hooks/useAuth')>()),
  useAuth: () => ({ user: null }),
}));
vi.mock('@/components/GlobalHeader', () => ({ GlobalHeader: () => <header data-testid="site-header" /> }));
vi.mock('@/components/BottomNav', () => ({ BottomNav: () => <nav data-testid="site-bottom-nav" /> }));
vi.mock('@/components/layout/GlobalFooter', () => ({ GlobalFooter: () => <footer data-testid="site-footer" /> }));
vi.mock('@/components/GlobalBackground', () => ({ GlobalBackground: () => null }));

import { AppChrome } from '@/components/AppChrome';

afterEach(cleanup);

const renderAt = (path: string) =>
  render(
    <MemoryRouter initialEntries={[path]}>
      <AppChrome>
        <div data-testid="page" />
      </AppChrome>
    </MemoryRouter>,
  );

describe('sign-up focus mode chrome', () => {
  it.each([
    ['/auth?mode=signup', '/'],
    ['/auth', '/'],
    ['/auth?mode=signup&returnTo=%2Fevent%2Fabc', '/event/abc'],
    ['/auth/callback?mode=signup&returnTo=%2Fevent%2Fabc', '/event/abc'],
  ])('%s: logo + "Not now" (-> %s) only', (path, notNow) => {
    renderAt(path);
    expect(screen.getByTestId('page')).toBeTruthy();
    expect(screen.queryByTestId('site-header')).toBeNull();
    expect(screen.queryByTestId('site-bottom-nav')).toBeNull();
    expect(screen.queryByTestId('site-footer')).toBeNull();
    const header = screen.getByTestId('focus-header');
    const links = header.querySelectorAll('a');
    expect(links).toHaveLength(1); // one exit, the logo is not a second one
    expect(links[0].textContent).toBe('Not now');
    expect(links[0].getAttribute('href')).toBe(notNow);
    expect(screen.getByAltText('Bachata Calendar')).toBeTruthy();
  });

  it.each(['/auth?mode=signin', '/auth?mode=signin&returnTo=%2Fevent%2Fabc', '/auth/callback?mode=signin', '/city/london', '/event/abc'])(
    '%s: normal site chrome, no focus bar',
    (path) => {
      renderAt(path);
      expect(screen.getByTestId('site-header')).toBeTruthy();
      expect(screen.getByTestId('site-bottom-nav')).toBeTruthy();
      expect(screen.queryByTestId('focus-header')).toBeNull();
    },
  );
});
