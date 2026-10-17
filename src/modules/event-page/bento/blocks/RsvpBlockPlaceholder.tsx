import type { CSSProperties } from 'react';

// Mirrors RsvpBlock's box, ghost buttons and meta line so the Suspense fallback is
// the same size (no layout shift when the lazy chunk lands). Copied, not shared:
// RsvpBlock importing anything that lives only in the event route chunk splits
// that chunk and adds a first-load request. rsvpBlock.test.tsx pins the match.
const RSVP_SECTION_CLASS = 'mt-3 rounded-[18px] border p-3';
const RSVP_SECTION_STYLE: CSSProperties = {
  background: 'hsl(var(--bento-surface-raised))',
  borderColor: 'var(--bento-hairline)',
};
const RSVP_GHOST_STYLE: CSSProperties = {
  background: 'hsl(var(--bento-surface-raised))',
  color: 'hsl(var(--bento-fg))',
  border: '1px solid hsl(var(--bento-fg-muted) / 0.25)',
};
const RSVP_BTN =
  'flex h-[44px] items-center justify-center gap-1.5 rounded-full px-3 text-[13px] font-semibold disabled:cursor-not-allowed disabled:opacity-50';
const RSVP_META_CLASS = 'mt-2 text-[12px]';
const RSVP_META_STYLE: CSSProperties = { color: 'hsl(var(--bento-fg-muted))' };

/** Disabled-looking stand-in for the button row while RsvpBlock's chunk loads. */
export const RsvpBlockPlaceholder = ({ goingCountLabel }: { goingCountLabel: string }) => (
  <section
    className={RSVP_SECTION_CLASS}
    style={RSVP_SECTION_STYLE}
    aria-label="RSVP for this night"
    aria-busy
    data-testid="rsvp-placeholder"
  >
    <div className="flex items-center gap-2">
      <button type="button" disabled className={`${RSVP_BTN} flex-1`} style={RSVP_GHOST_STYLE}>
        <span className="h-4 w-4" aria-hidden />
        {"I'm Going"}
      </button>
      <button type="button" disabled className={RSVP_BTN} style={RSVP_GHOST_STYLE}>
        <span className="h-4 w-4" aria-hidden />
        Interested
      </button>
    </div>
    <p className={RSVP_META_CLASS} style={RSVP_META_STYLE}>
      {goingCountLabel}
    </p>
  </section>
);
