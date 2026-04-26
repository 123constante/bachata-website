/**
 * Per-event muted-jewel card colour palette.
 *
 * Used for event-card surfaces (currently DayDetailModal) where each card
 * needs to be visually distinct from its neighbours. Each event id maps
 * deterministically to one of 8 muted-jewel tones, so the same event keeps
 * the same colour everywhere it appears.
 *
 * Decision approved 2026-04-26 — see plan-day-modal-card-colour.md in the
 * Bachata Calendar PM workspace folder. Per-event persistent assignment;
 * replaces the cyan/pink CLASSES/PARTY strip-colour split.
 */

const EVENT_CARD_PALETTE = [
  '#2d0a1a', // wine
  '#0a2d1f', // emerald
  '#0a1a3a', // navy
  '#1a0a2d', // plum
  '#2d1a0a', // cocoa
  '#0a2d2d', // teal
  '#2d2a0a', // olive
  '#2d0a2a', // magenta
] as const;

export type EventCardColour = (typeof EVENT_CARD_PALETTE)[number];

/**
 * Returns a deterministic muted-jewel colour for an event id.
 * Same id always returns the same colour.
 */
export function eventCardColour(eventId: string): EventCardColour {
  let hash = 0;
  for (let i = 0; i < eventId.length; i++) {
    hash = (Math.imul(hash, 31) + eventId.charCodeAt(i)) | 0;
  }
  const idx = Math.abs(hash) % EVENT_CARD_PALETTE.length;
  return EVENT_CARD_PALETTE[idx];
}

export const EVENT_CARD_COLOURS = EVENT_CARD_PALETTE;
