/**
 * upcomingEventCover.test.ts -- both directions for CI contract check #62.
 *
 * The checks-manifest law: a guard whose only proof is "it printed ok against
 * live data today" is a proof nobody can re-run. The network half necessarily
 * lives in db-contract-check.yml; the DECISION half is pure and belongs here,
 * where unit-tests.yml and the pre-push gate collect it without secrets.
 *
 * Origin: 2026-08-03. app/detailLoader.ts:resolveOgCardImage() falls back to the
 * generic site logo whenever an event has no cover, which is invisible until
 * someone shares the link. Exactly one published event was coverless when this
 * was written and it was PAST, so the guard is scoped to UPCOMING events -- the
 * window where an organiser can still fix it.
 */
import { describe, expect, it } from 'vitest';
import { findBreaches } from '../scripts/check-upcoming-event-cover.mjs';

const row = (over: Record<string, unknown> = {}) => ({
  slug: 'some-event',
  name: 'Some Event',
  instance_date: '2026-09-01',
  event_id: 'e1',
  cover_image_url: 'https://pub-x.r2.dev/images/cover.jpg',
  ...over,
});

describe('upcoming-event cover contract (#62)', () => {
  it('GREEN: a covered, slugged upcoming event is not a breach', () => {
    expect(findBreaches([row()])).toEqual([]);
  });

  it('RED: a slugged event with a null cover IS a breach, and names the row', () => {
    const [b] = findBreaches([row({ cover_image_url: null })]);
    expect(b.slug).toBe('some-event');
    expect(b.name).toBe('Some Event');
    expect(b.date).toBe('2026-09-01');
    expect(b.eventId).toBe('e1');
  });

  it('RED: an empty-string cover counts as missing, not as present', () => {
    // The fallback in resolveOgCardImage triggers on a falsy cover token, so a
    // blank string degrades the preview exactly like a null does.
    expect(findBreaches([row({ cover_image_url: '' })])).toHaveLength(1);
  });

  it('IGNORES an unslugged row -- it has no shareable /event/<slug> URL', () => {
    expect(findBreaches([row({ slug: null, cover_image_url: null })])).toEqual([]);
  });

  it('survives a malformed row rather than throwing mid-scan', () => {
    expect(findBreaches([null, undefined, row({ cover_image_url: null })])).toHaveLength(1);
  });

  it('reports every breach, not just the first', () => {
    const rows = [
      row({ slug: 'a', cover_image_url: null }),
      row({ slug: 'b' }),
      row({ slug: 'c', cover_image_url: null }),
    ];
    expect(findBreaches(rows).map((b) => b.slug)).toEqual(['a', 'c']);
  });

  it('falls back to start_time, then to a placeholder, when instance_date is absent', () => {
    const [withStart] = findBreaches([row({ cover_image_url: null, instance_date: null, start_time: '2026-09-02T19:00:00Z' })]);
    expect(withStart.date).toBe('2026-09-02T19:00:00Z');
    const [withNeither] = findBreaches([row({ cover_image_url: null, instance_date: null })]);
    expect(withNeither.date).toBe('(undated)');
  });
});
