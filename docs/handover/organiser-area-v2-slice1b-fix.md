# Handover: organiser area v2, slice 1b FIX round (PR #1511)

Branch `claude/organiser-area-v2-chooser`. Ticket dt_b97900bd0d32. Brief `docs/briefs/organiser-area-v2-slice1b-fix.md`
(brief branch, sha cf43752). origin/main (8931635, slice 1c #1512) merged in first (INVENTORY.md conflict: kept ours, then rewritten).

## Done (the five fixes)
0. `INVENTORY.md` rewritten for Team person, Team index, chooser, settings sheet + entry, flag gate. **Coverage 20 / 34**
   (the 14 not covered are untouched by the fixes). Written in the same session as the build, not strictly before it.
1. P3 Team: `team/Person.tsx` `personExplainer(kind)` = P3_ROLE_HELP (from TEAM_ROLES) on P3, R1 unchanged.
   `team/index.tsx` RolesCard (Owner, Manager, Door; Door aria-disabled + DOOR_NOT_OPEN) on P3 only.
2. Flag pair: `edit-in-place/teamRoles.ts` `p3RolesLive` (organiserP3 AND organiserSelfServe), the default in
   `EditInPlaceLayer.tsx`.
3. Tests: P5 openRequestCount 1 -> P3 Welcome via continueAsLanding (both files); P4 uses role 'manager' rows; P12 removed
   with a note (no interim seat exists, so P12 = the dancer-only cell); A5 now asserts no storage write; X1 measures 44px
   through the stylesheet class (tapHeight) and asserts Sign out.
4. `ContinueAsPage.tsx`: my_roles_v1 `retry: 1, retryDelay: 300`; `rolesSettled` waits while fetching. Tests: reject then
   succeed -> chooser (organiser + teacher), reject twice -> lands as today.
5. `p3/shell/P3Shell.tsx`: `AccountEntry` (44px, "Account") on the role strip's right edge, and a bar with only the entry
   when there is no strip (no page). Opens the existing SettingsSheet (lazy). Tested on Home, Events, Stats, You, Team,
   Team person x 0 / 1 page.
- Outside the file list, declared: `shared/teamModel.ts` re-exports TEAM_ROLES / P3_ROLE_HELP (so teamRoles.ts is not
  its own chunk, see below).

## Red on PR head / green after
New and changed tests vs the unfixed code: 23 failed / 47 passed (p3Roles 22, chooser race cell 1). The eventDay cells
pass on both: they correct the fixtures (P5, P4) and the rule was already right.

## OPEN: bundle-budget is RED (needs the next worker or the lead)
`check:bundle-budget`: chunk ratchet auth 26 vs 25 and dancer-app 48 vs 47; dancer-app 375.3 KB vs 374 KB.
- bae3e37 (main merged + slice 1b, no fix) builds at 25 / 47, so the extra chunk comes from this round.
- First cause found and fixed: teamRoles.ts became its own shared chunk; the teamModel re-export removes it, but auth stays 26.
- The extra first-load chunk on auth is `assets/paths-*.js` = organiser `shell/paths.ts` (ORG_PATHS), pulled in by
  `app/routes/catchall.tsx`. It used to be folded into another chunk.
- Reverting one file at a time does NOT bring it back to 25: P3Shell alone (26), Person + index alone (26), ContinueAsPage
  alone (26). The EditInPlaceLayer + teamRoles bisect was not valid (a stash undid the revert), so it is still untested.
- Next steps: revert EditInPlaceLayer.tsx + teamRoles.ts together WITHOUT stashing and build. If the count still does not drop, the cause
  is a mix of files: pin ORG_PATHS into a first-load group in `vite.chunks.ts` (as listImpressions was), or raise the
  allowance in `perf-budgets.json` with the measurement. Both files are outside this brief.

## Checks run locally (head = the final commit)
- tsc (`tsconfig.app.json`): 0 errors in branch files (the TeamPicker.test.tsx:306 error is old code that came from main).
- npm run lint: 34/34 links green (eslint is informational). Scoped eslint: EditInPlaceLayer.tsx 4 errors = base 4.
- check:mojibake clean. Related suites: 36 files / 1364 tests green. Full organiser + account + lib run: 382 files green.
- pre-ship: FAILS on bundle-budget (above); test:unit shows 15 network contract / integrityCouldNotRun failures, the same 15
  recorded on unchanged main; its typecheck ratchet reported 128 vs a baseline of 106 (not in branch files; not looked into).
- CI on 53f8442: bundle-budget failure, contract-check failure (not looked into), others green or still running.

## Not verified
Browser walk at 390x844 (no seeded sign-in in the sandbox); Vercel preview; independent review; admin-repo anchors.
