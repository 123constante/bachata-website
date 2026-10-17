import { useState, type CSSProperties } from 'react';
import { UserRound } from 'lucide-react';
import { avatarFallback, avatarInitial } from './avatarFallback';

export type PersonAvatarProps = {
  photoUrl: string | null | undefined;
  /** A real name, or null. The placeholder label counts as none (glyph, never its "Y"). */
  name: string | null | undefined;
  size: number;
  /** Organisers are a rounded square (a logo); people are a circle. */
  shape?: 'circle' | 'rounded';
  loading?: 'lazy' | 'eager';
  imgTestId?: string;
  placeholderTestId?: string;
  /** The photo's alt text where the photo is content (DancerHome); decorative ("") by default. */
  alt?: string;
};

/**
 * THE avatar (audit H4/H11/M29): header picture, switcher sheet, Continue as...,
 * and the dancer Home / Me / Edit. avatarFallback() decides the face.
 *
 * No-photo disc: --da-avatar inside the dancer theme (>= 3:1 on --da-bg and
 * --da-surface, pinned by tests/client/dancerAppTheme.test.ts TEXT_PAIRS). Outside
 * it (organiser area, site pages) the site's muted-foreground on background,
 * which every site theme keeps at AA, so the disc is visible there too.
 */
export function PersonAvatar({ photoUrl, name, size, shape = 'circle', loading = 'lazy', imgTestId, placeholderTestId, alt = '' }: PersonAvatarProps) {
  // Keyed on the URL: a new photo gets a fresh try.
  const [failedUrl, setFailedUrl] = useState<string | null>(null);
  const face = avatarFallback({ photoUrl, imgFailed: Boolean(photoUrl) && failedUrl === photoUrl, name });
  const box: CSSProperties = { width: size, height: size, borderRadius: shape === 'rounded' ? 10 : '50%', flex: '0 0 auto' };
  if (face === 'photo' && photoUrl) {
    return (
      <img
        src={photoUrl}
        alt={alt}
        width={size}
        height={size}
        loading={loading}
        data-face="photo"
        data-testid={imgTestId}
        style={{ ...box, objectFit: 'cover' }}
        onError={() => setFailedUrl(photoUrl)}
      />
    );
  }
  const glyph = Math.round(size * 0.56);
  return (
    <span
      aria-hidden="true"
      data-face={face}
      data-testid={placeholderTestId}
      style={{
        ...box,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: 'var(--da-avatar, hsl(var(--muted-foreground)))',
        color: 'var(--da-text, hsl(var(--background)))',
        fontWeight: 800,
        fontSize: Math.round(size * 0.42),
        lineHeight: 1,
      }}
    >
      {face === 'initial' ? avatarInitial(name) : <UserRound aria-hidden="true" style={{ width: glyph, height: glyph }} />}
    </span>
  );
}

export default PersonAvatar;
