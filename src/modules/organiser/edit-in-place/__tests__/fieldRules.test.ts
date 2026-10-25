/**
 * Edit in place: every field's rules, table-driven -- each accepted shape, each
 * hint and each refusal copy. "We will save" must be EXACTLY what
 * buildOrganiserProfilePatch produces (no second format), and every value we
 * accept must also pass the server's own regexes (organiser_profile_update_p5_v1,
 * _owner_public_url_ok_p5, _owner_instagram_url_ok_p5, read from prod 2026-10-11).
 */
import { describe, expect, it } from 'vitest';
import { buildOrganiserProfilePatch } from '@/lib/organiserProfileUpdate';
import { extractFbHandle, extractIgHandle, facebookDisplayLabel, extractDomain, PUBLIC_LINK_REL } from '@/lib/organiserLinkLabels';
import {
  ABOUT_COPY,
  ABOUT_MAX,
  CATEGORY_OPTIONS,
  CITY_COPY,
  FIELD_KEYS,
  FIELD_LABEL,
  NAME_COPY,
  NAME_MAX,
  checkCity,
  checkField,
  checkName,
  FACEBOOK_COPY,
  INSTAGRAM_COPY,
  PROMPTED_FIELDS,
  WEBSITE_COPY,
  YEAR_COPY,
  checkAbout,
  checkCategory,
  checkFacebook,
  checkInstagram,
  checkWebsite,
  checkYear,
  displayValue,
  facebookDisplay,
  instagramDisplay,
  websiteDisplay,
} from '../fieldRules';

// The server's rules, verbatim from the prod function bodies.
// eslint-disable-next-line no-control-regex -- verbatim from the server function
const SERVER_PUBLIC_URL = /^https?:\/\/[^\s\x00-\x1f\x7f]+$/i;
const SERVER_IG = (v: string) => /^@?[A-Za-z0-9._]{1,30}$/.test(v) || (SERVER_PUBLIC_URL.test(v) && /^https?:\/\/(www[.])?instagram[.]com\/\S*$/i.test(v));
const SERVER_FB = (v: string) => /^@?[A-Za-z0-9._-]{1,50}$/.test(v) || SERVER_PUBLIC_URL.test(v);

const FORM = { name: 'x', avatar_url: '', bio: '', instagram: '', facebook: '', website: '', organisation_category: '', founded_year: '' };

describe('the prompted fields', () => {
  it('are exactly Photo, Year started, Instagram, in that order, with their importance', () => {
    expect(PROMPTED_FIELDS.map((p) => [p.key, p.importance])).toEqual([
      ['avatar_url', 'Essential'], ['founded_year', 'Essential'], ['instagram', 'Recommended'],
    ]);
    for (const p of PROMPTED_FIELDS) expect(p.reason.length).toBeGreaterThan(10);
  });
});

describe('checkYear', () => {
  const NOW = 2026;
  it.each([
    ['2019', true, null, 2019],
    [' 1900 ', true, null, 1900],
    ['2026', true, null, 2026],
    ['', true, null, null],
    ['2027', false, YEAR_COPY.range, null],
    ['1899', false, YEAR_COPY.range, null],
    ['19', false, YEAR_COPY.format, null],
    ['20199', false, YEAR_COPY.format, null],
    ['2019.5', false, YEAR_COPY.format, null],
    ['twenty', false, YEAR_COPY.format, null],
    ['-2019', false, YEAR_COPY.format, null],
  ])('%j -> ok %s', (raw, ok, error, sent) => {
    const c = checkYear(raw, NOW);
    expect([c.ok, c.error]).toEqual([ok, error]);
    if (ok) {
      // Sent as a NUMBER (the server refuses a string).
      const patch = buildOrganiserProfilePatch({ ...FORM, founded_year: c.value }, 'c');
      expect(patch.founded_year).toBe(sent);
    }
  });
});

