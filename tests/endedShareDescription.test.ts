// @vitest-environment node
/**
 * Series-termination arc P4b. og:description for an ended series -- the copy a
 * WhatsApp, Slack or Facebook preview shows, and the only part of the tombstone
 * that travels away from the page.
 *
 * WHY THIS FILE EXISTS -- and what changed under it (arc W14, 2026-09-04).
 *
 * It was written for a FESTIVAL GATE that no longer exists. The subject used to
 * take a second argument, the loader's sniffIsFestival answer, and return the
 * STORED sales copy whenever it was true: a festival-routed series rendered no
 * tombstone at all, so promising "this festival has finished" in a preview and
 * then landing the reader on FestivalDetail -- a page still selling passes --
 * was the worse of two wrongs. The gate had itself been a bug once, first
 * written as a LOCAL `(format ?? type) === 'festival'` re-derivation of a
 * routing decision the loader had already made; that is narrower than
 * sniffIsFestival, which also fires on a content sniff (>= 2 distinct schedule
 * days, or any passes) whatever `format` says.
 *
 * W14 removed the gate by removing its PREMISE: FestivalDetail now renders the
 * ended record in place of its hero CTA and suppresses its passes grid, ticket
 * pill, promo codes, raffle, group chat, add-to-calendar and JSON-LD offers, so
 * the two surfaces agree and the copy travels for every shape.
 *
 * The two tests that pinned the gate are kept, INVERTED -- both ways it read
 * wrong now give the same answer -- plus one that fails if a gating argument
 * comes back by any route. That last one was itself mutation-tested: an earlier
 * `expect(fn.length).toBe(1)` did NOT arm, because a parameter declared with a
 * default does not count toward Function.length.
 */
import { describe, expect, it } from 'vitest';
import { buildEventShareDescription } from '@/modules/event-page/endedShareDescription';
import type { EventPageSnapshot } from '@/modules/event-page/types';

const STORED = 'Join me every Sunday this June for styling.';
const TAIL = 'See what else is on at Bachata Calendar.';

// Only the event fields the subject reads. Pick (rather than a free-standing
// shape) so renaming one on EventPageSnapshot reds this file instead of silently
// leaving it asserting a field the subject no longer looks at.
type ShareFields = Pick<
  EventPageSnapshot['event'],
  'description' | 'lifecycleStatus' | 'format' | 'type' | 'category' | 'ranFrom' | 'endedOn'
>;

const snap = (event: Partial<ShareFields>): EventPageSnapshot =>
  ({
    event: {
      description: STORED,
      lifecycleStatus: 'live',
      format: 'course',
      type: 'course',
      category: 'class',
      ranFrom: null,
      endedOn: null,
      ...event,
    },
  }) as unknown as EventPageSnapshot;

