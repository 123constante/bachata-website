import { useLayoutEffect, useRef, useState } from 'react';
import { BentoTile } from '@/modules/event-page/bento/BentoTile';
import { BLOCK_COLORS, BLOCK_TITLES } from '@/modules/event-page/bento/BentoGrid';

type DescriptionBlockProps = {
  body: string | null;
};

// A body shorter than this renders naturally with no fade + no button. The
// threshold is a heuristic for "probably longer than 6 visible lines" — it
// matches the contract established in Phase 7, preserved here so event
// pages that currently render short descriptions don't suddenly sprout an
// expand button pointing at nothing.
const TRUNCATE_AT = 240;

// 13 px font × 1.5 line-height = 19.5 px per line. 6 visible lines ≈ 120 px.
const COLLAPSED_PX = 120;

// Gradient fade spans ~2 lines of text at the bottom of the collapsed body.
const FADE_PX = 40;

export const DescriptionBlock = ({ body }: DescriptionBlockProps) => {
  const [expanded, setExpanded] = useState(false);
  // Full content height (of the unclipped body). Measured by the inner ref
  // via ResizeObserver so no artificial max-height ceiling is needed — the
  // expanded state grows exactly to the body's actual height, even if the
  // description is extremely long.
  const [contentHeight, setContentHeight] = useState<number | null>(null);
  const contentRef = useRef<HTMLDivElement>(null);

  useLayoutEffect(() => {
    const node = contentRef.current;
    if (!node) return;
    const update = () => setContentHeight(node.scrollHeight);
    update();
    const ro = new ResizeObserver(update);
    ro.observe(node);
    return () => ro.disconnect();
  }, [body]);

  if (!body || !body.trim()) return null;

  const trimmed = body.trim();
  const needsExpander = trimmed.length > TRUNCATE_AT;
  const surface = BLOCK_COLORS.description;

  // Short body: render naturally, no fade, no pill. The block height is
  // content-driven via the grid's dynamic row (no minH on description).
  if (!needsExpander) {
    return (
      <BentoTile title={BLOCK_TITLES.description} color={surface}>
        <p
          className="whitespace-pre-wrap text-[13px] leading-[1.5]"
          style={{
            fontFamily: '"Fraunces", Georgia, serif',
            fontWeight: 500,
            color: 'hsl(var(--bento-fg))',
          }}
        >
          {trimmed}
        </p>
      </BentoTile>
    );
  }

  // Long body: clamp to COLLAPSED_PX with fade, or animate to full measured
  // height on expand. If contentHeight hasn't resolved yet (initial layout
  // effect not run), fall back to COLLAPSED_PX — the ResizeObserver fires
  // synchronously in useLayoutEffect so in practice this branch is hit once
  // on first render, then contentHeight is known from the next paint on.
  const expandedTarget = contentHeight ?? COLLAPSED_PX;
  const maxHeight = expanded ? expandedTarget : COLLAPSED_PX;

  return (
    <div className="relative">
      <BentoTile
        title={BLOCK_TITLES.description}
        color={surface}
        mode="tappable"
        onClick={() => setExpanded((v) => !v)}
      >
        <div
          className="relative overflow-hidden"
          style={{
            maxHeight,
            transition: 'max-height 300ms ease',
          }}
        >
          <div ref={contentRef}>
            <p
              className="whitespace-pre-wrap text-[13px] leading-[1.5]"
              style={{
                fontFamily: '"Fraunces", Georgia, serif',
                fontWeight: 500,
                color: 'hsl(var(--bento-fg))',
              }}
            >
              {trimmed}
            </p>
          </div>
          {!expanded && (
            <div
              className="pointer-events-none absolute inset-x-0 bottom-0"
              style={{
                height: FADE_PX,
                // Fades from transparent into the tile surface
                // (--bento-surface-raised). Stays neutral through
                // interpolation and blends cleanly into the Velvet & Brass
                // tile bg.
                background: `linear-gradient(to bottom, transparent 0%, ${surface} 85%)`,
              }}
            />
          )}
        </div>
      </BentoTile>
      {/* Brass pill straddling the block's outer bottom edge. Lives DOM-
          outside the BentoTile so there's no nested-button issue; the
          stopPropagation on its own handler prevents the tile-tap from
          double-firing expand when the user taps the pill directly. */}
      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation();
          setExpanded((v) => !v);
        }}
        className="absolute left-1/2 z-10 rounded-full px-4 py-[6px] text-[11px] font-bold uppercase tracking-[0.06em] shadow-md transition-transform duration-150 active:scale-[0.97]"
        style={{
          bottom: 0,
          transform: 'translate(-50%, 50%)',
          background: 'hsl(var(--bento-accent))',
          color: 'hsl(var(--bento-surface))',
        }}
        aria-expanded={expanded}
      >
        {expanded ? 'Read less ↑' : 'Read more ↓'}
      </button>
    </div>
  );
};
