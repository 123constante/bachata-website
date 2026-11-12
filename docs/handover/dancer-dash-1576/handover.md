# Handover: dancer dashboard slice 1 (admin #1534), PR 1576

Branch `claude/profile-dash-dancer-build1`. No DB change. No organiser files touched. Design note and screenshots are in this folder (the isolation guard only allows docs under `docs/handover/`, so they are not under `docs/design/`).

## Done
- Option A Home + ClaimCard (earlier commit), raw-Unicode fix, Message us always on the claim card.
- All 10 failing test files updated for the new Home (removed assertions listed in `1576.md`); 2268 unit tests green.
- One-profile header reads "Account" (SwitcherGate), tested.
- Edit untouched table test (guard, passed on unchanged code, not red-first).
- Shape survey (counts only), 7 screenshots at 390x844, e2e spec `profile-dash-home.spec.ts` added to `test:e2e`, `home-nights.spec.ts` updated.

## Left
1. CI on the earlier push showed red: `contract-check`, `bundle-budget`, `dancer-area-isolation` (isolation fixed by moving docs; the other two not yet diagnosed, logs not readable from here).
2. `npm run pre-ship` result: see PR comment / Not verified below.
3. Delete unused PartnerTile / LineupPeople / NumbersTiles / HomeHero (cascades into rpc.ts, rpcContract, optionsAudit, goingHidden, e2e).
4. ember-walk and review-pack e2e still use retired Home test ids (not in the gate).
5. 3-role switch sheet and going-switch-on Home not walked.

tsc run on the pre-docs-move commit: 0 errors in branch files.

## Continuation (review-fix round, brief docs/briefs/profile-dash-dancer-fixes.md)

Done
1. bundle-budget: `claimMyDancerProfile.ts` and `myPersona.ts` pinned into `lib-event-rules` (vite.chunks.ts), ClaimCard moved to `claimCard.tsx`. Measured with the perf-budget.yml env: dancer-app 48 -> 46 first-load chunks, 374.3 KB (budget 376), 4 pullers (allowance 4). Chunk allowance tightened 47 -> 46 in perf-budgets.json (the ratchet blocks on UNDER). Tried lazy ClaimCard first: it made rollup drop the dancer-app entry from the manifest, so the pin route was used instead.
2. Claim copy: already_linked now has a "Show my page" button (reload); email_unproven reworded to point at the sign-up confirmation email plus the existing "Check again" button. Table test asserts a control for every status.
3. "Going" heading only renders when a going row exists.
4. Deleted PartnerTile, LineupPeople, NumbersTiles, HomeHero, GoingTileView, Ring and unused imports; tests that only covered them removed (homeFixPass, goingHidden, optionsAudit list).
5. Kickers are sentence case (no uppercase/tracking); checklist uses lucide Check/Circle icons.
6. Screenshots at 390x844 in this folder: home-unclaimed-initial, home-unclaimed (no_match), home-unclaimed-already-linked, home-unclaimed-ambiguous (plus refreshed others). e2e spec extended for both new claim shapes.

Not for this branch: `puller ratchet: event 2, allowance 3` UNDER still prints and makes `check:bundle-budget` exit 1. It is on main, in event files; left alone.

Verified: vitest src/modules/dancer-app + tests/client (all green); playwright profile-dash-home + home-nights (13 pass; one flaky first run of `home: new`/`unfinished` passed on rerun); `npm run build` + `check:bundle-budget` (only the event UNDER above) + `check:first-load-requests`; `check:mojibake`; eslint on touched files (0 errors); tsc 0 errors.
Not verified: 3-role switch sheet and going-switch-on Home walk (no harness fixture for 3 roles); ember-walk and review-pack e2e still use retired Home test ids (not in the gate); pre-ship not run; real-prod data shape survey not repeated this round (no data-shape change).

## Continuation (bundle-budget fix, brief docs/briefs/dancer-bundle-budget-fix.md)

Diagnosis (measured, bare `npm run build` + `npm run check:bundle-budget`, three builds):
- vendor-supabase is 57.3 KB gz on **main, the branch head and the branch with the pin removed** alike. The "+14.3 KB vs baseline 43 KB" line is informational: main prints it and still exits 0. The pin did not pull the supabase client anywhere (`rpcLoose` reaches it only through the lazy `getSupabase`).
- What actually made `check:bundle-budget` exit 1 was `PULLER RATCHET NOT TIGHTENED: event 2, allowance 3`. Main measures **3**, so this is branch-caused, not on main as the round above said. The pin reshapes Rollup's graph: on main `profileViewEmit` is its own entry importing `vendor-supabase` directly; on the branch its chunk imports only the client.ts chunk + lib-event-rules. Event chunk count stays 39.
- Removing the pin is worse: dancer-app goes back to 48 chunks (allowance 46, main 47).

