import { AlertOctagon } from 'lucide-react';

type EventCancelledBannerProps = {
  reasonLabel?: string | null;
};

// Whole-event cancellation banner. Pinned just under the fixed 60px
// GlobalHeader so dancers landing from a stale link / WhatsApp share
// can't miss the signal while they scroll the bento grid. Self-hides
// when isCancelled is false on the page model.
//
// Approach B from event-cancelled-mockups.html: global header +
// breadcrumb stay clean, banner slides in below them, hero/cover get
// their own dim + red strip treatment (handled by CoverBlock).
//
// Arc P4: stickiness moved to the WRAPPER in BentoPage. This banner can now
// render BENEATH the ended banner (a series that finished with its last night
// called off), and two sticky siblings at the same top offset overlap on scroll
// instead of stacking. It keeps the red treatment when stacked: it is the only
// surface carrying the cancellation reason, which is why 'ended' stacks above
// it rather than replacing it.
export const EventCancelledBanner = ({ reasonLabel }: EventCancelledBannerProps) => {
  return (
    <div
      className="w-full border-b-2 border-red-900 px-4 py-2.5 text-white shadow-lg"
      style={{
        background: 'linear-gradient(180deg, #DC2626 0%, #991B1B 100%)',
      }}
      data-testid="event-cancelled-banner"
      role="status"
      aria-live="polite"
    >
      <div className="mx-auto flex max-w-[430px] items-start gap-2.5">
        <AlertOctagon className="h-4 w-4 shrink-0 mt-[1px]" aria-hidden="true" />
        <div className="min-w-0 flex-1">
          <div className="text-[13px] font-bold leading-tight tracking-[-0.01em]">
            This event has been cancelled
          </div>
          {reasonLabel && (
            <div className="mt-0.5 text-[11px] leading-tight opacity-90">
              {reasonLabel}
            </div>
          )}
        </div>
        <span
          className="shrink-0 rounded-[3px] bg-white px-1.5 py-0.5 text-[9px] font-black tracking-[0.1em] text-red-700"
          aria-hidden="true"
        >
          CANCELLED
        </span>
      </div>
    </div>
  );
};
