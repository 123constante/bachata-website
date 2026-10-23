// @vitest-environment jsdom
/** Contrast measured from the RENDERED DOM (computed styles), like S10's contrast.json. */
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { installJsdomPolyfills } from '../../../../../tests/client/jsdomPolyfills';
import { DjsWall } from '../lists';
import { SEAM } from '../tokens';
import type { PersonBadge } from '@/modules/person-page/badges';

const rgb = (s: string): [number, number, number] => {
  const m = s.match(/(\d+(?:\.\d+)?)[ ,]+(\d+(?:\.\d+)?)[ ,]+(\d+(?:\.\d+)?)/);
  if (!m) throw new Error(`unparsable colour ${s}`);
  return [Number(m[1]), Number(m[2]), Number(m[3])];
};
const lum = ([r, g, b]: [number, number, number]) => {
  const f = (v: number) => { const c = v / 255; return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4; };
  return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b);
};
const ratio = (a: string, b: string) => {
  const [hi, lo] = [lum(rgb(a)), lum(rgb(b))].sort((x, y) => y - x);
  return (hi + 0.05) / (lo + 0.05);
};

beforeEach(() => installJsdomPolyfills());
afterEach(() => cleanup());

describe('wall contrast on the warm dark base', () => {
  it('text >= 4.5 (name, chip text, date chip) and chip edge >= 3 vs the page', () => {
    const roles: PersonBadge['roles'] = ['teacher', 'dj', 'dancer'];
    const badges = new Map([['a', { id: 'a', roles, djName: null, djHasUpcoming: true, nextGigDate: '2099-10-23' }]]);
    render(
      <MemoryRouter>
        <DjsWall djs={[{ id: 'a', display_name: 'Aa', dj_name: 'Aa', has_upcoming_gig: true, next_gig_date: '2099-10-23' }]} isLoading={false} badges={badges} badgesFailed={false} teacherPagesOpen />
      </MemoryRouter>,
    );
    // The wall paints SEAM.base through its fade layers (no solid background colour since the seam
    // fix), so the page colour is that base, proven to be in the rendered gradient.
    const probe = document.createElement('div');
    probe.style.backgroundColor = SEAM.base;
    const page = probe.style.backgroundColor;
    expect(page).toMatch(/^rgb\(/);
    expect(screen.getByTestId('wall-root').style.backgroundImage).toContain(page);
    expect(ratio(getComputedStyle(screen.getByTestId('tile-name')).color, page)).toBeGreaterThanOrEqual(4.5);
    const chips = screen.getAllByTestId('role-chip');
    expect(chips).toHaveLength(3);
    for (const c of chips) {
      const s = getComputedStyle(c);
      expect(ratio(s.color, s.backgroundColor)).toBeGreaterThanOrEqual(4.5);
      // chip edge: the better of its fill and its border against the page
      const edge = Math.max(ratio(s.backgroundColor, page), ratio(s.borderTopColor, page));
      expect(edge).toBeGreaterThanOrEqual(3);
    }
    // Inside the 64px fades the page ground shows through: pills (top) and the last row's names
    // (bottom) must also hold on the grounds measured at the seams (docs/design/924.md).
    const pill = getComputedStyle(screen.getAllByTestId('wall-filter').find((b) => b.getAttribute('aria-pressed') === 'false')!);
    for (const ground of ['rgb(20, 28, 33)', 'rgb(10, 8, 11)', 'rgb(14, 18, 21)', page]) {
      expect(ratio(pill.color, ground)).toBeGreaterThanOrEqual(4.5);
      expect(ratio(getComputedStyle(screen.getByTestId('tile-name')).color, ground)).toBeGreaterThanOrEqual(4.5);
    }
    const d = getComputedStyle(screen.getByTestId('date-chip'));
    expect(ratio(d.color, d.backgroundColor)).toBeGreaterThanOrEqual(4.5);
  });
});
