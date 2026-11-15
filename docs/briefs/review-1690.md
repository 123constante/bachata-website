# Brief: independent review of PR #1690 (defect-escape-weekly)

Review only. Do not edit product code, do not open a PR, do not merge.

Target: PR #1690, branch `claude/defect-escape-weekly`, head `ff6bca7879f160434d9b476ac571e9bfd7a46734`.
Fetch it: `git fetch origin claude/defect-escape-weekly` then `git diff origin/main...FETCH_HEAD`.

Check:
1. `scripts/defect-escape.mjs` is git-only (no network, no secrets), matches the metric frozen in its header (fix/revert/hotfix commit within 7 days after a non-fix commit in the same top-level area; merged = first-parent commits in window), and cannot throw on an empty window.
2. `tests/defectEscape.test.ts` covers positive, negative, empty window, and a non-vacuity mutant that really fails when the parser is mutated. Run it: `npx vitest run tests/defectEscape.test.ts`.
3. The edit in `scripts/prove-entry-point-dispatch.mjs` only adds the new script to a TARGETS list and changes nothing else.
4. No edit under `.github/`, no secrets, no migration.

Output: write `docs/review/1690-r1.md` on a NEW branch `claude/review-1690-r1` (from `main`) and push it. The file must contain exactly one line `## Verdict: PASS` or `## Verdict: PASS WITH NITS` or `## Verdict: BLOCK`, and the text `head ff6bca7879f160434d9b476ac571e9bfd7a46734`. Then a short findings list with file:line. End the final commit subject with `[worker-done <ticket>]` as your prompt says.
