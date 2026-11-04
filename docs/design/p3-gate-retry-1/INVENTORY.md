# INVENTORY: every "how many details are left" and every unfinished-details lock (F-13)

Brief `p3-gate-retry-1` step 0. Read on main `8c60541` (2026-11-04). Searched by name AND by sentence
(`answers left`, `answer left`, `things left`, `thing left`, `To finish:`, `to do.`, `Finish your profiles first`,
`Complete your profile`, `Required to publish`, `profileLock(`, `requiredLeftText(`, `thingsLeft(`,
`thingsLeftText(`, `onboardingLeft(`). Sources: **A** = `my_profile_progress_v1` (`required_left`, "N answers
left"); **B** = `organiser_onboarding_status_v1` (`_onboarding_missing_v1`, "N things left"); **C** =
`series_go_live_check_v1` (event go-live gaps, a third, event-level question).

## Data source proof (prod `stsdtacfauprzrdebmzg`, read-only SELECT, 2026-11-04)

- **A** counts `_profile_progress_p5` steps with `required && !done` (+ teacher / DJ go-live keys). **B** counts
  `_onboarding_missing_v1(user, org)`: 7 dancer codes, teach / DJ answer codes, organiser logo / links / ...
  Different definitions. Over the 66 (person, organiser page) member pairs on prod: **60 differ, 6 equal**;
  10 pairs are A-"publish ready" (no lock) but B-"things left" > 0; **0** pairs are B-complete but A-locked;
  55 pairs were A-locked up front on Details / Prices.
- **Gate flag**: `is_feature_enabled('organiser_onboarding_gate')` = **true** on prod today (the brief said
  false; re-read 2026-11-04). `series_command_p5` (the Details / Prices door) calls
  `_require_onboarding_complete_v1(_command_target_organisers_p5(env))` first; flag OFF -> it returns at once.
  `series_command_p5` reads neither profile progress nor `publish_ready`: **the old up-front lock was a
  client-only rule** in every case. With the flag ON an unfinished person is now refused at Save (and the sheet
  opens) instead of locked at open; with the flag OFF they can now SAVE (real behaviour change, said in the PR).
- `useSaveRun` (EditTray.tsx ~line 108-125) already routes every refusal through ONE `useGatedCopy`; no new
  mapping added. Proven by `gateRetry.matrix.test.tsx` (sheet opens for the screen's path, no error line).

## Rows (file:line on main 8c60541 -> what this PR does)

| # | Where | Surface | Text / lock | Source | This PR |
|---|---|---|---|---|---|
| 1 | `p3/screens/EditTray.tsx:77-84` `useEditLock` | P3 Details + Prices | up-front lock "Finish your profiles first, N answers left" | A | **REMOVED** (only the event-closed lock remains) |
| 2 | `shared/profileProgress.ts:65-68` `profileLock` | read by #1 and #13 | reason text | A | left (old area still uses it, #13); P3 no longer calls it |
| 3 | `p3/screens/DetailsScreen.tsx:84-89` | P3 Details | lock box + "Complete your profile" link | A | link **REMOVED**; box shows only the closed reason |
| 4 | `p3/screens/PricesScreen.tsx:45-50` | P3 Prices | same | A | link **REMOVED**; same |
| 5 | `p3/onboarding/gateModel.ts:32` | P3 gate sheet ("A few details first") | "N things left" + rows | B | kept: THE one count |
| 6 | `p3/screens/GraceBanner.tsx:67` | P3 Home banner | "N things left" | B | kept |
| 7 | `p3/onboarding/pageModel.ts:401,404` | P3 checklist header | "N things left", "N to do.", "Nothing left to do." | B | kept |
| 8 | `p3/you/youRows.ts:38` + `YouScreen.tsx:103` | P3 You tab page row | "To finish: N things left" | B | kept |
| 9 | `p3/screens/EditTray.tsx:108-125` `useSaveRun` | P3 Details / Prices Save | refusal -> sheet | B (server) | kept; now also returns `gated`, the screens keep the typing |
| 10 | `page/index.tsx:36` | old organiser area, My page | `toFinish` "To finish: N things left" | B | left: not P3 |
| 11 | `page/index.tsx:48` | old organiser area, My page | "Required to publish: N answers left" | A | left: not P3 (old area; out of scope) |
| 12 | `home/ProfileButton.tsx:18` | old organiser Home | "N answers left. Needed before your events can go live." | A | left: not P3 |
| 13 | `events/ProfileLock.tsx:28-30` (used by `events/Details.tsx`, `OneEvent.tsx`, `LifecycleActions.tsx`, `ProgrammeSeries.tsx`, `flows/add/AddFlow.tsx`, `flows/fix/CoverFlow.tsx`, `dates/index.tsx`) | old organiser area edit screens | up-front lock, "Finish your profiles first, N answers left" | A | left: old area, not P3 (brief scope: "no N answers left in the P3 organiser area") |
| 14 | `wizard/LevelTrack.tsx:33` | profile wizard | "N answers left" | A | left: the wizard IS the answers list, its own question |
| 15 | `shared/goLiveCheck.ts:49` `profileRowLabel` (via `events/lifecycleModel.ts:73`) | old area go-live list | "Finish your profile (N answers left)" | A | left: not P3 |
| 16 | `events/LifecycleActions.tsx:21,71` | old area go-live | "N things left", "Finish the N things above first" | C | left: event gaps, not details |
| 17 | `jobs/homeJobs.ts:142` | old area Home jobs | "N things left" | C | left: event gaps |
| 18 | `home/onboarding/golive/goLiveModel.ts:138,171` | old area go-live flow | "<event> has N things left" | C | left: event gaps |
| 19 | `areas/home/areaStatus.ts:46,79` (`AccountAreasRow`, `YourAreasPage`, `RoleAreaPage`, `RoleProfilePage`) | account areas (dancer side) | "N answers left" | A | left: account areas, not the P3 organiser area |
| 20 | public event page (`src/modules/event-page/**`) | public | none found (no count, no lock) | - | nothing to do |
| 21 | admin app (`bachata-admin-11april`) | admin | NOT inspected: repo not attached to this session | - | **Not verified** |

Coverage: **21 rows found**; 5 changed (1, 3, 4, 9 and 2's P3 caller), 5 kept as THE one count (5-9), 10
explicitly left with a reason (10-19), 1 nothing to do (20), 1 not inspected (21). None silently omitted.

After this PR, `grep -rn "answers\? left\|requiredLeftText\|profileLock" src/modules/organiser/p3` finds only a
comment in `EditTray.tsx` (the history note) - no P3 screen shows source A.
