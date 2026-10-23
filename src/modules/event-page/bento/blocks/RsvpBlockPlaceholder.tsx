import type { CSSProperties } from 'react';
import { GOING_CHECKIN_ENABLED } from '@/lib/goingCheckin';

// Mirrors RsvpBlock's "Who's going" tile (title, box, night line, count line,
// 48px button) so the Suspense fallback holds the tile's place while its lazy
// chunk lands. Copied, not imported: RsvpBlock (and the going module) importing
// anything that lives in the event route chunk -- or this file importing the
// going module -- splits that chunk and adds a first-load request.
// rsvpBlock.test.tsx pins the classes and words to RsvpBlock / GOING_COPY.
export const PLACEHOLDER_TITLE_CLASS = 'mb-1.5 text-center text-[13px] font-bold uppercase tracking-[0.04em]';
export const PLACEHOLDER_BODY_CLASS = 'rounded-[18px] border p-3';
export const PLACEHOLDER_NIGHT_CLASS = 'text-[12px] font-bold uppercase tracking-[0.05em]';
export const PLACEHOLDER_MESSAGE_CLASS = 'mt-1.5 min-h-[17px] text-[12px] leading-snug';
/** = GOING_COPY.tileTitle / .tileLabel / .go (pinned by rsvpBlock.test.tsx). */
export const PLACEHOLDER_WORDS = {
  title: 'Who\u2019s going',
  label: 'Who\u2019s going to this night',
  go: 'I\u2019m going',
};

const BODY_STYLE: CSSProperties = {
  background: 'hsl(var(--bento-surface-raised))',
  borderColor: 'var(--bento-hairline)',
};
const GHOST_STYLE: CSSProperties = {
  background: 'hsl(var(--bento-surface-raised))',
  color: 'hsl(var(--bento-fg-muted))',
  border: '1px solid hsl(var(--bento-fg-muted) / 0.25)',
};

/** Disabled-looking stand-in for the tile while RsvpBlock's chunk loads. */
const RsvpBlockPlaceholderInner = () => (
  <section className="mt-3" aria-label={PLACEHOLDER_WORDS.label} aria-busy data-testid="rsvp-placeholder">
    <h2 className={PLACEHOLDER_TITLE_CLASS} style={{ color: 'hsl(var(--bento-accent))' }}>
      {PLACEHOLDER_WORDS.title}
    </h2>
    <div className={PLACEHOLDER_BODY_CLASS} style={BODY_STYLE}>
      <p className={PLACEHOLDER_NIGHT_CLASS} aria-hidden>
        &nbsp;
      </p>
      <div className="mt-2 min-h-[20px]">
        <p className="text-[14px]" aria-hidden>
          &nbsp;
        </p>
      </div>
      <div className="mt-3">
        <button
          type="button"
          disabled
          className="flex h-[48px] min-h-[48px] w-full items-center justify-center gap-1.5 rounded-full px-3 text-[14px] font-bold disabled:cursor-not-allowed"
          style={GHOST_STYLE}
        >
          {PLACEHOLDER_WORDS.go}
        </button>
        {/* = GoingButton's MESSAGE_CLASS: the line under the button is held, so the tile does not jump. */}
        <p className={PLACEHOLDER_MESSAGE_CLASS} aria-hidden data-testid="rsvp-placeholder-message">
          &nbsp;
        </p>
      </div>
    </div>
  </section>
);

/** Renders nothing while GOING_CHECKIN_ENABLED is off (no gap while the block loads). */
export const RsvpBlockPlaceholder = () => (GOING_CHECKIN_ENABLED ? <RsvpBlockPlaceholderInner /> : null);
