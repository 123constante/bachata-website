import type { ProfileSide } from '@/lib/accountRouting';

/** The one way a side is named on screen: the organiser's name, or the dancer's first name. */
export const sideTitle = (side: ProfileSide): string =>
  side.kind === 'organiser' ? side.name : side.firstName?.trim() || 'Your dancer profile';

/** What kind of side it is, under its name. */
export const sideKind = (side: ProfileSide): string => (side.kind === 'organiser' ? 'Organiser' : 'Dancer');

/** The organiser logo or the dancer face; the first letter when there is no picture. */
export function SideAvatar({ side, size }: { side: ProfileSide; size: number }) {
  const title = sideTitle(side);
  const radius = side.kind === 'organiser' ? 10 : size / 2;
  const box = { width: size, height: size, borderRadius: radius, flexShrink: 0 } as const;
  if (side.avatarUrl) {
    return <img src={side.avatarUrl} alt="" loading="lazy" style={{ ...box, objectFit: 'cover' }} data-testid="side-avatar-img" />;
  }
  return (
    <span
      aria-hidden="true"
      className="flex items-center justify-center bg-muted font-bold text-foreground"
      style={{ ...box, fontSize: Math.round(size * 0.42) }}
    >
      {title.charAt(0).toUpperCase()}
    </span>
  );
}
