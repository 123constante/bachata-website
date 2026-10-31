import { describe, expect, it } from 'vitest';
import {
  CLOSED_SCREEN, START_CODES, doorIsOn, emailFormState, missingSentence, parseLookalikes, parseStartResult, shouldAskLookalikes,
  startFormState, startView, turnstileSiteKey, type StartCode,
} from '../doorModel';

const ids = (v: ReturnType<typeof startView>) => (v.kind === 'screen' ? v.screen.actions : []);

describe('door switch and Turnstile key', () => {
  it.each([['on', true], [undefined, false], ['', false], ['ON', false], ['off', false], ['true', false]])('door env %s -> %s', (v, want) => {
    expect(doorIsOn(v as string | undefined)).toBe(want);
  });
  it.each([[undefined, null], ['', null], ['  ', null], ['0x4AAA', '0x4AAA']])('turnstile key %s -> %s', (v, want) => {
    expect(turnstileSiteKey(v as string | undefined)).toBe(want);
  });
});

describe('startView over every code', () => {
  it.each(START_CODES.map((c) => [c]))('%s says something and never dead-ends', (code) => {
    const v = startView({ code: code as StartCode, organiserId: 'o1', missing: ['photo'] });
    if (v.kind === 'screen') {
      expect(v.screen.title.length).toBeGreaterThan(0);
      expect(v.screen.actions.length).toBeGreaterThan(0);
      expect(v.screen.actions.some((a) => a.primary)).toBe(true);
    } else if (v.kind === 'inline') {
      expect(v.message.length).toBeGreaterThan(0);
    } else {
      expect(code).toBe('DOOR_CLOSED');
    }
  });
  it('unknown / transport failure gets Try again', () => {
    const v = startView(parseStartResult(null, new Error('x')));
    expect(ids(v).some((a) => a.kind === 'retry')).toBe(true);
  });
  it('an unrecognised code is unknown, not a crash', () => {
    expect(parseStartResult({ code: 'WAT' }, null).code).toBe('unknown');
  });
  it('CREATED links to the page and to add an event', () => {
    const tos = ids(startView({ code: 'CREATED', organiserId: 'o1', missing: [] })).map((a) => (a.kind === 'link' ? a.to : ''));
    expect(tos).toContain('/organisers/o1');
    expect(tos.some((t) => t.includes('/new/what'))).toBe(true);
  });
  it('ALREADY_HAS_PAGE links to their page', () => {
    const tos = ids(startView({ code: 'ALREADY_HAS_PAGE', organiserId: 'o9', missing: [] })).map((a) => (a.kind === 'link' ? a.to : ''));
    expect(tos).toContain('/organisers/o9');
  });
  it('NOT_ON_LIST uses the owner words and offers what they can do', () => {
    const v = startView({ code: 'NOT_ON_LIST', organiserId: null, missing: [] });
    expect(v.kind === 'screen' && v.screen.body).toContain('a few at a time');
    expect(ids(v).length).toBeGreaterThanOrEqual(3);
  });
  it('EMAIL_DOMAIN_NOT_ALLOWED says "Please use your own email address"', () => {
    const v = startView({ code: 'EMAIL_DOMAIN_NOT_ALLOWED', organiserId: null, missing: [] });
    expect(v.kind === 'screen' && v.screen.title).toBe('Please use your own email address');
  });
  it('PROFILE_INCOMPLETE routes to the existing profile screen, names what is missing, and returns here', () => {
    const v = startView({ code: 'PROFILE_INCOMPLETE', organiserId: null, missing: ['first_name', 'city', 'photo'] });
    expect(v.kind === 'screen' && v.screen.body).toContain('your first name, your city and a photo');
    expect(v.kind === 'screen' && v.screen.body).toContain('come straight back here');
    const to = ids(v).find((a) => a.primary);
    expect(to && to.kind === 'link' && to.to).toBe('/finish-profile?returnTo=%2Frun-events');
  });
  it('DOOR_CLOSED is the closed page, not an error', () => {
    expect(startView({ code: 'DOOR_CLOSED', organiserId: null, missing: [] })).toEqual({ kind: 'closed' });
    expect(CLOSED_SCREEN.actions.length).toBeGreaterThanOrEqual(3);
  });
  it('warnings in the payload are ignored (no alarm)', () => {
    const o = parseStartResult({ success: true, code: 'CREATED', organiser_id: 'o1', warnings: [{ code: 'POSSIBLE_DUPLICATE', organiser_id: 'o2' }, { code: 'LOOKALIKE_UNKNOWN' }] }, null);
    expect(o).toEqual({ code: 'CREATED', organiserId: 'o1', missing: [] });
  });
  it.each([[[], 'a few details'], [['photo'], 'a photo'], [['city', 'photo'], 'your city and a photo']])('missingSentence %j', (m, want) => {
    expect(missingSentence(m as string[])).toBe(want);
  });
});

describe('lookalikes: none, 1, 5, rate-limited, error', () => {
  const row = (i: number) => ({ organiser_id: `o${i}`, name: `N${i}`, city: 'London', slug: `n${i}`, logo_url: null });
  it('none', () => expect(parseLookalikes({ success: true, code: 'OK', items: [] }, null)).toEqual({ kind: 'none' }));
  it('1', () => expect(parseLookalikes({ success: true, code: 'OK', items: [row(1)] }, null)).toMatchObject({ kind: 'some' }));
  it('5 and never more than 5', () => {
    const s = parseLookalikes({ success: true, code: 'OK', items: [1, 2, 3, 4, 5, 6, 7].map(row) }, null);
    expect(s.kind === 'some' && s.items.length).toBe(5);
  });
  it('rate limited', () => expect(parseLookalikes({ success: false, code: 'RATE_LIMITED', items: [] }, null)).toEqual({ kind: 'rate_limited' }));
  it.each([[null, { message: 'x' }], [{ success: false, code: 'NOT_SIGNED_IN' }, null], [{ code: 'CITY_NOT_FOUND' }, null]])('error %j', (d, e) => {
    expect(parseLookalikes(d, e)).toEqual({ kind: 'error' });
  });
});

describe('forms', () => {
  it('an untouched start form cannot submit and says why', () => {
    expect(startFormState('', '', false)).toEqual({ canSubmit: false, why: 'Add your organiser name to continue.' });
    expect(startFormState('Ana', '', false).why).toBe('Choose your city to continue.');
    expect(startFormState('Ana', 'c1', false)).toEqual({ canSubmit: true, why: null });
    expect(startFormState('Ana', 'c1', true).canSubmit).toBe(false);
  });
  it('lookalikes are not asked for an untouched form', () => {
    expect(shouldAskLookalikes('', '')).toBe(false);
    expect(shouldAskLookalikes('Ana', '')).toBe(false);
    expect(shouldAskLookalikes('A', 'c1')).toBe(false);
    expect(shouldAskLookalikes('Ana', 'c1')).toBe(true);
  });
  it.each([
    ['', false, false, false, false], ['a@b.co', false, false, false, true], ['a@b.co', false, true, false, false],
    ['a@b.co', false, true, true, true], ['a@b.co', true, false, false, false],
  ])('email %s busy=%s needsToken=%s hasToken=%s -> canSend %s', (e, busy, need, has, want) => {
    const s = emailFormState(e as string, busy as boolean, need as boolean, has as boolean);
    expect(s.canSend).toBe(want);
    if (!want) expect(s.why).toBeTruthy();
  });
});
