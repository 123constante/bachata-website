import { CircleSlash } from 'lucide-react';
import type { RunRange } from '@/modules/event-page/bento/utils/endedRun';

type EventEndedBannerProps = {
  /** Null when the run's dates are unknown -- see below. */
  runRange: RunRange | null;
};

// Series-termination arc P4. A series that no longer runs at all.
//
// Calm slate, deliberately NOT the red cancelled treatment: a night reaching the
// end of its life is a record, not an alarm, and the red shape is reserved for
// "this specific date was called off". Shares the paused banner's family because
// both answer the same visitor question -- "is this still on?" -- and only the
// answer differs.
//
// Stickiness lives on the WRAPPER in BentoPage, not here. This banner can render
// stacked above the cancelled one (an ended series whose final night was called
// off), and two independently-sticky siblings at the same offset would overlap
// on scroll instead of stacking.
//
// runRange is null whenever the payload carries no ended_on -- which is the real
// state of every page served before the P4a migration is applied, not a
// defensive branch. The date-free copy below is that path.
export const EventEndedBanner = ({ runRange }: EventEndedBannerProps) => {
  return (
    <div
      className="w-full border-b-2 border-slate-600 px-4 py-2.5 text-white shadow-lg"
      style={{ background: 'linear-gradient(180deg, #475569 0%, #334155 100%)' }}
      data-testid="event-ended-banner"
      role="status"
      aria-live="polite"
    >
      <div className="mx-auto flex max-w-[430px] items-start gap-2.5">
        <CircleSlash className="h-4 w-4 shrink-0 mt-[1px]" aria-hidden="true" />
        <div className="min-w-0 flex-1">
          <div className="text-[13px] font-bold leading-tight tracking-[-0.01em]">
            Finished &mdash; no longer running
          </div>
          {runRange && (
            <div className="mt-0.5 text-[11px] leading-tight opacity-90">
              {runRange.kind === 'range' ? (
                <>
                  Ran {runRange.from} &ndash; {runRange.to}
                </>
              ) : (
                <>Ran until {runRange.to}</>
              )}
            </div>
          )}
        </div>
        <span
          className="shrink-0 rounded-[3px] bg-white px-1.5 py-0.5 text-[9px] font-black tracking-[0.1em] text-slate-600"
          aria-hidden="true"
        >
          ENDED
        </span>
      </div>
    </div>
  );
};
