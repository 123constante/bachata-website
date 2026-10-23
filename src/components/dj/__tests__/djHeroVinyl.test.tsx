// @vitest-environment jsdom
/**
 * DJ hero vinyl (review 7a): with no photo the label shows the initials. The label TEXT
 * must not spin with the disc, and no spindle dot may sit over the initials.
 */
import { afterEach, describe, expect, it } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import { DjHero } from '../DjTiles';

const base = {
  name: 'Kiko Rugido', cityName: null, nationality: null, nationalityCode: null, bio: null, isLive: false,
  stats: { gigs: null, upcoming: null, genres: null },
};
const spins = (el: Element) => /dj-spin/.test((el as HTMLElement).style?.animation ?? '');
const ancestors = (el: Element): Element[] => {
  const out: Element[] = [];
  for (let p = el.parentElement; p; p = p.parentElement) out.push(p);
  return out;
};

afterEach(() => cleanup());

describe('DjHero vinyl', () => {
  it('without a photo: initials shown, not inside the spinning disc, no spindle dot', () => {
    const { container } = render(<DjHero {...base} photoUrl={null} />);
    const initials = screen.getByText('KR');
    expect(ancestors(initials).some(spins)).toBe(false);
    expect(spins(initials)).toBe(false);
    const disc = Array.from(container.querySelectorAll('div')).find(spins);
    expect(disc).toBeTruthy(); // the grooves still spin
    expect(disc?.textContent ?? '').toBe('');
    // the 9 px spindle dot drawn over the initials is gone
    const dots = Array.from(container.querySelectorAll<HTMLElement>('div')).filter((d) => d.style.width === '9px');
    expect(dots).toHaveLength(0);
  });

  it('with a photo: no initials label, the disc still spins', () => {
    const { container } = render(<DjHero {...base} photoUrl="https://cdn.example.test/k.jpg" />);
    expect(screen.queryByText('KR')).toBeNull();
    expect(Array.from(container.querySelectorAll('div')).some(spins)).toBe(true);
  });
});
