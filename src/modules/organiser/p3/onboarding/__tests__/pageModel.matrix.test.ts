/**
 * W4b build 2 slices 2+3, the pure page model: every page step x the prod shapes (survey 2026-10-29,
 * counts only: 49 live pages, phone E.164 40 / legacy 5 / none 4, WhatsApp 0, category missing 2,
 * link missing 2 (Instagram 47, website 27, Facebook 24), logo missing 1). Asserts the FULL-path percent
 * (review r1 S6), why Continue is off, diff-first commands (untouched = null), one command per change,
 * heldAfter stops re-sends, the link / phone rules, every status code has a Review row, and Go live.
 */
import { describe, expect, it } from 'vitest';
import { personPath, type PersonStep } from '../personModel';
import {
  CATEGORIES,
  EMPTY_PAGE,
  GO_LIVE_NOT_YET,
  REVIEW_ROWS,
  checkLink,
  contactEntry,
  draftFrom,
  flowPercent,
  fullPath,
  goLiveState,
  heldLinkText,
  pageBlocked,
  pageCommandFor,
  pageHeldAfter,
  pageHeldFrom,
  phoneE164,
  reviewCopy,
  reviewRow,
  reviewStatusFrom,
  waLink,
  type FlowStep,
  type PageHeld,
  type PageStep,
  type ReviewStatus,
} from '../pageModel';
import { graceShown, thingsLeft } from '../graceModel';

/** Prod shapes of a page (counts in the header). */
const SHAPES: Record<string, PageHeld> = {
  e164Confirmed: { ...EMPTY_PAGE, name: 'Leeds Nights', city: 'Leeds', phone: '+447700900123', contactConfirmed: true, socials: { facebook: 'https://facebook.com/ln' }, instagram: 'leedsnights', website: 'https://ln.com', category: 'Promoter', logo: 'https://img/l.png' },
  e164Unconfirmed: { ...EMPTY_PAGE, name: 'Bristol B', city: 'Bristol', phone: '+447700900124', socials: {}, instagram: '@bb', category: 'Dance School', logo: 'https://img/b.png' },
  legacyPhone: { ...EMPTY_PAGE, name: 'Old Phone', city: 'Leeds', phone: '07700 900125', socials: {}, website: 'https://old.com', category: 'Event Brand', logo: 'https://img/o.png' },
  noPhone: { ...EMPTY_PAGE, name: 'No Phone', city: 'York', socials: null as unknown as Record<string, string | null> },
  hasWhatsApp: { ...EMPTY_PAGE, name: 'Wa', city: 'Leeds', phone: '+447700900126', contactConfirmed: true, socials: { whatsapp: 'https://wa.me/447700900126' }, instagram: 'wa', category: 'Promoter', logo: 'https://img/w.png' },
  noCategoryNoLink: { ...EMPTY_PAGE, name: 'Bare', city: 'Hull', phone: '+447700900127', socials: {}, logo: '' },
  facebookOnly: { ...EMPTY_PAGE, name: 'Fb', city: 'Leeds', phone: '+447700900128', socials: { facebook: 'https://facebook.com/fbonly' }, category: 'Community Group', logo: 'https://img/f.png' },
};
const fixShape = (h: PageHeld): PageHeld => ({ ...h, socials: h.socials ?? {} });
const DETAIL: PageStep[] = ['contact', 'contact-phone', 'whatsapp', 'cat', 'link', 'logo'];

describe('full-path progress (review r1 S6)', () => {
  const cases = (['has-page', 'no-page'] as const).flatMap((arrival) => [true, false].flatMap((waPhone) => (['yes', 'no', null] as const).map((teach) => ({ arrival, waPhone, teach }))));
  it.each(cases)('$arrival / WhatsApp $waPhone / teach $teach: rises to 100 at Review, never 100 before', ({ arrival, waPhone, teach }) => {
    const person = personPath(teach, true);
    const g = fullPath({ arrival, waPhone }, person);
    const order: FlowStep[] = g.map((x) => x[0]);
    const pcts = order.map((s) => flowPercent(s, g));
    for (let i = 1; i < pcts.length; i++) expect(pcts[i]).toBeGreaterThan(pcts[i - 1]);
    expect(flowPercent('review', g)).toBe(100);
    expect(flowPercent('about', g)).toBeLessThan(100);
    expect(flowPercent(person[person.length - 1] as PersonStep, g)).toBeLessThan(100);
    expect(flowPercent('welcome', g)).toBe(0);
    expect(flowPercent('contact', g)).toBe(flowPercent('contact-phone', g));
    expect(g.some((x) => x.includes('find'))).toBe(arrival === 'no-page');
    expect(g.some((x) => x.includes('whatsapp'))).toBe(waPhone);
    expect(flowPercent('create-name', g)).toBe(arrival === 'no-page' ? flowPercent('find', g) : 0);
  });
  it('slice 1 bug S6: About read 100% on the person-only path; on the full path it does not', () => {
    const person = personPath('yes', true);
    expect(Math.round((person.length / person.length) * 100)).toBe(100);
    expect(flowPercent('about', fullPath({ arrival: 'has-page', waPhone: true }, person))).toBe(94);
  });
});

