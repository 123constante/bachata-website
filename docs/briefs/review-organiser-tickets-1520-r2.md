# Review round 2 (delta): Website PR #1520 at head 4de9a894

Brief-version: 1
Repo: Website. Review branch `claude/review-organiser-tickets-1520-r2` (READ-ONLY: no source edit, one report file). Fable reviews. You are not the round-1 reviewer and not the builder.

## Target
Head 4de9a894 of `claude/organiser-area-v2-tickets` (round-1 head 7debc56). Round-1 report (HOLD: F1 blocker, F2-F7): `docs/reviews/1520-r1.md` on branch `claude/review-organiser-tickets-1520`. Fix brief: `docs/briefs/organiser-area-v2-tickets-fix1.md` on `brief/organiser-area-v2-tickets`. Delta: `git diff 7debc56 4de9a894`.

## Files
docs/review/organiser-tickets-1520-r2.md

## Check
1. F1: a manager on a paid order now sees "Ask the owner to refund this order." in the REAL read shape (rows from `ORDER_SELECT_COUNTS`, no pence). Run the round-1 proof test shape against the new head; run a mutant that gates the note on `refundable` (needs pence) again and show it fails.
2. F2: removing `owner &&` at GetPaid MoneySoFar now fails a test (run the mutant).
3. F3: a manager's summary parse drops every `*_pence` field before caching (test + mutant). PR body says the server still sends pence until Part B.
4. F4: one 8-char order code mapping used in list, refund sheet and toast. F5 note placement, F6 `money` prop required, F7 dead alias removed.
5. No regression: `npx vitest run src/modules/organiser src/modules/tickets` green; owner paths unchanged (owner still sees money, refund button, CSV); flags off = no change.
6. State plainly what you could not verify (no 390x844 walk; Part B not live).

## Hand-off
Verdict PASS / FIX in `docs/review/organiser-tickets-1520-r2.md`; it must name "PR #1520" and "head 4de9a894". Last commit subject ends with the worker-done marker.
