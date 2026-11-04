# BRIEF: manager-full-edit-web (WEBSITE, BUILD-visual, small; normal lane; Sonnet, medium). Managers get FULL edit of the page and its events: remove the two Website gates that still treat a manager as read-only. NO admin change (proved below).

Brief-version: 2

Branch: `claude/manager-full-edit-web`. Push ONCE. Owner choice 2026-11-04 (PRIORITY-QUEUE.md "Owner choices answered": "Q6 manager rights: managers get FULL edit").

Context line: stay under 50% of your context; early checkpoint push, push + handover by 50%. Never approve/merge/--no-verify. Plain git only. Supabase READ-ONLY. No migration. Never ends a turn on a background task. Source files over 2 KB go through scripts/safe-edit.py / safe-write.py (read the hook message). Hard limits are at the end.

Read first: `src/modules/organiser/events/organisersModel.ts`, `SeriesOrganisers.tsx`, `src/modules/organiser/shared/ownership.ts`, `src/modules/profile/organiserEmptyState.ts`, `src/modules/organiser/shared/teamRules.ts` (the rules you must NOT change).

## Scope reading (said out loud so it is checkable)
"Full edit" = everything that edits the organiser page and its events. It does NOT include team control (who is on the team, role changes, hand-over, access-request decisions) or taking a DRAFT page live through onboarding: those are owner-only on purpose (interim-seat plan D3/D4/D6, `teamRules.ts`, `complete_organiser_onboarding_v1`) and the owner's Q6 answer did not name them. If website-44 hears otherwise from the owner, that is a separate brief.

