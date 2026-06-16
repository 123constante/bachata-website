/**
 * Rem-based type scale for bento informational text, so sizes track the user's
 * font-size preference and the responsive root (WCAG 1.4.4 Resize Text).
 *
 * The app root is `font-size: clamp(13.5px, 0.78rem + 0.28vw, 16px)` (index.css),
 * so 1rem is ~13.57px on a typical ~390px mobile, not 16px. These rem values are
 * calibrated against that ~13.57px root so they render at the intended px on
 * mobile and still scale up with viewport / user preference. The smallest
 * informational size is floored at ~9px for legibility; the previous 6.5-8px
 * micro-sizes sat at the edge of readability. Decorative micro-labels may stay
 * px at the call site.
 */
export const BENTO_TYPE = {
  /** Big date numeral on the Date tile. ~22px. */
  dayNumber: '1.62rem',
  /** Upcoming session / occurrence time. ~13px. */
  time: '0.958rem',
  /** Past session / occurrence time. ~11px. */
  timePast: '0.811rem',
  /** Weekday + day label on date rows. ~10.5px. */
  dateLabel: '0.774rem',
  /** Month label on the Date tile. ~10px. */
  month: '0.737rem',
  /** Weekday eyebrow on the Date tile. ~9px. */
  weekday: '0.663rem',
  /** Duration sub-label. ~9px floor (was 7.5px). */
  duration: '0.663rem',
  /** Today / Cancelled status badges. ~9px floor (was 6.5px). */
  badge: '0.663rem',
  /** Multi-day continuation line. ~9px floor (was 8px). */
  multiDay: '0.663rem',
} as const;
