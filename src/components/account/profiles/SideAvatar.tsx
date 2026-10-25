import type { ProfileSide } from '@/lib/accountRouting';
import { DANCER_NAME_PLACEHOLDER } from './avatarFallback';
import { PersonAvatar } from './PersonAvatar';

/** The one way a side is named on screen: the organiser's name, or the dancer's first name. */
export const sideTitle = (side: ProfileSide): string =>
  side.kind === 'organiser' ? side.name : side.firstName?.trim() || DANCER_NAME_PLACEHOLDER;

/** What kind of side it is, under its name. */
export const sideKind = (side: ProfileSide): string => (side.kind === 'organiser' ? 'Organiser' : 'Dancer');

/** The organiser logo or the dancer face, through the one PersonAvatar (initial, or a glyph with no name). */
export function SideAvatar({ side, size }: { side: ProfileSide; size: number }) {
  return (
    <PersonAvatar
      photoUrl={side.avatarUrl}
      name={side.kind === 'organiser' ? side.name : side.firstName}
      size={size}
      shape={side.kind === 'organiser' ? 'rounded' : 'circle'}
      imgTestId="side-avatar-img"
      placeholderTestId="side-avatar-placeholder"
    />
  );
}
