/**
 * The ONE mapping from an /event/:id page's lifecycle facts to its SEO outputs:
 * HTTP status, indexability, sitemap membership, the JSON-LD Event node's
 * eventStatus and offers, and the lifecycle copy that must agree with them.
 * The loaders (app/lib/hiddenEventResponse, shared by /event and /festival) and
 * the JSON-LD builder (buildEventJsonLd, called by BentoPage and FestivalDetail)
 * all read it,
 * so a state cannot be "gone" in one and "live" in another.
 *
 * Inputs are DB facts, never page copy:
 *  - resolves: resolve_public_event_ref_v1 returned a row. It IS the page gate
 *    (live | ended | paused WITH a past public date), and list_public_event_urls_v1
 *    (the sitemap) uses the identical SQL predicate -- so "in the sitemap" is
 *    exactly "resolves", by construction in the DB, not by a second copy here.
 *  - lifecycleStatus: event_series_p5.lifecycle_status. For a hidden series it
 *    comes from the server-only lookup (app/lib/hiddenEventLookup), because anon
 *    cannot read event_series_p5.
 *  - isCancelled: the headline occurrence is cancelled.
 *
 * Owner SEO decisions (2026-10-08, final):
 *  (a) paused (with a past date): 200, indexable, in sitemap, "On hiatus" on the
 *      page, JSON-LD with NO Event node. Not EventPostponed: every Event node
 *      needs a startDate, and the only date a paused page carries is one that
 *      already RAN (_p5_series_has_past_public_date_v1 is the paused page's
 *      headline query). Google reads EventPostponed + startDate as "the event
 *      scheduled for startDate was postponed" -- a false statement about a night
 *      that happened. The hiatus is a fact about the SERIES; schema.org has no
 *      series-level "on hiatus" status, so the honest node is none.
 *  (b) archived (taken down): 410 Gone + noindex. draft / pending_review were
 *      never public, and an unknown slug never existed: those stay 404.
 *  (c) a cancelled date on a live series: indexed, eventStatus EventCancelled.
 *  (d) ended: indexed, no offers (a finished run must not advertise passes),
 *      and the page links to the organiser's still-running events.
 */

export type EventPageStatus = 200 | 404 | 410;

const SCHEMA = 'https://schema.org/';

/** Accessible name of the ended page's door to the organiser's still-running
 *  events (its visible heading is "More from {organiser}"). */
export const ENDED_DOOR_LABEL = 'Still running from this organiser';

/** HTTP status for a series the public resolver hides. */
export function hiddenEventStatus(lifecycleStatus: string | null | undefined): 404 | 410 {
  return lifecycleStatus === 'archived' ? 410 : 404;
}

export type EventJsonLdPolicy = {
  /** false: emit no Event node at all. */
  emitEvent: boolean;
  eventStatus: string | null;
  /** false: never emit `offers`, even with real ticket rows on file. */
  offers: boolean;
};

export function eventJsonLdPolicy(p: {
  lifecycleStatus: string | null | undefined;
  isCancelled: boolean | null | undefined;
}): EventJsonLdPolicy {
  if (p.lifecycleStatus === 'paused') return { emitEvent: false, eventStatus: null, offers: false };
  return {
    emitEvent: true,
    eventStatus: `${SCHEMA}${p.isCancelled ? 'EventCancelled' : 'EventScheduled'}`,
    offers: p.lifecycleStatus !== 'ended',
  };
}

export type EventPageSeoPolicy = EventJsonLdPolicy & {
  status: EventPageStatus;
  indexable: boolean;
  inSitemap: boolean;
  endedDoorLabel: string | null;
};

export function eventPageSeoPolicy(p: {
  resolves: boolean;
  lifecycleStatus: string | null | undefined;
  isCancelled?: boolean | null;
}): EventPageSeoPolicy {
  if (!p.resolves) {
    return {
      status: hiddenEventStatus(p.lifecycleStatus),
      indexable: false,
      inSitemap: false,
      emitEvent: false,
      eventStatus: null,
      offers: false,
      endedDoorLabel: null,
    };
  }
  return {
    status: 200,
    indexable: true,
    inSitemap: true,
    ...eventJsonLdPolicy({ lifecycleStatus: p.lifecycleStatus, isCancelled: p.isCancelled }),
    endedDoorLabel: p.lifecycleStatus === 'ended' ? ENDED_DOOR_LABEL : null,
  };
}
