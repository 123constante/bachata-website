/** B-WEB1: the pinned key list, diff-first patches, client validation, completeness, error copy, response parsers. */
import { describe, expect, it } from 'vitest';
import { ROLE_FIELDS, roleFieldKeys, type Role } from '../shared/fieldRegistry';
import { completeness, completenessLine, diffPatch, toDraft, validatePatch } from '../shared/roleModel';
import { ROLE_ERROR_CODES, ROLE_ERROR_COPY, ROLE_ERROR_FALLBACK, roleErrorMessage } from '../shared/errorCopy';
import { MALFORMED, parseDeclinedResult, parseLineup, parseRoleDetails, parseSaveResult } from '../shared/areaApi';
import { teacherWizardSteps } from '../teacher/wizardSteps';
import { djWizardSteps } from '../dj/wizardSteps';

// The ONLY writable keys save_my_role_v1 accepts (brief B-WEB1, pinned interface).
const PINNED: Record<Role, string[]> = {
  teacher: ['years_teaching', 'teaching_styles', 'offers_private', 'private_lesson_types', 'private_lesson_locations', 'private_travel_distance', 'partner_role'],
  dj: ['dj_name', 'genres', 'soundcloud', 'mixcloud', 'pricing'],
};
const EMPTY: Record<Role, Record<string, unknown>> = {
  teacher: { years_teaching: null, teaching_styles: [], offers_private: null, private_lesson_types: [], private_lesson_locations: [], private_travel_distance: null, partner_role: null },
  dj: { dj_name: null, genres: [], soundcloud: null, mixcloud: null, pricing: null },
};

describe.each(['teacher', 'dj'] as Role[])('%s registry', (role) => {
  it('labels exactly the pinned writable keys', () => {
    expect(new Set(roleFieldKeys(role))).toEqual(new Set(PINNED[role]));
    expect(roleFieldKeys(role)).toHaveLength(PINNED[role].length);
  });
  it('has one wizard step per writable key, one question each', () => {
    const steps = role === 'teacher' ? teacherWizardSteps : djWizardSteps;
    expect(steps.map((s) => s.field)).toEqual(roleFieldKeys(role));
    for (const s of steps) {
      expect(s.area).toBe(role);
      expect(s.title).toMatch(/\?$/);
      expect(Object.keys(s.toPatch('x'))).toEqual([s.field]);
    }
  });
  it('untouched form -> empty patch (nothing is sent)', () => {
    expect(diffPatch(role, EMPTY[role], toDraft(role, EMPTY[role]))).toEqual({});
  });
  it('an all-null / missing details object is also untouched', () => {
    expect(diffPatch(role, {}, toDraft(role, {}))).toEqual({});
  });
  it('every field marked by label is unique', () => {
    expect(new Set(ROLE_FIELDS[role].map((f) => f.label)).size).toBe(ROLE_FIELDS[role].length);
  });
});

describe('diff-first: one changed key sends exactly that key', () => {
  const cases: [Role, string, unknown, unknown][] = [
    ['teacher', 'years_teaching', '7', 7],
    ['teacher', 'teaching_styles', ['Sensual'], ['Sensual']],
    ['teacher', 'offers_private', false, false],
    ['teacher', 'partner_role', '  Both  ', 'Both'],
    ['dj', 'dj_name', 'DJ Luna', 'DJ Luna'],
    ['dj', 'pricing', 'Line one\nLine two\n', 'Line one\nLine two'],
    ['dj', 'soundcloud', 'https://soundcloud.com/x', 'https://soundcloud.com/x'],
  ];
  it.each(cases)('%s.%s', (role, key, draftValue, sent) => {
    const draft = { ...toDraft(role, EMPTY[role]), [key]: draftValue };
    expect(diffPatch(role, EMPTY[role], draft)).toEqual({ [key]: sent });
  });
  it('clearing a filled text sends null, clearing a list sends []', () => {
    const held = { ...EMPTY.dj, dj_name: 'DJ Luna', genres: ['Bachata'] };
    expect(diffPatch('dj', held, { ...toDraft('dj', held), dj_name: '  ', genres: [] })).toEqual({ dj_name: null, genres: [] });
  });
  it('re-typing the held value is not a change', () => {
    const held = { ...EMPTY.teacher, years_teaching: 5 };
    expect(diffPatch('teacher', held, { ...toDraft('teacher', held), years_teaching: ' 5 ' })).toEqual({});
  });
});

