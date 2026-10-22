# Brief: Festival Hub counter overlaps the intro text (prod bug)

Lane: NORMAL. Repo: bachata-website. Branch: `claude/festival-counter-gap` (from `origin/main`). One PR, push ONCE.

## The bug
On https://bachatacalendar.co.uk/festivals at a phone width (390x844), the line "7 upcoming festivals" sits on top of
the last line of the intro paragraph. Measured on prod 2026-10-18: counter y 422-435, paragraph y 374-432.

Cause: `src/pages/FestivalHub.tsx` (about line 330), the stats row:
`<div className="flex items-center justify-center gap-2 -mt-4 mb-8 relative z-10">`.
The `-mt-4` pulls it 16px up into the intro `<section ... pt-3 pb-1>` above it.

## What to change (this file only, plus tests)
1. Replace `-mt-4 mb-8` with a small positive gap (e.g. `mt-2 mb-6`). Change nothing else on the page.
2. Wording: `1 upcoming festival` (singular), `N upcoming festivals` otherwise. When there are 0 festivals,
   render no counter line at all (the list below already handles being empty; do not invent a new empty state).
   Put the wording in a tiny pure helper (e.g. `festivalCountLabel(n): string | null`) exported from a small
   module next to the page, so it is testable.
3. Use HTML entities, never raw Unicode punctuation, in JSX (repo rule).

## Tests (write them red first against the current code, then fix)
- Vitest, table-driven: n = 0 -> null, 1 -> "1 upcoming festival", 7 -> "7 upcoming festivals".
- A layout check at 390x844 that the counter's top is >= the intro paragraph's bottom. Use the repo's existing
  build-smoke / e2e pattern (look in `tests/e2e-build/` and `playwright*.config.*`); if the page needs data that the
  e2e fake does not have, assert on the class list instead (no negative top margin on the stats row) and say so in the PR body.
- If you add a spec to the curated e2e list, add it BY NAME (the list is explicit, not a glob).

## Done means
- Every CI job step that applies to this PR is run in your sandbox (read `.github/workflows/*.yml`); per-job table in the PR body.
- PR body has the "Verified on real data" section filled honestly (you cannot walk prod data; say "Not verified: real-data walk, orchestrator will do it").
- Design Gate: bug fix restoring layout; only stage 4 checks apply (no sideways scroll, no clipping, contrast unchanged). Say so in the PR body.
- Handover file `docs/handover/festival-counter-gap.md` (short: cause, change, tests, what you did not verify).
- Do NOT push again after your final commit.
