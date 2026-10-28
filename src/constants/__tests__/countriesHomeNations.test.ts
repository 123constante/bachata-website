import { describe, expect, it } from 'vitest';
import { loadCountries } from '@/constants/countries';
import { nationalityCodeForPick } from '@/modules/dancer-app/screens/edit/editModel';
import { nationalityLabel, normaliseNationalityCode } from '@/components/people/nationality';
import { flagArtMarkup, FLAG_ART } from '@/components/people/flagArt';
import { getNationalityCode } from '@/lib/utils';

const HOME = ['GB-ENG', 'GB-NIR', 'GB-SCT', 'GB-WLS'];

describe('country list: full ISO 3166-1 plus GB home nations', () => {
  it('lists every ISO entry and the four home nations beside GB', async () => {
    const list = await loadCountries();
    const codes = list.map((c) => c.code);
    expect(list.length).toBeGreaterThan(245);
    for (const c of ['GB', ...HOME, 'TW', 'HK', 'PS', 'VA', 'XK']) expect(codes).toContain(c);
    expect(new Set(codes).size).toBe(codes.length);
    expect(list.find((c) => c.code === 'GB-SCT')?.name).toBe('Scotland');
  });
  it('every entry has a name; home nations carry a flag emoji and a flagcdn url', async () => {
    const list = await loadCountries();
    expect(list.every((c) => c.name.length > 0)).toBe(true);
    const eng = list.find((c) => c.code === 'GB-ENG')!;
    expect(eng.flag).not.toBe('');
    expect(eng.flagUrl).toBe('https://flagcdn.com/w40/gb-eng.png');
  });
});

describe('table: stored value through picker pick, label and flag (no crash, nothing blank)', () => {
  const rows: Array<[unknown, string | null]> = [
    ['ES', 'Spain'], ['gb', 'United Kingdom'], ['GB-ENG', 'England'], ['gb-sct', 'Scotland'],
    ['GB-WLS', 'Wales'], ['GB-NIR', 'Northern Ireland'], ['GB-XXX', null], ['', null], [null, null], ['Spanish', null],
  ];
  it.each(rows)('%j -> %s', (raw, name) => {
    expect(nationalityLabel(raw)?.name ?? null).toBe(name);
    if (name) expect(flagArtMarkup(normaliseNationalityCode(raw) as string).length).toBeGreaterThan(0);
  });
  it('home nations reuse the GB artwork, not the generic letters flag', () => {
    for (const c of HOME) expect(flagArtMarkup(c)).toBe(FLAG_ART.GB);
  });
  it('getNationalityCode keeps a home nation code', () => {
    expect(getNationalityCode('GB-ENG')).toBe('gb-eng');
    expect(getNationalityCode('gb')).toBe('gb');
  });
});

describe('save path', () => {
  it('a picked name becomes the code only; cleared stays empty', async () => {
    const list = await loadCountries();
    expect(nationalityCodeForPick('Scotland', list)).toBe('GB-SCT');
    expect(nationalityCodeForPick('Spain', list)).toBe('ES');
    expect(nationalityCodeForPick('', list)).toBe('');
  });
});
