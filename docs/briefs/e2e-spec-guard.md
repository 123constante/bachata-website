# Brief: e2e spec-list guard (item 1 of 4, e2e audit 2026-11-12)

Lane: careful (touches scripts/ and CI). Class: GUARD-CI. One PR. Branch: claude/e2e-spec-guard.

## Four lines
1. Who for: the owner (sole dev). A green e2e tick must mean every spec we wrote ran.
2. After: adding a spec to `tests/e2e/` without listing it in `test:e2e` (or marking it manual) turns CI red.
3. How we know: red-first proof (guard fails on a deliberately unlisted spec, passes once fixed) + before/after table of which specs run in CI.
4. Scope: guard only. Do NOT change which specs run, add secrets, or edit playwright configs.

## Problem (measured 2026-11-12)
`package.json` `test:e2e` is a hand-typed list of 15 filenames. 5 of 20 specs in `tests/e2e/` are outside it:
organiser-real-rpc, organiser-launch-walk, organiser-edit-save-bar.real-supabase,
organiser-public-claim.real-supabase, vendor-city-real-supabase.
Re-measure on current main before building; do not trust this list.

## Build
- New `scripts/check-e2e-spec-coverage.mjs`. Read `scripts/check-script-conventions.mjs` (six rules) FIRST.
- Every `tests/e2e/*.spec.ts` must be either in the `test:e2e` list, or in an explicit manual allow-list inside the script with a one-line reason and the command that runs it (e.g. `test:e2e:organiser-real-rpc`). An allow-list entry for a file that no longer exists also fails.
- Wire it as an npm script and into the right existing workflow (check `.github/workflows/architecture-guard.yml`; it does NOT run eslint). Never pin a check count in prose.
- Unit test (table-driven): listed spec passes; allow-listed passes; unlisted fails; stale allow-list entry fails; spec in a subfolder/helpers ignored.
- Red first: show the guard failing on a throwaway unlisted spec, then passing.

## Acceptance contract
Person: owner. Journey: dev adds `tests/e2e/foo.spec.ts` and pushes. Data shape: 20 specs now, 15 listed, 5 manual.
CI goes red naming `foo.spec.ts` and says to list it or allow-list it. Existing 20 specs pass the guard on main.

## Not in scope
Making the 5 manual specs run in CI (item 2 decides that after finding why they skip).

## Hand-off
PR body: per-job CI table, Verified / Not verified, before/after spec table. Independent review before owner sees it.
