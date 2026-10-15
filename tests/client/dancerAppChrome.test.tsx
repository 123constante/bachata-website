// @vitest-environment jsdom
/**
 * Seams 2 and 3: on /app/* the site's header, bottom nav, footer and their
 * spacers are gone (the dancer shell draws its own), while
 * ProfileCompletionChrome stays mounted for a signed-in person (it publishes
 * ProfileGateContext); everywhere else the chrome is exactly as before. And the
 * "Finish your profile" banner never draws on /app.
 */
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';

const h = vi.hoisted(() => ({ user: null as null | { id: string } }));

vi.mock('@/hooks/useAuth', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/hooks/useAuth')>()),
  useAuth: () => ({ user: h.user }),
}));
vi.mock('@/components/GlobalHeader', () => ({ GlobalHeader: () => <header data-testid="site-header" /> }));
vi.mock('@/components/BottomNav', () => ({ BottomNav: () => <nav data-testid="site-bottom-nav" /> }));
vi.mock('@/components/layout/GlobalFooter', () => ({ GlobalFooter: () => <footer data-testid="site-footer" /> }));
vi.mock('@/components/GlobalBackground', () => ({ GlobalBackground: () => null }));
vi.mock('@/components/profile/ProfileCompletionChrome', () => ({ default: () => <div data-testid="completion-chrome" /> }));

import { AppChrome } from '@/components/AppChrome';
import { bannerModel } from '@/lib/profileCompletion';

afterEach(() => {
  cleanup();
  h.user = null;
});

const renderAt = (path: string) =>
  render(
    <MemoryRouter initialEntries={[path]}>
      <AppChrome>
        <div data-testid="page" />
      </AppChrome>
    </MemoryRouter>,
  );

const spacers = (container: HTMLElement) =>
  Array.from(container.querySelectorAll('[aria-hidden="true"]')).filter((el) => /\bh-\[/.test(el.className));

describe('AppChrome on /app/*', () => {
  it.each(['/app', '/app/home', '/app/me/edit', '/APP/options'])('%s: no site header, bottom nav, footer or spacers', (path) => {
    const { container } = renderAt(path);
    expect(screen.getByTestId('page')).toBeTruthy();
    expect(screen.queryByTestId('site-header')).toBeNull();
    expect(screen.queryByTestId('site-bottom-nav')).toBeNull();
    expect(screen.queryByTestId('site-footer')).toBeNull();
    expect(spacers(container)).toEqual([]);
  });

  it('keeps ProfileCompletionChrome mounted for a signed-in person on /app', async () => {
    h.user = { id: 'u1' };
    renderAt('/app/home');
    expect(await screen.findByTestId('completion-chrome')).toBeTruthy();
  });
});

describe('AppChrome elsewhere is unchanged', () => {
  it.each(['/account', '/dancers', '/application', '/apps', '/finish-profile'])('%s: header, bottom nav, footer and both spacers', (path) => {
    const { container } = renderAt(path);
    expect(screen.getByTestId('site-header')).toBeTruthy();
    expect(screen.getByTestId('site-bottom-nav')).toBeTruthy();
    expect(screen.getByTestId('site-footer')).toBeTruthy();
    expect(spacers(container)).toHaveLength(2);
  });
});

describe('the reminder banner', () => {
  const incomplete = { status: 'incomplete' as const, missing: ['photo' as const], profileId: 'p1' };
  it.each(['/app', '/app/home', '/app/welcome', '/APP/me'])('is hidden on %s', (pathname) => {
    expect(bannerModel(incomplete, { dismissed: false, pathname })).toBeNull();
  });
  it.each(['/dancers', '/application', '/'])('still shows on %s', (pathname) => {
    expect(bannerModel(incomplete, { dismissed: false, pathname })).not.toBeNull();
  });
});
