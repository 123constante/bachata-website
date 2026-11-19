// @vitest-environment jsdom
import { describe, expect, it, beforeEach } from 'vitest';
import { feedEndRows, menuRows, SUPPORT_LINKS, type MenuRole } from '../menuModel';
import { matchesCats, formatMiles, readNearestPref, writeNearestPref, type ChipCat } from '../chips';
import { searchGroupOf } from '../searchFilter';
import { clearRecent, pushRecent, readRecent } from '../recentSearches';

const base = {
  signInHref: '/auth?returnTo=%2F',
  venuesHref: '/city/london-gb/venues',
  communityHref: 'https://chat.whatsapp.com/x',
  accountHref: '/account',
  organiserHomeHref: '/account/p3',
  sellTicketsHref: '/account/p3/events',
};

describe('menu rows per role', () => {
  const cases: [MenuRole, boolean, string[], number][] = [
    ['signedOut', false, ['signin'], 8],
    ['signedOut', true, ['signin'], 9],
    ['signedIn', false, ['profile'], 8],
    ['organiser', true, ['profile', 'orgdash', 'sell'], 9],
  ];
  it.each(cases)('%s (raffles %s)', (role, rafflesOn, accountIds, browseCount) => {
    const { account, browse } = menuRows({ ...base, role, rafflesOn });
    expect(account.map((r) => r.id)).toEqual(accountIds);
    expect(browse).toHaveLength(browseCount);
    expect(browse.some((r) => r.id === 'raffles')).toBe(rafflesOn);
    // Every row the brief names is present, every href is real.
    for (const id of ['dancers', 'teachers', 'djs', 'organisers', 'venues', 'festivals', 'cities', 'community']) {
      expect(browse.find((r) => r.id === id)?.href).toBeTruthy();
    }
    expect(browse.find((r) => r.id === 'community')?.external).toBe(true);
  });
  it.each([[true, ['organisers', 'venues', 'raffles']], [false, ['organisers', 'venues']]] as const)(
    'end-of-feed block mirrors the menu rows (raffles %s)',
    (on, ids) => {
      const rows = feedEndRows('/city/london-gb/venues', on);
      expect(rows.map((r) => r.id)).toEqual(ids);
      expect(rows.find((r) => r.id === 'venues')?.href).toBe('/city/london-gb/venues');
    },
  );
  it('support has exactly the three Stripe links', () => {
    expect(SUPPORT_LINKS.map((s) => s.label)).toEqual(['£3', '£5', '£10']);
    for (const s of SUPPORT_LINKS) expect(s.href.startsWith('https://buy.stripe.com/')).toBe(true);
  });
});

describe('chip filters', () => {
  const ev = (o: Partial<{ type: string; format: string | null; has_party: boolean; has_class: boolean }>) =>
    ({ type: 'party', format: null, has_party: false, has_class: false, ...o }) as never;
  const party = ev({ has_party: true });
  const cls = ev({ type: 'class', has_class: true });
  const mix = ev({ has_party: true, has_class: true });
  const fest = ev({ type: 'festival' });
  const social = ev({ type: 'social' });
  const S = (...c: ChipCat[]) => new Set(c);
  it.each([
    ['none on', S(), [true, true, true, true, true]],
    ['party', S('party'), [true, false, true, false, false]],
    ['class', S('class'), [false, true, true, false, false]],
    ['fest', S('fest'), [false, false, false, true, false]],
    ['party+fest', S('party', 'fest'), [true, false, true, true, false]],
  ])('%s', (_n, cats, want) => {
    expect([party, cls, mix, fest, social].map((e) => matchesCats(e, cats))).toEqual(want);
  });
  it('formats miles, rough with ~', () => {
    expect(formatMiles(2.34, false)).toBe('2.3 mi');
    expect(formatMiles(12.6, true)).toBe('~13 mi');
  });
});

describe('search chips', () => {
  it.each([
    ['event', 'events'],
    ['teacher', 'people'],
    ['dj', 'people'],
    ['dancer', 'people'],
    ['person', 'people'],
    ['organiser', 'people'],
    ['venue', 'venues'],
    ['city', null],
    ['vendor', null],
  ] as const)('%s -> %s', (k, g) => expect(searchGroupOf(k)).toBe(g));
});

describe('local prefs', () => {
  beforeEach(() => window.localStorage.clear());
  it('recent searches: newest first, de-duped, cleared', () => {
    expect(readRecent()).toEqual([]);
    pushRecent('salsa');
    pushRecent('Bachata');
    pushRecent('SALSA');
    pushRecent('x');
    expect(readRecent()).toEqual(['SALSA', 'Bachata']);
    clearRecent();
    expect(readRecent()).toEqual([]);
  });
  it('nearest preference stores only a flag', () => {
    expect(readNearestPref()).toBe(false);
    writeNearestPref(true);
    expect(readNearestPref()).toBe(true);
    expect(JSON.stringify(window.localStorage)).not.toMatch(/lat|lng/);
    writeNearestPref(false);
    expect(readNearestPref()).toBe(false);
  });
});
