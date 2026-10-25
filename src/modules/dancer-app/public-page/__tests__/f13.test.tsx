// @vitest-environment jsdom
/**
 * F13 teal dancer page: the F14 stress shapes (thin, overfull, one event, no events +
 * practising, no nationality / no photo), table-driven over the model and the render.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { mapDancerPublicProfile } from '@/modules/profile/dancerPublicProfile';
import { NO_EXTRAS, buildPublicDancerPage, cityOnly, practiceGoalText, type PublicPageExtras } from '../model';
import { GOING_COPY, nightLine, type GoingNextNight } from '@/modules/going';
import { PublicDancerPageV2 } from '../PublicDancerPageV2';
import { installJsdomPolyfills } from '../../../../../tests/client/jsdomPolyfills';

const h = vi.hoisted(() => ({ on: true }));
vi.mock('@/lib/goingCheckin', () => ({ get GOING_CHECKIN_ENABLED() { return h.on; } }));
vi.mock('@/hooks/useAuth', () => ({ useAuth: () => ({ user: null, authStatus: 'ready' }) }));

const rec = (over: Record<string, unknown>) => ({
  id: 'id-x', first_name: 'Ricky', surname: null, display_name: 'Ricky Q', nationality: null, dance_role: null, instagram: null, facebook: null,
  avatar_url: null, website_url: null, gallery_urls: null, cities: null, dancing_role_details: null, ...over,
});
/** get_public_dancer_extras_v1 going_next rows (London wall clock, no zone). */
const goingNext = (n: number): GoingNextNight[] => Array.from({ length: n }, (_, i) => ({
  occurrence_id: `occ${i}`, public_event_id: `ev${i}`, event_title: `Event ${i}`, occurrence_date: `2099-01-0${i + 1}`, starts_at_local: `2099-01-0${i + 1}T21:00:00`,
}));

const THIN = rec({ instagram: '@thin', dancing_role_details: { dance_started_year: 2025 } });
const OVERFULL = rec({
  display_name: 'Maria-Fernanda Alejandra de los Santos Quinonez Villalobos', nationality: 'EC', dance_role: 'Leader', avatar_url: 'https://cdn.example.test/p.jpg',
  cities: { name: 'London' }, instagram: '@a_very_long_instagram_handle_that_goes_on_and_on_and_on', facebook: 'https://facebook.com/a.very.long.name.indeed.yes',
  website_url: 'https://example.com/a/very/long/path/that/keeps/going/and/going/and/going',
  dancing_role_details: { dance_started_year: 2015, favorite_styles: ['Sensual', 'Dominican', 'Moderna'], achievements: ['A', 'B', 'C', 'D'], looking_for_partner: true, partner_practice_goals: ['Competition prep', 'Footwork', 'Third'] },
});
const LANG5: PublicPageExtras = { bio: 'hidden bio', languages: ['en', 'es', 'it', 'de', 'fr'], whatsapp: null };

const build = (r: ReturnType<typeof rec>, extras: PublicPageExtras = NO_EXTRAS) =>
  buildPublicDancerPage(mapDancerPublicProfile(r as never), extras, []);

const show = (m: ReturnType<typeof build>) =>
  render(<MemoryRouter><PublicDancerPageV2 model={m} profileId="id-x" pathname="/dancers/x" /></MemoryRouter>);
const q = (id: string) => screen.queryByTestId(id);

beforeEach(() => {
  installJsdomPolyfills();
  h.on = true;
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

describe('Going next (Going P2: ALWAYS shows while the going switch is on; no opt-in)', () => {
  // going_next 0 / 1 / 2 / 3 (the RPC sends at most 3) x hidden page (extras SQL NULL).
  it.each([
    ['hidden page (extras NULL)', null, null],
    ['no going_next key', undefined, null],
    ['0 nights', 0, null],
    ['1 night: one full-width card', 1, { shown: 1, seeAll: false }],
    ['2 nights: side by side', 2, { shown: 2, seeAll: false }],
    ['3 nights: two + See all 3', 3, { shown: 2, seeAll: true }],
  ] as const)('%s', (_n, count, expected) => {
    const extras = count === null ? NO_EXTRAS /* the loader maps NULL to NO_EXTRAS */ : count === undefined ? NO_EXTRAS : { ...NO_EXTRAS, goingNext: goingNext(count) };
    const m = build(THIN, extras);
    if (!expected) {
      expect(m.goingNext).toBeNull();
      show(m);
      expect(q('dancer-going')).toBeNull();
      return;
    }
    expect(m.goingNext!.shown).toHaveLength(expected.shown);
    expect(m.goingNext!.seeAll).toBe(expected.seeAll);
    show(m);
    const section = q('dancer-going')!;
    expect(section.textContent).toContain(GOING_COPY.goingNextTitle);
    expect(screen.getAllByTestId('dancer-going-card')).toHaveLength(expected.shown);
    // Each card is ONE night, its date read AS STORED (full weekday), linked to its event page.
    const first = screen.getAllByTestId('dancer-going-card')[0];
    // Same words as the module's nightLine; the time is held together ("9 PM" never splits in the 2-up cards).
    expect(first.textContent!.replace(/\u00a0/g, ' ')).toContain(nightLine(goingNext(1)[0].starts_at_local)!);
    expect(first.textContent).toMatch(/\u00b7 9\u00a0PM/);
    expect(first.getAttribute('href')).toBe('/event/ev0');
    const seeAll = screen.queryByTestId('dancer-going-see-all');
    expect(seeAll !== null).toBe(expected.seeAll);
    if (seeAll) {
      expect(seeAll.textContent).toBe(GOING_COPY.seeAll(3));
      expect(seeAll.getAttribute('aria-expanded')).toBe('false');
      // "See all" opens the rest right here: a working control, never a link back to this page.
      fireEvent.click(seeAll);
      expect(screen.getAllByTestId('dancer-going-card')).toHaveLength(3);
      expect(q('dancer-going-see-all')).toBeNull();
    }
  });

  it('switch off: no section even with nights', () => {
    h.on = false;
    const m = build(THIN, { ...NO_EXTRAS, goingNext: goingNext(3) });
    expect(m.goingNext).toBeNull();
    show(m);
    expect(q('dancer-going')).toBeNull();
  });

  it('a night with no public event is a card without a link; a missing time falls back to the date', () => {
    const [n] = goingNext(1);
    const m = build(THIN, { ...NO_EXTRAS, goingNext: [{ ...n, public_event_id: null, starts_at_local: null, occurrence_date: '2099-01-02' }] });
    show(m);
    const card = screen.getByTestId('dancer-going-card');
    expect(card.tagName).not.toBe('A');
    expect(card.textContent).toContain('Friday 2 Jan');
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
