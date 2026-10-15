# Handover: site-nav-top (DONE)

Code change in 44e58c8 (see PR body). This pass: phone spec run (10/10 pass after), same spec on main (10/10 fail, as designed: main has the bottom bar), screenshots in after/ and before/, production build (prerendered page served statically) measured at 390x844 and 360x780 (prod-*.png).
Spec fix: Raffles is flag-gated off in prod, so the row has 3 targets (Organisers, Venues, Community); the spec accepts 3 or 4.
Not verified: fixed full-height layers still reported touching the bottom on the prod page (likely background layers, not inspected); lighthouse, e2e-smoke, seo/og.

## Merge with main (2026-10-15, worker dt_6851d920e6cf)

Merge commit of `origin/main` (2260d46, #759 + 9a8351cf + 865bd82b) into this branch; no rebase, no force-push.

**What conflicted.** `src/components/AppChrome.tsx` and `src/components/BottomNav.tsx`.
- AppChrome: main wrapped header/spacer/footer/bottom spacer/BottomNav in `!ownChrome` (the closed `/app` area draws its own chrome). Kept all of that, but the nav is now the top row: `{!ownChrome && <BottomNav />}` directly under the 60px header spacer; the 64px bottom spacer and the `isHome` md-only spacer are gone. Only `h-[env(safe-area-inset-bottom)]` remains at the end (0 px on devices without an inset), also `!ownChrome`.
- BottomNav: kept #761's sticky 46px top row (row 44px); dropped main's 61px row / 2px orange line (they existed only to match the old bottom spacer).
- Merged without conflict: 865bd82b storage change in these files stays.

**Bottom-bar math made right for the new layout** (grep 124 / 64px / spacer / safe-area):
- `src/index.css` `.route-shell`: was `100vh - 124px` (60 header + 64 nav); now `100vh - 106px` on phones (60 + 46 top row) and `100vh - 60px` from md up (row is md:hidden), minus the safe-area inset. Comment in `app/InitialVisiblePageTransition.tsx` updated.
- `.home-map-fill` already used 106px (from #761).
- `tests/e2e-phone/small-queue-gaps.phone.spec.ts`: the "gap above the BottomNav" check now measures the gap to the viewport bottom (nothing is fixed there). `organiser-name-city-create.phone.spec.ts`: dropped the "under the BottomNav at full scroll" assertion (a control scrolled under a TOP sticky row is ordinary scrolling).
- `src/modules/dancer-app/**` and routing untouched.

**Measured (production build, fake Supabase, /organisers):** 390x844 and 360x780: header 60px + row 46px = 106px (< 120); `scrollWidth == viewport width`; no `position:fixed` element touching the bottom half's bottom edge; at full scroll the document bottom gap = 0 (the footer has its own 20px padding inside it, not a strip).

**Screenshots:** re-taken into `after/` (home, event, festival, organisers, account-save at 390x844 and 360x780) from `site-nav-top.phone.spec.ts` with `SHOT_DIR` (phone config, fake-Supabase fixtures). `after/app-signed-out-390x844.png`: signed out, `/app` redirects to the public `/auth?mode=signin&returnTo=/app` page (main's #759 behaviour, unchanged by this merge), so that page shows the public top row like every public page; the dancer app's own chrome is not rendered signed-out. Signed-in `/app` not walked (no session in the sandbox).

## CI run in the worker sandbox

| Job / step | Command | Exit | Result |
|---|---|---|---|
| typecheck | `npm run typecheck` | 2 | 96 errors, identical count on origin/main (sandbox env, none in touched files) |
| unit | `npm run test:unit` | 1 | 15 failed / 8053 passed: live-DB contract tests (no DB access), `integrityCouldNotRun`, plan-hygiene; none touch this change |
| lint chain | `npm run lint` | 1 | 15 of 16 links pass; `check:integrity` exit 126 = script not executable in the sandbox; `bash bin/check-integrity.sh` => ok (0 issues) |
| build | `npm run build` | 0 | pass |
| build (CI, fake Supabase) | CI-style `npm run build` | 0 | pass |
| build-smoke | `playwright test --config playwright.build.config.ts` | 0 | 3 passed |
| phone-qa (full) | `playwright test --config playwright.phone.config.ts` | 0 | first full run: 172 passed, 74 skipped, 12 failed (gaps spec + 2 organiser-create cases, the two specs fixed above); re-run of site-nav-top (10), organiser-name-city-create, organiser-save-bar, small-queue-gaps: all pass |

Not run: GitHub Actions, Lighthouse, e2e-smoke, seo/og, DB contract checks (no Docker / DB). The full phone suite was not re-run end to end after the two spec fixes.
