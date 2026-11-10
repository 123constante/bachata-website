# Review: S1a Website side (PR #1523, branch claude/ticket-night-aware-website)

Brief-version: 1
Repo: Website. Review branch: `claude/review-ticket-night-aware-website` (READ-ONLY review: you change no source, you add one report file). Lane: careful, Fable reviews. You did not write this code; do not trust its PR body.

## Target
Head 7532b82e of `claude/ticket-night-aware-website` against `main`. Brief it was built from: `docs/briefs/ticket-night-aware-s1a-website.md` on `brief/ticket-night-aware-website`.

## Files
docs/review/ticket-night-aware-website.md

## Check, in order (each finding: file:line, failing input, wrong output)
1. Wire vs prod (read-only Supabase, counts only, no personal data): `ticket_types_public_v2` and `ticket_promo_preview_v2` argument names and result columns equal what the parser and the calls use. NULL `remaining` with no night, `sold_out`, `effective_close_at`, `kind`, `valid_from/to`.
2. Money path: a series-wide night type can never post to `ticket-checkout` without `occurrence_id`; the id sent is the night on screen, not a stale one (query key, navigation between nights, back from Stripe cancel keeps `?occurrenceId`). The promo preview prices the same night the checkout sends.
3. Each of the five refusals (`wrong_night`, `night_required`, `night_cancelled`, `night_ended`, `not_course_night`) has copy with a working way forward (the control exists and goes somewhere real). No dead end.
4. Sticky bar and block agree for: no night, sold-out night, past night, cancelled night, course ticket, mixed list. Full weekday names; HTML entities not raw punctuation; tap targets >= 44px; no sideways scroll at 390 wide (read the CSS/classes; say what you could not measure).
5. Gap safety: before the edge deploy the old edge ignores `occurrence_id`; confirm nothing here breaks a buyer in that gap.
6. Tests: do they fail against a mutant (drop `occurrence_id` from the body; keep the old query key; use v1 again)? Reason it out and, where you can run vitest, run it.

## Limits
Read-only on prod. No source edit, no merge, no approve, no push except the report to your review branch. Say plainly what you could not verify (no browser walk).

## Hand-off
Report verdict PASS / FIX (list) in `docs/review/ticket-night-aware-website.md`; last commit subject ends with the worker-done marker.
