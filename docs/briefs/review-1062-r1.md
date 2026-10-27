# Brief: independent review of PR #1062 (P3 W2b Dates) -- READ-ONLY, findings doc only

Repo 123constante/bachata-website. Review branch `claude/p3-w2b-dates` (head b37f588) against `main`. You did not build it. You write ONE file on branch `claude/review-1062-r1`: `docs/reviews/1062-r1.md`. No source edits, no tests added, no DB write (Supabase read-only, counts and function bodies only).

## Read
`git fetch origin claude/p3-w2b-dates` then `git diff origin/main...FETCH_HEAD --stat`, then the P3 files: `src/modules/organiser/p3/model/dates.ts`, `p3/data/dates.ts`, `p3/data/dateFacts.ts`, `p3/screens/DateSheet.tsx`, `AllDatesScreen.tsx`, `CancelEventSheet.tsx`, `shared/seriesCommands.ts` + `selfServeErrors.ts` changes, `docs/design/1062.md`. Plan of record: `docs/plans/ARC-p3.md` on branch `claude/p3-arc-plan`. Brief it was built from: `docs/briefs/p3-w2b-dates.md` and `p3-w2b-continuation.md` on `brief/p3-w2b-dates`.

## Judge (find real defects; do not restate the PR)
1. Does each date action's enable rule match what the prod handler really accepts? Read the prod function bodies (`_cmd_occurrence_cancel_p5`, move_date, set_time, set_override, skip/unskip, add/remove date) read-only and compare refusal conditions to `dateActions`. A greyed-but-allowed or enabled-but-refused case is a finding.
2. Versions and idempotency: date commands against the DATE version; series command after a date command re-reads the series version; the same key on retry; "put back to normal" composite (partial failure: what state is left, what does the user see?).
3. The never-delete guard (owner answer 20): confirm no code path sends `series.remove_date`.
4. One-off date opens the W2c `CancelEventSheet` and sends `series.cancel_one_off`; recurring uses `occurrence.cancel`. Any second mapping or second reason list?
5. Data honesty: "newest 100 of N", counts, filters, empty states that say what the person can do, copy that points at a control not on screen, British English / full weekday names.
6. Anything that breaks the flag-OFF guarantee (a P3 import in an always-loaded route; the old `/account/o` flows untouched).

## Output
Findings ranked most severe first, each: file:line, what is wrong, a concrete failing input, severity (blocks merge / fix before arc end / nit). Mark each CONFIRMED (you traced it) or PLAUSIBLE. End with a short "Not reviewed" list. Do not pad: zero findings is a valid answer if you checked each point above and say what you checked.

## Done =
Push `claude/review-1062-r1` once; final commit subject ends with the done marker from your prompt. Stop at 30% context with a PARTIAL marker.
