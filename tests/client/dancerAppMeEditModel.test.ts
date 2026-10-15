/**
 * W2c model: the one mapping Me and Edit share, and the Edit form's rules.
 * Table-driven; the "red-first" mutants are in dancerAppMeEdit.test.tsx.
 */
import { describe, expect, it } from 'vitest';
import { DANCER_SHAPES, DANCER_SHAPE_NAMES, makeProfile } from '@/modules/dancer-app/api/fixtures';
import { STRENGTH_STEPS } from '@/modules/dancer-app/api/types';
import {
  BIO_MAX, NEXT_STEP, addChip, bandForYear, buildDelta, draftFromProfile, mainAction, nextStepCopy, parseLanguages,
  profileName, roleCityLine, saveDisabledReason, validateDraft, yearForBand, YEAR_BANDS,
} from '@/modules/dancer-app/screens/me/model';

const shapes = DANCER_SHAPE_NAMES.map((n) => [n, DANCER_SHAPES[n].profile] as const).filter(([, p]) => p !== null);

describe('untouched draft -> empty delta, on every production shape', () => {
  it.each(shapes)('%s', (_n, p) => {
    expect(buildDelta(p!, draftFromProfile(p!))).toEqual({});
    expect(validateDraft(draftFromProfile(p!), p!)).toEqual({});
    expect(saveDisabledReason({}, {}, false)).toBe('Nothing has changed yet. Edit a field above to save.');
  });
});

describe('main action and copy follow strength.next_step (one mapping)', () => {
  it.each(shapes)('%s', (_n, p) => {
    const a = mainAction(p!);
    const step = p!.strength.next_step;
    if (step === null) expect(a).toMatchObject({ label: 'Edit my profile', href: '/app/me/edit', isEdit: true });
    else expect(a.label).toBe(NEXT_STEP[step].label);
    expect(nextStepCopy(p!)).not.toBe('');
  });
  it('photo -> /app/me/photo; city -> edit with the city focused', () => {
    expect(mainAction(makeProfile({ first_name: 'A', based_city_id: 'c1000000-0000-4000-8000-000000000001', dance_role: 'Leader' })).href).toBe('/app/me/photo');
    expect(mainAction(makeProfile({ first_name: 'A' })).href).toBe('/app/me/edit?focus=city');
  });
  it('every strength step has a button', () => {
    for (const s of STRENGTH_STEPS) expect(NEXT_STEP[s].label.length).toBeGreaterThan(0);
  });
});

describe('name and role/city line', () => {
  it('the public rule (review S6): first name + surname, else the display name', () => {
    const n = (o: Partial<Parameters<typeof profileName>[0]>) =>
      profileName({ display_name: null, first_name: null, surname: null, hide_surname_publicly: false, ...o });
    expect(n({ display_name: 'Ana L', first_name: 'Ana' })).toBe('Ana');
    expect(n({ display_name: 'Ana L' })).toBe('Ana L');
    expect(n({ first_name: 'Ana', surname: 'Lopez' })).toBe('Ana Lopez');
    expect(n({ first_name: 'Ana', surname: 'Lopez', hide_surname_publicly: true })).toBe('Ana');
    expect(n({})).toBe('No name yet');
  });
  it('Leader · London; Both for Lead and Follow', () => {
    expect(roleCityLine({ dance_role: 'Leader', city_name: 'London' })).toBe('Leader · London');
    expect(roleCityLine({ dance_role: 'Lead and Follow', city_name: null })).toBe('Both');
  });
});

describe('dancing-since bands map both ways', () => {
  const now = 2026;
  it.each([[2026, 'new'], [2025, 'one-two'], [2024, 'one-two'], [2023, 'three-five'], [2021, 'three-five'], [2020, 'six-plus'], [1990, 'six-plus']] as const)(
    'year %i -> %s', (y, band) => expect(bandForYear(y, now)).toBe(band),
  );
  it('band -> year -> same band', () => {
    for (const b of YEAR_BANDS) expect(bandForYear(yearForBand(b.id, now), now)).toBe(b.id);
  });
  it('null stays null', () => expect(bandForYear(null, now)).toBeNull());
});

