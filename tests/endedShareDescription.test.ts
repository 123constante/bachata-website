// @vitest-environment node
/**
 * Series-termination arc P4b. og:description for an ended series -- the copy a
 * WhatsApp, Slack or Facebook preview shows, and the only part of the tombstone
 * that travels away from the page.
 *
 * WHY THIS FILE EXISTS. The festival gate below was first written as
 * `(format ?? type) === 'festival'`, a LOCAL re-derivation of a routing decision
 * the loader had already made two lines above it with sniffIsFestival(). The two
 * are not the same predicate -- sniffIsFestival also returns true on a content
 * sniff (>= 2 distinct schedule days, or any passes) whatever `format` says --
 * so an ended series that qualified only on the sniff would have been SHARED as
 * "this course has finished" and then landed the reader on FestivalDetail, a
 * page with no tombstone that still sells passes. That is the exact harm the
 * gate exists to prevent, and nothing failed: the branch had no test, and no
 * ended festival exists on prod to see it on. Case 5 is that regression.
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
    expect(buildEventShareDescription(snap({}), false)).toBe(STORED);
  });

  it('returns null when the snapshot could not load', () => {
    expect(buildEventShareDescription(null, false)).toBeNull();
  });

  it('REPLACES the sales copy on an ended series, and states the run', () => {
    const out = buildEventShareDescription(
      snap({ lifecycleStatus: 'ended', ranFrom: '2026-06-07', endedOn: '2026-06-28' }),
      false,
    );
    expect(out).toBe(`This course has finished and is no longer running. It ran 7 to 28 June 2026. ${TAIL}`);
    // The invitation is GONE, not prefixed -- appending would leave "Join me
    // every Sunday this June" sitting in the preview, which is the whole defect.
    expect(out).not.toContain('Join me');
  });

  it('reads properly with no dates at all (a pre-P4c payload)', () => {
    expect(buildEventShareDescription(snap({ lifecycleStatus: 'ended' }), false)).toBe(
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
        false,
      ),
    ).toBe(`This night has finished and is no longer running. Its last night was 28 June 2026. ${TAIL}`);
  });

  it('keeps the stored copy for a festival, which renders no tombstone', () => {
    expect(
      buildEventShareDescription(
        snap({ lifecycleStatus: 'ended', format: 'festival', type: 'festival', endedOn: '2026-06-28' }),
        true,
      ),
    ).toBe(STORED);
  });

  // THE REGRESSION. format says 'course', so the old `(format ?? type) ===
  // 'festival'` test passed it straight through to the ended copy -- but the
  // loader's sniffIsFestival said festival on the CONTENT (multi-day schedule or
  // passes), so the reader would have landed on FestivalDetail. Driven by the
  // caller's answer, this is stored copy.
  it('keeps the stored copy for a CONTENT-sniffed festival whose format says otherwise', () => {
    expect(
      buildEventShareDescription(
        snap({ lifecycleStatus: 'ended', format: 'course', type: 'course', endedOn: '2026-06-28' }),
        true,
      ),
    ).toBe(STORED);
  });

  // The same bug's other face: a legacy row with type 'festival' and no format
  // renders the tombstone perfectly well when the sniff says it is not one, so
  // suppressing the ended copy for it was wrong too.
  it('still emits the ended copy for a legacy festival TYPE the sniff rejects', () => {
    expect(
      buildEventShareDescription(
        snap({ lifecycleStatus: 'ended', format: null, type: 'festival', endedOn: '2026-06-28' }),
        false,
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
        false,
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
        false,
      ),
    ).toBe(`This night has finished and is no longer running. Its last night was 28 June 2026. ${TAIL}`);
  });

  it('emits the ended copy even when the series never had a description', () => {
    expect(
      buildEventShareDescription(snap({ lifecycleStatus: 'ended', description: null }), false),
    ).toBe(`This course has finished and is no longer running. ${TAIL}`);
  });

  it('passes a paused or cancelled series through untouched -- ended is the only trigger', () => {
    for (const lifecycleStatus of ['paused', 'draft', 'archived']) {
      expect(buildEventShareDescription(snap({ lifecycleStatus }), false)).toBe(STORED);
    }
  });
});
