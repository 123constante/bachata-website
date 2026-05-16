import { useLayoutEffect, useRef, useState } from 'react';
import { BentoTile } from '@/modules/event-page/bento/BentoTile';
import { BLOCK_COLORS, BLOCK_TITLES } from '@/modules/event-page/bento/BentoGrid';

type DescriptionBlockProps = {
  body: string | null;
};

// Min length before the stacked reveal UI appears.
const TRUNCATE_AT = 240;

// How many px of the continuation to show in collapsed state (~3 lines).
const COLLAPSED_DETAIL_PX = 64;

// Gradient fade spans ~2 lines of text at the bottom of the collapsed detail.
const FADE_PX = 40;

// Split body at its first sentence boundary. Returns [summary, detail].
// Falls back to a character split at 120 chars if no sentence break found.
function splitBody(text: string): [string, string] {
  const m = text.match(/^(.*?[.!?])\s+([\s\S]+)$/);
  if (m) return [m[1], m[2]];
  return [text.slice(0, 120), text.slice(120)];
}

export const DescriptionBlock = ({ body }: DescriptionBlockProps) => {
  const [expanded, setExpanded] = useState(false);
  const [detailHeight, setDetailHeight] = useState<number | null>(null);
  const detailRef = useRef<HTMLDivElement>(null);

  useLayoutEffect(() => {
    const node = detailRef.current;
    if (!node) return;
    const update = () => setDetailHeight(node.scrollHeight);
    update();
    const ro = new ResizeObserver(update);
    ro.observe(node);
    return () => ro.disconnect();
  }, [body]);

  if (!body || !body.trim()) return null;

  const trimmed = body.trim();
  const surface = BLOCK_COLORS.description;

  if (trimmed.length <= TRUNCATE_AT) {
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

  const [summary, detail] = splitBody(trimmed);
  const maxHeight = expanded ? (detailHeight ?? COLLAPSED_DETAIL_PX) : COLLAPSED_DETAIL_PX;

  return (
    <BentoTile title={BLOCK_TITLES.description} color={surface} mode="container">
      <p
        className="whitespace-pre-wrap text-[13px] leading-[1.5]"
        style={{
          fontFamily: '"Fraunces", Georgia, serif',
          fontWeight: 500,
          color: 'hsl(var(--bento-fg))',
        }}
      >
        {summary}
      </p>

      {detail && (
        <>
          <div
            className="relative mt-3 overflow-hidden"
            style={{ maxHeight, transition: 'max-height 400ms ease' }}
          >
            <div ref={detailRef}>
              <p
                className="whitespace-pre-wrap text-[13px] leading-[1.5]"
                style={{
                  fontFamily: '"Fraunces", Georgia, serif',
                  fontWeight: 500,
                  color: 'hsl(var(--bento-fg))',
                }}
              >
                {detail}
              </p>
            </div>
            {!expanded && (
              <div
                className="pointer-events-none absolute inset-x-0 bottom-0"
                style={{
                  height: FADE_PX,
                  background: `linear-gradient(to bottom, transparent, ${surface})`,
                }}
              />
            )}
          </div>

          <button
            type="button"
            onClick={() => setExpanded((v) => !v)}
            className="-mx-2.5 -mb-2.5 mt-3 w-[calc(100%+1.25rem)] py-2.5 text-center text-[11px] font-bold uppercase tracking-[0.08em] transition-colors hover:bg-white/5 active:bg-white/10"
            style={{
              color: 'hsl(var(--bento-fg-muted))',
              borderTop: '1px solid rgba(255,255,255,0.07)',
            }}
            aria-expanded={expanded}
          >
            {expanded ? '▲ Less' : '▼ More'}
          </button>
        </>
      )}
    </BentoTile>
  );
};
