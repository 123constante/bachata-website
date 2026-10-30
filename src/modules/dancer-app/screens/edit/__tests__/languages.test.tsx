// @vitest-environment jsdom
/** Languages tick list: parse -> ticks -> join round trip, save delta, search, and the nationality search height. */
import { afterEach, describe, expect, it } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { useState } from 'react';
import { readFileSync } from 'node:fs';
import { LANGUAGES, filterLanguages, joinLanguages, selectedLanguages, toggleLanguage } from '../languages';
import LanguagePicker from '../LanguagePicker';
import { buildDelta, draftFromProfile, parseLanguages } from '../../me/model';
import { DANCER_SHAPES } from '../../../api/fixtures';
import { parseMyDancerEdit } from '../../../api/rpc';

afterEach(cleanup);

const long = LANGUAGES.slice(0, 40).join(', ');

describe('stored value -> ticks -> join', () => {
  it.each([
    ['empty', '', ''],
    ['null', null, ''],
    ['one', 'English', 'English'],
    ['two', 'English, Spanish', 'English, Spanish'],
    ['lower case takes the list spelling', 'english,  spanish', 'English, Spanish'],
    ['unknown name is kept', 'Klingon, English', 'Klingon, English'],
    ['long list', long, long],
  ])('%s', (_n, stored, joined) => {
    const ticks = selectedLanguages(stored);
    expect(joinLanguages(ticks)).toBe(joined);
    expect(joinLanguages(selectedLanguages(joinLanguages(ticks)))).toBe(joined);
  });
  it('agrees with the save path parser (parseLanguages) on every shape', () => {
    for (const s of ['', 'a,,b', ' English ,english', 'Klingon, English', long]) {
      expect(selectedLanguages(s).map((x) => x.toLowerCase())).toEqual(parseLanguages(s).map((x) => x.toLowerCase()));
    }
  });
  it('toggle adds and removes, keeping unknown values', () => {
    expect(toggleLanguage('Klingon', 'Spanish')).toBe('Klingon, Spanish');
    expect(toggleLanguage('Klingon, Spanish', 'spanish')).toBe('Klingon');
  });
  it('list has no Other and no duplicates', () => {
    expect(LANGUAGES.some((n) => /^other$/i.test(n))).toBe(false);
    expect(new Set(LANGUAGES).size).toBe(LANGUAGES.length);
  });
});

describe('save delta', () => {
  const base = DANCER_SHAPES.fourFieldComplete.profile!;
  const profile = parseMyDancerEdit({ ...base, languages: ['english', 'Klingon'] } as never) ?? base;
  it('untouched sends nothing for languages', () => {
    expect('languages' in buildDelta(profile, draftFromProfile(profile))).toBe(false);
  });
  it('changed selection sends the joined string as the list it parses to', () => {
    const d = draftFromProfile(profile);
    const next = { ...d, languages: toggleLanguage(d.languages, 'Spanish') };
    expect(buildDelta(profile, next).languages).toEqual(['English', 'Klingon', 'Spanish']);
  });
});

const Host = ({ start }: { start: string }) => {
  const [v, setV] = useState(start);
  return (
    <>
      <LanguagePicker id="languages" value={v} onChange={setV} />
      <output data-testid="out">{v}</output>
    </>
  );
};

describe('LanguagePicker', () => {
  it('search filters case-insensitively', () => {
    expect(filterLanguages('SPAN')).toEqual(['Spanish']);
    render(<Host start="" />);
    fireEvent.change(screen.getByLabelText('Search languages'), { target: { value: 'sPaN' } });
    expect(screen.getByLabelText('Spanish')).toBeTruthy();
    expect(screen.queryByLabelText('French')).toBeNull();
  });
  it('empty result says what to do', () => {
    render(<Host start="" />);
    fireEvent.change(screen.getByLabelText('Search languages'), { target: { value: 'zzzz' } });
    expect(screen.getByTestId('languages-empty').textContent).toMatch(/clear the search/);
  });
  it('ticking writes the joined string; chips show ticks', () => {
    render(<Host start="Klingon" />);
    fireEvent.click(screen.getByLabelText('Spanish'));
    expect(screen.getByTestId('out').textContent).toBe('Klingon, Spanish');
    expect(screen.getByTestId('languages-chips').textContent).toMatch(/Klingon/);
  });
  it('letter group headers exist', () => {
    render(<Host start="" />);
    expect(screen.getByRole('group', { name: 'A' })).toBeTruthy();
    expect(screen.getByRole('group', { name: 'Z' })).toBeTruthy();
  });
});

describe('nationality picker search height', () => {
  it('search input is at least 44px (explicit px, not rem)', () => {
    const src = readFileSync('src/components/ui/nationality-picker.tsx', 'utf8');
    expect(src).toMatch(/<CommandInput[^>]*className='[^']*min-h-\[44px\]/);
  });
});
