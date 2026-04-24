import type { ReactNode } from 'react';
// PinkFallback keeps its legacy pink surface as a deliberate exception to
// the Phase 8g unified-surface palette — it signals no-cover / error
// states, not a normal tile. Imports PINK_FALLBACK_SURFACE (not
// BLOCK_COLORS.cover, which now resolves to BENTO_SURFACE) so the pink
// is preserved after the palette migration.
import { PINK_FALLBACK_SURFACE } from '@/modules/event-page/bento/BentoGrid';

type PinkFallbackProps = {
  title: string;
  subtitle?: string | null;
  action?: ReactNode;
  // When true, the panel fills its parent (height/width 100%) instead of
  // self-imposing a 4:3 aspect ratio. Used by CoverBlock now that cover
  // lives inside the bento grid as a 2×2 cell. Defaults to false so the
  // ErrorScreen (full-page not-found / unavailable) still renders 4:3.
  fill?: boolean;
};

// Shared pink panel. Two modes:
// - Default: 4:3 self-sized, used by the not-found / error / unavailable
//   ErrorScreen so those surfaces keep the same look as the old full-width
//   cover hero.
// - `fill`: 100% of parent, used by CoverBlock inside the grid cell.
export const PinkFallback = ({ title, subtitle, action, fill = false }: PinkFallbackProps) => (
  <div
    className="relative flex w-full items-center justify-center overflow-hidden rounded-[22px] px-6"
    style={
      fill
        ? { height: '100%', background: PINK_FALLBACK_SURFACE }
        : { aspectRatio: '4 / 3', background: PINK_FALLBACK_SURFACE }
    }
  >
    <div className="text-center">
      <h2
        className={
          fill
            ? 'text-[18px] font-extrabold leading-[0.95] tracking-[-0.03em] text-white'
            : 'text-[28px] font-extrabold leading-[0.95] tracking-[-0.03em] text-white'
        }
        style={{ wordBreak: 'break-word' }}
      >
        {title}
      </h2>
      {subtitle && <p className="mt-3 text-[13px] leading-[1.35] text-white/85">{subtitle}</p>}
      {action && <div className="mt-4">{action}</div>}
    </div>
  </div>
);
