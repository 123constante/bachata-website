// @vitest-environment jsdom
/**
 * Dancer layout C, slice S1 (brief dancer-layout-c-s1): Home grouped under Get ready / Go out /
 * Be found behind VITE_ENABLE_DANCER_LAYOUT_C. Table-driven: every state x the DOM order of the
 * heads and rows the prototype checklist names. Flag OFF: today's Home (the A/B path) unchanged.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { MemoryRouter } from 'react-router-dom';
import { cleanup, render, screen, waitFor } from '@testing-library/react';
import type { MyDancerEdit } from '../../../api/types';
import type { HomeGoing, HeroNight } from '../homeParts';

const h = vi.hoisted(() => ({
  layoutC: true,
  dashB: false,
  going: false,
  ticketing: false,
  teaser: false,
  profile: null as unknown,
  error: null as unknown,
  went: 0 as number | null,
  feed: null as unknown,
}));

vi.mock('../layoutCFlag', () => ({ get DANCER_LAYOUT_C_ENABLED() { return h.layoutC; } }));
vi.mock('../dashBFlag', () => ({ get DANCER_DASH_B_ENABLED() { return h.dashB; } }));
vi.mock('@/lib/goingCheckin', () => ({ get GOING_CHECKIN_ENABLED() { return h.going; } }));
vi.mock('../../teaser/teaserFlag', () => ({ get TICKET_TEASER_ENABLED() { return h.teaser; } }));
vi.mock('@/lib/featureFlags', async (orig) => {
  const real = (await orig()) as { flags: Record<string, unknown> };
  return { ...real, flags: new Proxy(real.flags, { get: (t, k) => (k === 'publicTicketing' ? h.ticketing : t[k as string]) }) };
});
vi.mock('@/hooks/useAuth', () => ({ useAuth: () => ({ user: { id: 'u1' } }) }));
vi.mock('../../../api/useMyDancerEdit', () => ({
  useMyDancerEdit: () => ({ isLoading: false, error: h.error, data: h.profile, refetch: () => undefined }),
}));
vi.mock('../../../api/useMyNumbers', () => ({ useMyNumbers: () => ({ data: h.went === null ? undefined : { went: h.went } }) }));
vi.mock('../../../analytics/events', () => ({ trackDancerEvent: () => false }));
vi.mock('../homeGoing', async () => {
  const { useEffect } = await import('react');
  const Feed = ({ onGoing }: { onGoing: (g: HomeGoing) => void }) => {
    useEffect(() => onGoing(h.feed as HomeGoing), [onGoing]);
    return null;
  };
  return { default: Feed };
});
vi.mock('../RateNudge', () => ({ RateNudge: () => <a data-testid="rate-nudge" href="/app/nights">Rate last night</a> }));
vi.mock('../homeTicket', () => ({ default: () => <section data-testid="home-c-ticket">Your ticket</section> }));
vi.mock('../claimCard', () => ({ ClaimCard: () => <div data-testid="claim-card" /> }));
vi.mock('../../options/NoProfileWayOut', () => ({ default: () => <div data-testid="no-profile-way-out" /> }));

import HomeScreen from '../HomeScreen';
import { CITY_LONDON, makeProfile } from '../../../api/fixtures';
import { DancerApiError } from '../../../api/errors';
import { SHARE_INCOMPLETE_REASON } from '../homeFocus';
import { HIDDEN_SHARE_REASON } from '../../options/optionsModel';

afterEach(cleanup);
beforeEach(() => {
  Object.assign(h, { layoutC: true, dashB: false, going: false, ticketing: false, teaser: false, error: null, went: 0, feed: null });
  try { localStorage.clear(); } catch { /* jsdom */ }
});

const FOUR = { first_name: 'Ana', based_city_id: CITY_LONDON.id, dance_role: 'Follower' as const, avatar_url: 'https://img.example/ana.jpg' };
const INCOMPLETE = makeProfile({ first_name: 'Ana', based_city_id: CITY_LONDON.id });
const COMPLETE = makeProfile({ ...FOUR });
const NIGHT: HeroNight = { name: 'Bachata Sensual Social', inDays: 'in 2 days', place: 'The Loft, London', tag: 'Going', href: '/event/x' };
const feed = (o: Partial<HomeGoing>): HomeGoing => ({
  isLoading: false, isError: false, retry: () => undefined, hero: null, how: null, nudge: [], todayKey: '2026-11-20',
  goingCount: 0, wentCount: 0, tagGoing: 'Going', tileHelp: null, ...o,
});
const A_NUDGE = [{ seriesId: 's1' }] as unknown as HomeGoing['nudge'];

