// @vitest-environment jsdom
/** Golden look, part 2 (flag homeGoldenLook): HomeCView keeps every item and tap, drawn in prototype A style. */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { MemoryRouter } from 'react-router-dom';
import { cleanup, render, screen } from '@testing-library/react';

const h = vi.hoisted(() => ({ look: true, win: false }));
vi.mock('@/lib/featureFlags', async (orig) => {
  const real = (await orig()) as { flags: Record<string, unknown> };
  return { ...real, flags: new Proxy(real.flags, { get: (t, k) => (k === 'homeGoldenLook' ? h.look : t[k as string]) }) };
});
vi.mock('../homeRaffleWin', () => ({ useHasRaffleWin: () => h.win }));
vi.mock('../../onboarding/onboardingV3Flag', () => ({ DANCER_ONBOARDING_V3_ENABLED: true }));
vi.mock('@/hooks/useAuth', () => ({ useAuth: () => ({ user: { id: 'u1' } }) }));

import { HomeCView } from '../homeOptionB';
import { CITY_LONDON, makeProfile } from '../../../api/fixtures';
import type { HeroNight } from '../homeParts';

afterEach(cleanup);
beforeEach(() => { h.look = true; h.win = false; try { localStorage.clear(); } catch { /* jsdom */ } });

const PROFILE = makeProfile({ first_name: 'Walker', based_city_id: CITY_LONDON.id, dance_role: 'Follower', avatar_url: 'https://img.example/w.jpg' });
const NIGHT: HeroNight = { name: 'Bachata Social', inDays: 'in 2 days', place: 'The Loft', tag: 'Going', href: '/event/x' };

const show = (went: number | null = 0) => render(
  <MemoryRouter>
    <HomeCView profile={PROFILE} went={went} night={NIGHT} goingCount={3} focusLoading={false} alerts={null}
      rate={<a data-testid="rate-nudge" href="/app/nights">Rate last night</a>} ticket={<section data-testid="home-c-ticket">Your ticket</section>} />
  </MemoryRouter>,
);

describe('HomeCView golden look', () => {
  it('shows the h1 greeting when no win card is on screen', () => {
    show();
    expect(screen.getByRole('heading', { level: 1 }).textContent).toContain('Walker');
  });
  it('drops the h1 greeting when a win card is on screen', () => {
    h.win = true;
    show();
    expect(screen.queryByRole('heading', { level: 1 })).toBeNull();
  });
  it('keeps every row with its link target', () => {
    show();
    expect(screen.getByTestId('home-b-more-plans').getAttribute('href')).toBe('/app/nights');
    expect(screen.getByTestId('home-b-first-night')).toBeTruthy();
    expect(screen.getByTestId('home-b-share').getAttribute('href')).toBeTruthy();
    expect(screen.getByTestId('home-c-preview').getAttribute('href')).toBeTruthy();
    expect(screen.getByTestId('home-c-ticket')).toBeTruthy();
    expect(screen.getByTestId('rate-nudge')).toBeTruthy();
    expect(screen.getByTestId('home-shine-add').getAttribute('href')).toContain('/app/welcome');
    expect(screen.getByTestId('home-shine-dismiss')).toBeTruthy();
    expect(screen.getByTestId('home-c-go-rows')).toBeTruthy();
  });
  it('draws section headings in the .sec style', () => {
    show();
    for (const id of ['home-c-head-go', 'home-c-head-found']) {
      const el = screen.getByTestId(id);
      expect(el.style.fontSize).toBe('13px');
      expect(el.style.fontWeight).toBe('800');
      expect(el.style.textTransform).toBe('uppercase');
      expect(el.style.margin).toBe('26px 2px 8px');
    }
  });
  it('flag off: today\u2019s view, no golden wrapper', () => {
    h.look = false;
    const { container } = show();
    expect(container.querySelector('.hgl')).toBeNull();
    expect(screen.getByRole('heading', { level: 1 }).textContent).toContain('Walker');
    expect(screen.getByTestId('home-c-found')).toBeTruthy();
  });
});
