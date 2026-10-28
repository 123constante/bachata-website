# Brief: W3c-1 Repeat, FIX ROUND 1 (continuation on claude/w3c-1-repeat, PR #1122)
Builder: Opus. Lane careful. This is the ONE fix round (stopping rule: after it, orchestrator walk). Context cap 30%; push an early checkpoint (subject ends [skip preview]); final commit subject ends "[worker-done <ticket>]"; update docs/handovers/w3c-1-repeat.md.

Read the independent review first: `git fetch origin claude/review-w3c-1-repeat` then `git show FETCH_HEAD:docs/review/w3c-1-repeat.md` (Fable, verdict FIX FIRST). Re-read the original brief `git show origin/brief/w3c-1-repeat:docs/briefs/w3c-1-repeat.md`. The branch already exists with your predecessor's work; continue on it (git fetch origin claude/w3c-1-repeat, check it out, do not rebase away history).

## Do exactly these (review finding numbers)
- F2 BLOCK: Save must stay DISABLED after a FAILED dry run (error answer, also a thrown offline fetch). Save waits for a good answer; "Check again" is the way on. RED FIRST: add the two probe cases (rpc answers permission_denied; rpc throws TypeError('Failed to fetch')) to repeat.send.test.tsx, commit red against the unfixed sheet, then fix.
- F3: two new sentences in REPEAT_FAIL, matched in repeatFailure BEFORE the shared selfServeErrors copy: "end.date must not be before the start date" -> "Pick a last date on or after the first date."; "end.date needs a start date no earlier than 12 months ago" -> "This event started more than a year ago, so a last date can't be set here. Choose Stops after a number of times, or ask the Bachata Calendar team." Pre-check the first in repeatProblem when the workspace carries the anchor (COALESCE(default_start_date, created_at)). Matrix rows for both. Leave selfServeErrors.ts:254 untouched.
- F4: the dry-run preview gets its own offline/failed line ("... so the dates could not be checked. Check your connection, then tap Check again."), never the save-offline sentence.
- F5: restore the 26 unrelated screenshots: `git checkout origin/main -- docs/handover/dancer-rebuild-w2a docs/handover/dancer-rebuild-w2b docs/handover/dancer-rebuild-w2d docs/handover/dancer-rebuild-w2e`, commit. Never commit e2e screenshot churn again (run the e2e suite last and `git checkout` those dirs before committing).
- F6: route the one-command save through the same sendOnce / idempotency pattern the Status sheet uses (key from draftSig), so a retry after a dropped connection reuses the key. Test it.
- F7: on a course the disabled editor's button must not read "Nothing changed yet" (use "Can't change here" or hide it). F9: anchor the course_needs_count match as `invalid_transition: course_needs_count`.
- F8 and F10: no change (F10 is a separate baseline PR, not W3c-1).
- Do NOT edit the PR body; the orchestrator does it. Do not widen scope (no First date, no leave guard, no Undo, no Make a copy).

## Definition of done
Tests table-driven and updated; run every CI job step you can in the sandbox and list the per-job table in docs/handovers/w3c-1-repeat.md; `npm run check:bundle-budget` still adds 0 bytes to /app; same hard limits (Supabase read-only, no merge/approve, no --no-verify, plain git, no gh api).
