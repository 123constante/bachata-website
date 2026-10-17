// @vitest-environment jsdom
/**
 * B1b S3: the numbers (Home + My page), My page, in-app feedback, the partner tile and consent.
 * Table-driven: every screen x every shape reads the same numbers through ONE mapping
 * (api/numbersModel), and a control that cannot work says why.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { ReactNode } from 'react';
import { cleanup, fireEvent, screen, waitFor } from '@testing-library/react';

vi.mock('@/hooks/useAuth', async (importOriginal) =>
  (await import('@/modules/dancer-app/shell/testAuth')).authModuleMock(importOriginal));

const h = vi.hoisted(() => ({
  rpcCalls: [] as Array<[string, unknown]>,
  rpc: async (fn: string, args?: unknown): Promise<unknown> => {
    h.rpcCalls.push([fn, args]);
    return { data: [], error: null };
  },
  from: () => ({ select: () => ({ eq: () => ({ maybeSingle: async () => ({ data: { slug: 'london-gb' }, error: null }) }) }) }),
}));
vi.mock('@/integrations/supabase/getSupabase', () => ({ getSupabase: async () => ({ rpc: h.rpc, from: h.from }) }));
vi.mock('@/integrations/supabase/client', () => ({ supabase: { rpc: (f: string, a?: unknown) => h.rpc(f, a), from: () => h.from() } }));
vi.mock('@/contexts/CityContext', () => ({
  CityProvider: ({ children }: { children: ReactNode }) => children,
  useCity: () => ({ citySlug: 'london-gb', setCitySlug: () => {} }),
}));
vi.mock('@/hooks/useCalendarEventsRpc', () => ({ useCalendarEvents: () => ({ data: [], isLoading: false, isError: false }) }));

import { renderInShell, resetShell } from '@/modules/dancer-app/shell/renderInShell';
import { DANCER_SHAPES } from '@/modules/dancer-app/api/fixtures';
import { STATS_SHAPES, STATS_SHAPE_NAMES } from '@/modules/dancer-app/api/statsFixtures';
import { fmt, numbersFrom } from '@/modules/dancer-app/api/numbersModel';
import { parseMyStats, parseMyViews } from '@/modules/dancer-app/api/rpc';
import { pageModel, NOT_READY_REASON, PAUSED_REASON } from '@/modules/dancer-app/screens/page/pageModel';
import { DANCER_EVENTS } from '@/modules/dancer-app/analytics/events';
import { acceptTerms } from '@/lib/termsConsent';
import { TERMS_VERSION } from '@/lib/legalVersions';
import { disabled, pointers } from './journeyChecks';

beforeEach(() => { h.rpcCalls = []; localStorage.clear(); sessionStorage.clear(); });
afterEach(() => { cleanup(); resetShell(); vi.restoreAllMocks(); });

const settle = async (testId: string) => {
  await screen.findByTestId(testId);
  await new Promise((r) => setTimeout(r, 30));
};

describe('numbers: one mapping, every screen x every stats shape', () => {
  it.each(STATS_SHAPE_NAMES)('%s: Home and My page show the same weekly count, never NaN', async (name) => {
    const fixture = STATS_SHAPES[name];
    const read: Record<string, string> = {};
    for (const [screenName, path, id] of [['home', '/app/home', 'tile-views-count'], ['page', '/app/page', 'page-views-count']] as const) {
      renderInShell({ path, backend: { shape: 'fourFieldComplete', statsShape: name } });
      if ('error' in fixture) {
        await waitFor(() => expect(screen.getByTestId(screenName === 'home' ? 'numbers-error' : 'page-views-error')).toBeTruthy());
      } else {
        read[screenName] = (await screen.findByTestId(id)).textContent ?? '';
        expect(read[screenName]).toBe(fmt(fixture.views.last_7_days));
      }
      const text = document.body.textContent ?? '';
      expect(text).not.toMatch(/NaN|undefined|null/);
      cleanup();
      resetShell();
    }
    if (!('error' in fixture)) expect(read.home).toBe(read.page);
  });

  it('error shape: Home says what happened and offers Try again', async () => {
    renderInShell({ path: '/app/home', backend: { statsShape: 'error' } });
    const box = await screen.findByTestId('numbers-error');
    expect(box.textContent).toMatch(/could not load your numbers/);
    expect(box.textContent).toMatch(/Try again/);
  });

  it('zero shape says what the dancer CAN do (photo first when there is none)', async () => {
    renderInShell({ path: '/app/home', backend: { shape: 'noPhoto', statsShape: 'zero' } });
    expect((await screen.findByTestId('tile-views-detail')).textContent).toBe('Add a photo and share your page.');
    expect(screen.getByTestId('stats-strip-empty').textContent).toMatch(/going to a night/);
    cleanup();
    renderInShell({ path: '/app/home', backend: { shape: 'fourFieldComplete', statsShape: 'zero' } });
    expect((await screen.findByTestId('tile-views-detail')).textContent).toBe('Share your page to get your first visitor.');
  });

  it('huge counts are grouped, normal strip shows four cells', async () => {
    renderInShell({ path: '/app/home', backend: { statsShape: 'huge' } });
    expect((await screen.findByTestId('tile-views-count')).textContent).toBe('54,321');
    expect(screen.getByTestId('stat-went-value').textContent).toBe('2,400');
  });

  it('the parsers turn null, NaN, text and negatives into 0', () => {
    const s = parseMyStats({ profile_id: 'p', nights_went: null, nights_going_upcoming: 'x', level_votes: -3, views_30_days: NaN, views_total: 7.9 });
    expect(s).toMatchObject({ nights_went: 0, nights_going_upcoming: 0, level_votes: 0, views_30_days: 0, views_total: 7 });
    expect(parseMyViews({ profile_id: 'p', total: undefined, last_7_days: '4' })).toMatchObject({ total: 0, last_7_days: 0, last_viewed_at: null });
    expect(() => parseMyStats(null)).toThrow();
    expect(numbersFrom(s, parseMyViews({ profile_id: 'p' })).noViews).toBe(false);
  });
});

describe('My page (/app/page): every profile shape', () => {
  const SHAPE_KEYS = Object.keys(DANCER_SHAPES).filter((k) => DANCER_SHAPES[k as keyof typeof DANCER_SHAPES].profile) as Array<keyof typeof DANCER_SHAPES>;
  it.each(SHAPE_KEYS)('%s: View + Share are enabled only when the page is public, else disabled WITH a reason', async (key) => {
    const profile = DANCER_SHAPES[key].profile!;
    renderInShell({ path: '/app/page', backend: { shape: key } });
    await settle('dancer-screen-page');
    const m = pageModel(profile);
    const view = screen.getByTestId('page-view');
    if (m.url) {
      expect(view.getAttribute('href')).toBe(m.url);
      expect(m.disabledReason).toBeNull();
      expect(screen.queryByTestId('page-why')).toBeNull();
    } else {
      expect((view as HTMLButtonElement).disabled).toBe(true);
      expect((screen.getByTestId('page-share') as HTMLButtonElement).disabled).toBe(true);
      expect(screen.getByTestId('page-why').textContent).toContain(profile.is_active ? NOT_READY_REASON : PAUSED_REASON);
    }
    expect(disabled(document.body)).toEqual([]);
    expect(pointers(document.body)).toEqual([]);
    expect(screen.getByTestId('page-look').textContent).toMatch(/It /);
  });

  it('a hidden profile is paused, not "not ready"; an incomplete one is not ready', () => {
    expect(pageModel(DANCER_SHAPES.paused.profile!).disabledReason).toBe(PAUSED_REASON);
    expect(pageModel(DANCER_SHAPES.emptyStub.profile!).disabledReason).toBe(NOT_READY_REASON);
  });

  it('Me and Options both reach it', async () => {
    renderInShell({ path: '/app/me' });
    expect((await screen.findByTestId('me-my-page')).getAttribute('href')).toBe('/app/page');
    cleanup(); resetShell();
    renderInShell({ path: '/app/options' });
    expect((await screen.findByTestId('opt-page')).getAttribute('href')).toBe('/app/page');
  });
});

describe('in-app feedback', () => {
  const open = async (opts: Parameters<typeof renderInShell>[0] = {}) => {
    const r = renderInShell({ path: '/app/options', ...opts });
    fireEvent.click(await screen.findByTestId('opt-feedback'));
    await screen.findByTestId('opt-feedback-sheet');
    return r;
  };
  const type = (v: string) => fireEvent.change(screen.getByTestId('feedback-text'), { target: { value: v } });

  it('keeps the WhatsApp help row as a separate row', async () => {
    renderInShell({ path: '/app/options' });
    expect((await screen.findByTestId('opt-help')).getAttribute('href')).toMatch(/^https:\/\/wa\.me\//);
  });

  it('empty box: Send is disabled WITH a reason', async () => {
    await open();
    expect((screen.getByTestId('feedback-send') as HTMLButtonElement).disabled).toBe(true);
    expect(screen.getByTestId('feedback-why').textContent).toMatch(/Write a message/);
    type('   ');
    expect((screen.getByTestId('feedback-send') as HTMLButtonElement).disabled).toBe(true);
  });

  it('too long: disabled with a reason', async () => {
    await open();
    type('x'.repeat(2001));
    expect((screen.getByTestId('feedback-send') as HTMLButtonElement).disabled).toBe(true);
    expect(screen.getByTestId('feedback-why').textContent).toMatch(/over 2000/);
  });

  it('sends kind + current route once, fires feedback_sent once, clears the box', async () => {
    const dl: unknown[] = [];
    (window as unknown as { dataLayer: unknown[] }).dataLayer = dl;
    const { backend } = await open();
    fireEvent.click(screen.getByTestId('feedback-kind-idea'));
    type('  Please add a map  ');
    fireEvent.click(screen.getByTestId('feedback-send'));
    await screen.findByTestId('feedback-thanks');
    expect(backend.feedback).toEqual([{ body: 'Please add a map', kind: 'idea', page: '/app/options' }]);
    expect(JSON.stringify(dl).match(/feedback_sent/g)).toHaveLength(1);
    expect(DANCER_EVENTS).toContain('feedback_sent');
  });

  it('rate_limited -> the owner copy, text kept', async () => {
    await open({ backend: { feedbackLimit: 0 } });
    type('hello');
    fireEvent.click(screen.getByTestId('feedback-send'));
    expect((await screen.findByTestId('feedback-error')).textContent).toBe('You\u2019ve sent a few today, try again tomorrow.');
    expect((screen.getByTestId('feedback-text') as HTMLTextAreaElement).value).toBe('hello');
  });

  it('area_closed -> its own copy', async () => {
    const { backend } = await open();
    backend.failNextWith('area_closed');
    type('hello');
    fireEvent.click(screen.getByTestId('feedback-send'));
    expect((await screen.findByTestId('feedback-error')).textContent).toMatch(/not open for your account/);
  });

  it('offline -> says so, sends nothing, keeps the text', async () => {
    const { backend } = await open();
    vi.spyOn(navigator, 'onLine', 'get').mockReturnValue(false);
    type('hello');
    fireEvent.click(screen.getByTestId('feedback-send'));
    expect((await screen.findByTestId('feedback-error')).textContent).toMatch(/offline/);
    expect(backend.feedback).toHaveLength(0);
    expect((screen.getByTestId('feedback-text') as HTMLTextAreaElement).value).toBe('hello');
  });

  it('an unknown failure while online keeps the text and fires no event', async () => {
    const dl: unknown[] = [];
    (window as unknown as { dataLayer: unknown[] }).dataLayer = dl;
    const { backend } = await open();
    backend.failNextWith('unknown');
    type('hello');
    fireEvent.click(screen.getByTestId('feedback-send'));
    await screen.findByTestId('feedback-error');
    expect(JSON.stringify(dl)).not.toMatch(/feedback_sent/);
  });
});

describe('partner tile', () => {
  it('asks once, then says "We\u2019ll tell you" with the button disabled', async () => {
    const { backend } = renderInShell({ path: '/app/home' });
    const btn = (await screen.findByTestId('partner-notify')) as HTMLButtonElement;
    await waitFor(() => expect(btn.disabled).toBe(false));
    expect(screen.getByTestId('tile-partner').textContent).toMatch(/Partner search: coming soon/);
    fireEvent.click(btn);
    await waitFor(() => expect(btn.textContent).toBe('We\u2019ll tell you'));
    expect(btn.disabled).toBe(true);
    expect(backend.interest).toEqual(['partner_search']);
    fireEvent.click(btn);
    expect(backend.calls.filter((c) => c.fn === 'registerFeatureInterest')).toHaveLength(1);
  });

  it('already registered (my_feature_interest_v1) shows "We\u2019ll tell you" straight away', async () => {
    const { backend } = renderInShell({ path: '/app/home', backend: { interest: ['partner_search'] } });
    const btn = (await screen.findByTestId('partner-notify')) as HTMLButtonElement;
    await waitFor(() => expect(btn.textContent).toBe('We\u2019ll tell you'));
    expect(btn.disabled).toBe(true);
    expect(backend.calls.some((c) => c.fn === 'registerFeatureInterest')).toBe(false);
  });

  it('a failed ask says why and the button stays usable', async () => {
    const { backend } = renderInShell({ path: '/app/home' });
    const btn = (await screen.findByTestId('partner-notify')) as HTMLButtonElement;
    await waitFor(() => expect(btn.disabled).toBe(false));
    backend.failNextWith('unknown');
    fireEvent.click(btn);
    expect((await screen.findByTestId('partner-error')).textContent).toMatch(/Something went wrong/);
    expect(btn.disabled).toBe(false);
  });
});

describe('consent (finding, not a fix)', () => {
  it('visiting the app screens records no consent: terms are recorded at sign-up / sign-in only', async () => {
    renderInShell({ path: '/app/home' });
    await settle('dancer-screen-home');
    renderInShell({ path: '/app/options' });
    await settle('dancer-screen-options');
    expect(h.rpcCalls.filter(([fn]) => fn === 'accept_terms_v1')).toHaveLength(0);
  });

  it('acceptTerms sends the one (kind, version); the server stores it once and a repeat is already_accepted', async () => {
    const stored = new Set<string>();
    h.rpc = async (fn: string, args?: unknown) => {
      h.rpcCalls.push([fn, args]);
      const a = args as { p_kind: string; p_version: string };
      const key = `${a.p_kind}:${a.p_version}`;
      const again = stored.has(key);
      stored.add(key);
      return { data: { already_accepted: again }, error: null };
    };
    expect(await acceptTerms()).toBe(true);
    expect(await acceptTerms()).toBe(true);
    const calls = h.rpcCalls.filter(([fn]) => fn === 'accept_terms_v1');
    expect(calls.every(([, a]) => JSON.stringify(a) === JSON.stringify({ p_kind: 'terms_privacy', p_version: TERMS_VERSION }))).toBe(true);
    expect(stored.size).toBe(1);
  });
});
