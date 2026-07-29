import { useMemo, type ReactNode } from 'react';

// All bento block ids. `cover` is now a grid block (2-col top-left) rather
// than a full-width hero. `city` is mutually exclusive with `promo` — one of
// them always occupies the top-right 1-col slot next to Date.
export type BentoBlockId =
  | 'cover'
  | 'date'
  | 'promo'
  | 'city'
  | 'venue'
  | 'video'
  | 'organiser-card'
  | 'schedule'
  | 'dates'
  | 'description'
  | 'raffle'
  | 'guest';

// Every block id is placed inside the 4-col grid. Kept as a type alias so the
// rest of the code (renderBlock callbacks, hidden sets) has a stable name.
export type GridBlockId = BentoBlockId;

// Phase 8g palette migration (Vibe F: Velvet & Brass) — every tile shares
// the raised forest-green surface; the page behind the tiles uses the
// deeper --bento-surface so tiles visually "sit on" the page. Brass
// accents (border, title strip, raffle glyph) + aged-cream body text
// complete the two-hue palette.
export const BENTO_SURFACE = 'hsl(var(--bento-surface-raised))';
// Text tokens — imported by blocks that need inline style colours
// (Tailwind arbitrary values work too but inline style keeps the hex-free
// promise visible at call sites).
export const BENTO_FG = 'hsl(var(--bento-fg))';
export const BENTO_FG_MUTED = 'hsl(var(--bento-fg-muted))';
export const BENTO_ACCENT = 'hsl(var(--bento-accent))';

// PinkFallback is semantically distinct from a normal tile (no-cover / error
// state) and retains its legacy pink. Kept as a named export so
// PinkFallback.tsx has a token to import instead of a floating hex literal.
export const PINK_FALLBACK_SURFACE = '#E13A8A';

// BLOCK_COLORS is retained for backward compatibility with consumers that
// still read `BLOCK_COLORS[id]` — every entry now points to BENTO_SURFACE so
// those consumers get the unified surface without requiring call-site
// churn. New code should import BENTO_SURFACE directly.
export const BLOCK_COLORS: Record<BentoBlockId, string> = {
  cover: BENTO_SURFACE,
  date: BENTO_SURFACE,
  promo: BENTO_SURFACE,
  city: BENTO_SURFACE,
  venue: BENTO_SURFACE,
  video: BENTO_SURFACE,
  'organiser-card': BENTO_SURFACE,
  schedule: BENTO_SURFACE,
  dates: BENTO_SURFACE,
  description: BENTO_SURFACE,
  raffle: BENTO_SURFACE,
  guest: BENTO_SURFACE,
};

// Empty strings for date/city/venue suppress the brass label strip — those
// tiles are self-explanatory and the labels added clutter (Ricky 2026-04-28).
export const BLOCK_TITLES: Record<BentoBlockId, string> = {
  cover: 'Cover',
  date: '',
  promo: 'Promo',
  city: '',
  venue: '',
  video: 'Video',
  'organiser-card': 'Organiser',
  schedule: 'Schedule',
  dates: 'Dates',
  description: 'About',
  raffle: 'Raffle',
  guest: 'Guest list',
};

// Content-driven block spec. Replaces the old coordinate-based INITIAL_LAYOUT.
//
// - `preferredW` is the desired column span (1–4).
// - `minW` is the minimum span the block will accept (reserved for future
//   responsive behaviour; today always equals preferredW).
// - `minH` is the minimum row span in cells. Rows auto-grow past this when
//   content demands it (gridAutoRows uses minmax(cell, auto)). Blocks without
//   minH get a single content-sized row — used by the dynamic-height
//   schedule/description per Phase 8a.
export type BlockSpec = {
  id: BentoBlockId;
  minW: 1 | 2 | 3 | 4;
  preferredW: 1 | 2 | 3 | 4;
  minH?: number;
};

