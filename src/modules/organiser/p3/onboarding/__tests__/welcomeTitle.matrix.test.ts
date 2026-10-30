/**
 * Playful mood, Welcome title: the ONE shared mapping. First name known -> "Hey <first>, you made it!";
 * unknown -> the previous copy. Shapes: known / empty / whitespace / long / non-Latin / multi-word.
 */
import { describe, expect, it } from 'vitest';
import { welcomeTitle } from '../pageModel';

describe('welcomeTitle', () => {
  const cases: Array<[string, string | null | undefined, string | null, string]> = [
    ['known first name', 'Sam', 'Ritmo Bachata London', 'Hey Sam, you made it!'],
    ['known, no page held', 'Sam', null, 'Hey Sam, you made it!'],
    ['empty -> page name', '', 'Ritmo Bachata London', 'Welcome to Ritmo Bachata London'],
    ['whitespace -> page name', '   ', 'Ritmo Bachata London', 'Welcome to Ritmo Bachata London'],
    ['null -> page name', null, 'Ritmo Bachata London', 'Welcome to Ritmo Bachata London'],
    ['undefined, no page -> Welcome', undefined, null, 'Welcome'],
    ['empty, empty page -> Welcome', '', '', 'Welcome'],
    ['multi-word keeps the first word', '  Mary Jane Watson ', null, 'Hey Mary, you made it!'],
    ['non-Latin', '田中', null, 'Hey 田中, you made it!'],
    ['accented / Arabic', 'محمد', null, 'Hey محمد, you made it!'],
    ["apostrophe name", "O'Brien", null, "Hey O'Brien, you made it!"],
    ['markup characters stay literal text', '<b>&', null, 'Hey <b>&, you made it!'],
    ['punctuation-only first word -> page name', '. Sam', 'Leeds Nights', 'Welcome to Leeds Nights'],
    ['long name is clipped', 'A'.repeat(60), null, `Hey ${'A'.repeat(23)}…, you made it!`],
    ['emoji is not split mid-character', '\u{1F600}'.repeat(30), null, `Hey ${'\u{1F600}'.repeat(23)}…, you made it!`],
  ];
  it.each(cases)('%s', (_n, first, page, want) => {
    expect(welcomeTitle(first, page)).toBe(want);
  });
});

import { flagEmoji, flagFallbackText } from '../ObShell';

describe('flagEmoji fallback', () => {
  it('maps ISO codes and home nations, never empty for a valid code', () => {
    expect(flagEmoji('gb')).toBe('\u{1F1EC}\u{1F1E7}');
    expect(flagEmoji('PL')).toBe('\u{1F1F5}\u{1F1F1}');
    expect(flagEmoji('gb-sct')).toBe('\u{1F3F4}\u{E0067}\u{E0062}\u{E0073}\u{E0063}\u{E0074}\u{E007F}');
    expect(flagEmoji('gb-eng')).toBe('\u{1F3F4}\u{E0067}\u{E0062}\u{E0065}\u{E006E}\u{E0067}\u{E007F}');
    expect(flagEmoji('gb-wls')).toBe('\u{1F3F4}\u{E0067}\u{E0062}\u{E0077}\u{E006C}\u{E0073}\u{E007F}');
    expect(flagEmoji('gb-nir')).toBe('');
    expect(flagEmoji('nope!')).toBe('');
  });
  it('flags with no RGI emoji fall back to the code as text, never a wrong flag or tofu', () => {
    expect(flagFallbackText('gb-nir')).toBe('NI');
    expect(flagFallbackText('gb')).toBe('\u{1F1EC}\u{1F1E7}');
    expect(flagFallbackText('gb-sct')).not.toBe('');
  });
});
