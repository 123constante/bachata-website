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