Done
1. perf-budgets.json: event `pullerRatchet` 3 -> 2 (the win the guard asks to record), with a dated `//` note. Pin kept.
2. Cost noted: lib-event-rules +0.7 KB gz on every route; all routes stay under their KB budgets.

Verified: `npm run build`; `check:bundle-budget` exit 0 (all ok); `check:first-load-requests` 0; `check:chunk-cycles` 0; all three self-tests 0; `npm run lint` 34/34 links green (whole-tree eslint informational only); `npm run typecheck` 130 errors repo-wide, 0 in files this branch changes.
Not verified: Lighthouse / doc-weight jobs (need a preview deploy); contract-check (red on main from prod data drift, left alone as the brief says); no UI change this round, so no new phone walk.

## Unit red fix (dt_9ead4bae4fee, 2026-11-12)

CI job 131092739727 (head 7125522) had 2 failed test files:

1. `tests/chunkClassifier.test.ts`: this branch caused it. c7cfeb1 added `claimMyDancerProfile.ts` and `myPersona.ts` to
   `LIB_EVENT_RULES_MODULES` and did not update the test's pinned list. I added both, in the same order as
   `vite.chunks.ts`. The comment in `vite.chunks.ts` was already accurate, so I left it alone.
2. `src/modules/admin-organisers/join/__tests__/JoinGetPaidNext.test.tsx:174`: this branch did not cause it. The branch
   diff touches nothing under `src/modules/admin-organisers/` and nothing that file imports; it only changes dancer-app
   files, tests, `vite.chunks.ts`, `perf-budgets.json` and `package.json`. The test passed locally both on its own and
   in the full `test:unit:offline` run (Europe/London). The CI value was the URL from the step before
   (`?step=code&email=...`), so the test read the address before the effect that rewrites it had run: a timing race
   under CI load. Fix: the assertion now uses `waitFor` (timeout 4000), the same pattern this file already uses at
   line 150.

Verified: both files pass under TZ=Europe/London, Australia/Sydney and America/New_York (106 tests). The full
`TZ=Europe/London npm run test:unit:offline` gave 913/914 files passing; the one failure, `tests/integrityCouldNotRun.test.ts`,
is a sandbox problem (TypeScript resolves inside the temp repo under /tmp, which breaks the test's precondition) and does
not happen in CI. Typecheck (`tsc -p tsconfig.app.json`): 0 errors in the touched files. The total is 148 against the
pre-ship baseline of 106, because the branch is behind a force-updated main. That gap is not from this change. `check:mojibake`
is clean.

Not verified: the full suite under Sydney or New_York (I only ran the two touched files there); a fresh CI run.
contract-check red is prod-data drift on main and I did not touch it, as the brief says.
Next: if JoinGetPaidNext still flakes on CI, look at the other bare `where()` reads in that file.

## dancer-area-isolation red at ce98460 (ticket dt_0c20212efd23)

Reverted: `src/modules/admin-organisers/join/__tests__/JoinGetPaidNext.test.tsx` is back to `origin/main` (I ran
`git checkout origin/main -- <file>`). Why: `dancer-area-isolation` rule (a) fails any changed file outside
`src/modules/dancer-app/` that is not a seam. The `waitFor` edit from the previous unit fix was that kind of change.
Adding a seam is the lead's call, so I did not touch the allowlist.

After the revert, the main version of the file passed 5/5 on this branch (`npx vitest run <file>`, 45/45 tests each run),
so in this sandbox there is nothing branch-specific to fix inside `src/modules/dancer-app/`. The earlier CI failure at
line 174 (a bare `where()` read racing the effect that rewrites the address) looks like a pre-existing CI-load flake in a
main-owned file. If it comes back on CI, the lead should file the `waitFor` fix against main on its own.
`node scripts/check-dancer-area-isolation.mjs` after the commit: `dancer-area isolation: OK`.
tsc run on d67fc34 (pre-amend content): 0 errors in branch files touched by this unit (JoinGetPaidNext.test.tsx). check:mojibake clean.