describe('buildEventShareDescription', () => {
  it('leaves a live series entirely alone', () => {
    expect(buildEventShareDescription(snap({}))).toBe(STORED);
  });

  it('returns null when the snapshot could not load', () => {
    expect(buildEventShareDescription(null)).toBeNull();
  });

  it('REPLACES the sales copy on an ended series, and states the run', () => {
    const out = buildEventShareDescription(
      snap({ lifecycleStatus: 'ended', ranFrom: '2026-06-07', endedOn: '2026-06-28' }),
    );
    expect(out).toBe(`This course has finished and is no longer running. It ran 7 to 28 June 2026. ${TAIL}`);
    // The invitation is GONE, not prefixed -- appending would leave "Join me
    // every Sunday this June" sitting in the preview, which is the whole defect.
    expect(out).not.toContain('Join me');
  });

  it('reads properly with no dates at all (a pre-P4c payload)', () => {
    expect(buildEventShareDescription(snap({ lifecycleStatus: 'ended' }))).toBe(
      `This course has finished and is no longer running. ${TAIL}`,
    );
  });

  it('names the last night when the run was a single date', () => {
    expect(
      buildEventShareDescription(
        snap({
          lifecycleStatus: 'ended',
          ranFrom: '2026-06-28',
          endedOn: '2026-06-28',
          format: 'one_off',
          type: 'party',
          category: 'party',
        }),
      ),
    ).toBe(`This night has finished and is no longer running. Its last night was 28 June 2026. ${TAIL}`);
  });

  // INVERTED BY W14. This asserted STORED until FestivalDetail grew a tombstone,
  // so it is the defect W14 fixed, seen from the share preview.
  it('gives an ended FESTIVAL the ended copy, now that its page renders one', () => {
    expect(
      buildEventShareDescription(
        snap({ lifecycleStatus: 'ended', format: 'festival', type: 'festival', endedOn: '2026-06-28' }),
      ),
    ).toBe(`This festival has finished and is no longer running. Its last night was 28 June 2026. ${TAIL}`);
  });

  // ALSO INVERTED. format says 'course' but the loader's sniffIsFestival said
  // festival on the CONTENT (multi-day schedule or passes), so the reader lands
  // on FestivalDetail -- which now renders the record and derives its noun from
  // these same three fields. Preview and page say "course" together, which is
  // the point: FestivalDetail must never hard-code the word "festival".
  it('gives a CONTENT-sniffed festival the ended copy in its OWN noun', () => {
    expect(
      buildEventShareDescription(
        snap({ lifecycleStatus: 'ended', format: 'course', type: 'course', endedOn: '2026-06-28' }),
      ),
    ).toBe(`This course has finished and is no longer running. Its last night was 28 June 2026. ${TAIL}`);
  });

  // The guard against the gate coming back. Calls THROUGH a signature that has
  // it and asserts a second argument changes nothing, which catches both the
  // required and the defaulted shape; asserting arity alone catches only the
  // required one, and the defaulted one is the likelier way it would return.
  it('cannot be gated by a second argument, whatever a caller passes', () => {
    const ended = snap({
      lifecycleStatus: 'ended',
      format: 'festival',
      type: 'festival',
      endedOn: '2026-06-28',
    });
    const expected = `This festival has finished and is no longer running. Its last night was 28 June 2026. ${TAIL}`;
    const withGate = buildEventShareDescription as unknown as (
      s: EventPageSnapshot | null,
      isFestival?: boolean,
    ) => string | null;
    expect(withGate(ended, true)).toBe(expected);
    expect(withGate(ended, false)).toBe(expected);
    expect(buildEventShareDescription(ended)).toBe(expected);
  });

  // A legacy row with type 'festival' and no format. It read wrong under the old
  // gate too -- the sniff said "not a festival", so the ended copy was emitted
  // for a page that DID render the tombstone. Same answer now, for a simpler
  // reason: there is no gate.
  it('emits the ended copy for a legacy festival TYPE with no format', () => {
    expect(
      buildEventShareDescription(
        snap({ lifecycleStatus: 'ended', format: null, type: 'festival', endedOn: '2026-06-28' }),
      ),
    ).toBe(`This festival has finished and is no longer running. Its last night was 28 June 2026. ${TAIL}`);
  });

  // A weekly class is format='recurring', so before the category fix the preview
  // read "This night has finished" for a bachata class. This is the common shape
  // for what this arc ends, not an edge case.
  it('calls a recurring CLASS a class, not a night', () => {
    expect(
      buildEventShareDescription(
        snap({
          lifecycleStatus: 'ended',
          format: 'recurring',
          type: 'class',
          category: 'class',
          endedOn: '2026-06-28',
        }),
      ),
    ).toBe(`This class has finished and is no longer running. Its last night was 28 June 2026. ${TAIL}`);
  });

  it('still calls a recurring PARTY a night', () => {
    expect(
      buildEventShareDescription(
        snap({
          lifecycleStatus: 'ended',
          format: 'recurring',
          type: 'party',
          category: 'party',
          endedOn: '2026-06-28',
        }),
      ),
    ).toBe(`This night has finished and is no longer running. Its last night was 28 June 2026. ${TAIL}`);
  });

  it('emits the ended copy even when the series never had a description', () => {
    expect(
      buildEventShareDescription(snap({ lifecycleStatus: 'ended', description: null })),
    ).toBe(`This course has finished and is no longer running. ${TAIL}`);
  });

  it('passes a paused or cancelled series through untouched -- ended is the only trigger', () => {
    for (const lifecycleStatus of ['paused', 'draft', 'archived']) {
      expect(buildEventShareDescription(snap({ lifecycleStatus }))).toBe(STORED);
    }
  });
});