describe('client validation mirrors the server rules', () => {
  const cases: [Role, Record<string, unknown>, Record<string, string>][] = [
    ['teacher', { years_teaching: 81 }, { years_teaching: 'invalid_years' }],
    ['teacher', { years_teaching: 'ten' }, { years_teaching: 'invalid_years' }],
    ['teacher', { years_teaching: 0 }, {}],
    ['teacher', { years_teaching: 80 }, {}],
    ['teacher', { partner_role: 'x'.repeat(81) }, { partner_role: 'invalid_text' }],
    ['teacher', { partner_role: 'x'.repeat(80) }, {}],
    ['teacher', { teaching_styles: Array.from({ length: 21 }, (_, i) => `s${i}`) }, { teaching_styles: 'invalid_list' }],
    ['teacher', { teaching_styles: ['x'.repeat(81)] }, { teaching_styles: 'invalid_list' }],
    ['teacher', { teaching_styles: Array.from({ length: 20 }, (_, i) => `s${i}`) }, {}],
    ['dj', { soundcloud: 'https://a b' }, { soundcloud: 'invalid_link' }],
    ['dj', { mixcloud: `https://${'x'.repeat(293)}` }, { mixcloud: 'invalid_link' }],
    ['dj', { mixcloud: `https://${'x'.repeat(292)}` }, {}],
    ['dj', { pricing: 'x'.repeat(281) }, { pricing: 'invalid_text' }],
    ['dj', { pricing: `${'x'.repeat(139)}\n${'y'.repeat(140)}` }, {}],
    ['dj', { dj_name: null }, {}],
  ];
  it.each(cases)('%s %j', (role, patch, expected) => {
    expect(validatePatch(role, patch)).toEqual(expected);
  });
});

describe('completeness = filled keys / all keys', () => {
  it.each([
    ['teacher', EMPTY.teacher, 0, 7, 'No details added yet'],
    ['teacher', { ...EMPTY.teacher, offers_private: false, years_teaching: 0 }, 2, 7, '2 of 7 details added'],
    ['dj', { ...EMPTY.dj, genres: ['  '] }, 0, 5, 'No details added yet'],
    ['dj', { dj_name: 'A', genres: ['B'], soundcloud: 'c', mixcloud: 'd', pricing: 'e' }, 5, 5, 'All 5 details added'],
  ] as const)('%s %#', (role, details, filled, total, line) => {
    const c = completeness(role, details);
    expect([c.filled, c.total]).toEqual([filled, total]);
    expect(completenessLine(c)).toBe(line);
  });
});

describe('refusal -> plain words (one table)', () => {
  it('every pinned code has a sentence', () => {
    expect([...ROLE_ERROR_CODES].sort()).toEqual(
      ['invalid_link', 'invalid_list', 'invalid_payload', 'invalid_role', 'invalid_text', 'invalid_type', 'invalid_years', 'no_profile', 'not_signed_in', 'rate_limited', 'unknown_key'].sort(),
    );
  });
  it.each(ROLE_ERROR_CODES.map((c) => [c]))('%s', (code) => {
    const msg = roleErrorMessage(new Error(`P0001: ${code}`));
    expect(msg).toBe(ROLE_ERROR_COPY[code]);
    expect(msg).not.toMatch(/_/); // no internal codes on screen
  });
  it('anything else reads as the calm fallback', () => {
    expect(roleErrorMessage(new Error('Could not find the function public.save_my_role_v1'))).toBe(ROLE_ERROR_FALLBACK);
    expect(roleErrorMessage(null)).toBe(ROLE_ERROR_FALLBACK);
  });
});

describe('parsers refuse unexpected shapes', () => {
  const details = { role: 'dj', person_id: 'p1', details: {} };
  it('role details', () => {
    expect(parseRoleDetails('dj', details).personId).toBe('p1');
    expect(() => parseRoleDetails('teacher', details)).toThrow(MALFORMED);
    expect(() => parseRoleDetails('dj', { ...details, details: [] })).toThrow(MALFORMED);
    expect(() => parseRoleDetails('dj', null)).toThrow(MALFORMED);
  });
  it('save result', () => {
    expect(parseSaveResult('dj', { ...details, changed: true, changed_keys: ['dj_name'] }).changedKeys).toEqual(['dj_name']);
    expect(() => parseSaveResult('dj', { ...details, changed: 'yes', changed_keys: [] })).toThrow(MALFORMED);
  });
  it('declined result', () => {
    expect(parseDeclinedResult({ roles: ['dancer'], declined: ['dj'], changed: true }).declined).toEqual(['dj']);
    expect(() => parseDeclinedResult({ roles: 'dancer', declined: [], changed: true })).toThrow(MALFORMED);
  });
  it('line-up keeps server order and refuses a bad row', () => {
    const rows = [
      { series_id: 's2', event_name: 'B', slug: 'b', date: '2026-11-01', session_title: 'Workshop' },
      { series_id: 's1', event_name: 'A', slug: null, date: '2026-10-25', session_title: null },
    ];
    expect(parseLineup(rows).map((r) => r.seriesId)).toEqual(['s2', 's1']);
    expect(parseLineup([])).toEqual([]);
    expect(() => parseLineup({})).toThrow(MALFORMED);
    expect(() => parseLineup([{ ...rows[0], date: '1 Nov' }])).toThrow(MALFORMED);
  });
});
