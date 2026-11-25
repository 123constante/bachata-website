// @vitest-environment jsdom
/** Onboarding v8 C2: progress ring card, 100% win, and "Nothing planned yet" gone behind the v3 flag. */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { MemoryRouter } from 'react-router-dom';
import { act, cleanup, render, screen } from '@testing-library/react';

const h = vi.hoisted(() => ({ v3: true, boom: vi.fn() }));
vi.mock('../../onboarding/onboardingV3Flag', () => ({ get DANCER_ONBOARDING_V3_ENABLED() { return h.v3; } }));
vi.mock('@/hooks/useAuth', () => ({ useAuth: () => ({ user: { id: 'u1' } }) }));
vi.mock('../../onboarding/neon/neonConfetti', () => ({ boom: (...a: unknown[]) => h.boom(...a) }));

import ProgressRingCard, { ringOffset, wonKey } from '../ProgressRingCard';
import { HomeBView, HomeCView } from '../homeOptionB';
import { NEXT_LABEL, profileProgress, type ProgressInput } from '../../onboarding/profileProgress';
import { CITY_LONDON, makeProfile } from '../../../api/fixtures';

const FULL: ProgressInput = { photo: true, startedYear: 2020, styles: ['Sensual'], partnerAnswered: true, bio: 'Hi', link: '@ana' };
const card = (i: ProgressInput) => render(<MemoryRouter><ProgressRingCard progress={profileProgress(i)} requiredPath="/app/welcome" /></MemoryRouter>);
const COMPLETE4 = makeProfile({ first_name: 'Ana', based_city_id: CITY_LONDON.id, dance_role: 'Follower', avatar_url: 'https://img.example/a.jpg' });
const home = (kind: 'c' | 'b') => render(<MemoryRouter>{kind === 'c'
  ? <HomeCView profile={COMPLETE4} went={1} night={null} goingCount={0} focusLoading={false} alerts={null} rate={null} ticket={null} />
  : <HomeBView profile={COMPLETE4} went={1} night={null} goingCount={0} focusLoading={false} />}</MemoryRouter>);

beforeEach(() => { h.v3 = true; h.boom.mockClear(); vi.useFakeTimers(); try { localStorage.clear(); } catch { /* jsdom */ } });
afterEach(() => { cleanup(); vi.useRealTimers(); });

describe('ring card', () => {
  it('offset math at 0/33/50/86/100', () => {
    expect([0, 33, 50, 86, 100].map((p) => Number(ringOffset(p).toFixed(2)))).toEqual([213.6, 143.11, 106.8, 29.9, 0]);
  });
  it('counts up by 3 every 18ms to the percentage, then arms the arc', () => {
    card({ ...FULL, bio: '', link: '' });
    expect(screen.getByTestId('home-ring-count').textContent).toBe('0%');
    act(() => { vi.advanceTimersByTime(18); });
    expect(screen.getByTestId('home-ring-count').textContent).toBe('3%');
    act(() => { vi.advanceTimersByTime(2000); });
    expect(screen.getByTestId('home-ring-count').textContent).toBe('67%');
    expect(Number(screen.getByTestId('home-ring-bar').getAttribute('stroke-dashoffset'))).toBeCloseTo(ringOffset(67), 1);
  });
  for (const k of ['photo', 'years', 'styles', 'partner', 'bio', 'link'] as const) {
    it(`next label when ${k} is the first missing item`, () => {
      const off: Record<string, Partial<ProgressInput>> = { photo: { photo: false }, years: { startedYear: null }, styles: { styles: [] }, partner: { partnerAnswered: false }, bio: { bio: '' }, link: { link: '' } };
      card({ ...FULL, ...off[k] });
      expect(screen.getByTestId('home-ring-next').textContent).toBe(`Next: ${NEXT_LABEL[k]} (+1 step closer)`);
    });
  }
  it('optional chips go to the bio step, required to their step', () => {
    card({ ...FULL, photo: false, bio: '' });
    expect(screen.getByTestId('home-ring-chip-bio').getAttribute('href')).toBe('/app/welcome?step=bio&returnTo=/app/home');
    expect(screen.getByTestId('home-ring-chip-photo').getAttribute('href')).toBe('/app/welcome');
    expect(screen.queryByTestId('home-ring-chip-link')).toBeNull();
  });
  it('100%: win card, confetti once after 250ms, not again after a reload', () => {
    card(FULL);
    expect(screen.getByTestId('home-ring-win').textContent).toContain('Profile complete');
    act(() => { vi.advanceTimersByTime(249); });
    expect(h.boom).not.toHaveBeenCalled();
    act(() => { vi.advanceTimersByTime(1); });
    expect(h.boom).toHaveBeenCalledWith(true);
    expect(localStorage.getItem(wonKey('u1'))).toBe('1');
    cleanup();
    card(FULL);
    act(() => { vi.advanceTimersByTime(1000); });
    expect(h.boom).toHaveBeenCalledTimes(1);
  });
});

describe('Nothing planned yet, flag on vs off', () => {
  for (const kind of ['c', 'b'] as const) {
    it(`${kind}: gone with the flag on, ticket-free rows kept`, () => {
      home(kind);
      expect(document.body.textContent).not.toMatch(/Nothing planned yet|Find events this week/);
      expect(screen.queryByTestId('home-c-go-card')).toBeNull();
      expect(screen.queryByTestId('home-b-cta')).toBeNull();
      expect(screen.getByTestId(kind === 'c' ? 'home-b-attended' : 'home-b-attended').textContent).toContain('1 night attended');
    });
    it(`${kind}: present with the flag off`, () => {
      h.v3 = false;
      home(kind);
      expect(document.body.textContent).toContain('Nothing planned yet');
      expect(document.body.textContent).toContain('Find events this week');
    });
  }
  it('layout C draws the ring card under Get ready; flag off draws neither', () => {
    home('c');
    expect(screen.getByTestId('home-ring')).toBeTruthy();
    cleanup();
    h.v3 = false;
    home('c');
    expect(screen.queryByTestId('home-ring')).toBeNull();
  });
});