describe('parsing', () => {
  it.each([
    ['English, Spanish', ['English', 'Spanish']],
    [' English ,, english,Spanish ', ['English', 'Spanish']],
    ['', []],
  ])('languages %j', (text, out) => expect(parseLanguages(text)).toEqual(out));
  it('chips: trims, dedupes, caps', () => {
    expect(addChip(['Obsesion'], '  obsesion ')).toEqual(['Obsesion']);
    expect(addChip([], '   ')).toEqual([]);
    expect(addChip(Array.from({ length: 20 }, (_, i) => `s${i}`), 'new')).toHaveLength(20);
  });
});

describe('validation mirrors the server codes', () => {
  const p = makeProfile({ first_name: 'Ana', based_city_id: 'c1000000-0000-4000-8000-000000000001', other_roles: ['teaching'] });
  const base = draftFromProfile(p);
  it.each([
    ['bio 279', { bio: 'x'.repeat(279) }, null],
    ['bio 280', { bio: 'x'.repeat(280) }, null],
    ['bio 281', { bio: 'x'.repeat(BIO_MAX + 1) }, 'bio'],
    ['bio https', { bio: 'see https://x.co' }, 'bio'],
    ['bio www', { bio: 'see www.x.co' }, 'bio'],
    ['bio tld/', { bio: 'x.com/me' }, 'bio'],
    ['display name link', { display_name: 'http bad' }, 'display_name'],
    ['display name @', { display_name: 'a@b' }, 'display_name'],
    ['display name 41', { display_name: 'x'.repeat(41) }, 'display_name'],
    ['bad handle', { instagram: 'not a handle!' }, 'instagram'],
    ['good handle', { instagram: '@ana.dances' }, null],
    ['bad url', { website_url: 'ana.com' }, 'website_url'],
    ['good url', { website_url: 'https://ana.com' }, null],
    ['bad whatsapp', { whatsapp: 'call me' }, 'whatsapp'],
    ['good whatsapp', { whatsapp: '+44 7700 900123' }, null],
    ['first name cleared', { first_name: '  ' }, 'first_name'],
    ['city cleared', { based_city_id: '' }, 'based_city_id'],
  ] as const)('%s', (_n, over, field) => {
    const errs = validateDraft({ ...base, ...over }, p);
    expect(Object.keys(errs)).toEqual(field ? [field] : []);
  });
});

describe('delta: only changed keys, null to clear, WhatsApp rules', () => {
  const ana = makeProfile({ ...DANCER_SHAPES.completeAllExtras.profile! });
  it('one change -> one key', () => {
    expect(buildDelta(ana, { ...draftFromProfile(ana), nationality: 'FR' })).toEqual({ nationality: 'FR' });
  });
  it('cleared optional -> null / []', () => {
    const d = { ...draftFromProfile(ana), bio: '', instagram: '', surname: '', favorite_songs: [] as string[], dance_started_year: null };
    expect(buildDelta(ana, d)).toEqual({ bio: null, instagram: null, surname: null, favorite_songs: [], dance_started_year: null });
  });
  it('never sends first_name/city/photo clears (the draft is invalid instead)', () => {
    const d = draftFromProfile(ana);
    expect(Object.keys(validateDraft({ ...d, first_name: '' }, ana))).toContain('first_name');
  });
  it('pure dancer never produces a whatsapp key', () => {
    const pure = makeProfile({ ...DANCER_SHAPES.fourFieldComplete.profile! });
    const d = { ...draftFromProfile(pure), whatsapp: '+447700900123', show_whatsapp_publicly: false };
    expect(buildDelta(pure, d)).toEqual({});
  });
  it('person with a teaching role can change WhatsApp', () => {
    const t = DANCER_SHAPES.teacherWithWhatsapp.profile!;
    expect(buildDelta(t, { ...draftFromProfile(t), show_whatsapp_publicly: false })).toEqual({ show_whatsapp_publicly: false });
  });
});
