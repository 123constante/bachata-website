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

export const GuestListBlock = ({ data, onSeeAll, onJoin }: GuestListBlockProps) => {
  if (!data || !data.enabled) return null;

  const { count, entries } = data;
  const visible = entries.slice(0, 4);
  const overflow = Math.max(0, count - visible.length);
  const cutoffPassed = data.cutoff_passed;

  // Multi-target: the outer tile has the strong-button visual but inner
  // See all / Join list buttons take the actual taps.
  return (
    <BentoTile title={BLOCK_TITLES.guest} color={BLOCK_COLORS.guest} mode="multi-target">
      <div className="flex min-h-0 flex-1 flex-col gap-[6px]">
        <div className="flex items-center gap-2">
          <div className="flex">
            {visible.map((entry, i) => (
              <div
                key={`${entry.first_name}-${entry.created_at}-${i}`}
                className="flex h-6 w-6 items-center justify-center rounded-full border-2 text-[9px] font-bold"
                style={{
                  background: 'hsl(var(--bento-surface))',
                  borderColor: 'var(--bento-hairline)',
                  color: 'hsl(var(--bento-accent))',
                  marginLeft: i === 0 ? 0 : -6,
                }}
                aria-label={entry.first_name}
              >
                {initialFrom(entry.first_name)}
              </div>
            ))}
            {overflow > 0 && (
              <div
                className="flex h-6 w-6 items-center justify-center rounded-full border-2 text-[9px] font-bold"
                style={{
                  background: 'hsl(var(--bento-surface))',
                  borderColor: 'var(--bento-hairline)',
                  color: 'hsl(var(--bento-fg-muted))',
                  marginLeft: visible.length === 0 ? 0 : -6,
                }}
              >
                +{overflow}
              </div>
            )}
          </div>
          <div className="text-[22px] font-black leading-none tabular-nums tracking-[-0.02em]">
            {count}
          </div>
        </div>

        <div className="text-[11px]" style={{ color: 'hsl(var(--bento-fg-muted))' }}>
          {count === 1 ? 'dancer on the list' : 'dancers on the list'}
        </div>

        <div className="mt-auto flex gap-[6px]">
          <button
            type="button"
            onClick={onSeeAll}
            disabled={count === 0}
            className="flex-1 rounded-full px-3 py-[8px] text-[11px] font-bold transition-transform duration-150 active:scale-[0.97] disabled:cursor-not-allowed disabled:opacity-50"
            style={{
              background: 'transparent',
              border: '1px solid var(--bento-hairline)',
              color: 'hsl(var(--bento-fg))',
            }}
          >
            See all
          </button>
          <button
            type="button"
            onClick={onJoin}
            disabled={cutoffPassed}
            className="flex-1 rounded-full px-3 py-[8px] text-[11px] font-bold transition-transform duration-150 active:scale-[0.97] disabled:cursor-not-allowed disabled:opacity-60"
            style={{
              background: 'hsl(var(--bento-accent))',
              color: 'hsl(var(--bento-surface))',
            }}
          >
            {cutoffPassed ? 'Closed' : 'Join list'}
          </button>
        </div>
      </div>
    </BentoTile>
  );
};
