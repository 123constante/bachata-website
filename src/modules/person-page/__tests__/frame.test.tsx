// @vitest-environment jsdom
/**
 * People arc S1: the shared frame. RoleTabs over every role combination (1 role = no
 * row; 2-3 roles = all listed in the order Teacher, DJ, Dancer, the current one
 * selected, hrefs to the role pages, every tap >= 44px) and the Avatar over photo /
 * no photo / a photo that fails after mount / one that failed before hydration.
 */
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import type { PersonRole } from '../personRoles';
import { Avatar, PersonFrame, RoleTabs, roleTabs, sharePage } from '../frame';
import { ROLE_COLOUR, WORLD } from '../worlds/tokens';

afterEach(cleanup);

const COMBOS: { roles: PersonRole[]; slug: string; who: string }[] = [
  { roles: ['dancer'], slug: 'unclaimed-440f99dd', who: 'Magda' },
  { roles: ['teacher'], slug: 'pierre-henry', who: 'Pierre Henry' },
  { roles: ['dj'], slug: 'bobby-blanco', who: 'DJ only' },
  { roles: ['dancer', 'dj'], slug: 'papacito', who: 'Papacito (stored dancer-first)' },
  { roles: ['teacher', 'dancer'], slug: 'marta', who: 'teacher + dancer' },
  { roles: ['dj', 'teacher'], slug: 'nickchata', who: 'Nickchata (DJ + teacher)' },
  { roles: ['dancer', 'teacher', 'dj'], slug: 'ramiro-zapata', who: 'Ramiro Zapata x3' },
];
const ORDER: PersonRole[] = ['teacher', 'dj', 'dancer'];
const BASE: Record<PersonRole, string> = { teacher: '/teachers', dj: '/djs', dancer: '/dancers' };
const LABEL: Record<PersonRole, string> = { teacher: 'Teacher', dj: 'DJ', dancer: 'Dancer' };

const tabsOn = (roles: PersonRole[], current: PersonRole, slug: string) =>
  render(<MemoryRouter><RoleTabs roles={roles} current={current} slug={slug} /></MemoryRouter>);

describe.each(COMBOS)('RoleTabs: $who', ({ roles, slug }) => {
  const want = ORDER.filter((r) => roles.includes(r));
  it.each(roles)('on the %s world', (current) => {
    tabsOn(roles, current, slug);
    if (want.length < 2) {
      expect(screen.queryByTestId('role-tabs')).toBeNull();
      expect(roleTabs(roles, current, slug)).toBeNull();
      return;
    }
    const tabs = screen.getAllByTestId('role-tab');
    expect(tabs.map((t) => t.getAttribute('data-role'))).toEqual(want);
    expect(tabs.map((t) => t.textContent)).toEqual(want.map((r) => LABEL[r]));
    expect(tabs.map((t) => t.getAttribute('href'))).toEqual(want.map((r) => `${BASE[r]}/${slug}`));
    for (const t of tabs) {
      const role = t.getAttribute('data-role') as PersonRole;
      const on = role === current;
      expect(t.getAttribute('aria-current')).toBe(on ? 'page' : null);
      expect(parseFloat(t.style.minHeight)).toBeGreaterThanOrEqual(44);
      expect(t.style.minHeight).toMatch(/px$/);
      // current: filled in its role colour; others: a dot in theirs
      expect(t.querySelector('[data-testid="role-tab-dot"]') !== null).toBe(!on);
      if (on) expect(t.style.background).toBe(hexToRgb(ROLE_COLOUR[role].fill));
    }
  });
});

it('RoleTabs: no slug = no row (a link would be dead)', () => {
  expect(roleTabs(['dj', 'dancer'], 'dj', null)).toBeNull();
});

it('PersonFrame: Back left, Share right, the tabs under them, the same on every world', () => {
  const ys: string[] = [];
  for (const current of ['teacher', 'dj', 'dancer'] as PersonRole[]) {
    const { container, unmount } = render(
      <MemoryRouter>
        <PersonFrame backHref="/dancers" shareTitle="Ramiro Zapata on Bachata Calendar" roles={['dancer', 'dj', 'teacher']} current={current} slug="ramiro-zapata">
          <p>world</p>
        </PersonFrame>
      </MemoryRouter>,
    );
    const frame = screen.getByTestId('person-frame');
    const kids = Array.from(frame.children).map((c) => c.getAttribute('data-testid') ?? c.tagName);
    expect(kids).toEqual(['DIV', 'role-tabs', 'P']);
    const bar = frame.children[0];
    expect(bar.children[0].getAttribute('data-testid')).toBe('frame-back');
    expect(bar.children[0].getAttribute('href')).toBe('/dancers');
    expect(bar.children[1].getAttribute('data-testid')).toBe('frame-share');
    for (const el of [bar.children[0], bar.children[1]] as HTMLElement[]) expect(parseFloat(el.style.minHeight)).toBeGreaterThanOrEqual(44);
    ys.push(shape(container));
    unmount();
  }
  // The same boxes above the world on every world (only which tab is filled differs) = the tabs sit at the same y.
  expect(new Set(ys).size).toBe(1);
});

