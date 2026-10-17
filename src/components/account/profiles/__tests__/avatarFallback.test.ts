import { describe, expect, it } from 'vitest';
import { avatarFallback, avatarInitial, DANCER_NAME_PLACEHOLDER, type AvatarFace } from '../avatarFallback';

const PHOTO = 'https://pub-x.r2.dev/a.jpg';
const LONG = 'Maria-Fernanda Alexandrina Lopez de la Vega';

// Prod shapes: no photo, a photo, a broken photo (2 prod rows on a legacy host), no name
// (empty stub before the name card), the switcher placeholder, a long name.
const ROWS: Array<[string, string | null, boolean, string | null, AvatarFace, string]> = [
  ['photo + name', PHOTO, false, 'Ana', 'photo', 'A'],
  ['photo, no name', PHOTO, false, null, 'photo', ''],
  ['broken photo + name', PHOTO, true, 'Ana', 'initial', 'A'],
  ['broken photo, no name', PHOTO, true, null, 'glyph', ''],
  ['no photo + name', null, false, 'ana', 'initial', 'A'],
  ['no photo + long name', null, false, LONG, 'initial', 'M'],
  ['empty photo string + name', '  ', false, 'Ana', 'initial', 'A'],
  ['no photo, no name (empty stub)', null, false, null, 'glyph', ''],
  ['no photo, blank name', null, false, '   ', 'glyph', ''],
  ['no photo, placeholder label (M29)', null, false, DANCER_NAME_PLACEHOLDER, 'glyph', ''],
  ['broken photo, placeholder label', PHOTO, true, DANCER_NAME_PLACEHOLDER, 'glyph', ''],
];

describe('avatarFallback (one decision for every avatar)', () => {
  it.each(ROWS)('%s', (_n, photoUrl, imgFailed, name, face, letter) => {
    expect(avatarFallback({ photoUrl, imgFailed, name })).toBe(face);
    expect(avatarInitial(name)).toBe(letter);
  });
});
