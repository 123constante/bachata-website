# Brief: independent REVIEW B of the Website event-truth P1+P3 diff (no code changes)

You are a reviewer, not a builder. Do not edit source. Branch `arc/event-truth-p1p3-review-b` (create it from
`origin/arc/event-truth-p1p3-fix`); the ONLY file you add is `docs/handover/event-truth-p1p3-review-b.md`. Never use
`gh api` in this repo (it stalls on a permission prompt): read everything with `git fetch` + `git show` / `git diff`.

## What to review
The merged Website tree = `origin/arc/event-truth-p1p3-fix` (572612e1) = guard slice (d956c90e) + UI slice
(ui-b 03fff9cf) + fix (7a75cb0e). Diff: `git diff origin/main...origin/arc/event-truth-p1p3-fix`, ignoring
`docs/handover/**` and `docs/session-handover-*`. Read the three handovers first (`docs/handover/event-truth-p1-ui.md`,
`docs/handover/event-truth-p1p3-fix.md`, and the guard handover on `origin/arc/event-truth-p1p3-guard-b`).

What the change claims: the event category is DERIVED from sessions by the admin DB (admin PR #780, migrations
20261115180000/190000); `src/lib/eventCategory.ts` is the one shared rule (byte-pinned, LF sha256 prefix a8d972e7);
the organiser create flow seeds the first session and NEVER sends `category`; organiser screens show the event type
from that rule; CI #70 (`scripts/check-event-truth-v1.mjs`) counts date-only sessions and gates `category_drift` at 0
with a parity fixture against the admin's derivation; `vite.chunks.ts` adds the `lib-event-rules` manual chunk
(londonDate + eventCategory) so /event stays on its 47-chunk pin.

## Look hardest at
1. Correctness against real prod data shapes: series with NULL category, ended/archived, festival, course with/without
   length, date-only sessions, sort_order -1 synthetic date-time rows (the admin excludes them; does the Website rule
   and the guard?), masterclass, more than 100 rows (API cap). Use the Supabase connector READ-ONLY for counts only.
2. Parity: does `eventCategory.ts` agree with admin #780's SQL derivation (`_series_programme_genres_v1` and the
   keep-if-agrees rule in `origin` of the admin repo branch `arc/event-truth-p1p2-fix-sql`: you may read it with
   `git ls-remote` + a shallow fetch of https://github.com/123constante/bachata-admin, read-only) on every shape?
3. The guard: can it report green without checking (fail-open on an RPC error, an empty payload, a renamed key)?
   Does it fail closed before #780 is applied (exit 2) and pass after?
4. Owner rules (C:/Users/ecual/.claude/CLAUDE.md is not readable to you; they are): the same fact reads the same on
   every screen from one shared mapping; no copy points at a control that is not on screen; every empty state says
   what the person can do; a control that cannot work is disabled with a reason; saving an untouched record sends
   nothing. Check each organiser screen this diff touches.
5. The chunk change: can `lib-event-rules` pull anything else into first load, and are the classifier bounds right?
6. Tests that cannot fail (vacuous assertions, mocks that echo the expectation).

## Output
`docs/handover/event-truth-p1p3-review-b.md`: verdict (ship / fix first), then findings ordered by severity, each with
file:line, a concrete failure scenario (inputs -> wrong output), and how you confirmed it (read, ran a test, prod
count). Say what you did NOT check. Commit, push `arc/event-truth-p1p3-review-b`, stop.
