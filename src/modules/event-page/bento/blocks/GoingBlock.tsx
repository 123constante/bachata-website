import { BentoTile } from '@/modules/event-page/bento/BentoTile';
import { BLOCK_COLORS, BLOCK_TITLES } from '@/modules/event-page/bento/BentoGrid';

// Static "Coming soon" — no RSVP mutation wiring per locked decisions.
export const GoingBlock = () => (
  <BentoTile title={BLOCK_TITLES.going} color={BLOCK_COLORS.going}>
    <div className="flex flex-1 flex-col justify-between">
      <div className="text-[10px] font-semibold uppercase tracking-[0.12em] text-white/80">
        Coming soon
      </div>
      <button
        type="button"
        disabled
        aria-disabled
        className="mt-2 w-full cursor-not-allowed rounded-full bg-white/40 px-3 py-[10px] text-[13px] font-extrabold tracking-[0.01em] text-white/60"
      >
        Going
      </button>
    </div>
  </BentoTile>
);