/** The checklist's ids, in the order layout C must draw them. */
const ORDER = [
  'paused-banner', 'linked-notice',
  'home-c-head-ready', 'home-b-focus',
  'home-c-head-go', 'rate-nudge', 'home-c-ticket', 'home-c-go-card', 'home-b-more-plans', 'home-b-attended', 'home-b-first-night',
  'home-c-head-found', 'home-b-share', 'home-b-share-off', 'home-c-preview',
  'claim-card', 'no-profile-way-out',
];
const drawn = () =>
  Array.from(document.querySelectorAll('[data-testid]'))
    .map((e) => e.getAttribute('data-testid') as string)
    .filter((id) => ORDER.includes(id));

type Row = {
  name: string;
  profile: MyDancerEdit | null;
  setup?: () => void;
  expected: string[];
};

const ROWS: Row[] = [
  {
    name: 'profile incomplete, went 0',
    profile: INCOMPLETE,
    expected: ['home-c-head-ready', 'home-b-focus', 'home-c-head-go', 'home-b-first-night', 'home-c-head-found', 'home-b-share-off', 'home-c-preview'],
  },
  {
    name: 'complete + no night (going on, nothing planned)',
    profile: COMPLETE,
    setup: () => { h.going = true; h.feed = feed({}); },
    expected: ['home-c-head-go', 'home-c-go-card', 'home-b-first-night', 'home-c-head-found', 'home-b-share', 'home-c-preview'],
  },
  {
    name: 'complete + night + 3 plans + 12 attended',
    profile: COMPLETE,
    setup: () => { h.going = true; h.went = 12; h.feed = feed({ hero: NIGHT, goingCount: 3 }); },
    expected: ['home-c-head-go', 'home-c-go-card', 'home-b-more-plans', 'home-b-attended', 'home-c-head-found', 'home-b-share', 'home-c-preview'],
  },
  {
    name: 'going on with a rate candidate: Rate first in Go out',
    profile: COMPLETE,
    setup: () => { h.going = true; h.feed = feed({ nudge: A_NUDGE }); },
    expected: ['home-c-head-go', 'rate-nudge', 'home-c-go-card', 'home-b-first-night', 'home-c-head-found', 'home-b-share', 'home-c-preview'],
  },
  {
    name: 'going off (prod): no rate, find card, attended last',
    profile: COMPLETE,
    setup: () => { h.going = false; h.went = 4; },
    expected: ['home-c-head-go', 'home-c-go-card', 'home-b-attended', 'home-c-head-found', 'home-b-share', 'home-c-preview'],
  },
  {
    name: 'ticketing on: Your ticket second, after Rate',
    profile: COMPLETE,
    setup: () => { h.ticketing = true; h.going = true; h.feed = feed({ nudge: A_NUDGE }); },
    expected: ['home-c-head-go', 'rate-nudge', 'home-c-ticket', 'home-c-go-card', 'home-b-first-night', 'home-c-head-found', 'home-b-share', 'home-c-preview'],
  },
  {
    name: 'ticketing on + teaser on: no ticket card on Home',
    profile: COMPLETE,
    setup: () => { h.ticketing = true; h.teaser = true; },
    expected: ['home-c-head-go', 'home-c-go-card', 'home-b-first-night', 'home-c-head-found', 'home-b-share', 'home-c-preview'],
  },
  {
    name: 'paused: banner above everything, share off with the hidden reason',
    profile: makeProfile({ ...FOUR, is_active: false }),
    expected: ['paused-banner', 'home-c-head-go', 'home-c-go-card', 'home-b-first-night', 'home-c-head-found', 'home-b-share-off', 'home-c-preview'],
  },
  {
    name: 'linked + incomplete: notice above Get ready',
    profile: makeProfile({ first_name: 'Ana', linked_from_admin: true }),
    expected: ['linked-notice', 'home-c-head-ready', 'home-b-focus', 'home-c-head-go', 'home-b-first-night', 'home-c-head-found', 'home-b-share-off', 'home-c-preview'],
  },
  {
    name: 'attended not loaded yet, incomplete: Go out has nothing, so no head',
    profile: INCOMPLETE,
    setup: () => { h.went = null; },
    expected: ['home-c-head-ready', 'home-b-focus', 'home-c-head-found', 'home-b-share-off', 'home-c-preview'],
  },
  {
    name: 'no_profile: Claim card + way out, unchanged',
    profile: null,
    setup: () => { h.error = new DancerApiError('no_profile', 'no profile'); },
    expected: ['claim-card', 'no-profile-way-out'],
  },
];

