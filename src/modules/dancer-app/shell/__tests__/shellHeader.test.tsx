// @vitest-environment jsdom
/**
 * L9: the header had two controls going to "/" (logo and Events). One stays: "Events".
 * L2: the logo never wraps (nowrap) and shrinks below 375px (clamp; the sheet may not
 * use media queries, tests/client/dancerAppTheme.test.ts).
 */
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { cleanup, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

vi.mock('@/hooks/useAuth', async (importOriginal) =>
  (await import('@/modules/dancer-app/shell/testAuth')).authModuleMock(importOriginal));

import { renderInShell, resetShell } from '../renderInShell';

afterEach(() => {
  cleanup();
  resetShell();
});

describe('L9: one control per destination in the header', () => {
  it.each(['/app/home', '/app/nights', '/app/me', '/app/options'])('%s: exactly one header link to "/" (the home link; D131: no Events)', async (url) => {
    renderInShell({ path: url });
    const header = await screen.findByTestId('dancer-app-header');
    const home = [...header.querySelectorAll('a')].filter((a) => a.getAttribute('href') === '/');
    expect(home.map((a) => a.getAttribute('data-testid'))).toEqual(['site-home-link']);
  });
});

describe('L2: the logo fits on one line at 360', () => {
  const css = readFileSync(path.resolve(__dirname, '../../theme', ['dancer', 'css'].join('.')), 'utf8').replace(/\/\*[\s\S]*?\*\//g, '');
  const rule = css.match(/\[data-profile="dancer"\] \.da-logo \{([^}]*)\}/)?.[1] ?? '';
  const size = (vw: number): number => {
    const m = rule.match(/font-size:\s*clamp\(([\d.]+)px,\s*calc\(([\d.]+)vw - ([\d.]+)px\),\s*([\d.]+)px\)/);
    if (!m) return Number(rule.match(/font-size:\s*([\d.]+)px/)?.[1] ?? NaN);
    return Math.min(Number(m[4]), Math.max(Number(m[1]), (Number(m[2]) * vw) / 100 - Number(m[3])));
  };
  it('never wraps', () => {
    expect(rule).toMatch(/white-space:\s*nowrap/);
  });
  it.each([[360, 15], [320, 13.5], [375, 16], [390, 16]])('at %ipx the logo is <= %fpx', (vw, max) => {
    expect(size(vw)).toBeLessThanOrEqual(max);
  });
  it('full size from 375 up', () => {
    expect(size(375)).toBe(16);
  });
});