describe('every page step x every shape: untouched sends nothing', () => {
  const cells = Object.entries(SHAPES).flatMap(([shape, h]) => DETAIL.map((step) => ({ shape, step, h: fixShape(h) })));
  it.each(cells)('$shape / $step', ({ step, h }) => {
    const d = draftFrom(h);
    const cmd = pageCommandFor(step, d, h);
    if (step === 'contact' && !h.contactConfirmed) expect(cmd).toEqual({ kind: 'confirm', phone: null });
    else if (step === 'contact-phone' && !h.contactConfirmed && phoneE164(h.phone)) expect(cmd).toEqual({ kind: 'confirm', phone: phoneE164(h.phone) === h.phone ? null : phoneE164(h.phone) });
    else expect(cmd).toBeNull();
  });
});

describe('why Continue is off (never a disabled control without a reason)', () => {
  const empty = draftFrom(EMPTY_PAGE);
  it.each<[PageStep, Partial<typeof empty>, string | null]>([
    ['create-name', {}, 'Type a name to continue.'],
    ['create-name', { name: 'x'.repeat(81) }, 'Keep the name under 80 characters.'],
    ['create-name', { name: 'Leeds' }, null],
    ['create-city', {}, 'Pick a city to continue.'],
    ['create-city', { cityId: 'c1' }, null],
    ['contact-phone', {}, 'Type a phone number to continue.'],
    ['contact-phone', { phone: '12' }, 'Type a UK number starting 07, or + and the country code.'],
    ['contact-phone', { phone: '07700 900123' }, null],
    ['contact-phone', { phone: '+34 612 345 678' }, null],
    ['whatsapp', {}, 'Pick one to continue.'],
    ['whatsapp', { whatsapp: 'no' }, null],
    ['cat', {}, 'Pick one to continue.'],
    ['cat', { category: 'Promoter' }, null],
    ['link', {}, 'Add one link to continue.'],
    ['link', { link: 'not a link at all' }, 'Use a web address, like yourschool.com.'],
    ['link', { link: '@leeds' }, null],
    ['logo', {}, 'Add a logo to continue.'],
    ['logo', { logo: 'https://img/x.png' }, null],
    ['contact', {}, null],
    ['welcome', {}, null],
    ['find', {}, null],
  ])('%s %o -> %s', (step, patch, why) => {
    expect(pageBlocked(step, { ...empty, ...patch })).toBe(why);
  });
});

