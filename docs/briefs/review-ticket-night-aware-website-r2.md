# Review round 2: S1a Website fix round 1 (PR #1523, branch claude/ticket-night-aware-website)

Brief-version: 1
Repo: Website. Review branch: `claude/review-ticket-night-aware-website-r2` (READ-ONLY: you change no source, you add one report file). Lane: careful, Fable reviews. You did not write this code and you are not the round-1 reviewer; do not trust the PR body.

## Target
Head e015802a of `claude/ticket-night-aware-website` against `main`. Round-1 report (FIX x3, notes N1-N5): `docs/review/ticket-night-aware-website.md` on branch `claude/review-ticket-night-aware-website`. Fix brief: `docs/briefs/ticket-night-aware-website-fix1.md` on `brief/ticket-night-aware-website`.

## Files
docs/review/ticket-night-aware-website-r2.md

## Check, in order (each finding: file:line, failing input, wrong output)
1. FIX-1: every "Choose a night" / "See the dates" / "Choose another night" control now reaches a real rendered night row or a real navigation, on a festival page and a weekly page (no `dates` tile). Nights listed are future, non-cancelled, full weekday names. Copy matches what is on screen. Does a tap on a night row set `?occurrenceId` and re-key the types read, the promo preview and the checkout body together?
2. FIX-2: block quiet bar and sticky bar agree for `needs_night`; no disabled labelled button.
3. FIX-3: new probe and sticky-bar tests exist; RUN the null-night mutant (probe fetching with null) and show it now fails. Run `npx vitest run src/modules/tickets src/modules/event-page`.
4. N1/N2 if done: correct, tested. Any regression to round-1 PASS items (body carries `occurrence_id`, v2 reads, five refusal copies).
5. UI by reading: taps >= 44px, no new fixed widths (390 wide), no raw Unicode punctuation (`npm run check:mojibake`), empty night list state actionable.

## Limits
Read-only on prod. No source edit, merge, approve, or push except the report. Say plainly what you could not verify (no browser walk).

## Hand-off
Verdict PASS / FIX (list) in `docs/review/ticket-night-aware-website-r2.md`; last commit subject ends with the worker-done marker.
