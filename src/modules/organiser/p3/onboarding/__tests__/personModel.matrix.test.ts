/**
 * W4b build 2 slice 1: the person screens' rules x every prod shape (survey 2026-10-29, read-only:
 * nationality null 173 / alpha-2 22; languages null 78 / [] 100 / 1-3 items 17; dance_role null 149 /
 * Leader 21 / Follower 17 / Lead and Follow 8; levels_taught null on all 21 teacher rows;
 * teaching_styles 0 / 1 / 2 items; years_teaching null 20 / set 1; role intent: no row, roles only,
 * never a declined teacher yet).
 */
import { describe, expect, it } from 'vitest';
import {
  EMPTY_DRAFT,
  LANG_ALL,
  LANG_FEW,
  PERSON_ORDER,
  STEP_COPY,
  STY_ALL,
  STY_FEW,
  blockedReason,
  commandFor,
  heldAfter,
  heldFrom,
  nextStep,
  parseYears,
  personPath,
  prevStep,
  progressPercent,
  sixFor,
  starterSentence,
  type PersonDraft,
  type PersonStep,
} from '../personModel';

const FULL: PersonDraft = {
  first_name: 'Sam', avatar_url: 'https://img/a.jpg', dance_role: 'Lead and Follow', nationality: 'ES', languages: ['English', 'Spanish'],
  teach: 'yes', levels: ['Beginner'], styles: ['Moderna'], years: '4', about: 'We dance.',
};

describe('path and progress (owner change 2: a percentage that follows the path length)', () => {
  it.each([
    ['unanswered, with a page', null, true, 11],
    ['yes, with a page', 'yes', true, 11],
    ['no, with a page', 'no', true, 8],
    ['unanswered, no page', null, false, 10],
    ['no, no page', 'no', false, 7],
  ] as const)('%s -> %i steps', (_n, teach, org, len) => {
    const path = personPath(teach, org);
    expect(path).toHaveLength(len);
    expect(path[path.length - 1]).toBe('email');
    expect(progressPercent(path[path.length - 1], path)).toBe(100);
    expect(progressPercent(path[0], path)).toBe(Math.round(100 / len));
    // Percent strictly rises along the path.
    const pcts = path.map((s) => progressPercent(s, path));
    expect([...pcts].sort((a, b) => a - b)).toEqual(pcts);
  });

  it('teach = No skips levels, styles, years both ways (Back too)', () => {
    const path = personPath('no', true);
    expect(nextStep('teach', path)).toBe('about');
    expect(prevStep('about', path)).toBe('teach');
    expect(prevStep('name', path)).toBeNull();
    expect(nextStep('email', path)).toBeNull();
  });

  it('a step not on the path reads 0%, never NaN', () => {
    expect(progressPercent('levels', personPath('no', true))).toBe(0);
  });
});

describe('blockedReason: every step x empty / filled', () => {
  it.each(PERSON_ORDER.map((s) => [s] as const))('%s', (step) => {
    const empty = blockedReason(step, EMPTY_DRAFT);
    if (STEP_COPY[step].optional) expect(empty).toBeNull();
    else expect(empty).toBe(STEP_COPY[step].reason);
    expect(blockedReason(step, FULL)).toBeNull();
  });

  it.each([['', false], ['0', true], ['60', true], ['61', false], ['4.5', false], ['-1', false], [' 7 ', true]])('years %j -> ok %s', (raw, ok) => {
    expect(parseYears(raw) !== null).toBe(ok);
    expect(blockedReason('years', { ...FULL, years: raw }) === null).toBe(ok);
  });

  it('a whitespace-only name is still blocked', () => {
    expect(blockedReason('name', { ...FULL, first_name: '   ' })).not.toBeNull();
  });
});