describe('a change sends ONE command, and heldAfter stops the re-send', () => {
  const h = fixShape(SHAPES.e164Unconfirmed);
  const base = draftFrom(h);
  it.each<[PageStep, Partial<typeof base>, unknown]>([
    ['contact', {}, { kind: 'confirm', phone: null }],
    ['contact-phone', { phone: '07700 900999' }, { kind: 'confirm', phone: '+447700900999' }],
    ['whatsapp', { whatsapp: 'yes' }, { kind: 'patch', patch: { socials: { whatsapp: 'https://wa.me/447700900124' } } }],
    ['cat', { category: 'Promoter' }, { kind: 'patch', patch: { organisation_category: 'Promoter' } }],
    ['link', { link: 'https://bb.co.uk' }, { kind: 'patch', patch: { website: 'https://bb.co.uk' } }],
    ['link', { link: '@newbb' }, { kind: 'patch', patch: { instagram: 'newbb' } }],
    ['link', { link: 'facebook.com/bbpage' }, { kind: 'patch', patch: { socials: { facebook: 'https://facebook.com/bbpage' } } }],
    ['logo', { logo: 'https://img/new.png' }, { kind: 'patch', patch: { avatar_url: 'https://img/new.png' } }],
  ])('%s %o', (step, patch, cmd) => {
    const d = { ...base, ...patch };
    expect(pageCommandFor(step, d, h)).toEqual(cmd);
    expect(pageCommandFor(step, d, pageHeldAfter(step, h, d))).toBeNull();
  });
  it('a socials patch keeps the other socials keys (whole-object write)', () => {
    const fb = fixShape(SHAPES.facebookOnly);
    expect(pageCommandFor('whatsapp', { ...draftFrom(fb), whatsapp: 'yes' }, fb)).toEqual({ kind: 'patch', patch: { socials: { facebook: 'https://facebook.com/fbonly', whatsapp: 'https://wa.me/447700900128' } } });
  });
  it('WhatsApp No on a page that has it clears it; No on a page without it sends nothing', () => {
    const wa = fixShape(SHAPES.hasWhatsApp);
    expect(draftFrom(wa).whatsapp).toBe('yes');
    expect(pageCommandFor('whatsapp', { ...draftFrom(wa), whatsapp: 'no' }, wa)).toEqual({ kind: 'patch', patch: { socials: { whatsapp: null } } });
    const none = fixShape(SHAPES.e164Confirmed);
    expect(pageCommandFor('whatsapp', { ...draftFrom(none), whatsapp: 'no' }, none)).toBeNull();
  });
  it('the held number confirmed by retyping it the same sends no phone', () => {
    const c = fixShape(SHAPES.e164Unconfirmed);
    expect(pageCommandFor('contact-phone', { ...draftFrom(c), phone: '07700 900124' }, c)).toEqual({ kind: 'confirm', phone: null });
  });
});

describe('shapes, entry and the link / phone rules', () => {
  it('contact opens on the held number, or on the phone field with none', () => {
    expect(contactEntry(fixShape(SHAPES.e164Confirmed))).toBe('contact');
    expect(contactEntry(fixShape(SHAPES.noPhone))).toBe('contact-phone');
  });
  it('the held link shows Instagram first, then website, then Facebook', () => {
    expect(heldLinkText(fixShape(SHAPES.e164Confirmed))).toBe('@leedsnights');
    expect(heldLinkText(fixShape(SHAPES.legacyPhone))).toBe('https://old.com');
    expect(heldLinkText(fixShape(SHAPES.facebookOnly))).toBe('https://facebook.com/fbonly');
    expect(heldLinkText(fixShape(SHAPES.noCategoryNoLink))).toBe('');
  });
  it.each([
    ['@leeds', 'instagram'], ['leedsnights', 'instagram'], ['leeds_nights.uk', 'website'], ['instagram.com/leeds', 'instagram'], ['https://www.instagram.com/leeds/', 'instagram'],
    ['facebook.com/leeds', 'facebook'], ['https://m.facebook.com/leeds', 'facebook'], ['leeds.com', 'website'], ['https://leeds.co.uk/x', 'website'],
  ])('%s is %s', (raw, kind) => {
    expect(checkLink(raw).kind).toBe(kind);
  });
  it.each([
    ['07700 900123', '+447700900123'], ['07700-900-123', '+447700900123'], ['+44 7700 900123', '+447700900123'], ['0044 7700 900123', '+447700900123'],
    ['+34 612 345 678', '+34612345678'], ['7700900123', null], ['', null], ['0770', null],
  ])('phone %s -> %s', (raw, out) => {
    expect(phoneE164(raw)).toBe(out);
  });
  it('wa.me link is the digits of the E.164 number', () => {
    expect(waLink('+447700900123')).toBe('https://wa.me/447700900123');
  });
  it('pageHeldFrom reads the prod row shape, missing values empty, never invented', () => {
    const h = pageHeldFrom({ page: { name: 'X', city: 'Leeds', socials: { instagram: 'x', whatsapp: null }, organisation_category: null, avatar_url: null }, phone: null, missing: ['contact_confirm', 'org_logo'] });
    expect(h).toEqual({ ...EMPTY_PAGE, name: 'X', city: 'Leeds', socials: { instagram: 'x', whatsapp: null } });
    expect(pageHeldFrom({ page: null, phone: '+447700900123', missing: [] }).contactConfirmed).toBe(true);
  });
  it('five category cards, stored Title Case, shown sentence case', () => {
    expect(CATEGORIES.map((c) => c.value)).toEqual(['Dance School', 'Event Brand', 'Community Group', 'Promoter', 'Festival Brand']);
    expect(CATEGORIES.map((c) => c.label)).toEqual(['Dance school', 'Event brand', 'Community group', 'Promoter', 'Festival brand']);
  });
});

