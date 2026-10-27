# Brief: ROUND 2 review of the fixes to PR #1068 (P3 W2d Sessions and line-up) -- READ-ONLY, findings doc only

Repo 123constante/bachata-website. Review branch `claude/p3-w2d-sessions-lineup` (head c8cf040 (after fix round 1: commits 5128718 and c8cf040)) against `main`. You did not build it. You write ONE file on branch `claude/review-1068-r2`: `docs/reviews/1068-r2.md`. No source edits, no tests added, no DB write (Supabase read-only, counts and function bodies only, no personal data).

## Read
`git fetch origin claude/p3-w2d-sessions-lineup` then `git diff origin/main...FETCH_HEAD --stat`, then the P3 files: `src/modules/organiser/p3/model/programme.ts`, `p3/data/sessions.ts`, `p3/screens/SessionSheet.tsx`, `LineupSheet.tsx`, the Sessions rows and per-date rows added to `EventPage.tsx` / `DateSheet.tsx`, `shared/selfServeErrors.ts` change, `docs/design/1068.md`, `docs/session-handover-2026-10-27-p3-w2d.md`. Brief it was built from: `docs/briefs/p3-w2d-sessions-lineup.md` on `brief/p3-w2d-sessions-lineup`. Plan of record: `docs/plans/ARC-p3.md` on branch `claude/p3-arc-plan` (section 2 row W2d).

## Judge (find real defects; do not restate the PR)
1. Every date (`series.set_program`): is the WHOLE programme sent and `expected_version` set? Read the prod function bodies read-only (`_owner_program_problem_p5`, the series.set_program handler in `series_command_p5`) and compare their refusal conditions to `model/programme.ts`: a greyed-but-allowed or enabled-but-refused case is a finding. Is the gate the existing `parityGate.ts` `AW1_APPLIED` with no second gate?
2. Just this date (`organiser_set_occurrence_programme_v1`): COMPLETE date programme sent with people_add / people_remove against the date's programme version? Refused on cancelled, past, multi-day, ended dates: greyed with a reason?
3. Data loss: can a stale read overwrite a concurrent change; does removing an item with per-date overrides get refused with plain copy; does an untouched save send nothing; does retry reuse the idempotency key.
4. #25 empty-session fix: a named session with no time or nobody on it saves and renders. Also the new-item-with-empty-title case the PR says is unproven on prod: read the validator and say whether the client can send it and what the server does.
5. Line-up: search via `organiser_search_people_v1` (no performer role there: what does the UI do for performers?), the `mc` row read-only, removeall wording and confirm.
6. Festivals read-only with "Ask us"; the derived kind word not a picker; one level mapping, one kind mapping (no second copy).
7. Honesty and copy: no copy pointing at a control not on screen, empty states say what the person can do, British English, full weekday names, HTML entities.
8. Flag-OFF guarantee: no P3 import in an always-loaded route; old `/account/o` flows untouched; the diff is only W2d files (no foreign PNGs rewritten).

## Output
Findings ranked most severe first, each: file:line, what is wrong, a concrete failing input, severity (blocks merge / fix before arc end / nit). Mark each CONFIRMED (you traced it) or PLAUSIBLE. End with a short "Not reviewed" list. Do not pad: zero findings is a valid answer if you checked each point above and say what you checked.

## Done =
Push `claude/review-1068-r2` once; final commit subject ends with the done marker from your prompt. Stop at 30% context with a PARTIAL marker.

## ROUND 2 scope (read this first)
Round 1 (`docs/reviews/1068-r1.md` on `claude/review-1068-r1`) found: typed edits lost on refetch; nameless NEW session saves on Every date; idempotency key vs version; 5 nits. The fix commit 5128718 and docs commit c8cf040 claim to fix all 8 (table in `docs/design/1068.md` "Review round 1"). Fixes are unreviewed code. Review ONLY `git diff c60588e..c8cf040` first: for each r1 finding, is it actually fixed, and does the fix add a new defect (stale-version key reuse after a refusal, edit state reset when it should keep, a new session name rule that blocks a legal case, a line-up re-add that duplicates a person, scope-switch clearing silently losing input)? Do the new tests fail against the c60588e code (red first)? Then spot-check the 8 judge points above only where the fix touched them. Zero findings is valid.
