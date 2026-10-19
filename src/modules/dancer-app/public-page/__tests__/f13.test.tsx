// @vitest-environment jsdom
/**
 * F13 teal dancer page: the F14 stress shapes (thin, overfull, one event, no events +
 * practising, no nationality / no photo), table-driven over the model and the render.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { mapDancerPublicProfile } from '@/modules/profile/dancerPublicProfile';
import { NO_EXTRAS, buildPublicDancerPage, cityOnly, practiceGoalText, type GoingNextEvent, type PublicPageExtras } from '../model';
import { PublicDancerPageV2 } from '../PublicDancerPageV2';
import { installJsdomPolyfills } from '../../../../../tests/client/jsdomPolyfills';

vi.mock('@/lib/goingCheckin', () => ({ GOING_CHECKIN_ENABLED: true })); // these specs exercise the check-in surfaces
vi.mock('@/hooks/useAuth', () => ({ useAuth: () => ({ user: null, authStatus: 'ready' }) }));

const rec = (over: Record<string, unknown>) => ({
  id: 'id-x', first_name: 'Ricky', surname: null, display_name: 'Ricky Q', nationality: null, dance_role: null, instagram: null, facebook: null,
  avatar_url: null, website_url: null, gallery_urls: null, cities: null, dancing_role_details: null, ...over,
});
const ev = (n: number): GoingNextEvent[] => Array.from({ length: n }, (_, i) => ({ id: `e${i}`, date: `FRI ${i + 1} OCT`, name: `Event ${i}`, venue: 'Venue' }));

const THIN = rec({ instagram: '@thin', dancing_role_details: { dance_started_year: 2025 } });
const OVERFULL = rec({
  display_name: 'Maria-Fernanda Alejandra de los Santos Quinonez Villalobos', nationality: 'EC', dance_role: 'Leader', avatar_url: 'https://cdn.example.test/p.jpg',
  cities: { name: 'London' }, instagram: '@a_very_long_instagram_handle_that_goes_on_and_on_and_on', facebook: 'https://facebook.com/a.very.long.name.indeed.yes',
  website_url: 'https://example.com/a/very/long/path/that/keeps/going/and/going/and/going',
  dancing_role_details: { dance_started_year: 2015, favorite_styles: ['Sensual', 'Dominican', 'Moderna'], achievements: ['A', 'B', 'C', 'D'], looking_for_partner: true, partner_practice_goals: ['Competition prep', 'Footwork', 'Third'] },
});
const LANG5: PublicPageExtras = { bio: 'hidden bio', languages: ['en', 'es', 'it', 'de', 'fr'], whatsapp: null };

const build = (r: ReturnType<typeof rec>, extras = NO_EXTRAS, going?: Parameters<typeof buildPublicDancerPage>[3]) =>
  buildPublicDancerPage(mapDancerPublicProfile(r as never), extras, [], going);

const show = (m: ReturnType<typeof build>) =>
  render(<MemoryRouter><PublicDancerPageV2 model={m} profileId="id-x" pathname="/dancers/x" /></MemoryRouter>);
const q = (id: string) => screen.queryByTestId(id);

beforeEach(() => {
  installJsdomPolyfills();
  vi.useFakeTimers({ toFake: ['Date', 'setTimeout', 'clearTimeout'], now: new Date('2026-10-18T12:00:00Z') });
});
afterEach(() => { cleanup(); vi.useRealTimers(); vi.restoreAllMocks(); });

describe('F14a thin: only years + one link', () => {
  it('one fact column, no languages, no stamp, no going, no achievements', () => {
    show(build(THIN));
    expect(q('dancer-facts')!.children).toHaveLength(2); // dancing + level; no style
    expect((q('dancer-facts') as HTMLElement).style.gridTemplateColumns).toContain('repeat(2');
    for (const id of ['dancer-languages', 'dancer-practice', 'dancer-going', 'dancer-highlights']) expect(q(id), id).toBeNull();
    expect(q('dancer-connect')!.querySelectorAll('li')).toHaveLength(1);
  });
  it('no facts at all: no row', () => {
    show(build(rec({})));
    expect(q('dancer-facts')).toBeNull();
  });
});

describe('F14b overfull', () => {
  it('long name wraps (clamped to 3 lines), 3 styles, 5 languages named, 3 link rows, 4 achievements, no horizontal overflow classes missing', () => {
    show(build(OVERFULL, LANG5));
    expect(q('dancer-name')!.className).toMatch(/break-words/);
    expect(q('dancer-name')!.className).toMatch(/line-clamp-3/);
    expect(q('dancer-facts')!.textContent).toContain('Sensual, Dominican, Moderna');
    expect(q('dancer-languages')!.textContent).toContain('English, Spanish, Italian, German, French');
    expect(q('dancer-connect')!.querySelectorAll('li')).toHaveLength(3);
    expect(q('dancer-highlights')!.querySelectorAll('li')).toHaveLength(4);
    expect(q('dancer-role-line')!.textContent).toBe('Leader \u00b7 London'); // role once
    expect(document.body.textContent).not.toContain('hidden bio');
    // long link text is cut with an ellipsis, not wrapped
    for (const span of q('dancer-connect')!.querySelectorAll('a span')) expect(span.className).toContain('truncate');
  });
  it('goals: first two only, plain words', () => {
    show(build(OVERFULL, LANG5));
    expect(q('dancer-practice')!.textContent).toContain('Goal: competition prep and footwork');
    expect(q('dancer-practice')!.textContent).not.toContain('Third');
  });
});

describe('Going next (opt-in, OFF by default)', () => {
  it.each([
    ['no input (default)', undefined, null],
    ['opted out', { optIn: false, events: ev(3) }, null],
    ['opted in, none', { optIn: true, events: [] }, null],
    ['one event', { optIn: true, events: ev(1) }, { shown: 1, seeAll: false }],
    ['two events', { optIn: true, events: ev(2) }, { shown: 2, seeAll: false }],
    ['six events', { optIn: true, events: ev(6) }, { shown: 2, seeAll: true }],
  ] as const)('%s', (_n, input, expected) => {
    const m = build(THIN, NO_EXTRAS, input as never);
    if (!expected) { expect(m.goingNext).toBeNull(); return; }
    expect(m.goingNext!.shown).toHaveLength(expected.shown);
    expect(m.goingNext!.seeAll).toBe(expected.seeAll);
    show(m);
    expect(q('dancer-going')!.textContent !== '' && (screen.queryByText(/See all 6 events/) !== null)).toBe(expected.seeAll);
  });
});

describe('F14c / F14d practice stamp', () => {
  it('not looking: no stamp even with goals stored', () => {
    show(build(rec({ dancing_role_details: { looking_for_partner: false, partner_practice_goals: ['x'] } })));
    expect(q('dancer-practice')).toBeNull();
  });
  it('looking, no goals: stamp without a Goal line; never follower/leader wanted', () => {
    show(build(rec({ dancing_role_details: { looking_for_partner: true, partner_search_role: 'Follower', partner_practice_goals: [] } })));
    const t = q('dancer-practice')!.textContent!;
    expect(t).toBe('Practice partner wanted');
    expect(t).not.toMatch(/follower|leader/i);
  });
  it.each([[[], null], [['Footwork'], 'footwork'], [['A', 'B', 'C'], 'a and b']] as const)('goal text %j', (g, out) => {
    expect(practiceGoalText(g as never)).toBe(out);
  });
});

describe('no nationality / no photo', () => {
  it('none: no flag, initials face; with photo + country: flag present', () => {
    show(build(rec({})));
    expect(screen.queryByRole('img', { name: /nationality/i })).toBeNull();
    expect(q('dancer-portrait-placeholder')).not.toBeNull();
    cleanup();
    show(build(OVERFULL));
    expect(screen.queryByRole('img', { name: /nationality/i })).not.toBeNull();
  });
});

describe('city is a name only', () => {
  it.each([['London', 'London'], ['London E8 3QJ', 'London'], ['London SW1A', 'London'], ['E8 3QJ', null], [null, null]] as const)('%s', (i, o) => {
    expect(cityOnly(i)).toBe(o);
  });
});

describe('Contact rows and Copy', () => {
  it('Copy copies the FULL text, then says Copied for ~2s', async () => {
    const writeText = vi.fn(async () => undefined);
    Object.defineProperty(navigator, 'clipboard', { value: { writeText }, configurable: true });
    show(build(OVERFULL));
    const buttons = screen.getAllByTestId('dancer-copy');
    expect(buttons).toHaveLength(3);
    await act(async () => { fireEvent.click(buttons[2]); });
    expect(writeText).toHaveBeenCalledWith('https://example.com/a/very/long/path/that/keeps/going/and/going/and/going');
    expect(buttons[2].textContent).toBe('Copied');
    await act(async () => { vi.advanceTimersByTime(2100); });
    expect(buttons[2].textContent).toBe('Copy');
  });
  it('rows are links that open (handle underlined, new tab)', () => {
    show(build(OVERFULL));
    const a = q('dancer-connect')!.querySelector('a')!;
    expect(a.getAttribute('href')).toBeTruthy();
    expect(a.className).toContain('underline');
    expect(a.getAttribute('target')).toBe('_blank');
  });
});

describe('Back / Share targets', () => {
  it('both at least 44px tall', () => {
    show(build(THIN));
    expect((q('dancer-back') as HTMLElement).style.minHeight).toBe('44px');
    expect((q('dancer-share') as HTMLElement).style.minHeight).toBe('44px');
  });
});
