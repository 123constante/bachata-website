// @vitest-environment jsdom
/** Dancer onboarding v3 slice 3: the Home "Make your profile shine" card (layout C, behind the v3 flag). */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { MemoryRouter } from 'react-router-dom';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';

const h = vi.hoisted(() => ({ v3: true }));
vi.mock('../../onboarding/onboardingV3Flag', () => ({ get DANCER_ONBOARDING_V3_ENABLED() { return h.v3; } }));
vi.mock('@/hooks/useAuth', () => ({ useAuth: () => ({ user: { id: 'u1' } }) }));

import ShineCard, { SHINE_ADD_PATH, shineDismissed, shineKey, shineMissing } from '../ShineCard';
import { HomeCView } from '../homeOptionB';
import { CITY_LONDON, makeProfile } from '../../../api/fixtures';

const DAY = 24 * 60 * 60 * 1000;
const COMPLETE = makeProfile({ first_name: 'Ana', based_city_id: CITY_LONDON.id, dance_role: 'Follower', avatar_url: 'https://img.example/ana.jpg' });
const BOTH = { bio: 'Hello', instagram: 'ana' };

beforeEach(() => { h.v3 = true; try { localStorage.clear(); } catch { /* jsdom */ } });
afterEach(() => { cleanup(); vi.useRealTimers(); vi.restoreAllMocks(); });

const card = (over = {}) => render(<MemoryRouter><ShineCard profile={makeProfile(over)} /></MemoryRouter>);

describe('ShineCard keep-list', () => {
  it('one line of copy, no heading, section label, Add (44px+) to the bio step, dismiss cross 44px', () => {
    card();
    const sec = screen.getByRole('region', { name: 'Make your profile shine' });
    expect(sec.textContent).toContain('Add a bio and a link so dancers know you.');
    expect(screen.queryByRole('heading')).toBeNull();
    const add = screen.getByTestId('home-shine-add');
    expect(add.textContent).toBe('Add');
    expect(add.getAttribute('href')).toBe('/app/welcome?step=bio&returnTo=/app/home');
    expect(SHINE_ADD_PATH).toBe('/app/welcome?step=bio&returnTo=/app/home');
    expect(add.className).toMatch(/min-h-\[52px\]/);
    const x = screen.getByLabelText('Dismiss');
    expect(x.className).toMatch(/h-\[44px\]/);
    expect(x.className).toMatch(/w-\[44px\]/);
    expect(x.className).toMatch(/right-0/);
    expect(sec.querySelector('p')?.className).toMatch(/pr-\[44px\]/);
    expect(sec.textContent).not.toMatch(/NEW/);
  });
});

describe('missing rule (every role)', () => {
  const cases: Array<[string, object, boolean]> = [
    ['nothing', {}, true],
    ['bio only', { bio: 'Hi' }, true],
    ['instagram only', { instagram: 'ana' }, true],
    ['bio + instagram', BOTH, false],
    ['bio + facebook', { bio: 'Hi', facebook: 'ana' }, false],
    ['bio + website', { bio: 'Hi', website_url: 'https://a.test' }, false],
    ['blank bio spaces + link', { bio: '  ', instagram: 'ana' }, true],
  ];
  it.each(cases)('%s', (_n, over, shown) => {
    expect(shineMissing(makeProfile(over))).toBe(shown);
    card(over);
    expect(!!screen.queryByTestId('home-shine')).toBe(shown);
  });
  it.each([['dancer'], ['organiser'], ['teacher'], ['dj']] as const)('shown for role %s', (r) => {
    card({ buyer_roles: [r] });
    expect(screen.getByTestId('home-shine')).toBeTruthy();
  });
  it('renders nothing until the profile has loaded', () => {
    const { container } = render(<MemoryRouter><ShineCard profile={undefined} /></MemoryRouter>);
    expect(container.innerHTML).toBe('');
  });
});

describe('dismiss', () => {
  it('writes a timestamp and hides the card', () => {
    vi.useFakeTimers().setSystemTime(1_700_000_000_000);
    card();
    fireEvent.click(screen.getByLabelText('Dismiss'));
    expect(screen.queryByTestId('home-shine')).toBeNull();
    expect(localStorage.getItem(shineKey('u1'))).toBe('1700000000000');
    expect(shineKey('u1')).toBe('dancer_app_shine_dismissed:u1');
  });
  it('30-day rule with a mocked clock: hidden at day 29, back at day 30 while still missing', () => {
    const t0 = 1_700_000_000_000;
    localStorage.setItem(shineKey('u1'), String(t0));
    expect(shineDismissed('u1', t0 + 29 * DAY)).toBe(true);
    expect(shineDismissed('u1', t0 + 30 * DAY)).toBe(false);
    vi.useFakeTimers().setSystemTime(t0 + 29 * DAY);
    card();
    expect(screen.queryByTestId('home-shine')).toBeNull();
    cleanup();
    vi.setSystemTime(t0 + 31 * DAY);
    card();
    expect(screen.getByTestId('home-shine')).toBeTruthy();
  });
  it('never returns once bio + a link exist, even after 30 days', () => {
    localStorage.setItem(shineKey('u1'), '1');
    card(BOTH);
    expect(screen.queryByTestId('home-shine')).toBeNull();
  });
  it('works with storage blocked: hides for the visit, no throw', () => {
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => { throw new Error('blocked'); });
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => { throw new Error('blocked'); });
    card();
    expect(screen.getByTestId('home-shine')).toBeTruthy();
    fireEvent.click(screen.getByLabelText('Dismiss'));
    expect(screen.queryByTestId('home-shine')).toBeNull();
  });
});

describe('Home layout C placement + keep-list', () => {
  const home = () =>
    render(
      <MemoryRouter>
        <HomeCView profile={COMPLETE} went={1} night={null} goingCount={0} focusLoading={false} alerts={null} rate={null} ticket={null} />
      </MemoryRouter>,
    );
  const order = () => Array.from(document.querySelectorAll('[data-testid]')).map((e) => e.getAttribute('data-testid'));

  it('flag on: the card sits between the "1 night attended" card and the Be found heading; the rest is as today', () => {
    home();
    const ids = order();
    expect(ids.indexOf('home-b-attended')).toBeGreaterThan(-1);
    expect(ids.indexOf('home-shine')).toBeGreaterThan(ids.indexOf('home-b-attended'));
    expect(ids.indexOf('home-shine')).toBeLessThan(ids.indexOf('home-c-head-found'));
    expect(screen.getByRole('heading', { level: 1 }).textContent).toMatch(/^Hi/);
    expect(screen.getByTestId('home-b-attended').textContent).toContain('1 night attended');
    expect(screen.getByTestId('home-c-head-found').textContent).toBe('Be found');
    expect(screen.getByTestId('home-c-preview').textContent).toContain('Preview my page');
    expect(screen.getByTestId('home-b-share')).toBeTruthy();
  });
  it('flag off: no card, same ids as before', () => {
    h.v3 = false;
    home();
    expect(screen.queryByTestId('home-shine')).toBeNull();
    expect(order()).toContain('home-c-head-found');
  });
});
