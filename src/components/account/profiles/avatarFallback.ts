/**
 * The ONE decision every person/organiser avatar makes (audit H4, H11, M29):
 * show the photo, the first letter of a real name, or a person glyph.
 * PersonAvatar renders it; the header picture, the switcher sheet, Continue
 * as..., and the dancer Home / Me / Edit avatar all go through PersonAvatar.
 */

/** What the switcher calls a dancer side with no first name yet. A label, never a name (M29). */
export const DANCER_NAME_PLACEHOLDER = 'Your dancer profile';

export type AvatarFace = 'photo' | 'initial' | 'glyph';

export type AvatarFallbackInput = {
  photoUrl: string | null | undefined;
  /** True once the browser refused or failed to load photoUrl. */
  imgFailed: boolean;
  /** The real name, or null. A placeholder label counts as no name. */
  name: string | null | undefined;
};

const realName = (name: string | null | undefined): string | null => {
  const n = (name ?? '').trim();
  return n === '' || n === DANCER_NAME_PLACEHOLDER ? null : n;
};

export const avatarFallback = ({ photoUrl, imgFailed, name }: AvatarFallbackInput): AvatarFace => {
  if ((photoUrl ?? '').trim() !== '' && !imgFailed) return 'photo';
  return realName(name) ? 'initial' : 'glyph';
};

/** The letter shown for 'initial' (first character, upper-cased); '' when there is no real name. */
export const avatarInitial = (name: string | null | undefined): string => {
  const n = realName(name);
  return n ? Array.from(n)[0].toUpperCase() : '';
};