// Declared in the order the user sees them top-to-bottom. The packer honours
// this order strictly — it will not reorder to fill gaps. Keeping order stable
// matches the Phase 8 "Block order stays as currently rendered" decision.
export const LAYOUT: BlockSpec[] = [
  // Cover is the tall portrait anchor on the left (2 cols × 3 rows).
  // minH is mandatory — without it the cover image has no intrinsic height
  // (object-cover on h-full w-full resolves to 0).
  { id: 'cover', minW: 2, preferredW: 2, minH: 3 },
  // Date + City/Promo are the small top-right tiles, 1 col × 1 row each.
  { id: 'date', minW: 1, preferredW: 1, minH: 1 },
  { id: 'promo', minW: 1, preferredW: 1, minH: 1 },
  { id: 'city', minW: 1, preferredW: 1, minH: 1 },
  // Venue is the 2×2 tile in the right column that sits beneath Date +
  // City/Promo, beside the lower two-thirds of Cover. The packer places it
  // at (x=2, y=1) because rows 1–2 cols 2–3 are the first free 2×2 slot.
  { id: 'venue', minW: 2, preferredW: 2, minH: 2 },
  // P5 video — full-width landscape tile; content-sized (no minH) so the inner
  // 16:9 aspect-video drives the height. Placed right after the cover/venue
  // cluster for prominence; BentoPage hides it when there's no playable video.
  { id: 'video', minW: 4, preferredW: 4 },
  // Organiser card sits immediately above the schedule (Phase 2, 2026-04-28).
  // Full-width, content-sized — height grows with the number of organisers.
  { id: 'organiser-card', minW: 4, preferredW: 4 },
  { id: 'schedule', minW: 4, preferredW: 4 },
  { id: 'dates', minW: 4, preferredW: 4 },
  { id: 'description', minW: 4, preferredW: 4 },
  // Raffle is a static "coming soon" placeholder — no data, no minH, so it
  // sizes to content (chest icon + two text lines). Always visible, including
  // on past events (BentoPage never adds it to hiddenBlocks).
  { id: 'raffle', minW: 4, preferredW: 4 },
  { id: 'guest', minW: 4, preferredW: 4, minH: 2 },
];

const GRID_COLS = 4;
// Phase 8g compact density — tiles sit closer together than the original
// 8 px to match the denser strong-button treatment.
const GAP_PX = 6;

type PackedBlock = {
  id: BentoBlockId;
  x: number;
  y: number;
  w: number;
  h: number;
  dynamic: boolean;
};

// Top-to-bottom, left-to-right greedy packer. Walks the layout in declared
// order, filters hidden blocks out, and places each remaining block at the
// first (x,y) where its (preferredW × minH) footprint fits in the 4-col grid.
// Blocks without minH are treated as 1 row tall for packing purposes but
// flagged `dynamic: true` so the renderer can omit an explicit row span and
// let CSS size them from content.
export function packLayout(
  specs: BlockSpec[],
  hidden: ReadonlySet<BentoBlockId>,
): PackedBlock[] {
  const occupied: boolean[][] = [];
  const ensureRow = (y: number) => {
    while (occupied.length <= y) {
      occupied.push(new Array(GRID_COLS).fill(false));
    }
  };

  const fits = (x: number, y: number, w: number, h: number): boolean => {
    if (x + w > GRID_COLS) return false;
    ensureRow(y + h - 1);
    for (let dy = 0; dy < h; dy++) {
      for (let dx = 0; dx < w; dx++) {
        if (occupied[y + dy][x + dx]) return false;
      }
    }
    return true;
  };

  const mark = (x: number, y: number, w: number, h: number) => {
    ensureRow(y + h - 1);
    for (let dy = 0; dy < h; dy++) {
      for (let dx = 0; dx < w; dx++) {
        occupied[y + dy][x + dx] = true;
      }
    }
  };

  const placed: PackedBlock[] = [];
  for (const spec of specs) {
    if (hidden.has(spec.id)) continue;
    const w = spec.preferredW;
    const dynamic = spec.minH === undefined;
    const h = spec.minH ?? 1;

    let found = false;
    for (let y = 0; !found; y++) {
      for (let x = 0; x <= GRID_COLS - w; x++) {
        if (fits(x, y, w, h)) {
          mark(x, y, w, h);
          placed.push({ id: spec.id, x, y, w, h, dynamic });
          found = true;
          break;
        }
      }
      // Safety bound — shouldn't trigger with a 4-col grid and ≤10 blocks,
      // but guards against a runaway loop if a future block spec is malformed.
      if (y > 200) break;
    }
  }

  return placed;
}

