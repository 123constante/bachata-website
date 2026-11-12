# Brief: dancer dashboard build, continuation 4 (admin #1534), FIX RED CI on PR #1577

Lane normal. Branch `claude/profile-dash-dancer-build`, PR #1577. No DB change, no `supabase/**`. Read first: `docs/handover/profile-dash-dancer-build-3-handover.md` and `profile-dash-dancer-build.md`; original brief on `brief/profile-dash-dancer-build`.
Continuation 3 left four remote jobs red at head 4185a12; logs were not read. I read them. Fix these in branch files, nothing else. Do NOT touch `contract-check` (red on main too: DB P5 time drift, 51 rows; not ours).

## 1. bundle-budget (scripts/check-bundle-budget.mjs, perf-budgets.json)
- `chunk ratchet: dancer-app (/app/*)` 48 first-load chunks, allowance 47. Find which new lazy chunk the build added (ProfileSwitcher/SwitcherGate/Add-profile/Account sheets, claim card). Merge it into an existing chunk (do not lazy-import small sheets; import them statically into the strip) so the count returns to 47. Raise the allowance only if you cannot, and say what bought it.
- `puller ratchet: event (/event/:id)` now 2 direct vendor-supabase pullers, allowance 3: a recorded WIN. Lower the allowance to 2 in perf-budgets.json in this PR (check first that it is not already lower on main).
- Run `npm run build` then `npm run check:bundle-budget` locally; if the build does not finish in the sandbox, say so and rely on the remote job.

## 2. build-smoke (tests/e2e-build/)
Four specs fail: `account-edges.build.spec.ts` lines 31, 67, 162 and `dancer-app-routing.build.spec.ts:52`. They expect `getByTestId('profile-switcher-button')` count 0 (a one-profile dancer has no Switch), got 1. By the design, one profile shows an "Account" button, which is allowed: decide which is true. If the strip button is the same testid for Account and Switch, give the Account variant its own testid (`profile-account-button`) so "no Switch" stays assertable, and keep those specs asserting the Switch is absent. Do not delete the assertions.

## 3. e2e-smoke (tests/e2e/, in `npm run test:e2e`)
7 failures: `dancer-app/home-nights.spec.ts:84` (4 shapes; `home-hero` is gone with the calm Home: assert the main card testid instead), `account-settings.spec.ts:64` (`settings-signout` not visible) and `:75` (`delete-type-input` not visible), `dancer-home.spec.ts:169` (organiser gate flow). Run each spec with Playwright locally on the touched specs (`npx playwright test <spec> --project=chromium`), find whether the cause is the stale testid or the real UI (e.g. settings now behind the Account sheet): if the UI broke a journey, fix the UI; if the spec is stale, update it to the new path. Same test for every one: would a real dancer still reach Settings, Sign out and Delete account from the new Home? They must.

## Rules
Table-driven where you add tests. Contrast >= 4.5, taps >= 44px. Put the per-job CI table in the PR body, with Verified / Not verified. Push once, early enough that the remote jobs finish; update the PR body. Handover to `docs/handover/profile-dash-dancer-build-4-handover.md` (NOT docs/briefs).
