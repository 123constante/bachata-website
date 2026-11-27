# BRIEF: welcome-w1b-join-note (Website; BUILD visual-copy; normal lane; Sonnet)

Brief-version: 2
Owner decision 2026-11-10: the Ask-to-join note is REQUIRED everywhere, minimum 3 characters, one rule (Welcome contract cell J3.1, DRAFT 3). The public claim card already does this (#1516: `REQUEST_NOTE_MIN` and the disabled send button with a reason). The onboarding sheet still says "Who are you? (optional)" and lets an empty note through. Make the sheet follow the same rule. Branch `claude/welcome-w1b-join-note`. Zero migrations, no new component.

## What main lacks
- The onboarding Ask-to-join sheet requiring a note -- grep: REQUEST_NOTE_MIN in src/modules/organiser/home/onboarding/OrganiserSheet.tsx (absent on main)

## What to do (in order)
1. Read the public card's rule in `src/modules/organiser/shared/components/PublicClaimCard.tsx` (`REQUEST_NOTE_MIN` line 50, `noteTooShort` line ~246, the reason line ~350). Import and reuse `REQUEST_NOTE_MIN` (do not copy the number).
2. In `src/modules/organiser/home/onboarding/OrganiserSheet.tsx` (request task, the `Who are you?` field at ~line 233): drop "(optional)" from the label; disable the send button while `note.trim().length < REQUEST_NOTE_MIN` AND show the reason line under the field in the same words as the public card ("Add a few words about who you are (at least 3 characters) to send your request."), so a disabled control always says why. Keep the 500-character limit. An untouched sheet sends nothing.
3. Check `request(task.org)` in the same file cannot be reached with a short note by another path (Enter key, double tap, the focus-return flow): guard inside `request` too.
4. Add `src/modules/organiser/home/onboarding/__tests__/OrganiserSheet.note.test.tsx` (new): table-driven over note values ``, `  `, `ab`, `abc`, `  abc  `, a 500-char string, a 501-char string: send button disabled or enabled, reason line shown or not, and the request RPC called or not. Red first (run it before the source change).
5. Update only the existing tests that assert the old optional behaviour (`dancerFirst.refusal.test.tsx` renders this sheet: check it). Say in the PR which tests changed and why.
6. `npm run test:unit`, `npm run lint`, `npm run pre-ship`; per-job CI table in the PR body. Walk the sheet at 390x844 (`preview-deploy.mjs`, screenshot on the PR): empty, 2 chars, 3 chars, error from the server.

## Verified on real data (PR block)
Read-only prod count (project `stsdtacfauprzrdebmzg`, counts only, no personal data): how many existing access requests have an empty note, to show what the old rule allowed. Never any write.

## Not in scope
The server (no migration; if the request RPC accepts an empty note, say so in the PR as a parked W2 item), other copy, the public card.

## Files
- `src/modules/organiser/home/onboarding/OrganiserSheet.tsx`
- `src/modules/organiser/home/onboarding/__tests__/OrganiserSheet.note.test.tsx` (new test)
- `src/modules/organiser/shared/__tests__/dancerFirst.refusal.test.tsx`
