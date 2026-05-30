import { useState } from 'react';
import { BentoTile } from '@/modules/event-page/bento/BentoTile';
import { BLOCK_COLORS, BLOCK_TITLES } from '@/modules/event-page/bento/BentoGrid';
import { DescriptionModal } from '@/modules/event-page/bento/modals/DescriptionModal';

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
  const [open, setOpen] = useState(false);

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

  return (
    <>
      <BentoTile
        title={BLOCK_TITLES.description}
        color={surface}
        mode="tappable"
        onClick={() => setOpen(true)}
      >
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
              style={{ maxHeight: COLLAPSED_DETAIL_PX }}
            >
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
              <div
                className="pointer-events-none absolute inset-x-0 bottom-0"
                style={{
                  height: FADE_PX,
                  background: `linear-gradient(to bottom, transparent, ${surface})`,
                }}
              />
            </div>

            <div
              className="mt-2.5 text-center text-[10.5px]"
              style={{ color: 'hsl(var(--bento-fg-muted))' }}
            >
              Tap to read more
            </div>
          </>
        )}
      </BentoTile>

      <DescriptionModal open={open} onOpenChange={setOpen} body={trimmed} />
    </>
  );
};
