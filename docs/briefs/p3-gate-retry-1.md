# Brief: P3 gate retry (F-13 only): one count, edit screens open, the gate sheet at Save

Lane: normal. Suggested model: Opus (it changes a lock rule on two save screens). One worker, branch `claude/p3-gate-retry-1`. Push ONCE when coherent; never add `run-ci`; one independent review round (file-score rule), one fix round.
Source: `docs/design/p3-acceptance/FIXLIST.md` rows F-10 to F-13, each CHECKED AGAINST MAIN (8c60541c6; #1250 = `ecfe506fd`, #1236, #1208, #1304 merged). Owner goal: 10 real organisers claim a page and edit an event themselves.

## Rows: what is already fixed and what is left
- F-10 (create and organisers refusal with no way to act): FIXED on main. Create = `p3/new/CreateFlow` shared sheet (#1208, #1250); Organisers = shared sheet (#1236). NOT rebuilt here. Regression rows only.
- F-11 (ticket refusal says "try again" forever): FIXED by #1250 (`TypeSheet`, `TicketsEntry` go through `useGatedCopy`; `scripts/onboarding-write-doors.json` ticket doors moved to `gated`). NOT rebuilt here (the `scripts/` file is a hard-tier path: do not touch it). Regression rows only.
- F-12 (Repeat sheet opens the details sheet before Save): FIXED by #1250 (`gateRule.ts`, `useGateAnswer`, note `p3-repeat-held`). NOT rebuilt here. Regression rows only.
- F-13 (two different counts): STILL OPEN, and it is this brief's whole job. SKIPPED rows: none have an unanswered owner decision. F-13 follows the program lead's logged decision "F-13 b" (PROGRAM.md 2026-10-31 00:30Z; the owner may overturn it): leave the edit screens OPEN and show the gate sheet at Save.

## Files owned by this brief (`p3-page-scope-1` must not touch them)
`p3/screens/EditTray.tsx`, `shared/profileProgress.ts` (and its tests), `p3/screens/DetailsScreen.tsx`, `PricesScreen.tsx`. NOT touched: `graceModel.ts`, `gateModel.ts`, `OnboardingFlow.tsx`, `joinCopy.ts`, the join and redeem screens (another worker, dt_9589cd720c9b, edits them), `p3/data/home.ts`, `stats.ts`, `useOrganiserChoice.ts`, Home/Events/Stats screens (the page-scope brief), `scripts/**`, `supabase/**`, the admin repo, the calendar protected files, `claude/w3c-1-repeat`. Rebase on main first and check `git log -1 origin/main`.

## Step 0 (before any code): INVENTORY.md
Write `docs/design/p3-gate-retry-1/INVENTORY.md`: every place a person is told how many details are left, or is locked out of editing for unfinished details, in the admin app, the current Website (P3 and the old organiser area) and the public page, file:line each. Start from `p3/screens/EditTray.tsx` (`useEditLock` ~lines 18-25 combines `eventLock` and `profileLock`; the "N answers left" text ~lines 78-86), `shared/profileProgress.ts:47-70` (`my_profile_progress_v1`), `gateModel.ts:32` ("N things left" from `organiser_onboarding_status_v1`), `GraceBanner`, the Home banner, the checklist header, and `useSaveRun` (~line 32-50, which already routes a refusal through `useGatedCopy`). Search the sentences, not only the names. End with a coverage count: N rows found, N covered or explicitly left, none silently omitted.

## Prove the data source first (read-only; Supabase SELECT only, never a write)
1. What do `my_profile_progress_v1` ("answers left") and `organiser_onboarding_status_v1` ("things left") each count, and do they ever disagree (quote both bodies)? Counts only on prod: people for whom the two numbers differ.
2. When the gate flag is OFF (prod `gate_on=false` today) does the server refuse a Details or Prices save for an unfinished person? If not, the up-front lock today is a client-only rule, and removing it changes real behaviour: say so in the PR body.
3. Does `useSaveRun`'s gated refusal path open the shared sheet on Details and Prices today (test it: no new mapping, ONE `useGatedCopy`)?

## What to change (acceptance in words)
- ONE count on every screen that shows one: the organiser-onboarding "things left" from `organiser_onboarding_status_v1`. No "N answers left" anywhere in the P3 organiser area after this change.
- Details and Prices are no longer locked up front for unfinished details. The person can type and press Save. When the server refuses with `onboarding_incomplete`, the shared "A few details first" sheet opens (the existing `useGatedCopy`), what they typed is KEPT, and after finishing the details they come back to the event with the hold released (the #1304 return path). The event-closed lock (ended or archived events) stays as it is, with its reason.
- A person who is complete, an admin, and a person on a page with the gate OFF see no change.
- A manager or contributor who may not edit still sees the existing "Not yours" state; F-20 (manager rights) is out of scope.
- Out of scope: F-07 grace, F-08 end date, F-09 (done by #1304), F-14, anything in `supabase/**` or the admin repo, the join flow.

## Acceptance contract (every person type x every journey x every data shape, walked at 390x844)
Person types (P): P1 owner with an unfinished page; P2 owner with a finished page; P3 owner of two pages, one finished, one not; P4 admin; P5 manager; P6 contributor; P7 owner of an ended or archived event; P8 person with an unreadable status (read failed).
Journeys (J): J1 open Details and press Save with no change; J2 edit Details then Save; J3 open Prices and Save; J4 Save refused with `onboarding_incomplete` -> sheet -> Continue -> finish -> back at the event with the typing kept; J5 Not now (stay with the typing); J6 regression: create an event, change who runs it, tickets create / Add and sell / switch to selling, Repeat save (all refused, all open the shared sheet, no stray writes).
Data shapes (S): gate flag on / off; rows left 10 / 6 / 3 / 1 / 0; the two counts equal vs different; status read ok / failed / slow; event live / ended / archived; text typed before the refusal.
Rule: ONE table-driven vitest, each row (P, J, S) -> locked or open, the count text shown (exactly one source), the sheet shown or not, what was sent (an untouched Save sends NOTHING), and where each button goes. Every cell is covered or listed "cannot happen". No copy may point at a control that is not on screen; a control that cannot work is disabled with a reason. Red first: run the new rows against the unfixed code and show them failing.
Walk the cells that differ visually at 390x844 with route-mocked answers in the cloud sandbox like `walk-fix-join-dead-ends` (dev-server Chromium, reduced motion, heading wait); reuse the harness `tests/e2e/walk-invite-recheck.spec.ts` on `claude/walk-invite-recheck-1` (fails any error-card state). OPEN every picture yourself. State the coverage count P x J x S: N covered, N "cannot happen". An independent reviewer (a different worker) checks the pictures against this contract BEFORE the orchestrator walk; the owner's phone check is last.

## Standing rules (Website)
Prove the data source first. Zero bytes to the `/app` first load (`npm run check:bundle-budget` on main and branch); never edit `perf-budgets.json` or `vite.config.ts`. HTML entities over raw Unicode punctuation; British English. Source files over 2 KB go through `scripts/safe-edit.py`. Overlay geometry: sheets must not scroll the page (`focus({ preventScroll: true })`). PR body: run `pr-body.mjs` the moment the PR exists (label `- Shapes surveyed:`, Phone QA names 390x844). Report Verified / Not verified, honestly.
