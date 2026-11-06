# Brief: walk pictures pinned to head, continuation 1 (review fixes)
Brief-version: 2

Branch: claude/walk-pictures-pinned-to-head (ALREADY has the build at head 819c94df; continue on it, do not recreate). Normal lane, Sonnet, context cap 50%. One push. No workflow files. Hard tier (scripts/**): the PR still needs independent re-check and the owner Approve.

## Decisions
Independent review returned SAFE AFTER FIXES.

## What main lacks
- extends: a live-head argument on the verdict function. -- grep: liveHeadSha

## What to build
1. scripts/lib/walk-pictures-pin.mjs `picturesMatchVerdict`: add a REQUIRED `liveHeadSha` argument; return false unless `pictureSetValid(record, liveHeadSha).valid`; require `input.headSha` when the input is an object and compare it to liveHeadSha. Tests (red first): old record + old report while the live head moved must return false; missing liveHeadSha returns false.
2. Add to the module header comment: this module does not hash picture files on disk; the wiring step must hash the real files and compare with the record's sha256 values; until then it is not a freshness proof. (Do not build the wiring here.)
3. Entries carrying both `path` and `name` with different values are rejected; add a test row.
4. Fill the handover doc's CI-per-job line from the PR's checks after your push is NOT possible; say "read from the PR checks at head" and list what you ran locally.
5. Run `npx vitest run tests/walkPicturesPin.test.ts`, `npm run lint` link `check-script-conventions`, `npm run check:mojibake`. Update the PR body Verified / Not verified block.
6. Commit `fix(walk): picture pin takes the live head, rejects ambiguous entries [worker-done <ticket>]` and push ONCE.

## Files
- scripts/lib/walk-pictures-pin.mjs (new; already on the branch, edit it)
- tests/walkPicturesPin.test.ts (new; already on the branch, edit it)
- docs/handover/walk-pictures-pin-to-head.md (new; already on the branch, edit it)

## Done when
Each fix has a test that failed before; script-conventions green; one push.
