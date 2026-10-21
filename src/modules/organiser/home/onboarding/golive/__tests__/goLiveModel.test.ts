import { describe, expect, it } from 'vitest';
import type { ProgressStep } from '@/modules/organiser/shared/profileProgress';
import { ORG_PATHS } from '@/modules/organiser/shell/paths';
import {
  allSetLine, almostLiveLine, goLivePath, mineFor, openQuestions, questionsText, sectionOf, stepInSection,
} from '../goLiveModel';

const s = (area: ProgressStep['area'], field: string, required = true, done = false): ProgressStep => ({ area, field, required, done });

describe('which questions are asked (the server list, required and open only)', () => {
  const steps = [
    s('dancer', 'first_name', true, true), s('dancer', 'nationality'), s('dancer', 'surname', false), s('teacher', 'years_teaching'),
    s('organiser', 'logo'), s('organiser', 'name', true, true), s('organiser', 'bio', false), s('dancer', 'gallery'),
  ];
  it('keeps server order, drops done, optional, unregistered and other-area steps', () => {
    expect(openQuestions({ steps }).map((x) => `${x.area}:${x.field}`)).toEqual(['dancer:nationality', 'organiser:logo']);
  });
  it('nothing open gives an empty list (the flow then opens on All set)', () => {
    expect(openQuestions({ steps: [s('dancer', 'first_name', true, true)] })).toEqual([]);
  });
});

describe('sections and step counts', () => {
  const list = [s('dancer', 'nationality'), s('dancer', 'languages'), s('organiser', 'logo'), s('organiser', 'category'), s('organiser', 'founded_year')];
  it.each([[0, 'you', 1, 2], [1, 'you', 2, 2], [2, 'page', 1, 3], [4, 'page', 3, 3]] as const)('question %i is %s, step %i of %i', (at, sec, k, n) => {
    expect(sectionOf(list[at])).toBe(sec);
    expect(stepInSection(list, at)).toEqual({ k, n });
  });
});

describe('"Use mine" only where an answer repeats', () => {
  const dancer = { instagram: ' ana.dances ', whatsapp: '+44 7700 900123', other_roles: [] as string[] };
  it.each([
    ['organiser', 'instagram', { label: 'Use mine', value: 'ana.dances' }],
    ['organiser', 'contact_phone', { label: 'Use my WhatsApp number', value: '+44 7700 900123' }],
    ['organiser', 'logo', null],
    ['organiser', 'founded_year', null],
    ['dancer', 'instagram', null],
    ['dancer', 'phone_or_whatsapp', null],
  ] as const)('%s:%s', (area, field, want) => {
    expect(mineFor({ area, field }, { dancer })).toEqual(want);
  });
  it.each([[null], [{ instagram: '  ', whatsapp: null, other_roles: [] }]])('no personal answer to reuse: %j offers nothing', (d) => {
    expect(mineFor({ area: 'organiser', field: 'instagram' }, { dancer: d })).toBeNull();
    expect(mineFor({ area: 'organiser', field: 'contact_phone' }, { dancer: d })).toBeNull();
  });
});

describe('words (approved prototype copy; one mapping)', () => {
  it('counts', () => {
    expect(questionsText(1)).toBe('1 quick question');
    expect(questionsText(10)).toBe('10 quick questions');
  });
  it('bridge and All set lines', () => {
    expect(almostLiveLine('Friday Social', 10)).toBe('Friday Social is saved. 10 quick questions and you can publish it.');
    expect(allSetLine('Friday Social')).toBe('Friday Social is ready to go live.');
    expect(allSetLine(null)).toBe('You can publish your first event.');
  });
  it('the flow path carries the event and the page', () => {
    expect(goLivePath('s1', 'o1')).toBe(`${ORG_PATHS.goLive}?series=s1&o=o1`);
    expect(goLivePath('s1', null)).toBe(`${ORG_PATHS.goLive}?series=s1`);
  });
});
