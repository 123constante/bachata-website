/**
 * The nationality badge: a small flag on a pole, waving, at the top-right of a person's
 * photo. THE one implementation every person-photo surface uses (directly, or through
 * <PersonAvatar>), so the same code always reads the same.
 *
 * - No flag at all when the code is null, empty, malformed or not a country (see
 *   nationality.ts): renders nothing, so there is no placeholder and no gap.
 * - pointer-events: none, so it never takes a tap meant for the photo or a control.
 * - role="img" + aria-label "Nationality: <country>" and a title with the country name.
 * - Motion: the Silk preset (flagWave.ts) on the shared clock (flagClock.ts); still under
 *   prefers-reduced-motion, paused while the tab is hidden or the flag is off screen.
 *
 * The parent must be position: relative. `corner` (round photos) lets the flag stand
 * out past the photo's top-right like the reference, so that parent must not clip;
 * `inset` keeps it inside the corner, for photos in a clipped card.
 */
import { useEffect, useRef, type CSSProperties } from 'react';
import { cn } from '@/lib/utils';
import { nationalityLabel } from './nationality';
import { flagDataUrl } from './flagArt';
import { drawFlag, flagGeometry, randomSeed, type FlagGeometry } from './flagWave';
import { drawNow, registerFlag } from './flagClock';

export type FlagPlacement = 'corner' | 'inset';

/** The `size` to pass for an `inset` flag on a large card photo (gives the reference's 22px cloth). */
export const TILE_FLAG_SIZE = 48;

export interface NationalityFlagProps {
  /** nationality_code from a public read (or a stored nationality); anything is accepted. */
  code: unknown;
  /** The round photo's diameter in CSS px; TILE_FLAG_SIZE for an `inset` flag on a card photo. */
  size: number;
  placement?: FlagPlacement;
  /** `inset` only: distance of the cloth from the photo's top and right edges (clear a rounded corner). */
  inset?: number;
  className?: string;
}

type Art = { cv: HTMLCanvasElement | null; ready: Promise<HTMLCanvasElement | null> };
const artCache = new Map<string, Art>();

/** The flag rasterised once at the cloth's device size; shared by every flag of that code and size. */
function flagArt(code: string, W: number, H: number): Art {
  const key = `${code}|${W}x${H}`;
  const hit = artCache.get(key);
  if (hit) return hit;
  const art: Art = { cv: null, ready: Promise.resolve(null) };
  art.ready = new Promise((resolve) => {
    const im = new Image();
    im.onload = () => {
      const cv = document.createElement('canvas');
      cv.width = W;
      cv.height = H;
      const c = cv.getContext('2d');
      if (!c) return resolve(null);
      c.imageSmoothingQuality = 'high';
      c.drawImage(im, 0, 0, W, H);
      art.cv = cv;
      resolve(cv);
    };
    im.onerror = () => resolve(null);
    im.src = flagDataUrl(code);
  });
  artCache.set(key, art);
  return art;
}

export function flagBoxStyle(g: FlagGeometry, placement: FlagPlacement, inset = 4): CSSProperties {
  // The cloth starts pad+2 px below the canvas top and ends 4px short of its right edge.
  if (placement === 'inset') return { right: inset - 4, top: inset - g.pad - 2, width: g.cw, height: g.ch };
  // Corner: the reference's left = .62 size, top = -.14 size - pad, as percentages of the
  // (square) photo box, so a fluid photo keeps the same placement at any width.
  return { left: '62%', top: `calc(-14% - ${g.pad}px)`, width: g.cw, height: g.ch };
}

export function NationalityFlag({ code, size, placement = 'corner', inset, className }: NationalityFlagProps) {
  const label = nationalityLabel(code);
  const ref = useRef<HTMLCanvasElement>(null);
  const g = flagGeometry(size);
  const iso = label?.code ?? null;

  useEffect(() => {
    const cv = ref.current;
    if (!cv || !iso) return;
    const ctx = cv.getContext('2d');
    if (!ctx) return;
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    cv.width = Math.round(g.cw * dpr);
    cv.height = Math.round(g.ch * dpr);
    const seed = randomSeed();
    const art = flagArt(iso, Math.round(g.fw * dpr), Math.round(g.fh * dpr));
    const unregister = registerFlag(cv, (t) => {
      if (art.cv) drawFlag(ctx, art.cv, g, seed, t, dpr);
    });
    let live = true;
    void art.ready.then(() => live && drawNow(cv));
    return () => {
      live = false;
      unregister();
    };
    // g is derived from size alone.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [iso, size]);

  if (!label) return null;
  return (
    <span
      role="img"
      aria-label={label.ariaLabel}
      title={label.name}
      data-nationality-flag={label.code}
      className={cn('pointer-events-none absolute z-[2] block select-none', className)}
      style={flagBoxStyle(g, placement, inset)}
    >
      <canvas ref={ref} aria-hidden="true" className="block h-full w-full" />
    </span>
  );
}

export default NationalityFlag;
