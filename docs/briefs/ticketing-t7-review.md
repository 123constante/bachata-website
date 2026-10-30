# Brief: T7 independent review of the P3 ticketing fix-1 and fix-2, plus bundle re-measure -- READ-ONLY

Repo 123constante/bachata-website. Branch `claude/review-ticketing-t7`. Review lane, Opus, read-only: write ONE file `docs/review/ticketing-t7-r1.md`. No source edits, no deploy, no DB write (Supabase read-only, counts and function bodies only, no personal data).

## Why
Scoping item T7 (`docs/scoping/ticket-followups-2026-10-30.md` on branch `claude/scope-ticket-followups`): the code of fix-1 and fix-2 on the P3 ticketing screens was never independently reviewed. Build order says this comes before any new P3 ticketing code.

## Read first
`docs/handover/p3-wt-ticketing.md` (fix 1, fix 2), `docs/handover/p3-wt-fix3.md`, and the code in `src/modules/organiser/p3/tickets/` (`TicketsEntry.tsx`, `TypeSheet.tsx`, `RefundSheet.tsx`, `GetPaid.tsx`, `model.ts`, `data.ts`) on `main`. Note: open PR #1165 (branch `claude/tickets-retire-old-screens`) edits the same folder; review `main` and say where #1165 changes the answer.

## Judge (find real defects)
1. Correctness of fix-1 and fix-2 against their handover descriptions: each claim in the handover, is it true in the code? Name any claim that is not.
2. Money and refund paths: can a refund be double-submitted, sent for the wrong order, or shown as done when the server refused? Table of states x shapes (paid, unpaid, refunded, zero tickets, 100+ tickets).
3. Open items from fix-3: R6 (toast outside the dialog), toasts over the tall sheet's Close, N1 (late refused rename names the typed name). Confirm each still happens on `main`, with file:line.
4. Bundle: re-measure the `/app` chunk against `perf-budgets.json` on `main` (the doc says 373.7 against 374 KB). State the measured number and the command used; say whether the allowance can be lowered or the item is resolved.
5. `phone-qa` 25-minute timeout: say what in the workflow causes it, from the workflow files, no guess.

## Output
Findings ranked most severe first, each: file:line, what is wrong, a concrete failing input, severity (blocks go-live / fix before go-live / nit); CONFIRMED (traced) or PLAUSIBLE. End with "Not reviewed". Zero findings is valid if you say what you checked.

## Done =
Push `claude/review-ticketing-t7` once; final commit subject ends with [worker-done ticketing-t7]. Stop at 30% context with a PARTIAL marker.