/** Tag + test id + class of every box, the current tab's dot left out. */
function shape(el: Element): string {
  return Array.from(el.querySelectorAll('*'))
    .filter((e) => e.getAttribute('data-testid') !== 'role-tab-dot')
    .map((e) => `${e.tagName}.${e.getAttribute('data-testid') ?? ''}.${e.getAttribute('class') ?? ''}`)
    .join('|');
}

function hexToRgb(hex: string): string {
  const n = parseInt(hex.slice(1), 16);
  return `rgb(${(n >> 16) & 255}, ${(n >> 8) & 255}, ${n & 255})`;
}

describe('Avatar', () => {
  const setImage = (complete: boolean, naturalWidth: number) => {
    Object.defineProperty(HTMLImageElement.prototype, 'complete', { configurable: true, get: () => complete });
    Object.defineProperty(HTMLImageElement.prototype, 'naturalWidth', { configurable: true, get: () => naturalWidth });
  };
  afterEach(() => setImage(false, 0));

  it.each(['teacher', 'dj', 'dancer'] as PersonRole[])('no photo: initials in Inter 800, coloured by the %s world', (world) => {
    setImage(false, 0);
    render(<Avatar name="Ramiro  Zapata" photo={null} world={world} size={112} />);
    const a = screen.getByTestId('person-avatar');
    expect(a.getAttribute('data-photo')).toBe('initials');
    expect(a.querySelector('img')).toBeNull();
    const b = a.querySelector('b') as HTMLElement;
    expect(b.textContent).toBe('RZ');
    expect(b.style.fontWeight).toBe('800');
    expect(b.style.color).toBe(hexToRgb(WORLD[world].avatar.ink));
    expect(a.style.borderRadius === '' && a.className.includes('rounded-full')).toBe(true);
  });

  it('a photo shows the photo', () => {
    setImage(false, 0);
    render(<Avatar name="Papacito" photo="https://img.example/p.jpg" world="dj" size={104} />);
    const a = screen.getByTestId('person-avatar');
    expect(a.getAttribute('data-photo')).toBe('photo');
    expect(a.querySelector('img')?.getAttribute('src')).toBe('https://img.example/p.jpg');
  });

  it('a photo that fails after mount falls back to the initials', () => {
    setImage(false, 0);
    render(<Avatar name="Papacito" photo="https://img.example/dead.jpg" world="dancer" size={112} />);
    fireEvent.error(screen.getByTestId('person-avatar').querySelector('img') as HTMLImageElement);
    const a = screen.getByTestId('person-avatar');
    expect(a.getAttribute('data-photo')).toBe('initials');
    expect(a.querySelector('img')).toBeNull();
    expect(a.textContent).toBe('P');
  });

  it('a photo that failed before hydration (complete, no pixels) falls back on mount', () => {
    setImage(true, 0);
    render(<Avatar name="Sabrina Guzman Pastor" photo="https://img.example/dead.jpg" world="dancer" size={112} />);
    const a = screen.getByTestId('person-avatar');
    expect(a.getAttribute('data-photo')).toBe('initials');
    expect(a.textContent).toBe('SP');
  });

  it('a loaded photo (complete, has pixels) stays', () => {
    setImage(true, 400);
    render(<Avatar name="Papacito" photo="https://img.example/p.jpg" world="dj" size={104} />);
    expect(screen.getByTestId('person-avatar').getAttribute('data-photo')).toBe('photo');
  });
});

describe('sharePage', () => {
  afterEach(() => { vi.restoreAllMocks(); Object.defineProperty(navigator, 'share', { configurable: true, value: undefined }); });
  it.each([
    ['the person closes the sheet (AbortError): nothing copied', 'AbortError', 0],
    ['the sheet fails: the link is copied instead', 'NotAllowedError', 1],
  ])('%s', async (_label, name, copies) => {
    Object.defineProperty(navigator, 'share', { configurable: true, value: () => Promise.reject(Object.assign(new Error('x'), { name })) });
    const writeText = vi.fn(() => Promise.resolve());
    Object.defineProperty(navigator, 'clipboard', { configurable: true, value: { writeText } });
    await sharePage('Morcilla on Bachata Calendar');
    expect(writeText).toHaveBeenCalledTimes(copies);
  });
});
