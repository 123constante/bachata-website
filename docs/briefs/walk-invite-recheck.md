# Brief: invite first-minute RE-WALK on main (report only)

Lane: normal, Sonnet. Branch: `claude/walk-invite-recheck-1` (spec already pushed there, off main after #1301 and #1294 merged). REPORT ONLY: no product code, no PR, no prod access, Supabase not queried. Every server answer is a `page.route` mock.

## Why
Owner goal: 10 real organisers claim a page and edit an event. The invite join screens had dead ends; #1301 fixed some. This walk lists what is STILL a dead end or a wording gap, ranked, so the program lead can pick fixes. Skip "wrong vs expired code" (row 12): it needs a server change and is known.

## What to run
`tests/e2e/walk-invite-recheck.spec.ts` (from the earlier walk `claude/walk-invite-first-minute`, 18 states). Run it in your sandbox EXACTLY like `tests/e2e/walk-fix-join-dead-ends.spec.ts` on `claude/walk-fix-join-dead-ends` was run: dev-server Chromium, 390x844, reduced motion (already set), wait for the heading text, never networkidle. Flags ON: `WALK_FLAGS=on VITE_ENABLE_ORGANISER_SELF_SERVE=true VITE_ENABLE_ORGANISER_P3=true npx playwright test tests/e2e/walk-invite-recheck.spec.ts --project=chromium --workers=1`. Then flags OFF for the states that differ.

## Hard rules (learned 2026-11-03)
1. The spec FAILS any state that shows the error card ("Something went wrong / We couldn't reach Bachata Calendar"). Do not weaken that. An earlier laptop run gave 9 false passes: every picture was the error card.
2. OPEN every picture yourself (read the PNG) before writing a word about it. A green test or DOM numbers alone is not a pass. Blank or error pictures = fix the harness (copy the waits and mocks from the walk-fix-join-dead-ends spec: heading wait, animations finished, full-page resize before the shot), then re-run.
3. Files to avoid editing: `src/modules/admin-organisers/join/**` (lead may touch it), anything ticketing or door, `claude/w3c-1-repeat`. Spec and docs only.
4. States 10-18 need the email box (`join-email-input`); if a state cannot be reached, say which and why, do not guess.

## Deliverable
`docs/walk/invite-recheck/RESULTS.md` plus pictures in `docs/walk/invite-recheck/{on,off}/`:
- per-state table: state, picture path, the words on screen (quoted), ONE next action? yes/no;
- what changed since the old RESULTS.md (`claude/walk-invite-first-minute`): fixed / still open / new;
- a ranked list of the remaining dead ends and wording gaps (worst first, max 8), each with a picture path;
- a "Not verified" block, honest.
Commit locally, PUSH ONCE (subject ends `[skip preview]`), do not add `run-ci`, no PR. Handover line `DONE [worker-done <ticket>]`.
