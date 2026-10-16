# Account settings screens: handover (Phase F PR 2, Website)

Branch `claude/account-settings-screens`. Brief: `docs/briefs/account-settings-screens.md` on `arc/briefs-account-lifecycle`.

## What was built
- `/account/settings` (home): sign out, change email, download my data, hide/show dancer profile, link to Account ownership.
- `/account/settings/ownership` -> "Delete account" -> `/account/settings/delete`: what is lost, download-first offer, hide-instead link, type `DELETE` (exact, case-sensitive) -> erase. Blocked states: sole organiser owner (names the pages, says add another owner or remove the page), admin account (short message), check failed (retry, erase stays disabled). A late 409 from the edge function switches to the same blocked reading.
- `/account/deleted`: public confirmation page after erase.
- Entry points: dancer home link + "profile hidden" banner (`DancerHome`), organiser account menu item (`OrganiserHomeDancer`), link on the Finish-profile screen so an unfinished profile is never trapped.
- Gate: `isDancerGatedPath` leaves `/account/settings*` and `/account/deleted` open; `AccountSettings.tsx` has no dancer-first gate (a test asserts it).

## Files
`src/lib/accountSettings.ts` (typed wrappers via `rpcLoose`, the one `eraseCheckFact` reading, export download, `account-erase` outcome mapping), `src/hooks/useMyProfileVisibility.ts` (own row `is_active`, via the persona resolver), `src/pages/AccountSettings.tsx`, `src/pages/AccountDeleted.tsx`, routes in `AnimatedRoutes.tsx` + `catchallClientPaths.ts`, breadcrumb ids in `siteIa.ts`. Tests: `src/lib/__tests__/accountSettings.test.ts`, `src/pages/__tests__/AccountSettings.test.tsx` (profile state x role matrix), `tests/e2e/account-settings.spec.ts` (added to `test:e2e`).

## Decisions / things to know
- Interfaces are exactly the pinned ones; generated types file untouched. When types regen, delete the `rpcLoose` casts.
- Read-only prod check: `_my_dancer_profile_id_v1` ignores `is_active`, so a hidden profile still resolves (the banner/toggle can read it). Archived rows do not resolve (shown as "no profile").
- Settings routes are NOT behind `flags.organiserSelfServe` (an account right); the only entries are inside pages that are.
- Email change shows the pending state from `user.new_email` (or just-sent), "check both inboxes".
- After `ok:true`: `signOut()` errors ignored, query cache cleared, route to `/account/deleted`.
- E2E screenshots come out blank in this cloud harness (the existing dancer-home spec's do too), so no pixels were inspected; layout evidence is DOM-measured only.

## Verified
- Unit/matrix: new suites 50 tests; whole `src/{pages,components,lib,hooks,modules}` run 4184 passed. New tests were first run with the implementation missing (both files failed to load), then pass.
- Playwright (CI env vars, mocked auth/RPC/edge function), 390x844 and 390x600: settings home reachable with an unfinished profile; every control in the content column >= 44px; no horizontal scroll; DELETE gate; sole-owner blocked; hide/show; erase -> deleted page; media_delete_failed; no-persona. Existing `dancer-home.spec.ts` still 14/14.
- Local: `npm run lint` chain all green except `check:integrity` exit 126 (script not executable here; `bash bin/check-integrity.sh` = ok); eslint on touched files 0 errors; `check:mojibake`, `check:rpc-typing`, `check:route-boundaries`, build, `check:bundle-budget`, `check:first-load-requests` ok. `tsc` has 96 errors both with and without this change (none in touched files).

## Not verified
Real RPC / edge-function responses (all mocked); real email confirmation; real file download on a phone; the real `account-erase` status/body shapes beyond the brief; visual pixels (blank screenshots); the full CI job list was not replayed step by step (perf-budget, live-qa, seo and DB-contract jobs need network/secrets); Phone QA section is filled from DOM measurements only.
