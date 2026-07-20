/**
 * Typed boundary for `get_public_events_list_v2` — the shared source for the
 * public ICS subscription feed (/api/ics/calendar) and the embeddable widget
 * (/api/embed/calendar).
 *
 * Both routes previously hand-declared their own row interface and called the
 * RPC through `as never`, so the wire shape was asserted, never checked: a
 * renamed or dropped column would surface as `undefined` at runtime rather than
 * as a compile error. This derives the row from the regenerated schema instead,
 * and brands the two stored wall clocks.
 *
 * Lives in app/lib (not src/integrations/supabase/eventRpcs.ts) because both
 * consumers are app/ resource routes — same placement rationale as
 * app/lib/ogCardRender.ts.
 */

import type { Database } from '@/integrations/supabase/types';
import {
  asWallClock,
  asWallClockOrNull,
  asEventTimeZone,
  type WallClock,
} from '@/lib/time/wallClock';

type RawPublicEventsListRow =
  Database['public']['Functions']['get_public_events_list_v2']['Returns'][number];

/**
 * `supabase gen types` marks every RPC-Returns column non-null, but the function
 * body genuinely emits NULL for an event with no venue, organiser or cover
 * image, an open-ended occurrence (`ends_at`), or an event with no
 * type/format/category. Both feeds already guard these, so re-widen rather than
 * let the generator narrow them to `string` — otherwise `ev.venue_name.trim()`
 * would compile and then throw.
 */
type NullableWireCol =
  | 'ends_at'
  | 'type'
  | 'city_slug'
  | 'city_name'
  | 'city_timezone'
  | 'venue_id'
  | 'venue_name'
  | 'venue_address'
  | 'organiser_id'
  | 'organiser_name'
  | 'cover_image_url'
  | 'format'
  | 'category';

/**
 * The branded feed row. `starts_at` / `ends_at` are the stored London wall clock
 * RE-TAGGED '+00', NOT true instants — verified live: a 19:30 London event
 * arrives as "2026-07-20T19:30:00+00:00". Branding them WallClock stops a
 * `new Date(row.starts_at)` from reading the stored clock as an instant (which
 * puts every BST event an hour late). A consumer that needs a real instant — the
 * ICS DTSTART — must go through `wallClockToInstant(wc, city_timezone)`.
 *
 * Produced ONLY by parsePublicEventsListRow below.
 */
export type PublicEventsListRow = Omit<
  RawPublicEventsListRow,
  'starts_at' | NullableWireCol
> & {
  starts_at: WallClock;
  ends_at: WallClock | null;
  city_timezone: string | null; // via asEventTimeZone ('UTC' -> null -> London default)
} & {
  [K in Exclude<NullableWireCol, 'ends_at' | 'city_timezone'>]:
    | RawPublicEventsListRow[K]
    | null;
};

/**
 * The one producer of a branded feed row. Replaces the blanket
 * `data as FeedEvent[]` / `data as WidgetEvent[]` casts, which asserted nothing.
 */
export function parsePublicEventsListRow(
  raw: RawPublicEventsListRow,
): PublicEventsListRow {
  return {
    ...raw,
    starts_at: asWallClock(raw.starts_at),
    ends_at: asWallClockOrNull(raw.ends_at),
    city_timezone: asEventTimeZone(raw.city_timezone),
  };
}
