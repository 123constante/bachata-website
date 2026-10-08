import { PauseCircle } from 'lucide-react';

// Reachable since admin #716/#718 (2026-10-08): a paused series WITH a past
// public date resolves (200, indexable, in the sitemap). This line is the page's
// visible "On hiatus" statement, which the owner's SEO decision requires and
// eventPageSeoPolicy pairs with "no Event node" in the JSON-LD. A paused series
// with no past date still 404s.
//
// Stickiness lives on the WRAPPER in BentoPage, not here -- banners can stack,
// and two sticky siblings at the same top offset overlap on scroll.
export const EventPausedBanner = () => {
  return (
    <div
      className="w-full border-b-2 border-slate-600 px-4 py-2.5 text-white shadow-lg"
      style={{
        background: 'linear-gradient(180deg, #475569 0%, #334155 100%)',
      }}
      data-testid="event-paused-banner"
      role="status"
      aria-live="polite"
    >
      <div className="mx-auto flex max-w-[430px] items-start gap-2.5">
        <PauseCircle className="h-4 w-4 shrink-0 mt-[1px]" aria-hidden="true" />
        <div className="min-w-0 flex-1">
          <div className="text-[13px] font-bold leading-tight tracking-[-0.01em]">
            On hiatus &mdash; no upcoming dates
          </div>
          <div className="mt-0.5 text-[11px] leading-tight opacity-90">
            Check back later or follow the organiser for updates.
          </div>
        </div>
        <span
          className="shrink-0 rounded-[3px] bg-white px-1.5 py-0.5 text-[9px] font-black tracking-[0.1em] text-slate-600"
          aria-hidden="true"
        >
          PAUSED
        </span>
      </div>
    </div>
  );
};
