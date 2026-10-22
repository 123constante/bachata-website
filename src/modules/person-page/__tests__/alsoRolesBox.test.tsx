// @vitest-environment jsdom
/**
 * Review F4: the "Also" row owns its own padding, so when it renders nothing (every SSR
 * render, every single-role person, every embedded tab) the old role pages get no empty
 * padded box: their markup is exactly what it was before the row existed.
 */
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import type { PersonRole } from '../personRoles';

const h = vi.hoisted(() => ({ roles: [] as PersonRole[] }));
vi.mock('../badges', async (orig) => {
  const real = await orig<typeof import('../badges')>();
  return {
    ...real,
    usePeopleBadges: () => ({
      badges: h.roles.length ? new Map([['p1', { id: 'p1', roles: h.roles, djName: null, djHasUpcoming: false, nextGigDate: null }]]) : new Map(),
      isLoading: false,
    }),
  };
});

import { AlsoRoles } from '../AlsoRoles';

const BOX = 'mx-auto w-full max-w-6xl px-3 pt-4';
const show = (current: PersonRole) =>
  render(
    <MemoryRouter>
      <div data-testid="host"><AlsoRoles current={current} id="p1" slug="ana" className={BOX} /></div>
    </MemoryRouter>,
  );

afterEach(() => { cleanup(); h.roles = []; });

describe('AlsoRoles box', () => {
  it.each([
    { name: 'roles not loaded yet (SSR / first paint)', roles: [] as PersonRole[] },
    { name: 'single-role DJ', roles: ['dj'] as PersonRole[] },
  ])('$name: renders nothing at all, no padded wrapper', ({ roles }) => {
    h.roles = roles;
    show('dj');
    expect(screen.getByTestId('host').innerHTML).toBe('');
  });

  it('multi-role: the padding is on the row itself', () => {
    h.roles = ['dj', 'dancer'];
    show('dj');
    const nav = screen.getByRole('navigation', { name: 'Other roles' });
    expect(nav.parentElement).toBe(screen.getByTestId('host'));
    expect(nav.className).toContain(BOX);
    expect(nav.textContent).toBe('Dancer');
  });

  it.each(['src/pages/DJProfile.tsx', 'src/pages/TeacherProfile.tsx', 'src/pages/DancerProfile.tsx'])(
    '%s does not wrap AlsoRoles in a box of its own',
    (file) => {
      const src = readFileSync(path.join(process.cwd(), file), 'utf8');
      expect(src).toContain('<AlsoRoles');
      expect(src).not.toMatch(/<div[^>]*>\s*<AlsoRoles[^>]*\/>\s*<\/div>/);
    },
  );
});