type BentoGridProps = {
  specs?: BlockSpec[];
  hiddenBlocks?: ReadonlySet<BentoBlockId>;
  renderBlock: (id: GridBlockId) => ReactNode;
};

export const BentoGrid = ({
  specs = LAYOUT,
  hiddenBlocks,
  renderBlock,
}: BentoGridProps) => {
  // Cell size drives the per-row minimum height: a cell is one column wide, and
  // columns are 1fr, so the cell height must track the container's INLINE size.
  //
  // Expressed in CSS (container query units), not measured in JS. It used to be
  // useState(90) corrected by a clientWidth read in an effect, which meant the
  // server -- and the first client paint -- laid the whole grid out at a 90px
  // cell and then reflowed it to the real one (95px at a 412px viewport). Every
  // fixed block grew, pushing ~55px of cumulative movement down the page: a
  // measured CLS of 0.217 on /event/:id, versus 0.041 when the correction
  // happened to land before paint. Deriving it from the container removes the
  // correction entirely -- the server HTML is already right at any width, and
  // resizes are handled by the browser rather than a ResizeObserver.
  // --bento-cell is defined in index.css: a static px fallback, overridden with
  // a cqw-derived value inside @supports (container-type: inline-size). Inline
  // styles cannot express @supports, and without a fallback an engine that
  // rejects cqw drops min-height entirely -- which collapses the cover block to
  // zero height (see LAYOUT). GRID_COLS/GAP_PX are mirrored in that rule.
  const cell = 'var(--bento-cell)';

  const packed = useMemo(
    () => packLayout(specs, hiddenBlocks ?? new Set()),
    [specs, hiddenBlocks],
  );

  return (
    <div
      style={{
        // Establishes the container the cqw above resolves against.
        containerType: 'inline-size',
        display: 'grid',
        gridTemplateColumns: `repeat(${GRID_COLS}, minmax(0, 1fr))`,
        // Rows auto-size purely from content. Per-block minimums are applied
        // via inline minHeight on each grid item so dynamic blocks (schedule,
        // description) can shrink below the notional "cell" height when their
        // content is short — no teal dead space.
        gridAutoRows: 'auto',
        gap: GAP_PX,
      }}
    >
      {packed.map((blk) => {
        // Fixed blocks enforce a minimum height sized to their declared
        // footprint (h cells tall, including inter-row gaps). Dynamic blocks
        // get no minimum — the grid row collapses to their content.
        const minHeight = blk.dynamic
          ? undefined
          : `calc(${blk.h} * ${cell} + ${(blk.h - 1) * GAP_PX}px)`;
        return (
          <div
            key={blk.id}
            style={{
              gridColumn: `${blk.x + 1} / span ${blk.w}`,
              // Dynamic blocks omit a row span so the track auto-sizes to
              // content. Fixed blocks span exactly h rows, and their
              // per-item minHeight keeps them visually "tall" even when the
              // neighbouring content is short.
              gridRow: blk.dynamic
                ? `${blk.y + 1}`
                : `${blk.y + 1} / span ${blk.h}`,
              minWidth: 0,
              minHeight,
            }}
          >
            {renderBlock(blk.id)}
          </div>
        );
      })}
    </div>
  );
};

