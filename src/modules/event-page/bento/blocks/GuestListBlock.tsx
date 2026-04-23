import { BentoTile } from '@/modules/event-page/bento/BentoTile';
import { BLOCK_COLORS, BLOCK_TITLES } from '@/modules/event-page/bento/BentoGrid';
import type { EventGuestList } from '@/modules/event-page/hooks/useEventGuestList';

type GuestListBlockProps = {
  data: EventGuestList | null;
  onSeeAll: () => void;
  onJoin: () => void;
};

const initialFrom = (name: string): string => {
  const trimmed = name.trim();
  return trimmed ? trimmed.charAt(0).toUpperCase() : '?';
};

// Deterministic hue per index so overlapping initials avatars aren't all the
// same colour. The purple block bg stays; these accents sit on top.
const hueFor = (i: number): number => (i * 47 + 260) % 360;

export const GuestListBlock = ({ data, onSeeAll, onJoin }: GuestListBlockProps) => {
  if (!data || !data.enabled) return null;

  const { count, entries } = data;
  const visible = entries.slice(0, 4);
  const overflow = Math.max(0, count - visible.length);
  const cutoffPassed = data.cutoff_passed;

  return (
    <BentoTile title={BLOCK_TITLES.guest} color={BLOCK_COLORS.guest}>
      <div className="flex min-h-0 flex-1 flex-col gap-[6px]">
        <div className="flex items-center gap-2">
          <div className="flex">
            {visible.map((entry, i) => (
              <div
                key={`${entry.first_name}-${entry.created_at}-${i}`}
                className="flex h-6 w-6 items-center justify-center rounded-full border-2 border-black/30 text-[9px] font-bold text-white"
                style={{
                  background: `hsl(${hueFor(i)} 45% 45%)`,
                  marginLeft: i === 0 ? 0 : -6,
                }}
                aria-label={entry.first_name}
              >
                {initialFrom(entry.first_name)}
              </div>
            ))}
            {overflow > 0 && (
              <div
                className="flex h-6 w-6 items-center justify-center rounded-full border-2 border-black/30 bg-white/20 text-[9px] font-bold text-white"
                style={{ marginLeft: visible.length === 0 ? 0 : -6 }}
              >
                +{overflow}
              </div>
            )}
          </div>
          <div className="text-[22px] font-black leading-none tabular-nums tracking-[-0.02em] text-white">
            {count}
          </div>
        </div>

        <div className="text-[11px] text-white/85">
          {count === 1 ? 'dancer on the list' : 'dancers on the list'}
        </div>

        <div className="mt-auto flex gap-[6px]">
          <button
            type="button"
            onClick={onSeeAll}
            disabled={count === 0}
            className="flex-1 rounded-full border border-white/45 bg-transparent px-3 py-[8px] text-[11px] font-bold text-white transition disabled:cursor-not-allowed disabled:opacity-50"
          >
            See all
          </button>
          <button
            type="button"
            onClick={onJoin}
            disabled={cutoffPassed}
            className="flex-1 rounded-full bg-white/95 px-3 py-[8px] text-[11px] font-bold text-black transition disabled:cursor-not-allowed disabled:opacity-60"
          >
            {cutoffPassed ? 'Closed' : 'Join list'}
          </button>
        </div>
      </div>
    </BentoTile>
  );
};
