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

// The three shapes this block can render. This is the SINGLE source: the tests
// below destructure it rather than rebuilding the same literals inline, so
// widening a shape widens what the headline gate sees too. Two copies would
// drift silently -- the gate would keep asserting over a shape the suite had
// stopped exercising, which is the exact failure this fixture exists to prevent.
const SHAPES: [string, EventPageSnapshotOccurrence[]][] = [
  ['clean', [occ(), occ(), occ(), occ()]],
  ['cancelled', [occ({ isPast: true }), occ({ isCancelled: true }), occ(), occ()]],
  ['finished', [occ({ isPast: true }), occ({ isCancelled: true })]],
];
const [CLEAN, CANCELLED, FINISHED] = SHAPES.map(([, occs]) => occs);

// The headline div -- the block's ONLY claim about the shape of the course.
// Matched by its own class so the gate reads the claim itself rather than the
// whole page; it contains spans and nothing nested, so a non-greedy match to
// its close is exact. A MISS THROWS: "the headline moved" must be loud, never a
// green gate asserting over an empty string.
const headline = (html: string) => {
  const m = html.match(/tracking-\[0\.04em\]"[^>]*>([\s\S]*?)<\/div>/);
  if (!m) throw new Error('headline div not found -- the block changed shape; re-anchor this gate');
  return strip(m[1]);
};

describe('WeeksLadderBlock renders option A', () => {
  it('a clean course numbers every week and counts them all', () => {
    const t = strip(render(CLEAN));
    expect(t).toContain('4-week course');
    expect(t).toContain('Week 1');
    expect(t).toContain('Week 4');
    expect(t).not.toContain('Cancelled');
  });

  it('a cancelled week is unnumbered, says Cancelled, and drops the count', () => {
    const html = render(CANCELLED);
    const t = strip(html);
    // The headline drops to three.
    expect(t).toContain('3-week course');
    expect(t).not.toContain('4-week course');
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
    const t = strip(render(FINISHED));
    expect(t).toContain('Course finished');
    // The headline is replaced, not merely reworded, when nothing is left.
    expect(t).not.toContain('week course');
  });

  // THE GATE. The block used to headline every format='course' event as a
  // "{n}-week progressive course" -- a claim with no column behind it, on a
  // renderer that cannot know. /event/styling-and-technique-1 is a 3-hour
  // drop-in workshop series and read "4-week progressive course".
  //
  // Stated as INCLUSION, not as a banned word. The headline may say the week
  // count (arithmetic courseLadderModel evidences) or that the course is over,
  // and nothing else. An exclusion rule only ever forbids what its author
  // thought of: "{n}-week intensive course" would have sailed through a
  // /progressive/i check while making exactly the same kind of unbacked claim.
  //
  // What this does NOT enforce, said plainly because the previous wording
  // overclaimed it: it cannot tell a literal in this file from a value arriving
  // on a prop. When join_policy lands, P10 must add its data-sourced case to
  // ALLOWED_HEADLINE deliberately -- the gate makes that a decision someone
  // takes, which is the whole of what a test can do here. It is not proof the
  // value came from the column.
  const ALLOWED_HEADLINE = /^(?:\d+-week course(?: \u00b7 .+)?|Course finished)$/;

  it.each(SHAPES)('claims only the week count (%s course)', (_label, occs) => {
    const h = headline(render(occs));
    expect(h).toMatch(ALLOWED_HEADLINE);
    // Named separately so a regression reads as itself in the failure output,
    // and to cover the level slot, which ALLOWED_HEADLINE leaves open because
    // the level IS column-backed.
    expect(h).not.toMatch(/progressive/i);
  });
});
