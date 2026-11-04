# BRIEF: door-camera-nits-1 (Website; normal lane; Sonnet; UI/copy only)

Brief-version: 2

Walk of PR #1317 (docs/walk/p3-batch-1/RESULTS.md) found three NITs on the ticket Door screen (flag organiserTicketing, OFF in prod). Pictures under `docs/walk/p3-batch-1/door/pics/` (denied-android-0-steps, none-0, failed-0, ask-1-after-start).

## What main lacks
- numbered steps: the blocked-camera steps (Android / iPhone / in-app) read as loose lines; render them as an ordered list with visible numbers 1-4 -- src/modules/organiser/p3/door/DoorScreen.tsx, src/modules/organiser/p3/door/door.css
- a "Try the camera again" button when the camera state is none or failed (today only blocked has it): on the Scan tab, and the list-tab line points to it -- src/modules/organiser/p3/door/DoorScreen.tsx, src/modules/organiser/p3/door/model.ts
- the "N of M in" pill must not sit on top of the live camera feed: move it above the feed or give the feed its own box -- src/modules/organiser/p3/door/door.css
- tests: table over camera states (ask, granted, denied x 3 user agents, none, failed, unknown): numbered steps present for denied, Try again present for denied/none/failed and absent for ask/granted, retry calls getUserMedia once -- src/modules/organiser/p3/door/__tests__/door.cameraHelp.matrix.test.tsx

## Files
- src/modules/organiser/p3/door/DoorScreen.tsx
- src/modules/organiser/p3/door/door.css
- src/modules/organiser/p3/door/model.ts
- src/modules/organiser/p3/door/__tests__/door.cameraHelp.matrix.test.tsx
- docs/handover/door-camera-nits-1.md

## What to build
1. Red first: add the new matrix cells; run on main, keep the red output in the handover.
2. Implement the three NITs. Tap targets 44px (explicit px, the site root font is ~13.5px). Keep camera.ts logic and the permissions-policy header untouched.
3. Run: `npm run lint`, `vitest run src/modules/organiser`, `npm run check:integrity`, `npm run check:mojibake`, `npm run check:bundle-budget`. Mojibake regexes with \u escapes.
4. PR body: real-data lines (shapes = camera states x user agents) and Phone QA lines (390x844; Walked: matrix only; Not verified: real phone permission sheet).
5. Push once; last commit subject ends `[worker-done <ticket>]`. No walk (the lead walks).
