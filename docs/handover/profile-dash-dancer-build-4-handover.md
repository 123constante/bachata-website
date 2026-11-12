# Handover: dancer dashboard build, continuation 4 (admin 1534): fix red CI on PR #1577

Branch `claude/profile-dash-dancer-build`. No DB change, no `supabase/**`. `contract-check` untouched (red on main too).

## Done
1. **bundle-budget.** Cause of the 48th /app/* chunk: `src/lib/claimMyDancerProfile.ts` was auth-only; Home's claim card now imports it too, so Rollup split it into a shared chunk (found by diffing the manifest closure against a main build). Lazy-loading the card does NOT work (breaks the /app/* manifest key, documented in homeGoing.tsx; tried and reverted). So `chunkRatchet` dancer-app 47 -> 48, with a `//dancer-app-2026-11-12-claim-card` note. Event puller allowance 3 -> 2 (main still had 3). Local `npm run build` + `check:bundle-budget`: exit 0.
2. **build-smoke.** The strip button now has `profile-account-button` for a one-profile person and keeps `profile-switcher-button` for Switch (ProfileSwitcher.tsx). The build specs still assert no Switch; all 16 pass locally (`playwright.build.config.ts`). 4 vitest files that clicked the old id for one profile now match either id by regex.
3. **e2e-smoke.** `home-nights.spec.ts` asserts `home-main` and that the old tiles are absent. `account-settings.spec.ts` and `dancer-home.spec.ts:169` passed locally with no change (their failures were the strip testid / stale Home); Settings, Sign out and Delete account stay reachable.

## Verified
tsc (tsconfig.app.json): 0 errors in touched files. Vitest dancer-app + components + lib: 160 files pass. Mojibake clean. Playwright: home-nights, account-settings, dancer-home 27 passed 1 skipped; build specs 16 passed.

## Not verified
Remote CI after push; full `npm run pre-ship`; real-phone QA; PR body (no gh here).
