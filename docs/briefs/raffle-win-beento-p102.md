# Brief P102+P99: raffle winner never sees events they have been to (Website, flow fix)

Brief-version: 2
Size: 5 files, 300 lines. Design: none (no new screen; owner clicks 2026-11-27: reload after onboarding, remove silently).
Branch: `claude/raffle-win-beento-p102`. One PR. No switch (bug fix on the live raffle win page).

## What main lacks
- src/pages/RaffleWin.tsx: after ProfileSteps onDone (onboarding inside the win page) the pick list is NOT reloaded, so events that onboarding newly links as "been to" stay in the list and the lock later refuses them (P102). -- grep: reloadAfterProfile
- extends: A refused lock with reason already_been_to_event shows the banner "Our records say you have been to that event..." (model.ts LOCK_LINES). Owner: never show it; remove the event silently. -- grep: already_been_to_event
- src/modules/raffle-win/screens/HonestySheet.tsx:58 has a raw check mark `{'✓'}` in JSX, not an HTML entity (P99). -- grep: honesty-tick

## Files
- src/pages/RaffleWin.tsx (edit)
- src/modules/raffle-win/model.ts (edit)
- src/modules/raffle-win/pick/pickCopy.ts (edit)
- src/modules/raffle-win/screens/HonestySheet.tsx (edit; line 58 only)
- src/pages/__tests__/RaffleWin.beenTo.test.tsx (new)

## What to build
0. Write INVENTORY.md first (it exists in the repo: replace its body with this job's notes, do not ship it): every step of the win page (claim, won, pick, profile, honest, share, qr, error) and every lock refusal reason, each with file:line. Build only after it exists, and report the coverage count at the end.
1. Reload after onboarding. ProfileSteps onDone calls a new `reloadAfterProfile()` in RaffleWin.tsx: show the loading step, call `raffle_win_claim_link_v1` with the same token (read its body in the admin repo first, `c:/dev/bachata-admin-11april/supabase/migrations`, latest definition, and confirm a second call by the same user is read-only/idempotent; if it is not, STOP and report). On ok: replace `nights` with the fresh list. If the chosen night is still in the fresh list (same occurrenceId), go on to the honesty step exactly as today (keep `profileDone.current = true`, tick cleared). If it is gone, clear the selection and go back to pick with NO banner. If the fresh claim says another screen (screenForClaim), follow it like `claim` does. On error: keep today's behaviour (go to honest with the old night; the lock still guards).
2. Silent slip case. A lock refusal `already_been_to_event` removes the whole event from the list (applyRefusal already does) and shows NO banner. Delete the sentence "Our records say you have been to that event, so it is not open to you. Pick another." from the codebase (model.ts LOCK_LINES and pickCopy.ts); no user-visible text names it. Keep the other refusal lines and banners unchanged. Do not key refusals on line text if removing the line breaks `refusalKey`: carry the reason in the parseLock result instead.
3. P99: HonestySheet.tsx:58 `{'✓'}` -> `&#10003;`, and add `data-testid="honesty-tick"` to that span. Nothing else in the sheet changes.

Use HTML entities in JSX, never raw Unicode punctuation.

## Tests (new `src/pages/__tests__/RaffleWin.beenTo.test.tsx`, follow RaffleWin.test.tsx mocks)
- Profile done, fresh claim still has the chosen night -> honesty step, claim RPC called twice in total.
- Profile done, fresh claim lacks the chosen event -> pick step, that event gone, no banner text, selection cleared.
- Profile done, fresh claim errors -> honesty step with the old night (today's behaviour).
- Lock refusal already_been_to_event -> pick, event removed, no banner; spot_taken still shows its banner.
- No text "have been to that event" anywhere in the rendered page in any case; HonestySheet tick renders.
Run the new tests against the unfixed code first and say they fail. Existing raffle-win and RaffleWin tests stay green (update only lines that pinned the removed sentence).

## Prod shape
Winners arrive signed out (claim -> sign in -> claim) or signed in; profile complete or missing fields; open nights 0, 1 or many, several dates per event; series audience 'anyone' (needs_tick false) or new-only.

## Done
- Every CI job step that applies (read .github/workflows; at least test:unit for src/modules/raffle-win and src/pages/__tests__/RaffleWin*, typecheck, lint chain incl. check:mojibake) run, results in the PR body.
- PR body from the repo template, "Verified on real data" block filled, honest "Not verified" (no phone walk).
- Handover in PR body: head SHA, checks per job.
