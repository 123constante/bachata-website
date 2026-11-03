# Brief: walk the onboarding field rows the first walk skipped (docs + walk spec only)

Lane: normal, read-only walk. Model: Sonnet. Branch: claude/walk-onboarding-field-rows (claude/walk-* is claimed).
Why: docs/walk/invite-first-minute/RESULTS.md (branch claude/walk-invite-first-minute) never walked the field rows `instagram`, `dj_genres`, `teach_years`, `teach_levels`, `org_link`,
`dj_answer`, `teach_answer`, and never walked a SAVE. Simon (prod, 2 Nov) saw "the screen flashes for a bit and then nothing happens" on his Instagram save. PR #1272 (merged) now shows refusals.
We need to see, at 390x844, every one of these rows end to end, including the refusals.

## Cover (reuse the mocked-RPC approach of that walk; no prod write, Supabase read-only, no real invite)
For each row code in the Review checklist (read pageModel.ts reviewRow and personModel.ts for the exact list):
1. Entering the row from Review: what the screen says, what is typed, the Continue/Save control, the label of the button and where it goes.
2. A SUCCESSFUL save: what the person sees after (screen, toast, return to Review), taps from the row back to the checklist.
3. A REFUSED save for the Instagram row: invalid handle, a handle already taken by another profile (unique violation), a network failure; quote every message; flag any case where the screen flashes and shows nothing.
4. A slow save (response held 4 s): is there a pending state, is the button disabled, can the person double-tap.
5. Back to the event: is there any way back to the event the person came from (expected: no, see the first walk).

## Output (commit once)
docs/walk/onboarding-field-rows/RESULTS.md: one table row per code x case with picture path (docs/walk/onboarding-field-rows/*.png at 390x844), the words on screen, whether a single next action is named, and any silent failure. End with a ranked list of the 5 worst stops. No code fixes proposed. Say what is Not verified (mocked answers, not prod).

## Rules
git fetch origin main and verify `git merge-base HEAD origin/main` equals origin/main before the first push. Push once. Do not add run-ci.
