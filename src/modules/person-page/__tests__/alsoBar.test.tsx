// @vitest-environment jsdom
/**
 * W1 S2: the Also bar, table-driven over the S0 prod shapes x teacher flag x page.
 * Label set and link must equal the ONE mapping (badges.ts); no /teachers/ href while the flag is off.
 */
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { AlsoBar } from '../AlsoRoles';
import { roleTagsFor, type PersonBadge } from '../badges';
import { splitInstagramWebsite } from '@/components/dj/djContacts';
import type { PersonRole } from '@/lib/searchEntities';

afterEach(cleanup);

const b = (roles: PersonRole[], djName: string | null = null): PersonBadge => ({ id: 'p1', roles, djName, djHasUpcoming: false, nextGigDate: null });
const SHAPES: [string, PersonBadge][] = [
  ['teacher only', b(['teacher'])],
  ['dancer+teacher', b(['teacher', 'dancer'])],
  ['dancer+dj+teacher', b(['teacher', 'dj', 'dancer'], 'Oreo Sensual')],
  ['dancer only', b(['dancer'])],
  ['dancer+dj', b(['dj', 'dancer'], 'Roger B')],
  ['no public role', b([])],
  ['dj only', b(['dj'])],
  ['dj+teacher', b(['teacher', 'dj'])],
];
const PAGES: PersonRole[] = ['dancer', 'dj', 'teacher'];

describe.each(SHAPES)('%s', (_n, badge) => {
  describe.each(PAGES)('on the %s page', (current) => {
    it.each([false, true])('teacher pages open=%s: chips equal the mapping, links as mapped', (open) => {
      const want = roleTagsFor(badge, { teacherPagesOpen: open, withStageName: true, exclude: current });
      render(<MemoryRouter><AlsoBar badge={badge} current={current} teacherPagesOpen={open} /></MemoryRouter>);
      const chips = screen.queryAllByTestId('also-chip');
      expect(chips.map((c) => c.textContent)).toEqual(want.map((t) => t.label));
      expect(chips.map((c) => c.getAttribute('href'))).toEqual(want.map((t) => t.href));
      expect(chips.some((c) => c.textContent === (current === 'dj' ? 'DJ' : current === 'dancer' ? 'Dancer' : 'Teacher'))).toBe(false);
      if (!open) expect(chips.every((c) => !(c.getAttribute('href') ?? '').startsWith('/teachers/'))).toBe(true);
      if (want.length === 0) expect(screen.queryByTestId('also-bar')).toBeNull();
      for (const c of chips) {
        expect((c as HTMLElement).style.minHeight).toBe('44px');
        expect(c.className).not.toMatch(/italic|opacity/);
      }
    });
  });
});

it('a linked DJ chip reads "DJ \u00b7 <stage name>" on the dancer page', () => {
  render(<MemoryRouter><AlsoBar badge={b(['dj', 'dancer'], 'Oreo Sensual')} current="dancer" teacherPagesOpen={false} /></MemoryRouter>);
  expect(screen.getByRole('link').textContent).toBe('DJ \u00b7 Oreo Sensual');
});

it('no badge yet = nothing (no empty box)', () => {
  const { container } = render(<MemoryRouter><AlsoBar badge={undefined} current="dj" teacherPagesOpen={false} /></MemoryRouter>);
  expect(container.innerHTML).toBe('');
});

describe('role pages use the bar and the role grounds', () => {
  const read = (f: string) => readFileSync(path.join(process.cwd(), f), 'utf8');
  it('dancer page: dancer ground; DJ page: dj ground, no floating Share', () => {
    expect(read('src/pages/DancerProfile.tsx')).toContain('gradientPalette="dancer"');
    const dj = read('src/pages/DJProfile.tsx');
    expect(dj).toContain('gradientPalette="dj"');
    expect(dj).toContain('data-testid="dj-head"');
    expect(dj).not.toMatch(/className="[^"]*\b(fixed|absolute)\b/);
  });
  it('no hard-coded role label or role-page href on these pages', () => {
    for (const f of ['src/pages/DancerProfile.tsx', 'src/pages/DJProfile.tsx', 'src/modules/person-page/AlsoRoles.tsx']) {
      expect(read(f)).not.toMatch(/['"`]\/(teachers)\//);
    }
  });
});

describe('splitInstagramWebsite', () => {
  it.each([
    [null, 'https://www.instagram.com/oreo', 'https://www.instagram.com/oreo', null],
    // A link to no person (home page, explore, a post) is dropped, never an "Instagram" button.
    [null, 'www.instagram.com', null, null],
    [null, 'https://instagram.com/', null, null],
    [null, 'https://www.instagram.com/explore/tags/bachata', null, null],
    [null, 'https://www.instagram.com/p/Cx1abc/', null, null],
    [null, 'https://instagram.com/reel/Cx1abc', null, null],
    [null, 'https://instagram.com/reels/Cx1abc', null, null],
    [null, 'https://instagram.com/stories/oreo/123', null, null],
    [null, 'https://instagram.com/tv/Cx1abc', null, null],
    ['@oreo', 'https://instagram.com/explore', '@oreo', null],
    // A handle segment makes it the Instagram contact; m. host recognised.
    [null, 'https://m.instagram.com/oreo', 'https://m.instagram.com/oreo', null],
    [null, 'HTTPS://Instagram.com/Oreo.DJ?igsh=x', 'HTTPS://Instagram.com/Oreo.DJ?igsh=x', null],
    [null, 'instagram.com/oreo_dj/', 'instagram.com/oreo_dj/', null],
    [null, 'https://instagram.com.evil.com/oreo', null, 'https://instagram.com.evil.com/oreo'],
    ['https://instagram.com/a', 'https://instagram.com/b', 'https://instagram.com/a', null],
    [null, 'https://oreo.dj', null, 'https://oreo.dj'],
    [null, null, null, null],
  ])('ig=%s web=%s', (ig, web, outIg, outWeb) => {
    expect(splitInstagramWebsite(ig, web)).toEqual({ instagram: outIg, website: outWeb });
  });
});
