import type { LinkKind } from '@/modules/organiser/shared/linkRules';

/**
 * Per link kind: a saved value and a valid / invalid entry, for the link-sheet
 * close matrices (events and profile). The saved values follow the prod shapes
 * (2026-10-08 survey, counts): organiser Instagram is mostly an instagram.com URL
 * (39 of 45), a few handles (2), one bare instagram.com/... address, 3 blank.
 */
export const LINK_ENTRIES: Record<LinkKind, { saved: string; valid: string; invalid: string }> = {
  ticket: { saved: 'https://tickets.example/saved', valid: 'https://tickets.example/new', invalid: 'tickets dot com' },
  video: { saved: 'https://youtu.be/saved', valid: 'https://youtu.be/new', invalid: 'youtube video' },
  instagram: { saved: 'https://instagram.com/ritmoleeds', valid: '@ritmo.leeds', invalid: 'not a handle!' },
  website: { saved: 'ritmo.example', valid: 'https://ritmo.example/tickets', invalid: 'not a site' },
  facebook: { saved: 'ritmofb', valid: 'https://facebook.com/ritmo', invalid: 'my page!!' },
};
