import { useCallback, useEffect, useState } from 'react';

// Per-slide dwell time in milliseconds. The progress bar animation runs over
// the same duration so its end matches the hook's natural advance.
export const COVER_CAROUSEL_ADVANCE_MS = 4000;

type UseCoverCarouselArgs = {
  /** Total number of slides (cover + gallery, deduped). */
  count: number;
  /**
   * External hard-pause signal. When true the rotation timer is torn down
   * completely; when it flips back to false, a fresh dwell window starts
   * for the current slide. Used by CoverBlock to pause while the gallery
   * lightbox is open (and, in some previews, on desktop hover).
   */
  paused: boolean;
  /**
   * Disables rotation entirely (e.g. prefers-reduced-motion is set or the
   * slide count is too low to rotate). Timer is never armed.
   */
  disabled?: boolean;
  /**
   * Override dwell time per slide in milliseconds. Defaults to
   * COVER_CAROUSEL_ADVANCE_MS (4000). Exposed so Phase 8d-cover previews
   * can compare 4 s vs 6 s cadences.
   */
  advanceMs?: number;
};

type UseCoverCarouselReturn = {
  /** Currently displayed slide. */
  index: number;
  /**
   * Monotonic counter that bumps each time a new slide dwell window starts —
   * natural advance, manual advance, or unpause. Consumers key their progress
   * bar fill on this so the CSS animation restarts cleanly in sync with the
   * timer. Also changes on index reset when `count` changes.
   */
  sessionId: number;
  /** Advance one step immediately (user tapped to skip). Wraps to the start. */
  advance: () => void;
};

// Manages the auto-rotation state for CoverBlock's image carousel.
//
// Design notes:
// - `index` state drives which slide is visible.
// - A `useEffect` keyed on `[disabled, paused, count, index]` owns the
//   setTimeout. Clearing + re-arming on each index change is what keeps the
//   timer in sync with manual advances — calling `advance()` from a tap
//   updates index, which re-runs the effect and starts a fresh dwell window
//   for the new slide (user gets their full 4 s to look).
// - `sessionId` is a signal for consumers: whenever a new dwell window
//   begins, it bumps. The progress-bar segment inside CoverBlock keys on it
//   to force-remount and restart the CSS animation at 0 %.
export const useCoverCarousel = ({
  count,
  paused,
  disabled = false,
  advanceMs = COVER_CAROUSEL_ADVANCE_MS,
}: UseCoverCarouselArgs): UseCoverCarouselReturn => {
  const [index, setIndex] = useState(0);
  const [sessionId, setSessionId] = useState(0);

  // Reset to slide 0 + bump sessionId whenever the image set changes (event
  // navigation, gallery reordering). Prevents a stale index from pointing
  // past the new array length.
  useEffect(() => {
    setIndex(0);
    setSessionId((s) => s + 1);
  }, [count]);

  // Timer. Bumps sessionId on entry so the progress-bar animation restarts
  // any time a new dwell window begins — natural tick, manual advance
  // (index change), or unpause transition (paused flips false).
  useEffect(() => {
    if (disabled || paused || count < 2) return;
    setSessionId((s) => s + 1);
    const id = window.setTimeout(() => {
      setIndex((i) => (i + 1) % count);
    }, advanceMs);
    return () => window.clearTimeout(id);
    // sessionId is intentionally not in deps — we write to it inside. The
    // effect re-runs on every index change (which is what we want) and on
    // paused/disabled/count/advanceMs toggles.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [disabled, paused, count, advanceMs, index]);

  const advance = useCallback(() => {
    // Bail out cleanly when there's nothing to cycle through — avoids a
    // modulo-by-zero and keeps callers from having to guard.
    if (count < 1) return;
    setIndex((i) => (i + 1) % count);
  }, [count]);

  return { index, sessionId, advance };
};
