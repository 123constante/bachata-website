// Series-termination arc P4b -- the share preview for a series that has ended.
//
// The stored description is written to SELL the run ("Join me every Sunday this
// June for..."), and it keeps selling it forever: measured on prod 2026-09-02,
// sharing the one ended course produced exactly that line over a flyer showing
// prices and a scannable QR code. So the ended lead REPLACES the description
// rather than prefixing it -- appending would leave the invitation in the
// preview, which is the whole defect.
//
// Dates are formatted from their own parts by formatRunRange (naive London
// 'YYYY-MM-DD', never Date/Intl -- see that module). A null range is the live
// path for a payload served before the P4a/P4c migrations, not a defensive one,
// so the date-free sentence has to read properly on its own.
//
// ASCII " to " rather than an en-dash: this string is consumed by WhatsApp,
// Slack and search snippets, and a plain separator survives every one of them.
//
// ITS OWN MODULE, not a local in app/routes/event.tsx, for two reasons. It is
// the copy dancers read in a WhatsApp preview and nothing else asserts it, so it
// needs a test, and a route module cannot export a helper for one without also
// shipping it to the client bundle -- react-router strips `loader`/`headers`
// from the client build, not arbitrary named exports.
import type { EventPageSnapshot } from '@/modules/event-page/types';
import { formatRunRange, runNoun } from '@/modules/event-page/bento/utils/endedRun';

/**
 * @param snap        the event_view_p5 snapshot, or null when it could not load
 * @param isFestival  the LOADER'S sniffIsFestival answer -- the same predicate
 *                    that decides whether the page renders FestivalDetail. Never
 *                    re-derive it here; see the comment on the gate below.
 */
export const buildEventShareDescription = (
  snap: EventPageSnapshot | null,
  isFestival: boolean,
): string | null => {
  const stored = snap?.event?.description ?? null;
  if (snap?.event?.lifecycleStatus !== 'ended') return stored;

  // A festival-routed series does NOT render the tombstone: EventPage sends it to
  // FestivalDetail (src/pages/EventPage.tsx), which has no ended banner, no record
  // card, and still shows passes and ticket CTAs. Promising "this festival has
  // finished" in the share preview and then landing the reader on a page selling
  // passes is worse than a stale invitation, so festivals keep their stored copy
  // until the ended treatment reaches FestivalDetail.
  //
  // THE CALLER'S `isFestival`, NOT A LOCAL RE-DERIVATION. This test was first
  // written as `(format ?? type) === 'festival'`, which is NARROWER than the
  // predicate that actually does the routing: sniffIsFestival also returns true
  // on a content sniff -- two or more distinct schedule days, or any passes --
  // whatever `format` says. An ended series that qualified only on the sniff
  // would have been shared as "this course has finished" and then landed the
  // reader on a page still selling passes: the exact defect this gate exists to
  // stop. It also read wrong the other way, suppressing the ended copy for a
  // legacy `type = 'festival'` row that renders the tombstone perfectly well.
  // One predicate, computed once in the loader, used by both.
  if (isFestival) return stored;

  const noun = runNoun(snap.event.format, snap.event.type);
  const range = formatRunRange(snap.event.ranFrom, snap.event.endedOn);
  const ran =
    range === null
      ? ''
      : range.kind === 'range'
        ? ` It ran ${range.from} to ${range.to}.`
        : ` Its last night was ${range.to}.`;
  return `This ${noun} has finished and is no longer running.${ran} See what else is on at Bachata Calendar.`;
};
