# Handover: organiser area v2, slice 1b (chooser, event-day landing, X1, Team roles)

Branch `claude/organiser-area-v2-chooser`. Ticket dt_efda9feba54e. Brief sha 26691a7.

## Done
- `src/lib/accountRouting.ts`: `LIVE_TONIGHT`, `liveTonightIds` (same rule as homeModel attentionItems 'tonight';
  a parity test pins it), `eventDayLanding` over signInLanding. Teacher/DJ pages count as pages; one live page today =
  straight there; 2+ live pages = chooser with "Live tonight" on each; returnTo / restore / new-organiser untouched.
  Flag off = signInLanding's answer unchanged.
- `ContinueAsPage.tsx`: flag on = `ContinueAsLive` (reads organiser home + my_roles_v1, same cache keys); flag off =
  `ContinueAsToday` (no new reads, no new elements). Teacher and DJ entries open `/account/t` and `/account/dj`.
- Team (P3 only, `p3Roles = flags.organiserP3`): new `edit-in-place/teamRoles.ts` (TEAM_ROLES Owner/Manager/Door,
  `teamRoleDoor`); count line has no contributor; the picker offers Manager, shows Door DISABLED with its reason;
  no Contributor option. Flag off = today's picker. `TeamSheet.tsx` is NOT in the brief's file list -- needed for the
  picker options; declared here.
- X1: `SettingsSheet.tsx` has one Account block: Account settings (`/account/settings`), Help (support mailto),
  Sign out. 44px targets.
- Tests: `src/lib/__tests__/accountRouting.eventDay.test.ts` (28), `chooser.matrix.test.tsx` (17),
  `TeamPicker.test.tsx` (+6). Red on origin/main: 34 failed / 11 passed (the 11 = flag-off and unchanged cells).

## STOPS / left (lead to decide)
1. DB: there is no door seat. `entity_members.member_role` CHECK = owner, manager, contributor, ambassador
   (prod read 2026-11-09; organiser rows 20 owner / 43 manager / 0 contributor). Door is LISTED but cannot be added.
   Making it addable needs an admin migration + an add RPC that accepts it. Removing contributor from the DB is the
   separate admin migration the brief names.
2. X1 "reachable from every screen of the area" is NOT met: the settings sheet opens only from Home's GraceBanner and
   onboarding "Not you?". Needs an entry on P3Shell (e.g. on the slice-1a role strip) -- P3Shell is outside this
   brief's file list.
3. A6 regression snapshots of teacher/DJ/dancer Home: not written (this diff does not touch those Homes).
4. Admin column of INVENTORY.md is not file-anchored: `bachata-admin-11april` is not reachable from this session.
5. Walks 1-8 at 390x844: NOT run (no seeded sign-in in the cloud sandbox). Independent review: not done.
6. A teacher/DJ with no dancer profile and no organiser page keeps today's no-side landing (`/app/welcome`), not
   their area. Lead to decide if that is wanted.

## Checks run locally
tsc (`tsconfig.app.json`): 146 errors overall = the same count as origin/main; 0 new in branch files (the one hit in
TeamPicker.test.tsx:306 is pre-existing main code). npm run lint: 34/34 links green. check:mojibake,
check:integrity, lint:architecture, check:legacy-tables, check:legacy-program-rpcs, check:images (AUDIT_STRICT=1):
exit 0. test:unit: 15 failures in 4 files (eventViewCompat / occurrenceProgram / publicEventPageLineup contract
tests, integrityCouldNotRun) -- the same 15 slice 1a recorded on unchanged main; none touch this diff.
