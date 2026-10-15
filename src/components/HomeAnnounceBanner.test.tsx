// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, cleanup } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import {
  HOME_ANNOUNCE_BANNER_ON,
  HOME_ANNOUNCE_HREF,
  HOME_ANNOUNCE_STORAGE_KEY,
} from '@/lib/homeAnnounceBanner';

// Fresh module per test: the dismissed-this-visit flag is module state.
const mount = async (enabled?: boolean) => {
  const { default: HomeAnnounceBanner } = await import('./HomeAnnounceBanner');
  return render(
    <MemoryRouter>
      <HomeAnnounceBanner enabled={enabled} />
    </MemoryRouter>,
  );
};

describe('HomeAnnounceBanner', () => {
  beforeEach(async () => {
    window.localStorage.clear();
    vi.resetModules();
  });
  afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
  });

  it('ships OFF', async () => {
    expect(HOME_ANNOUNCE_BANNER_ON).toBe(true);
  });

  it('renders nothing when off (default)', async () => {
    const { container } = await mount();
    expect(container.innerHTML).toBe("");
  });

  it('when on shows text and a link to dancer sign-up', async () => {
    await mount(true);
    expect(screen.getByText('New: dancer profiles + organiser pages')).toBeTruthy();
    const link = screen.getByRole('link', { name: 'Create your profile' });
    expect(link.getAttribute('href')).toBe(HOME_ANNOUNCE_HREF);
    expect(HOME_ANNOUNCE_HREF).toBe('/auth?mode=signup&userType=dancer');
  });

  it('Dismiss hides it and writes the key', async () => {
    await mount(true);
    fireEvent.click(screen.getByRole('button', { name: 'Dismiss' }));
    expect(screen.queryByTestId('home-announce-banner')).toBeNull();
    expect(window.localStorage.getItem(HOME_ANNOUNCE_STORAGE_KEY)).not.toBeNull();
  });

  it('a stored key keeps it hidden', async () => {
    window.localStorage.setItem(HOME_ANNOUNCE_STORAGE_KEY, '1');
    await mount(true);
    expect(screen.queryByTestId('home-announce-banner')).toBeNull();
  });

  it('works when storage throws', async () => {
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new Error('blocked');
    });
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('blocked');
    });
    await mount(true);
    expect(screen.getByTestId('home-announce-banner')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Dismiss' }));
    expect(screen.queryByTestId('home-announce-banner')).toBeNull();
  });
});