describe('checkInstagram', () => {
  it.each([
    // [typed, draft value, we will save, display] -- invite journey W2: every way of typing it saves the bare name.
    ['@ritmo.latino', 'ritmo.latino', 'ritmo.latino', '@ritmo.latino'],
    ['ritmo_latino', 'ritmo_latino', 'ritmo_latino', '@ritmo_latino'],
    ['  @abc  ', 'abc', 'abc', '@abc'],
    ['https://www.instagram.com/ritmo/', 'ritmo', 'ritmo', '@ritmo'],
    ['instagram.com/ritmo', 'ritmo', 'ritmo', '@ritmo'],
    ['HTTPS://instagram.com/Ritmo?igsh=x', 'ritmo', 'ritmo', '@ritmo'],
    ['@Ritmo.Latino', 'ritmo.latino', 'ritmo.latino', '@ritmo.latino'],
  ])('accepts %j', (typed, value, willSave, display) => {
    const c = checkInstagram(typed);
    expect(c.ok).toBe(true);
    expect(c.value).toBe(value);
    expect(c.willSave).toBe(willSave);
    // EXACTLY what the existing patch builder stores, and the server accepts it.
    expect(c.willSave).toBe(buildOrganiserProfilePatch({ ...FORM, instagram: c.value }, 'c').instagram);
    expect(SERVER_IG(c.willSave as string)).toBe(true);
    expect(instagramDisplay(c.willSave)).toBe(display);
    expect(c.href).toMatch(/^https:\/\/(www\.)?instagram\.com\//i);
  });
  it.each([
    ['https://m.instagram.com/ritmo', INSTAGRAM_COPY.refuse],
    ['https://instagram.com', INSTAGRAM_COPY.refuse],
    ['https://instagram.com.evil.tk/ritmo', INSTAGRAM_COPY.refuse],
    ['https://bit.ly/x?ref=instagram.com', INSTAGRAM_COPY.refuse],
    ['https://instagram.com/p/C0ffee', INSTAGRAM_COPY.post],
    ['ritmo latino', INSTAGRAM_COPY.characters],
    ['ritmo!', INSTAGRAM_COPY.characters],
    ['.ritmo', INSTAGRAM_COPY.dots],
    ['ritmo..latino', INSTAGRAM_COPY.dots],
    ['@' + 'a'.repeat(31), INSTAGRAM_COPY.tooLong],
  ])('refuses %j', (typed, error) => {
    const c = checkInstagram(typed);
    expect([c.ok, c.error, c.willSave, c.href]).toEqual([false, error, null, null]);
  });
  it('an empty box clears the field', () => {
    expect(checkInstagram('  ')).toMatchObject({ ok: true, value: '', willSave: null });
  });
});

describe('checkWebsite', () => {
  it.each([
    // [typed, we will save, hints]
    ['ritmo.co.uk', 'https://ritmo.co.uk', []],
    ['  https://ritmo.co.uk/classes  ', 'https://ritmo.co.uk/classes', []],
    ['ritmo .co.uk', 'https://ritmo.co.uk', []],
    ['htp://ritmo.com', 'http://ritmo.com', []],
    ['http//ritmo.com', 'http://ritmo.com', []],
    ['https//ritmo.com', 'https://ritmo.com', []],
    ['HTTPS://Ritmo.com', 'https://Ritmo.com', []],
    ['ritmo.con', 'https://ritmo.con', [WEBSITE_COPY.hintEnding]],
    ['ritmo.cmo', 'https://ritmo.cmo', [WEBSITE_COPY.hintEnding]],
    ['ritmo.vom', 'https://ritmo.vom', [WEBSITE_COPY.hintEnding]],
    ['ritmo.ocm', 'https://ritmo.ocm', [WEBSITE_COPY.hintEnding]],
    ['wwww.ritmo.com', 'https://wwww.ritmo.com', [WEBSITE_COPY.hintWww]],
    ['ritmo.com/a,b', 'https://ritmo.com/a,b', [WEBSITE_COPY.hintComma]],
    ['instagram.com/ritmo', 'https://instagram.com/ritmo', [WEBSITE_COPY.hintInstagram]],
    ['https://www.facebook.com/ritmo', 'https://www.facebook.com/ritmo', [WEBSITE_COPY.hintFacebook]],
    ['fb.com/ritmo', 'https://fb.com/ritmo', [WEBSITE_COPY.hintFacebook]],
  ])('%j -> %j', (typed, willSave, hints) => {
    const c = checkWebsite(typed);
    expect(c.ok).toBe(true);
    expect(c.willSave).toBe(willSave);
    expect(c.hints).toEqual(hints);
    expect(c.willSave).toBe(buildOrganiserProfilePatch({ ...FORM, website: c.value }, 'c').website);
    expect(SERVER_PUBLIC_URL.test(c.willSave as string)).toBe(true);
    expect(c.href).toBe(willSave);
  });
  it.each(['tba', 'https://tba', 'N/A', 'javascript:alert(1)', 'ftp://ritmo.com', '12345', 'https://'])('refuses %j', (typed) => {
    expect(checkWebsite(typed)).toMatchObject({ ok: false, error: WEBSITE_COPY.refuse, href: null });
  });
  it('refuses a link longer than the server allows', () => {
    expect(checkWebsite('https://ritmo.com/' + 'a'.repeat(2048))).toMatchObject({ ok: false, error: WEBSITE_COPY.tooLong });
  });
});

describe('checkFacebook', () => {
  it.each([
    // [typed, we will save, hints, display]
    ['ritmolatino', 'https://facebook.com/ritmolatino', [], '@ritmolatino'],
    ['@ritmo.latino', 'https://facebook.com/ritmo.latino', [], '@ritmo.latino'],
    ['https://www.facebook.com/RitmoLatino/', 'https://www.facebook.com/RitmoLatino/', [], '@RitmoLatino'],
    ['facebook.com/ritmo', 'https://facebook.com/ritmo', [], '@ritmo'],
    ['m.facebook.com/ritmo', 'https://m.facebook.com/ritmo', [], '@ritmo'],
    ['fb.com/ritmo', 'https://facebook.com/ritmo', [], '@ritmo'],
    ['https://www.fb.com/ritmo', 'https://facebook.com/ritmo', [], '@ritmo'],
    // What Facebook's own Share button gives: VALID, labelled as a page.
    ['https://www.facebook.com/share/1AbCdEf/', 'https://www.facebook.com/share/1AbCdEf/', [], 'Facebook page'],
    ['https://www.facebook.com/profile.php?id=1000', 'https://www.facebook.com/profile.php?id=1000', [FACEBOOK_COPY.hintProfile], 'Facebook page'],
    ['https://www.facebook.com/login/?next=x', 'https://www.facebook.com/login/?next=x', [FACEBOOK_COPY.hintLogin], 'Facebook page'],
  ])('%j -> %j', (typed, willSave, hints, display) => {
    const c = checkFacebook(typed);
    expect(c.ok).toBe(true);
    expect(c.willSave).toBe(willSave);
    expect(c.hints).toEqual(hints);
    expect((buildOrganiserProfilePatch({ ...FORM, facebook: c.value }, 'c').socials as { facebook: string }).facebook).toBe(willSave);
    expect(SERVER_FB(willSave)).toBe(true);
    expect(facebookDisplay(willSave)).toBe(display);
  });
  it.each([
    'https://twitter.com/ritmo',
    'https://facebook.com.evil.tk/ritmo',
    'https://facebook.com',
    'https://facebook.com/',
    'ritmo latino',
    'www.ritmo.com',
    'ritmo.co.uk',
    'javascript:alert(1)',
  ])('refuses %j with the one plain message', (typed) => {
    expect(checkFacebook(typed)).toMatchObject({ ok: false, error: FACEBOOK_COPY.refuse, willSave: null, href: null });
  });
});

describe('checkAbout', () => {
  it('counts characters the way the server does and allows exactly 4000', () => {
    expect(checkAbout('a'.repeat(ABOUT_MAX)).ok).toBe(true);
    expect(checkAbout('a'.repeat(ABOUT_MAX + 1))).toMatchObject({ ok: false, error: ABOUT_COPY.tooLong(ABOUT_MAX + 1) });
    // An emoji is one character to Postgres char_length, two UTF-16 units to JS.
    expect(checkAbout('\u{1F483}'.repeat(ABOUT_MAX)).ok).toBe(true);
  });
  it('keeps line breaks and saves the trimmed text', () => {
    const c = checkAbout('  Line one\nLine two  ');
    expect(c.value).toBe('  Line one\nLine two  ');
    expect(c.willSave).toBe('Line one\nLine two');
  });
});

describe('checkCategory (a picker, not free text)', () => {
  it('offers exactly the five real values', () => {
    expect([...CATEGORY_OPTIONS]).toEqual(['Dance School', 'Event Brand', 'Community Group', 'Promoter', 'Festival Brand']);
  });
  it.each([...CATEGORY_OPTIONS, ''])('accepts %j', (v) => expect(checkCategory(v).ok).toBe(true));
  it('refuses anything else, unless it is the stored legacy value', () => {
    expect(checkCategory('Salsa Club').ok).toBe(false);
    expect(checkCategory('Salsa Club', 'Salsa Club').ok).toBe(true);
  });
});

describe('display labels', () => {
  it.each([
    ['instagram', 'https://instagram.com/ritmo', '@ritmo'],
    ['instagram', '@ritmo', '@ritmo'],
    ['instagram', 'https://instagram.com/reel/x', 'Instagram'],
    ['facebook', 'https://facebook.com/ritmo', '@ritmo'],
    ['facebook', 'https://facebook.com/share/abc', 'Facebook page'],
    ['facebook', 'https://facebook.com/groups/123', 'Facebook page'],
    ['website', 'https://www.ritmo.co.uk/classes', 'ritmo.co.uk'],
    ['website', '', 'Not added'],
    ['avatar_url', 'https://x.supabase.co/a.webp', 'Photo added'],
  ] as const)('%s %j -> %j', (field, value, label) => {
    expect(displayValue(field, value)).toBe(label);
  });
  it('the public page and the owner rows read the same helpers', () => {
    expect(instagramDisplay('instagram.com/ritmo')).toBe(extractIgHandle('instagram.com/ritmo'));
    expect(websiteDisplay('ritmo.com')).toBe(extractDomain('ritmo.com'));
    expect(facebookDisplayLabel('https://facebook.com/ritmo')).toBe(extractFbHandle('https://facebook.com/ritmo'));
    expect(extractFbHandle('https://facebook.com/share/abc')).toBe('Facebook');
  });
  it('public links carry noopener nofollow ugc', () => {
    expect(PUBLIC_LINK_REL).toBe('noopener nofollow ugc');
  });
});

describe('the editable fields include Name and City', () => {
  it('FIELD_KEYS and FIELD_LABEL name them', () => {
    expect(FIELD_KEYS).toContain('name');
    expect(FIELD_KEYS).toContain('city');
    expect(FIELD_LABEL.name).toBe('Name');
    expect(FIELD_LABEL.city).toBe('City');
  });
  it('neither is a "Complete your page" prompt (every live organiser has both)', () => {
    expect(PROMPTED_FIELDS.map((p) => p.key)).not.toContain('name');
    expect(PROMPTED_FIELDS.map((p) => p.key)).not.toContain('city');
  });
});

describe('checkName (organiser_profile_update_p5_v1: required, <= 80 characters, one line)', () => {
  const at80 = 'R'.repeat(NAME_MAX);
  it.each([
    ['Ritmo Latino', true, null, 'Ritmo Latino'],
    ['  Ritmo Latino  ', true, null, 'Ritmo Latino'],
    [at80, true, null, at80],
    // Characters, not bytes or UTF-16 units: the server counts char_length.
    ['É'.repeat(NAME_MAX), true, null, 'É'.repeat(NAME_MAX)],
    ['\u{1F483}'.repeat(NAME_MAX), true, null, '\u{1F483}'.repeat(NAME_MAX)],
    ['', false, NAME_COPY.required, null],
    ['    ', false, NAME_COPY.required, null],
    [`${at80}R`, false, NAME_COPY.tooLong(81), null],
    ['Ritmo\nLatino', false, NAME_COPY.oneLine, null],
    ['Ritmo\tLatino', false, NAME_COPY.oneLine, null],
    ['Ritmo\u0007', false, NAME_COPY.oneLine, null],
  ])('%j -> ok %s', (typed, ok, error, willSave) => {
    const c = checkName(typed);
    expect(c.ok).toBe(ok);
    expect(c.error).toBe(error);
    expect(c.willSave).toBe(willSave);
    if (ok) {
      // "We will save" is exactly what the patch sends.
      expect(buildOrganiserProfilePatch({ ...FORM, name: c.value }, 'x').name).toBe(willSave);
      // eslint-disable-next-line no-control-regex -- the server's single-line rule
      expect(/[\x00-\x1f\x7f]/.test(c.value)).toBe(false);
    }
  });
  it('checkField dispatches name and city', () => {
    expect(checkField('name', 'Ritmo').ok).toBe(true);
    expect(checkField('city', '').ok).toBe(false);
  });
  it('the taken-name copy says what to do', () => {
    expect(NAME_COPY.taken).toMatch(/already uses this name/);
    expect(NAME_COPY.taken).toMatch(/different/);
  });
});

describe('checkCity (a pick from the list, never free text)', () => {
  const ID = 'c1000000-0000-4000-8000-000000000001';
  it.each([
    [ID, true, null, ID],
    [ID.toUpperCase(), true, null, ID],
    [` ${ID} `, true, null, ID],
    ['', false, CITY_COPY.required, null],
    ['London', false, CITY_COPY.required, null],
    ['c1000000-0000-4000-8000', false, CITY_COPY.required, null],
  ])('%j -> ok %s', (typed, ok, error, value) => {
    const c = checkCity(typed);
    expect(c.ok).toBe(ok);
    expect(c.error).toBe(error);
    if (ok) expect(c.value).toBe(value);
  });
});

describe('the contact keys (admin #771 split): phone, and one switch each for phone and email', () => {
  it('FIELD_KEYS and FIELD_LABEL name them; the legacy flag and contact_email are not editable keys', () => {
    for (const k of ['contact_phone', 'show_phone_publicly', 'show_email_publicly']) {
      expect(FIELD_KEYS).toContain(k);
      expect(FIELD_LABEL[k as keyof typeof FIELD_LABEL]).toBeTruthy();
    }
    expect(FIELD_KEYS).not.toContain('show_contact_publicly');
    expect(FIELD_KEYS).not.toContain('contact_email');
  });
  it('none is a "Complete your page" prompt', () => {
    for (const k of ['contact_phone', 'show_phone_publicly', 'show_email_publicly']) expect(PROMPTED_FIELDS.map((p) => p.key)).not.toContain(k);
  });
  // The ONE stored phone rule (invite journey W2: E.164, lib/phoneRules, the server's by fixture)
  // and the RPC's own (contact_phone: <= 40 characters, one line). The sheet's PhoneInput sends E.164.
  it.each([
    ['', true, ''],
    ['   ', true, ''],
    ['+44 7700 900123', true, '+447700900123'],
    ['+447700900123', true, '+447700900123'],
    ['  07700 900123 ', false, '07700 900123'],
    ['0113.496.0000', false, '0113.496.0000'],
    ['123456', false, '123456'],
    ['1234567890123456', false, '1234567890123456'],
    ['07700\n900123', false, '07700\n900123'],
    [`+44 ${'1'.repeat(10)} ${' '.repeat(30)}x1`, false, null],
  ] as Array<[string, boolean, string | null]>)('phone %j -> ok %s', (raw, ok, value) => {
    const c = checkField('contact_phone', raw);
    expect(c.ok).toBe(ok);
    if (value !== null) expect(c.value).toBe(value);
    if (!ok) expect(c.error).toBeTruthy();
  });
  it.each([
    ['true', true], ['false', true], ['', false], ['yes', false],
  ])('a switch draft %j -> ok %s', (raw, ok) => {
    expect(checkField('show_phone_publicly', raw).ok).toBe(ok);
    expect(checkField('show_email_publicly', raw).ok).toBe(ok);
  });
});
