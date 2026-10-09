// Product bugs this suite has FOUND and that are still open. Each entry keeps
// the daily run green on a known defect so that a NEW one is what turns it
// red -- and each says how the entry gets removed. Never add an entry without
// the bug being written up (PR body or issue); never remove one without the
// fix being live.
//
// KB-1 is a console error, so it is excused by text inside visit() and
// recorded as a run annotation. A bug that fails a whole assertion is excused
// by marking its test test.fail() with knownBug(id): the day the bug is fixed
// that test turns RED with "expected to fail", which is the prompt to delete
// the entry here (KB-2, organisers with no events, went that way).

export type KnownBug = { id: string; summary: string; console?: RegExp };

export const KNOWN_BUGS: KnownBug[] = [
  {
    id: 'KB-1',
    summary:
      'get_public_festival_detail_v2 answers 400 "invalid input syntax for type numeric" for some events '
      + '(found 2026-10-08 on /event/bachazouk-bootcamp-leader-workshop); the page logs "Query error".',
    console: /invalid input syntax for type numeric/,
  },
];

export const knownBug = (id: string): KnownBug => {
  const b = KNOWN_BUGS.find((k) => k.id === id);
  if (!b) throw new Error(`unknown known-bug id ${id}`);
  return b;
};
