# BRIEF: welcome-w1b-join-note-fix (Website; fix round 1 on PR #1527; normal lane; Sonnet)

Brief-version: 2
Fix round for PR #1527, branch `claude/welcome-w1b-join-note` (push to the SAME branch, one push). Independent review: `docs/review/review-1527-r1.md` on branch `claude/review-1527-r1` (verdict PASS-with-fixes). Read it first; findings 1 to 5 are yours.

## What main lacks
- The textarea tied to its requirement line for screen readers -- grep: aria-describedby in src/modules/organiser/home/onboarding/OrganiserSheet.tsx on the textarea (absent on main)

## What to do (in order)
1. F1 (blocks merge): fill the PR body: no `TO FILL`; changed-files list; per-job CI table; "Verified on real data" (read-only prod count of access requests with an empty note, counts only, no personal data, no writes); "Not verified". Do the 390x844 walk with `preview-deploy.mjs` (states: empty, 2 characters, 3 characters, server error) and attach the screenshots to the PR.
2. F2: the "501 characters" test case does not test `maxLength` (jsdom ignores it on `fireEvent.change`). Assert the field's `maxLength` attribute equals 500 instead, and rename the case to say so.
3. F3: add cases to the table test: three spaces (disabled) and a padded short note like ` a ` (disabled). Run before and after removing `.trim()` from the source to see it fail first.
4. F4: the "Enter" step does nothing (no form, no key handler). Either remove it or test the guard inside `request` directly (call the exported handler or trigger it through the real path with a short note and assert zero RPC calls). Prove red by removing the guard.
5. F5: add `aria-describedby` on the textarea pointing at the reason line, as well as on the button. Add an assertion for it.
6. `npm run test:unit`, `npm run lint`, `npm run pre-ship`. No other change; do not touch the public card or the server.

## Files
- `src/modules/organiser/home/onboarding/OrganiserSheet.tsx`
- `src/modules/organiser/home/onboarding/__tests__/OrganiserSheet.note.test.tsx` (new on the PR branch)
