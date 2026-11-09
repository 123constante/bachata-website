# Handover: organiser area v2, slice 1c (Add a profile card)

Branch `claude/organiser-area-v2-addprofile`. Ticket dt_784c6dbc8ec8. PR #1512 (bot-opened on the first push; title and body set by the worker).

## Done
- INVENTORY.md (data source proved: my_roles_v1 body on prod; Tests coverage 12/12 anchored).
- `switch/addProfileModel.ts` (one model), `switch/AddProfileCard.tsx` (look B), wired in `switch/index.tsx` for P3 only.
- Toast words in `p3/model/labels.ts` `L.addProfile` (R1 copy guard bans "Undo" in switch/).
- Unit matrix `switch/__tests__/addProfile.matrix.test.tsx` (26 cells; 15 red against unwired code first).
- e2e `tests/e2e/p3-add-profile.spec.ts` (390x844, flowing clock, light + dark), added to `test:e2e:p3`.
- Independent review (1 round): HIGH fixed -- the toast drew behind the P3 frame (z 50 vs 60); now `OnBody` + `.p3-toast`.
- Bundle: dancer-app first load 373.1 KB / 47 files on main and branch.

## Left / next steps
- Admin column of INVENTORY: admin repo not reachable from cloud; lead to anchor.
- Real signed-in walk on seeded accounts (dancer-only, organiser-only, all-roles), screenshots onto the PR.
- Full `test:e2e` and `test:e2e:p3` runs in CI.
- Check what `/account/t` and `/account/dj` show an organiser-only person with no dancer profile (teacher/DJ hang off the dancer profile).
- P6 overlap: an unfinished dancer sees "Dancer" in Other pages AND as an add row (per brief); design record notes it.
