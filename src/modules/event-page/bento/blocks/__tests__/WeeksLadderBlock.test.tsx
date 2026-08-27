// Server-renders WeeksLadderBlock so the cancelled JSX branch is covered, not
// just the courseLadderModel arithmetic behind it. Uses renderToStaticMarkup --
// this repo has no testing-library and this needs none.
import { describe, expect, it } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { MemoryRouter } from 'react-router-dom';
import { asWallClock } from '@/lib/time/wallClock';
import type { EventPageSnapshotOccurrence } from '@/modules/event-page/types';
import { WeeksLadderBlock } from '@/modules/event-page/bento/blocks/WeeksLadderBlock';

let n = 0;
const occ = (o: Partial<EventPageSnapshotOccurrence> = {}): EventPageSnapshotOccurrence => ({
  occurrenceId: `o${(n += 1)}`,
  startsAt: asWallClock('2026-09-10T20:00:00'),
  endsAt: asWallClock('2026-09-10T21:00:00'),
  localDate: asWallClock('2026-09-10T00:00:00'),
  timezone: 'Europe/London',
  isCancelled: false,
  cancellationReasonLabel: null,
  isLive: false,
  isPast: false,
  isUpcoming: true,
  lineup: { teachers: [], djs: [], dancers: [], vendors: [], videographers: [] },
  ...o,
});

const render = (occs: EventPageSnapshotOccurrence[]) =>
  renderToStaticMarkup(
    <MemoryRouter>
      <WeeksLadderBlock occurrences={occs} currentOccurrenceId={null} level="Improver" />
    </MemoryRouter>,
  );

const strip = (h: string) => h.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();

describe('WeeksLadderBlock renders option A', () => {
  it('a clean course numbers every week and counts them all', () => {
    const t = strip(render([occ(), occ(), occ(), occ()]));
    expect(t).toContain('4-week progressive course');
    expect(t).toContain('Week 1');
    expect(t).toContain('Week 4');
    expect(t).not.toContain('Cancelled');
  });

  it('a cancelled week is unnumbered, says Cancelled, and drops the count', () => {
    const html = render([occ({ isPast: true }), occ({ isCancelled: true }), occ(), occ()]);
    const t = strip(html);
    // The headline drops to three.
    expect(t).toContain('3-week progressive course');
    expect(t).not.toContain('4-week progressive course');
    // The row reads "Cancelled" where a week number would be...
    expect(t).toContain('Cancelled');
    // ...and the weeks after it renumber rather than skipping.
    expect(t).toContain('Week 1');
    expect(t).toContain('Week 2');
    expect(t).toContain('Week 3');
    expect(t).not.toContain('Week 4');
    // No red Cancelled BADGE any more -- the word appears exactly once.
    expect(t.match(/Cancelled/g)).toHaveLength(1);
    // The dot node: a 7px circle, and no numbered pip for that row.
    expect(html).toContain('h-[7px] w-[7px] rounded-full');
    // Strike-through is gone from the label (option A styles the word, not a line).
    expect(html).not.toContain('line-through');
  });

  it('shows Course finished when nothing is left to attend', () => {
    const t = strip(render([occ({ isPast: true }), occ({ isCancelled: true })]));
    expect(t).toContain('Course finished');
    expect(t).not.toContain('progressive course');
  });
});
