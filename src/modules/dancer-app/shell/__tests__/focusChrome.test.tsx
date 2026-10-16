// @vitest-environment jsdom
/**
 * H5: required setup runs in a minimal frame. While the profile's required
 * steps are not done, /app/welcome and the setup photo step show only the logo
 * (not a link) and "Not now"; no tabs, no "Events", no picture. Normal chrome
 * everywhere else, and on welcome once the profile is complete.
 */
import { cleanup, screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

vi.mock('@/hooks/useAuth', async (importOriginal) =>
  (await import('@/modules/dancer-app/shell/testAuth')).authModuleMock(importOriginal));

import { FOCUS_NOT_NOW_LABEL } from '@/lib/focusMode';
import { renderInShell, resetShell } from '../renderInShell';
import { notNowTarget, shellChrome } from '../focusChrome';
import { DANCER_SHAPES } from '../../api/fixtures';

afterEach(() => {
  cleanup();
  resetShell();
});

const INCOMPLETE = DANCER_SHAPES.nameCityOnly.profile;
const COMPLETE = DANCER_SHAPES.fourFieldComplete.profile;

type Row = [label: string, url: string, shape: 'emptyStub' | 'nameCityOnly' | 'fourFieldComplete', focus: boolean];
const ROWS: Row[] = [
  ['welcome, incomplete', '/app/welcome', 'nameCityOnly', true],
  ['welcome, empty stub', '/app/welcome', 'emptyStub', true],
  ['setup photo step, incomplete', '/app/me/photo?return=/app/welcome', 'nameCityOnly', true],
  ['home, incomplete', '/app/home', 'nameCityOnly', false],
  ['photo without the setup return, incomplete', '/app/me/photo', 'nameCityOnly', false],
  ['welcome, complete', '/app/welcome', 'fourFieldComplete', false],
  ['setup photo step, complete', '/app/me/photo?return=/app/welcome', 'fourFieldComplete', false],
];

describe('shellChrome (the mapping)', () => {
  it.each(ROWS)('%s', (_n, url, shape, focus) => {
    const [pathname, q] = url.split('?');
    expect(shellChrome(pathname, q ? `?${q}` : '', DANCER_SHAPES[shape].profile).focus).toBe(focus);
  });
  it('profile not read yet: a setup path stays focused (never flashes the full app)', () => {
    expect(shellChrome('/app/welcome', '', undefined).focus).toBe(true);
    expect(shellChrome('/app/home', '', undefined).focus).toBe(false);
  });
  it.each([
    ['', '/'],
    ['?returnTo=%2Fevents%2Fx', '/events/x'],
    ['?returnTo=https%3A%2F%2Fevil.example', '/'],
    ['?returnTo=%2Faccount%2Fo', '/'],
    ['?returnTo=%2Finvite%2Fabc', '/'],
    ['?return=%2Fapp%2Fwelcome', '/'],
    ['?return=%2Fapp%2Fwelcome%3FreturnTo%3D%252Fevents%252Fx', '/events/x'],
  ])('Not now from %s goes to %s', (search, to) => {
    expect(notNowTarget(search)).toBe(to);
  });
  it('complete and incomplete fixtures are what the rows say', () => {
    expect(COMPLETE.complete).toBe(true);
    expect(INCOMPLETE.complete).toBe(false);
  });
});

describe('the shell renders the mapping', () => {
  it.each(ROWS)('%s', async (_n, url, shape, focus) => {
    renderInShell({ path: url, backend: { shape } });
    await screen.findByTestId('dancer-app-shell');
    // Wait for the profile read to settle the chrome.
    await waitFor(() => expect(screen.getByTestId('dancer-app-shell').getAttribute('data-chrome')).toBe(focus ? 'focus' : 'full'));
    const logo = screen.getByTestId('dancer-app-logo');
    expect(logo.tagName).not.toBe('A');
    if (focus) {
      expect(screen.queryByTestId('dancer-app-tabs')).toBeNull();
      expect(screen.queryByTestId('dancer-app-events')).toBeNull();
      expect(screen.queryByTestId('profile-switcher-button')).toBeNull();
      expect(document.querySelector('[aria-current="page"]')).toBeNull();
      const notNow = screen.getByTestId('dancer-app-not-now');
      expect(notNow.textContent).toBe(FOCUS_NOT_NOW_LABEL);
      expect(notNow.getAttribute('href')).toBe('/');
    } else {
      expect(screen.getByTestId('dancer-app-tabs')).toBeTruthy();
      expect(screen.getByTestId('dancer-app-events').getAttribute('href')).toBe('/');
      expect(screen.queryByTestId('dancer-app-not-now')).toBeNull();
    }
  });
});