const mount = () => render(<MemoryRouter initialEntries={['/app/home']}><HomeScreen /></MemoryRouter>);

describe('layout C Home: DOM order per state', () => {
  for (const row of ROWS) {
    it(row.name, async () => {
      h.profile = row.profile;
      row.setup?.();
      mount();
      await waitFor(() => expect(drawn()).toEqual(row.expected));
      if (row.profile) {
        expect(screen.getByRole('heading', { level: 1 }).textContent).toMatch(/^Hi Ana$/);
        // Get ready only while the profile is incomplete; the profile card never shows in Go out.
        expect(screen.queryByTestId('home-c-head-ready') !== null).toBe(row.expected.includes('home-b-focus'));
        expect(screen.getByTestId('home-c-preview').getAttribute('href')).toBe('/app/page');
        // Nights attended / first night: never a link.
        for (const id of ['home-b-attended', 'home-b-first-night']) {
          const el = screen.queryByTestId(id);
          if (el) { expect(el.tagName).not.toBe('A'); expect(el.closest('a')).toBeNull(); }
        }
        expect(document.body.textContent).not.toMatch(/\b0 (nights|more)/);
      }
    });
  }

  it('heads read Get ready / Go out / Be found, in the prototype head2 look', async () => {
    h.profile = INCOMPLETE;
    mount();
    const heads = await screen.findAllByRole('heading', { level: 2 });
    const labels = heads.filter((x) => x.dataset.testid?.startsWith('home-c-head')).map((x) => x.textContent);
    expect(labels).toEqual(['Get ready', 'Go out', 'Be found']);
    const s = screen.getByTestId('home-c-head-go').style;
    expect([s.fontSize, s.textTransform, s.letterSpacing, s.fontWeight]).toEqual(['11px', 'uppercase', '0.08em', '700']);
  });

  it('share keeps its disabled reasons (incomplete / hidden)', async () => {
    h.profile = INCOMPLETE;
    mount();
    expect((await screen.findByTestId('home-b-share-off')).textContent).toContain(SHARE_INCOMPLETE_REASON);
    cleanup();
    h.profile = makeProfile({ ...FOUR, is_active: false });
    mount();
    expect((await screen.findByTestId('home-b-share-off')).textContent).toContain(HIDDEN_SHARE_REASON);
  });

  it('the Go out card is the find card with its button, or the night with Open the night', async () => {
    h.profile = COMPLETE;
    mount();
    expect((await screen.findByTestId('home-c-go-card')).textContent).toMatch(/Nothing planned yet.*Find events this week/);
    cleanup();
    h.going = true;
    h.feed = feed({ hero: NIGHT, goingCount: 1 });
    mount();
    await waitFor(() => expect(screen.getByTestId('home-c-go-card').textContent).toContain('Open the night'));
    expect(screen.queryByTestId('home-b-more-plans')).toBeNull();
  });

  it('C wins over the A/B switch', async () => {
    h.dashB = true;
    h.profile = COMPLETE;
    mount();
    expect(await screen.findByTestId('home-c-complete')).toBeTruthy();
    expect(screen.queryByText('Also')).toBeNull();
  });
});

describe('layout C OFF: the current Home', () => {
  for (const dashB of [false, true]) {
    it(`dash B ${dashB ? 'on' : 'off'}: no C heads, no Preview row, alerts before the view`, async () => {
      h.layoutC = false;
      h.dashB = dashB;
      h.profile = makeProfile({ ...FOUR, is_active: false });
      mount();
      await screen.findByTestId('paused-banner');
      expect(screen.queryByTestId('home-c-head-go')).toBeNull();
      expect(screen.queryByTestId('home-c-preview')).toBeNull();
      expect(screen.queryByTestId('home-c-ticket')).toBeNull();
      if (dashB) expect(screen.getByText('Also')).toBeTruthy();
      expect(screen.getByRole('heading', { level: 1 }).textContent).toBe('Hi Ana');
    });
  }
});
