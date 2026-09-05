// The venue panel's MARKUP. Leaflet takes popup content as an HTML string, so
// this builds one -- and it is its own module, with no Leaflet import anywhere
// in its graph, so it can be tested as a string function. Importing EventMap to
// reach its private `esc` would have pulled Leaflet and MapLibre into that test.

import type { VenueNight } from './venueNights';
import { CATEGORY_LABEL, CATEGORY_COLORS } from './mapTypes';
import { weekdayOfKey } from '@/lib/londonDate';

// Weekdays in FULL, per the house copy rule ("Friday", never "Fri"). Months
// stay short: the rule is about weekdays, and "11 September" costs a line wrap
// in a 268px panel that "11 Sep" does not.
const WEEKDAYS = [
  'Sunday',
  'Monday',
  'Tuesday',
  'Wednesday',
  'Thursday',
  'Friday',
  'Saturday',
];
const MONTHS_SHORT = [
  'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
  'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec',
];

/** Escape everything user-supplied that flows into the popup's innerHTML.
 *  Mirrors EventMap's own esc(); duplicated rather than shared because the
 *  alternative is importing Leaflet into a pure module. */
export function esc(s: string | null | undefined): string {
  return String(s ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

/**
 * '11 Sep', or 'Friday 11 Sep' when the weekday is worth saying.
 *
 * Built from the key's own parts, never `new Date('2026-09-13')` -- that parses
 * as UTC midnight and prints the previous weekday for a London date once BST
 * puts the browser an hour ahead. weekdayOfKey is the sanctioned helper and is
 * UTC-noon anchored for exactly this reason.
 */
export function dateLabel(key: string, withWeekday: boolean): string {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(key);
  if (!m) return '';
  const day = Number(m[3]);
  const month = MONTHS_SHORT[Number(m[2]) - 1] ?? '';
  const stem = `${day} ${month}`.trim();
  return withWeekday ? `${WEEKDAYS[weekdayOfKey(key)]} ${stem}` : stem;
}

export interface VenuePanelArgs {
  venueName: string | null;
  area: string | null;
  nights: VenueNight[];
  /** The venue's /venue-entity href, or null -- the flag is off, or the venue
   *  did not resolve to a public venue record. Null renders the heading as
   *  plain text, so no dead link can ship either way. */
  venueHref: string | null;
}

const CHEV = '<span class="vchev" aria-hidden="true">&rsaquo;</span>';

/** One night row. A real <a href> so it is keyboard-reachable, middle-clickable
 *  and openable in a new tab; the data-href is what EventMap's popupopen
 *  handler binds to for SPA navigation, and it intercepts the same href the
 *  anchor would have followed. Nothing interactive is nested inside anything
 *  else interactive -- the defect that got the attribution chip reverted. */
function nightRow(n: VenueNight): string {
  const href = `/event/${encodeURIComponent(n.eventId)}?occurrenceId=${encodeURIComponent(n.nextOccId)}`;
  // The weekday is dropped when the pattern already names it: 'Fridays . next
  // 11 Sep' rather than 'Fridays . next Friday 11 Sep'.
  const when = dateLabel(n.nextDate, !n.isWeekly);
  const meta = [n.pattern, when && `next ${when}`, n.time]
    .filter(Boolean)
    .join(' &middot; ');
  const cancelled = n.isCancelled
    ? '<span class="vcancel">Cancelled</span>'
    : '';
  return (
    `<li class="vnight-li"><a class="vnight" href="${esc(href)}" data-href="${esc(href)}">` +
    `<span class="vnight-body"><span class="vn-name">${esc(n.name)}</span>` +
    `<span class="vn-meta">${meta}</span></span>` +
    // The swatch colour comes from CATEGORY_COLORS rather than a per-category
    // CSS class, so the palette has ONE definition. A .vtype--party rule in the
    // stylesheet would be a second copy with nothing keeping it in step.
    `<span class="vtype" style="--vt:${esc(CATEGORY_COLORS[n.category])}">` +
    `${esc(CATEGORY_LABEL[n.category])}</span>` +
    `${cancelled}${CHEV}</a></li>`
  );
}

/**
 * The whole panel: a venue heading, then one row per regular night.
 *
 * WEIGHTED, as decided: the heading is its own full-width row to the venue,
 * and each night is its own row to the event. Nothing nested inside anything.
 */
export function venuePanelHtml(a: VenuePanelArgs): string {
  const name = a.venueName ?? 'This location';
  const count = a.nights.length;
  const sub = [
    a.area,
    count ? `${count} regular night${count === 1 ? '' : 's'}` : null,
  ]
    .filter(Boolean)
    .join(' &middot; ');

  const headBody =
    `<span class="vhead-body"><span class="vh-name">${esc(name)}</span>` +
    (sub ? `<span class="vh-meta">${sub}</span>` : '') +
    `</span>`;

  // A heading with nowhere to go is NOT a link with a dead href, and not a
  // button either -- it is text. That keeps the flag-off and unresolved-venue
  // cases from putting a control in the tab order that does nothing.
  const head = a.venueHref
    ? `<a class="vhead" href="${esc(a.venueHref)}" data-href="${esc(a.venueHref)}">${headBody}${CHEV}</a>`
    : `<div class="vhead vhead--static">${headBody}</div>`;

  // NEVER an empty panel. A pin that opens onto nothing is indistinguishable
  // from a broken one, which is this arc's founding defect one layer up -- and
  // it is reachable here whenever a filter hides every night at a venue whose
  // pin is still drawn.
  const body = count
    ? `<ul class="vnights">${a.nights.map(nightRow).join('')}</ul>`
    : `<p class="vempty">Nothing listed here under the current filter.</p>`;

  return `<div class="vpanel">${head}${body}</div>`;
}
