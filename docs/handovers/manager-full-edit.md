# Handover: manager-full-edit-web (ticket dt_40791b3776f5)

## What changed
- `organisersOff` takes `canEdit` (owner or manager) instead of `isOwner`; `MANAGER_REASON` is now `NOT_ORGANISER_REASON` ("Only the people who run this event can change who runs it.") and applies to a viewer with no seat. `SeriesOrganisers.tsx` passes `role === 'owner' || role === 'manager'`.
- `organiserEmptyState` input `isOwner` -> `canEdit`; kind `'owner-blank'` unchanged; `OrganiserProfile.tsx` passes `facts.canEdit`.
- No admin, migration, team, hand-over or onboarding change.

## Red then green
- Tests first, run on unchanged code: 20 failed (organisersOff table, 3 manager screen rows, role x surface guard, empty-state manager row, rename).
- After the change: `vitest run src/modules/organiser src/pages/__tests__/OrganiserProfileEmpty.matrix.test.tsx src/modules/profile` 224 files, 8459 passed / 0 failed / 2 skipped.
- New: organisersOff table (lifecycle x seat x gate = 18 + wording), manager one-organiser row, manager Add+Save row (exactly ONE `series.set_organisers`), P3 `['manager', null]`, `managerEditSurface.test.ts` (grep guard), 4 empty-state rows (manager, contributor).

## Per-job table (local)
| Check | Result |
|---|---|
| vitest (organiser, profile, empty matrix) | pass |
| `tsc --noEmit` | pass |
| `npm run lint` | 24 of 24 links green (eslint informational WARN, red on main) |
| `npm run build` + `check:bundle-budget` | pass, no change (pure rename) |
| `check:mojibake` | pass |

## Real-data check (prod `stsdtacfauprzrdebmzg`, SELECT only, 2026-11-04)
- entity_members: 45 manager / 22 owner (as the brief).
- `_assert_can_edit_series_p5`, `_cmd_series_set_organisers_p5`, `organiser_profile_update_p5_v1`, `organiser_set_occurrence_programme_v1`, `organiser_undo_last_change_v1` bodies each still contain `ARRAY['owner','manager']`.
- No manager other than the platform account exists, so a real organiser-manager save was NOT exercised on prod.

## Verified / Not verified
- Verified: unit rows above, server bodies admit managers, build/budget unchanged.
- Not verified: a real organiser-manager save on prod; a real phone (390x844 / 320x568 walk is the orchestrator's); `submit_organiser_profile_v1`, `confirm_organiser_contact_v1`, `organiser_team_set_public_v1` bodies not re-read this run.