describe('commandFor: an untouched answer sends nothing, a change sends one key', () => {
  it.each(PERSON_ORDER.filter((s) => s !== 'email').map((s) => [s] as const))('%s untouched -> null', (step) => {
    expect(commandFor(step, FULL, FULL)).toBeNull();
  });

  const cases: [PersonStep, Partial<PersonDraft>, unknown][] = [
    ['name', { first_name: ' Alex ' }, { kind: 'dancer', patch: { first_name: 'Alex' } }],
    ['photo', { avatar_url: 'https://img/b.jpg' }, { kind: 'dancer', patch: { avatar_url: 'https://img/b.jpg' } }],
    ['role', { dance_role: 'Leader' }, { kind: 'dancer', patch: { dance_role: 'Leader' } }],
    ['nat', { nationality: 'GB-ENG' }, { kind: 'dancer', patch: { nationality: 'GB-ENG' } }],
    ['langs', { languages: ['English'] }, { kind: 'dancer', patch: { languages: ['English'] } }],
    ['langs', { languages: [] }, { kind: 'dancer', patch: { languages: [] } }],
    ['teach', { teach: 'no' }, { kind: 'teach', yes: false }],
    ['levels', { levels: ['Advanced', 'Beginner'] }, { kind: 'teacher', patch: { levels_taught: ['Beginner', 'Advanced'] } }],
    ['styles', { styles: ['Moderna', 'Fusion'] }, { kind: 'teacher', patch: { teaching_styles: ['Moderna', 'Fusion'] } }],
    ['years', { years: '0' }, { kind: 'teacher', patch: { years_teaching: 0 } }],
    ['about', { about: 'New words.' }, { kind: 'about', bio: 'New words.' }],
  ];
  it.each(cases)('%s changed -> one command', (step, change, cmd) => {
    expect(commandFor(step, { ...FULL, ...change }, FULL)).toEqual(cmd);
  });

  it.each([
    ['same nationality, other case', 'nat', { nationality: 'es' }],
    ['same languages, other order and case', 'langs', { languages: ['spanish', 'English'] }],
    ['cleared about is never sent (skip, not a wipe)', 'about', { about: '  ' }],
    ['no levels is never sent (Continue is off)', 'levels', { levels: [] }],
  ] as const)('%s -> null', (_n, step, change) => {
    expect(commandFor(step, { ...FULL, ...change } as PersonDraft, FULL)).toBeNull();
  });

  it('email always asks the server (it alone knows the private copy); heldAfter then holds each step', () => {
    expect(commandFor('email', FULL, FULL)).toEqual({ kind: 'signinEmail' });
    for (const step of PERSON_ORDER.filter((s) => s !== 'email')) {
      const changed = { ...FULL, first_name: 'Alex', avatar_url: 'u2', dance_role: 'Follower', nationality: 'FR', languages: ['French'], teach: 'no' as const, levels: ['Advanced'], styles: ['Salsa'], years: '9', about: 'Hi.' };
      expect(commandFor(step, changed, heldAfter(step, FULL, changed))).toBeNull();
    }
  });
});

describe('heldFrom over the prod shapes', () => {
  const dancer = (o: Record<string, unknown>) => ({ profile_id: 'p1', first_name: null, avatar_url: null, dance_role: null, nationality: null, languages: null, ...o });
  it.each([
    ['brand new (all null, no intent row, no teacher row)', { dancer: dancer({}), intent: { roles: [], declined: [] }, teacher: {}, bio: null }, EMPTY_DRAFT],
    ['alpha-2 nationality, [] languages', { dancer: dancer({ nationality: 'DO', languages: [] }), intent: { roles: ['dancer'], declined: [] }, teacher: null, bio: '' }, { ...EMPTY_DRAFT, nationality: 'DO' }],
    ['Lead and Follow, 3 languages, teacher claimed', { dancer: dancer({ first_name: 'Sam', dance_role: 'Lead and Follow', languages: ['English', 'Polish', 'Spanish'] }), intent: { roles: ['dancer', 'teacher', 'dj'], declined: [] }, teacher: { teaching_styles: ['Sensual', 'Moderna'], years_teaching: null, levels_taught: null }, bio: 'Hi' },
      { ...EMPTY_DRAFT, first_name: 'Sam', dance_role: 'Lead and Follow', languages: ['English', 'Polish', 'Spanish'], teach: 'yes', styles: ['Sensual', 'Moderna'], about: 'Hi' }],
    ['declined teacher wins over a claimed one', { dancer: dancer({}), intent: { roles: ['teacher'], declined: ['teacher'] }, teacher: { years_teaching: 12, levels_taught: ['Beginner', 'Nonsense'] }, bio: null },
      { ...EMPTY_DRAFT, teach: 'no', years: '12', levels: ['Beginner'] }],
    ['a legacy lower-case role is not shown as picked', { dancer: dancer({ dance_role: 'leader' }), intent: null, teacher: null, bio: null }, EMPTY_DRAFT],
  ])('%s', (_n, reads, expected) => {
    expect(heldFrom(reads as Parameters<typeof heldFrom>[0])).toEqual(expected);
  });
});

describe('pickers and the About starter', () => {
  it('six on screen: popular with no query, matches (starts-with first) with one', () => {
    expect(sixFor(LANG_ALL, LANG_FEW, '', (s) => s)).toEqual(LANG_FEW);
    expect(sixFor(STY_ALL, STY_FEW, 'ba', (s) => s)).toEqual(['Bachata sensual', 'Dominican bachata', 'Urban', 'Kizomba']);
    expect(sixFor(LANG_ALL, LANG_FEW, 'zzz', (s) => s)).toEqual([]);
    expect(sixFor(LANG_ALL, LANG_FEW, 'i', (s) => s)).toHaveLength(6);
  });

  it.each([
    [{ name: 'Leeds Nights', category: 'Dance School', city: 'Leeds', styles: ['Moderna'] }, 'Leeds Nights is a dance school in Leeds. Classes in Moderna.'],
    [{ name: 'Leeds Nights', category: null, city: 'Leeds', styles: [] }, 'Leeds Nights is based in Leeds.'],
    [{ name: 'Leeds Nights', category: 'Promoter', city: null, styles: [] }, 'Leeds Nights is a promoter.'],
    [{ name: 'Leeds Nights', category: null, city: null, styles: [] }, ''],
    [{ name: '', category: 'Promoter', city: 'Leeds', styles: [] }, ''],
  ])('starter never invents a fact: %j', (o, out) => {
    expect(starterSentence(o)).toBe(out);
  });
});
