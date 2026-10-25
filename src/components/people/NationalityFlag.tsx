/**
 * The nationality badge: a small flag sticker at the top-right of a person's photo
 * (owner pick, 2026-10-13: style "Sticker"). THE one implementation every person-photo
 * surface uses (directly, or through <PersonAvatar>), so the same code always reads the same.
 *
 * - No flag at all when the code is null, empty, malformed or not a country (see
 *   nationality.ts): renders nothing, so there is no placeholder and no gap.
 * - Size: stickerSize, the one rule (28-47px photos get the small sticker, 40% and at
 *   least 14px; 48px and up 46% and at least 20px).
 * - No sticker on a photo under MIN_FLAG_PHOTO_PX (28px): the caller puts
 *   smallPhotoNationalityProps on the photo, so the country is still its label and title.
 * - pointer-events: none, so it never takes a tap meant for the photo or a control.
 * - role="img" + aria-label "Nationality: <country>" and a title with the country name.
 * - Static: a 3:2 flag tilted 9deg with a 2px white edge and a soft drop shadow. No
 *   animation of any kind, so reduced motion needs no special case.
 * - The artwork is inline SVG (flagArt.ts): no network call, works offline.
 *
 * The parent must be position: relative. `corner` (round photos) sets the sticker
 * half outside the photo's top-right (top -6%, right -14% of the photo box), so that
 * parent and its ancestors must not clip; `inset` keeps it inside the corner, for
 * photos that sit flush to the edge of a clipped card.
 */
import type { CSSProperties } from 'react';
import { cn } from '@/lib/utils';
import { MIN_FLAG_PHOTO_PX, nationalityLabel } from './nationality';
import { flagArtMarkup } from './flagArt';

export type FlagPlacement = 'corner' | 'inset';

/** The `size` to pass for an `inset` flag on a large card photo (gives a 22px sticker). */
export const TILE_FLAG_SIZE = 48;

/** Smallest sticker width in CSS px on a photo of 48px and up. */
export const MIN_STICKER_PX = 20;

/**
 * Largest photo (CSS px) that gets the SMALL sticker: 28-47px photos (header search and
 * Cmd+K rows 36px, list rows 40px) get the same sticker scaled down (owner decision
 * 2026-10-13, round 3), so it no longer covers half the photo.
 */
export const SMALL_PHOTO_MAX_PX = 47;

/** Smallest small-sticker width in CSS px: the 11 prod codes still read at 14px. */
export const MIN_SMALL_STICKER_PX = 14;

export interface NationalityFlagProps {
  /** nationality_code from a public read (or a stored nationality); anything is accepted. */
  code: unknown;
  /** The round photo's diameter in CSS px; TILE_FLAG_SIZE for an `inset` flag on a card photo. */
  size: number;
  placement?: FlagPlacement;
  /** `inset` only: distance of the sticker from the photo's top and right edges, CSS px. */
  inset?: number;
  className?: string;
}

/**
 * Sticker width and height (CSS px) for a photo of `size` px, 3:2. THE size rule for every
 * surface: 28-47px photos 40% of the photo, at least 14px; 48px and up 46%, at least 20px.
 * (Under MIN_FLAG_PHOTO_PX NationalityFlag renders nothing.)
 */
export function stickerSize(size: number): { w: number; h: number } {
  const photo = Math.max(0, size);
  const w = photo <= SMALL_PHOTO_MAX_PX
    ? Math.max(MIN_SMALL_STICKER_PX, Math.round(photo * 0.4))
    : Math.max(MIN_STICKER_PX, Math.round(photo * 0.46));
  return { w, h: Math.round(((w * 2) / 3) * 100) / 100 };
}

export function stickerBoxStyle(size: number, placement: FlagPlacement = 'corner', inset = 6): CSSProperties {
  const { w, h } = stickerSize(size);
  // Percentages of the (square) photo box, so a fluid photo keeps the same placement.
  const pos: CSSProperties = placement === 'inset' ? { top: inset, right: inset } : { top: '-6%', right: '-14%' };
  return {
    ...pos,
    width: w,
    height: h,
    transform: 'rotate(9deg)',
    borderRadius: 3,
    boxShadow: '0 0 0 2px #fff, 0 3px 8px rgba(0,0,0,.6)',
  };
}

export function NationalityFlag({ code, size, placement = 'corner', inset, className }: NationalityFlagProps) {
  const label = nationalityLabel(code);
  if (!label || size < MIN_FLAG_PHOTO_PX) return null;
  return (
    <span
      role="img"
      aria-label={label.ariaLabel}
      title={label.name}
      data-nationality-flag={label.code}
      className={cn('pointer-events-none absolute z-[2] block select-none overflow-hidden', className)}
      style={stickerBoxStyle(size, placement, inset)}
    >
      <svg
        aria-hidden="true"
        focusable="false"
        viewBox="0 0 30 20"
        preserveAspectRatio="xMidYMid slice"
        className="block h-full w-full"
        // Static artwork from flagArt.ts; the only variable part (a generic flag's
        // letters) is reduced to A-Z there.
        dangerouslySetInnerHTML={{ __html: flagArtMarkup(label.code) }}
      />
    </span>
  );
}

export default NationalityFlag;
