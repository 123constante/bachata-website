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

## CI per job
| step | command | exit | result |
|---|---|---|---|
| unit (new) | `npx vitest run src/components/HomeAnnounceBanner.test.tsx` | 0 | 6 passed |
| typecheck | `npx tsc --noEmit` | 0 | clean |
| eslint (my files) | `npx eslint <4 files>` | 0 | clean |
| prod build | `npm run build` | 0 | built; banner chunk in Index |
| phone spec | `playwright test -c playwright.phone.config.ts announce-banner` | 0 | 4 passed (390x844 + 360x640, ON + OFF) |
| lint chain | `npm run lint` | 1 | 15/16 links PASS; `check:integrity` exit 126 (script not executable in sandbox), eslint link skipped by chain |
| unit (all) | `npm run test:unit` | 1 | 15 failed / 8069 passed: all in `eventViewCompat`, `occurrenceProgram`, `publicEventPageLineup` (live-DB contract tests, no network) and `integrityCouldNotRun` (sandbox); none touch this change |

Not run: other workflows (live/prod/Vercel/DB-contract need network or secrets).

## Not verified
Real phone; screenshots at 390x844 / 360x780 (spec measures CTA and Dismiss height >= 44, no horizontal overflow, instead; viewport is 360x640 not 360x780); contrast not measured by tool (black on orange primary); sandbox-failing tests listed above; the full home page ON (page-level layout) was not rendered, only the banner in a harness.

## Left
Flip `HOME_ANNOUNCE_BANNER_ON` to true for the last wave.
