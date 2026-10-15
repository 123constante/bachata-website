# Handover: home-page announcement banner (ships OFF)

## What changed
- `src/lib/homeAnnounceBanner.ts`: `HOME_ANNOUNCE_BANNER_ON = false`, text, CTA, href, storage key.
- `src/components/HomeAnnounceBanner.tsx`: banner; `enabled` prop is a test seam, default is the constant.
- `src/pages/Index.tsx`: two lines (import + `<HomeAnnounceBanner />` above `HomeClockProvider`).
- `src/components/HomeAnnounceBanner.test.tsx` (6 unit tests), `tests/e2e-phone/announce-banner.phone.spec.ts`.

## Decisions
- Sign-up link: `/auth?mode=signup&userType=dancer` (Auth.tsx reads `mode`, `userType`; not edited).
- Banner renders only after mount (reads localStorage in an effect), so SSR/hydration match; OFF renders null.
- Colours: `bg-primary` / `text-primary-foreground` (black on orange); CTA is black on orange, white text.
- Phone spec bundles the component with esbuild and flips ON via the prop, styled with the PRODUCTION css
  from `npm run build` (the real page cannot show it while OFF). Needs a prior `npm run build`.
- Mounted only in Index, so not on other pages or `/app`.

## Red-first
On `main` the component and constant do not exist: the unit file fails at import resolution
(`Failed to resolve import "./HomeAnnounceBanner"`). Not run as a separate pre-change execution; stated honestly.

## Shapes surveyed
No data is read by this banner; no Supabase query was made.

## Catch-up (merge of main + CI fixes)
- Merged origin/main (10693f7) cleanly. It carried a new `check-dancer-area-isolation.mjs`; re-run: OK ("not a dancer-area PR: rule c only"), so the 5 old violations are gone with no code or allowlist change.
- phone-qa root cause: the spec read its CSS from `build/client/assets/root-*.css`, but the phone-qa job runs no `npm run build`, so it threw there (it passed locally only because a build existed). Fixed the SPEC (not the component): it now fetches `/src/index.css?direct` from the dev server the suite runs. Verified with `build/` deleted.
- phone-qa-section / real-data-verified: `PR-BODY.md` next to this file; the orchestrator copies it into the PR.

## CI per job
| job / step | command | exit | result |
|---|---|---|---|
| dancer-area-isolation | `node scripts/check-dancer-area-isolation.mjs` | 0 | OK |
| phone-qa (banner spec, no build dir) | `playwright test -c playwright.phone.config.ts announce-banner` | 0 | 4 passed (390x844 + 360x640, ON + OFF) |
| phone-qa-section | `check-pr-phone-qa.mjs` on PR-BODY.md | 0 | OK |
| real-data-verified | `check-pr-real-data-verified.mjs` on PR-BODY.md | 0 | OK |
| unit (banner) | `npx vitest run src/components/HomeAnnounceBanner.test.tsx` | 0 | 6 passed |
| typecheck | `npm run typecheck` | nonzero | 96 errors, below the 106 baseline in pre-ship.mjs; none in banner files |
| eslint (banner files) | `npx eslint` | 0 | clean |
| prod build | `npm run build` | 0 | built |

Not run: full unit suite in 3 timezones, full lint chain, integrity, build-smoke (not re-run after merge; earlier run on the old head had sandbox/network-only failures in live-DB contract tests). Billing annotations are not code failures.

## Not verified
Real phone; full-page home with banner ON; contrast by tool; the jobs listed under "Not run"; full phone suite beyond the announce-banner spec.

## Left
Flip `HOME_ANNOUNCE_BANNER_ON` to true for the last wave.
