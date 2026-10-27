# Brief: P3 W2b CONTINUATION -- finish PR #1062 on branch `claude/p3-w2b-dates` (2026-10-27)

You continue a PARTIAL worker. Normal lane, no DB change. Read FIRST, in this order: (1) the original brief `docs/briefs/p3-w2b-dates.md` on branch `brief/p3-w2b-dates`; (2) the previous worker's handover on your branch: `docs/session-handover-2026-10-27-p3-w2b-dates.md`; (3) `docs/plans/ARC-p3.md` on branch `claude/p3-arc-plan` section 2 row W2b. Work on the existing branch `claude/p3-w2b-dates` (fetch it; do NOT start from main) and the existing PR #1062 (do not open another).

## Owner call recorded (the fork in the handover)
Keep the guard: organisers never delete a date (owner answer 20, `events/__tests__/moveNotRemove.matrix.test.ts`). "Remove this date" stays listed and always greyed with `DATE_WHY.noDelete` ("Cancel it instead"). Do not build `series.remove_date`.

## What is left (from the handover, in order)
1. Browser walk at 390x844, light + dark, every state in the original brief's matrix, W2a-spec style (`docs/handover/p3-w2a-walk/walk.phone.spec.ts.txt` on main; harness `playwright.phone.config.ts`, `tests/e2e-phone/`). MEASURE: taps under 44px, sideways scroll, clipped text, contrast; PNGs + `metrics.jsonl` into `docs/handover/p3-w2b-dates/`. Fix every red, do not just report it. Look at each PNG yourself.
2. Contrast rows in `p3/__tests__/p3Theme.contrast.test.ts` for the new `.p3-danger-t` text and the `.p3-in` input.
3. `docs/design/1062.md` with the "matches C3 / does not and why" table (use the deviations listed in the handover item 3), stages 2 and 4 (5 and 6 are the orchestrator's).
4. Run every CI job step locally (read `.github/workflows`; run `bash bin/check-integrity.sh`, `npm run pre-ship`; run the unit suite with `--maxWorkers=3` and in separate passes if memory kills it), then put the per-job table in the PR body.
5. PR body must contain a `## Verified on real data` block with EXACTLY the lines `- Shapes surveyed:`, `- Checks run:`, `- NOT verified:` (the CI check requires those headings). Include the previous worker's prod survey.
6. Close the two "assumed" items from the handover by reading code/prod read-only: that `runOccurrenceCommand`'s `new_version` is the DATE's version (read `occurrence_command_p5` / `apply_aggregate_write_p5` through the Supabase connector, read-only), and the cover upload path; state what you could not exercise.
7. Update the PR title: drop "-- PARTIAL" when done.

## Do NOT
Touch `/account/o`, calendar density-excluded files, the admin repo, or `.github/workflows`. No DB write. Do not widen scope (no per-date name/music/photos/price, sessions, "Copy changes", bulk cancel).

## Done =
PR #1062 updated and green-ready, handover in `docs/handover/p3-w2b-dates/README.md`, final commit subject ends with the done marker from your prompt (NOT `[skip preview]` on the final push). Stop at 50% context with a PARTIAL marker.