describe('Review: organiser_onboarding_status_v1().missing[]', () => {
  // Every code _onboarding_missing_v1 returns on prod (pg_get_functiondef, 2026-10-29).
  const CODES = ['first_name', 'city', 'dance_role', 'photo', 'nationality', 'languages', 'instagram', 'teach_answer', 'teach_styles', 'teach_years', 'teach_levels', 'dj_answer', 'dj_genres', 'org_logo', 'org_link', 'org_city', 'org_category', 'contact_confirm'];
  it('every code has a row that goes somewhere (a screen here, or the dancer / page editor)', () => {
    expect(Object.keys(REVIEW_ROWS).sort()).toEqual([...CODES].sort());
    for (const c of CODES) {
      const r = reviewRow(c);
      expect(r.step !== null || r.elsewhere !== null).toBe(true);
    }
  });
  it('an unknown future code still shows a row (never dropped)', () => {
    expect(reviewRow('org_founded')).toEqual({ code: 'org_founded', label: 'org founded', step: null, elsewhere: 'dancer' });
  });
  const RAW = (o: Record<string, unknown>) => ({ v: 1, is_admin: false, person: { complete: false, missing: ['teach_answer'] }, organisers: [{ id: 'o1', name: 'L', role: 'owner', lifecycle: 'live', complete: false, missing: ['contact_confirm'], about: { done: false, skipped: true }, ...o }] });
  it('reads person + this page codes, in step order', () => {
    expect(reviewStatusFrom(RAW({}), 'o1')).toEqual({ missing: ['teach_answer', 'contact_confirm'], isAdmin: false, lifecycle: 'live', about: { done: false, skipped: true } });
    expect(reviewStatusFrom(RAW({}), 'other')).toBeNull();
    expect(reviewStatusFrom(null, 'o1')).toBeNull();
  });
  const S = (missing: string[], lifecycle: string, about = { done: false, skipped: false }): ReviewStatus => ({ missing, isAdmin: false, lifecycle, about });
  it.each<[ReviewStatus, boolean, string, string, string | null]>([
    [S(['photo', 'org_logo'], 'draft'), false, '2 things left', 'Go live', 'Finish the 2 things left to go live.'],
    [S(['photo'], 'draft'), true, '1 thing left', 'Go live', 'Finish the 1 thing left to go live.'],
    [S([], 'draft'), false, 'All set', 'Go live', GO_LIVE_NOT_YET],
    [S([], 'draft'), true, 'All set', 'Go live', null],
    [S([], 'live', { done: true, skipped: false }), false, 'All done', 'Go to Home', null],
    [S(['contact_confirm'], 'live'), false, '1 thing left', 'Go to Home', null],
  ])('%o deployed=%s -> %s / %s / %s', (s, deployed, title, primary, reason) => {
    const c = reviewCopy(s, deployed);
    expect([c.title, c.primary, c.reason]).toEqual([title, primary, reason]);
  });
  it('go live is never "ready" while go-live is not wired (deployed: false)', () => {
    expect(goLiveState(S([], 'draft'), false)).toBe('not-yet');
    expect(goLiveState(S([], 'draft'), true)).toBe('ready');
    expect(goLiveState(S(['x'], 'draft'), true)).toBe('blocked');
    expect(goLiveState(S(['x'], 'live'), true)).toBe('live');
  });
});

describe('Home grace banner', () => {
  it.each<[{ complete: boolean; isAdmin: boolean } | null, string | null, boolean]>([
    [{ complete: false, isAdmin: false }, null, true],
    [{ complete: false, isAdmin: false }, '2026-10-28', true],
    [{ complete: false, isAdmin: false }, '2026-10-29', false],
    [{ complete: true, isAdmin: false }, null, false],
    [{ complete: false, isAdmin: true }, null, false],
    [null, null, false],
  ])('%o hidden on %s -> %s', (s, hidden, shown) => {
    expect(graceShown(s, hidden, '2026-10-29')).toBe(shown);
  });
  it('thingsLeft', () => {
    expect(thingsLeft(1)).toBe('1 thing left');
    expect(thingsLeft(3)).toBe('3 things left');
  });
});
