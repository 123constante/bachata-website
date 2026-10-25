import type { PersonRole } from '../personRoles';
import { initials } from '../facts';
import { FONT, WORLD } from '../worlds/tokens';
import { usePhotoFallback } from './usePhotoFallback';

/**
 * The one face of the people worlds: the photo in a circle, or the one placeholder family
 * (circle, initials in Inter 800, coloured by the world). A photo that fails -- also one that
 * failed before hydration -- falls back to the initials, never a broken image.
 */
export function Avatar({ name, photo, world, size, ring = true, className }: {
  name: string | null | undefined;
  photo: string | null | undefined;
  world: PersonRole;
  /** Diameter in px (explicit px on purpose: rem renders ~16% small on phones). */
  size: number;
  ring?: boolean;
  className?: string;
}) {
  const { showPhoto, imgProps } = usePhotoFallback(photo || null);
  const t = WORLD[world].avatar;
  const border = ring ? Math.max(2, Math.round(size / 28)) : 0;
  return (
    <div
      data-testid="person-avatar"
      data-world={world}
      data-photo={showPhoto ? 'photo' : 'initials'}
      className={`flex shrink-0 items-center justify-center overflow-hidden rounded-full ${className ?? ''}`}
      style={{ width: size, height: size, background: t.background, border: border ? `${border}px solid ${t.ring}` : undefined }}
    >
      {showPhoto ? (
        <img {...imgProps} src={photo as string} alt="" loading="eager" className="h-full w-full object-cover" decoding="async" />
      ) : (
        <b aria-hidden style={{ fontFamily: FONT.body, fontWeight: 800, letterSpacing: '0.02em', color: t.ink, fontSize: Math.round(size * 0.36) }}>
          {initials(name)}
        </b>
      )}
    </div>
  );
}