## What main lacks (proofs read 2026-11-04: Website at origin/main 2b8831448, admin at origin/main f2b16a57, prod `stsdtacfauprzrdebmzg` SELECT-only)
- SERVER ALREADY ADMITS MANAGERS to every edit. Prod function bodies: `_assert_can_edit_series_p5` = `_is_entity_member('series', ..., ARRAY['owner','manager'])`; `_cmd_series_set_organisers_p5` = admin OR `ARRAY['owner','manager']`, with the comment "everyone on the event has full control (owner decision 2026-10-22)" (admin migration `20261202110000`, ER AD2 fix); `organiser_profile_update_p5_v1`, `organiser_set_occurrence_programme_v1`, `organiser_undo_last_change_v1`, `submit_organiser_profile_v1`, `confirm_organiser_contact_v1`, `organiser_team_set_public_v1` all admit `owner`+`manager`. Admin tests pin it (`tests/erAd2.db.test.ts`, `tests/a06ContributorSeriesEdit.test.ts`). So the admin half needs NO migration and NO brief.
- The `_is_entity_member(..., ARRAY['owner'])` arm in `admin_event_workspace_p5` is NOT a rights gap: it only strips the admin-internal keys `created_by, featured, promotion_touch_override` from the READ for non-owners (A58, ADR-004). Leave it. -- extends: (no file; proof only)
- WEBSITE GATE 1: the event's organisers list is read-only for a manager. `organisersOff` returns `MANAGER_REASON` ("Only the owner can change who runs this event.") unless `isOwner`, and `SeriesOrganisers.tsx:49` passes `isOwner: role === 'owner'`, so Remove, Link a page and Save are disabled for a manager although the server accepts the write. The file header says "Owner only (a manager sees the list read-only, with the reason)". Tests pin the stale rule: `sw1.parity.test.tsx` lines ~203 (`isOwner: false` -> `MANAGER_REASON`), ~596 (a manager reads the list with the owner-only reason) and ~604 (P3 two-organiser event, `['manager', MANAGER_REASON]`); `fixSw1.matrix.test.tsx:198`. -- extends: src/modules/organiser/events/organisersModel.ts, src/modules/organiser/events/SeriesOrganisers.tsx
- WEBSITE GATE 2: the public organiser page shows its "Just getting started / Complete your profile" prompt only to `facts.isOwner` (`organiserEmptyState`, `OrganiserProfile.tsx:1152`), although `ownership.canEdit` is true for a manager and the button just opens the same edit modal that `organiser_profile_update_p5_v1` accepts from a manager. A manager of a blank page sees the visitor's "no nights" box instead. -- extends: src/modules/profile/organiserEmptyState.ts, src/pages/OrganiserProfile.tsx
- Already correct (do not touch): `ownership.canEdit` (owner or manager), `homeView.ts:29`, `ticketModel.canManage` (owner or manager), the pencil/edit-in-place layer, the team gates in `teamRules.ts` and `More` (Hand over stays owner-only).
- Prod shape: 52 organiser pages have members; 33 of them have a manager and NO owner, 12 both; entity_members rows are 45 manager / 22 owner, but all 45 manager rows belong to ONE user (the platform's own account), so there is no real organiser manager to test with today; 166 series have an organiser with a manager; 6 series have two or more organisers.

## Files
- src/modules/organiser/events/organisersModel.ts
- src/modules/organiser/events/SeriesOrganisers.tsx
- src/modules/profile/organiserEmptyState.ts
- src/pages/OrganiserProfile.tsx (the one `isOwner: facts.isOwner` argument only)
- tests: src/modules/organiser/events/__tests__/sw1.parity.test.tsx, src/modules/organiser/events/__tests__/fixSw1.matrix.test.tsx, src/pages/__tests__/OrganiserProfileEmpty.matrix.test.tsx
- docs/handovers/manager-full-edit.md

Nothing else. NOT in scope and must not be touched (other briefs own them): `p3/screens/DetailsScreen.tsx`, `PricesScreen.tsx`, `p3/model/repeat.ts` (all-dates rule), any admin guard or guest notification (moving a date with guests). No `teamRules.ts`, `teamModel.ts`, `handover/*`, `onboarding/*`, `flows/fix/JoinRequest.tsx`, no route, flag, package or API change.

## What to build (tests first, red on main; say so)
1. `organisersOff({ lifecycle, canEdit, gate })`: rename `isOwner` to `canEdit` (true for owner or manager). The reason for a viewer with NO organiser seat (role null: an admin-less roster member or a stranger) stays a plain refusal; rename `MANAGER_REASON` to `NOT_ORGANISER_REASON` with the words "Only the people who run this event can change who runs it." (the only new string). Order unchanged: event lock first, then no-seat, then the AW1 parity gate.
2. `SeriesOrganisers.tsx`: `canEdit: role === 'owner' || role === 'manager'`. Update the header comment of `organisersModel.ts` ("Owner only (a manager sees the list read-only...)") to "Owner or manager".
3. `organiserEmptyState`: the input key `isOwner` becomes `canEdit`; the kind name `'owner-blank'` stays (no churn); `OrganiserProfile.tsx` passes `facts.canEdit`. Public copy unchanged.
4. Tests (red first, then green; give counts):
   - `organisersOff` table: lifecycle (live, ended, paused) x seat (owner, manager, none) x gate (on, off). Manager = same cells as owner (null on live with gate on; `GATE_REASON` with gate off); none = `NOT_ORGANISER_REASON`.
   - Screen rows: a manager of a one-organiser event sees no `org-off-reason`, Remove disabled only by the last-organiser rule, `org-add` enabled; a manager Adds a live page and Saves: exactly ONE `series.set_organisers` carrying the complete ordered list (the same assertion the owner row makes). P3 two-organiser row: `['manager', null]` now, `none` keeps the refusal.
   - A role x surface check that no other file in `src/modules/organiser/events` compares the role to `'owner'` for an edit control (a `git grep` test like `flagOff.test.ts` uses; the only allowed `=== 'owner'` hits are the team gates and Hand over, listed by path).
   - Empty-state matrix: add `canEdit` (owner, manager, visitor, contributor) x blank profile x events shape: owner and manager get `owner-blank`; visitor and contributor get `none`; every other cell unchanged (the existing cells all stay green).
5. `docs/handovers/manager-full-edit.md`: what changed (3 lines), red-then-green counts, the per-job table, Verified / Not verified.

## Real-data check (read-only on prod, counts only; paste in the handover)
Re-read before you finish: entity_members role counts, manager-only pages, and the five function bodies named above (that each still admits `ARRAY['owner','manager']`). Say plainly: no manager other than the platform account exists, so a real organiser-manager save was NOT exercised on prod.

## Run before you push (read `.github/workflows`; say the result of each)
`npx vitest run src/modules/organiser src/pages/__tests__/OrganiserProfileEmpty.matrix.test.tsx src/modules/profile`, `npx tsc --noEmit`, `npm run lint`, `npm run check:bundle-budget` after `npm run build` (a pure rename: expect no change; say so). Per-job table in the handover.

## Phone QA (orchestrator walks; the worker does not need a browser)
390x844 and 320x568, READ-ONLY on prod (no save): signed in as the platform account on a manager-only page it manages: event > organisers screen has Remove / Link a page enabled; a blank manager-only page shows "Complete your profile". Owner path unchanged. The save itself is proven by the unit row plus the server bodies above.

## Hard limits specific to this brief
- No change outside the Files. No admin or migration work. Owner-only team, hand-over, onboarding and access-request gates stay exactly as they are (their tests must pass unmodified).
- Flag state unchanged; no new dependency; HTML entities not raw Unicode in JSX.
- Do not touch the density-exempt calendar files.

## Done when
New rows red-then-green, the organiser, profile and page tests, tsc and lint green, one push, the handover has Verified / Not verified (Not verified: a real organiser-manager save on prod; a real phone). Then: orchestrator walk, pack by website-44, owner Approve/merge per the normal lane.
