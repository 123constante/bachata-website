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

// THE FESTIVAL GATE IS GONE (arc W14, 2026-09-04), and it is worth knowing why
// it was here rather than re-deriving it.
//
// Until W14 a festival-routed series rendered NO tombstone: EventPage sends it
// to FestivalDetail, which had no record card and went on showing passes and a
// Get Tickets button. Promising "this festival has finished" in a share preview
// and then landing the reader on a page selling passes is worse than a stale
// invitation, so festivals kept their stored copy and the gate carried a comment
// saying it held only "until the ended treatment reaches FestivalDetail".
//
// It has. FestivalDetail now renders EventEndedRecord in place of its hero CTA
// and suppresses the passes grid, the ticket pill, promo codes, the raffle, the
// group chat and add-to-calendar, and its JSON-LD emits no offers node. The
// premise the gate rested on is false, so the gate goes rather than being
// re-scoped -- the two surfaces now say the same thing.
//
// One consequence to keep: this function is the ONLY owner of the sentence, and
// FestivalDetail derives its noun from the same three fields via the same
// runNoun. Do not add a format-specific branch here without adding one there.
/**
 * The sentence itself, from the five fields it is built out of.
 *
 * SPLIT OUT of buildEventShareDescription because a SECOND caller needs it and
 * cannot supply an EventPageSnapshot: FestivalDetail's JSON-LD `description`
 * (arc W14). On the standalone /festival/:id mount that component holds only the
 * RAW snake_case event_view_p5 payload -- there is no parsed snapshot to hand in
 * -- and without this split the only ways to serve it were a second copy of the
 * sentence, or running the snapshot parser somewhere it can throw. runNoun's own
 * docblock rules out the first: two copies of this copy drift, and the drift is
 * only ever visible to someone reading a tombstone.
 */
export const endedRunSentence = (p: {
  format: string | null;
  type: string | null;
  category: string | null;
  ranFrom: string | null;
  endedOn: string | null;
}): string => {
  const noun = runNoun(p.format, p.type, p.category);
  const range = formatRunRange(p.ranFrom, p.endedOn);
  const ran =
    range === null
      ? ''
      : range.kind === 'range'
        ? ` It ran ${range.from} to ${range.to}.`
        : ` Its last night was ${range.to}.`;
  return `This ${noun} has finished and is no longer running.${ran} See what else is on at Bachata Calendar.`;
};

/**
 * The og:description an event page ships: the stored copy, replaced outright
 * by the ended sentence once the run has finished.
 *
 * @param snap  the event_view_p5 snapshot, or null when it could not load
 */
export const buildEventShareDescription = (
  snap: EventPageSnapshot | null,
): string | null => {
  const stored = snap?.event?.description ?? null;
  if (snap?.event?.lifecycleStatus !== 'ended') return stored;

  return endedRunSentence({
    format: snap.event.format,
    type: snap.event.type,
    category: snap.event.category,
    ranFrom: snap.event.ranFrom,
    endedOn: snap.event.endedOn,
  });
};
