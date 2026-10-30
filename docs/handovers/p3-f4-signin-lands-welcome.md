# Handover: F4 -- sign-in lands a new organiser on Welcome

Brief: `docs/briefs/p3-f4-signin-lands-welcome.md` (branch `brief/p3-f4-signin-lands-welcome`).
Branch: `claude/p3-f4-signin-lands-welcome`. Class: BUILD-visual (routing only). No PR opened
by the worker; the sections below are written to paste into the PR body.

## What changed

A brand-new organiser (organiser-type sign-up, **no organiser membership so no page**, no open
access request) now lands on P3's Welcome `/account/p3/start`, but only while the P3 area is live
(`organiserP3` AND `organiserSelfServe`, the same pair `AnimatedRoutes` mounts `/account/p3/*` on).
The flag stays OFF; nothing is switched on.

- **One mapping**: `newOrganiserLanding(p3Live)` in `src/lib/auth-otp-routing.ts`
  (P3 live -> `/account/p3/start`, else `/account/o`). Both new-organiser landings read it:
  - sign-UP (no returnTo): `landingPathAfterAuth` gains `organiserP3`; `AuthCallback` passes `flags.organiserP3`.
  - sign-IN: `/account/continue` (`ContinueAsPage`) passes `newOrganiserTo: newOrganiserLanding(p3Live)`
    into `signInLanding` (`lib/accountRouting`), which uses it ONLY in its two new-organiser
    branches (dancer done -> straight there; dancer unfinished -> `/app/welcome?returnTo=<it>`).
    Absent = `/account/o`, exactly as before. `p3Live` is a prop from `AnimatedRoutes`.
- Unchanged by construction: existing organiser (has a membership), dancer, invite claim
  (`/invite/<token>` returnTo always wins, before any of this), organiser-intent with an open
  access request, self-serve OFF (every role -> `/`), and every landing while P3 is off.

## Facts proved first

- **Login journeys map** (PR #1142, `docs/audits/login-journeys-2026-10-29.md`): finding F4 --
  "Sign-in never leads to P3"; landing decided by `landingPathAfterAuth` (callback) and
  `signInLanding` (`/account/continue`). This PR changes exactly those two, nothing else.
- **Data source for "new organiser"**: `organiser_home_v1()` (live body read on prod, read-only):
  `entity_members WHERE user_id = auth.uid() AND entity_type = 'organiser' AND member_role IN ('owner','manager')`.
  The client already reads that RPC (`useProfileSides` -> `organisers`); no permission logic was
  copied into the client. "Organiser intent" = sign-up `user_metadata.user_type` not `dancer`
  (existing `hasOrganiserIntent`); open requests = existing `fetchMyAccessRequests`.
- **Bundle**: see the perf table below.

## Verified on real data

Shape survey (prod `stsdtacfauprzrdebmzg`, read-only counts, no personal data):

| Shape | Count |
|---|---|
| Accounts | 42 |
| Accounts with an organiser membership (owner/manager) | 12 (11 with one page, 1 with several) |
| Organiser-intent accounts with **no** membership (= the "new organiser" shape this PR routes) | 8 |
| Organiser-intent accounts **with** a membership (existing organiser; unchanged) | 6 |
| Dancer-intent accounts with no membership (dancer; unchanged) | 22 |

Consistency matrix: `src/lib/__tests__/newOrganiserLanding.test.ts` -- every person kind
(new organiser done / unfinished, intent + open request, existing organiser, existing organiser
with intent, dancer, dancer unfinished, invite claim, two organisers) x 4 flag combinations, plus
every sign-up/sign-in kind x 4 flag combinations for `landingPathAfterAuth`.
**Red first**: on the unchanged code exactly the 4 new-organiser x "P3 live" rows failed (45 passed).
Wiring: `src/components/account/profiles/__tests__/newOrganiserWiring.test.tsx` mounts the real
`ContinueAsScreen` + `useProfileSides` (network edge mocked): new organiser -> `/account/p3/start`
when `p3Live`, `/account/o` when not / absent; existing organiser still gets "Continue as...";
dancer -> `/app/home`.

Browser walk, 390x844, prod-shaped fake (`tests/e2e/helpers/organiserFake`, user_type organiser,
no organiser, dancer profile done), dev server with self-serve ON:

| Flag | New organiser lands | Dancer | Existing organiser |
|---|---|---|---|
| `organiserP3` ON | `/account/p3/start` -- Welcome, "Find your page" ([shot](p3-f4-signin-lands-welcome/new-organiser-p3-on.png)), no sideways scroll | `/account/dancer` (unchanged) | `/account/o` (unchanged) |
| `organiserP3` OFF | `/account/o` -- R1 Welcome ([shot](p3-f4-signin-lands-welcome/new-organiser-p3-off.png)) | `/account/dancer` | `/account/o` |

(The walk spec was throwaway and is not committed; the dancer lands on `/account/dancer` because
the fake closes the dancer-area gate -- same with the flag on or off.)

Design Gate: routing only, no new visible UI. The landing is the existing P3 Welcome screen.

### Not verified

- A real sign-in against prod auth (e-mail code) -- walked with the fake session only.
- The `organiserP3` / `organiserSelfServe` Vercel values (not readable here; P3 stays OFF).
- Open-access-request counts for the 8 new-organiser accounts (not surveyed).
- P3 Welcome has a Back arrow; after `/account/continue` replaces itself, Back goes to whatever
  was before sign-in. Not changed here, not walked.
- `/account/p3/start` has no dancer-profile gate (R1's `/account/o` has one). A sign-up only
  reaches the landing after the callback has filled the dancer basics, and an unfinished dancer
  signing in goes through `/app/welcome` first, so the walked shapes are fine; noted for F-series.
- Ricky's phone test.

## CI jobs run locally

| Workflow / step | Result |
|---|---|
| typecheck: `tsc --noEmit -p tsconfig.app.json` | 99 errors, **none** in a touched file (pre-existing; the workflow does not gate on unrelated ones) |
| unit-tests: `TZ=Europe/London npm run test:unit` | all pass except 4 files that fail identically on main: `tests/eventViewCompat.contract`, `occurrenceProgram.contract`, `publicEventPageLineup.contract` (live DB, skipped in CI), `integrityCouldNotRun` (sandbox env) |
| `npm run lint` (full chain) | pass |
| architecture-guard: `lint:architecture`, `check:dancer-area-isolation` (+ self-test), `check:legacy-tables`, `check:legacy-program-rpcs`, `check:rpc-typing`, `check:wallclock-brand`, `check:mojibake:self-test`, `check:plan-hygiene:self-test` | pass |
| integrity: `bin/check-integrity.sh`, `AUDIT_STRICT=1 npm run check:images` | pass |
| perf-budget: `build`, `check:bundle-budget` (+ self-test), `check:first-load-requests` (+ self-test), `check:chunk-cycles` | pass |
| perf-budget: `check:doc-weight`, `check:lighthouse` | NOT RUN -- need a live Vercel preview |
| e2e-smoke: `npm run test:e2e` | 179 passed, 3 failed under full-run load (`account-settings` x2, `dancer-home` "unfinished organiser"), all 23 tests of those two specs pass when re-run; CI runs with P3 OFF, where this change is inert |

### Bundle (main vs branch, `check:bundle-budget`; exact gzip per chunk)

All budgets green; **0 new first-load requests** on every route (chunk ratchet unchanged).
`/app/*`: 373.6 -> 373.7 KB. Exact gzip: `lib-account` +13 B (`signInLanding`'s
`newOrganiserTo ?? ...`), `AnimatedRoutes` +13 B (the `p3Live` prop; on every route),
`auth-otp-routing` +39 B and `ContinueAsPage` +41 B (neither on `/app`), `AuthCallback` +10 B;
everything else is +/-1-5 B hash noise. So **not literally zero bytes** on `/app`: about 26 B gz.
Two earlier layouts were measured and rejected: mapping in `lib/accountPaths` (+0.1 KB on
EVERY route), and a `featureFlags` import in `useProfileSides`/`ContinueAsPage` (+1 first-load
chunk on `/auth/callback` and `/app/*`, over the 374 KB `/app` budget). `perf-budgets.json` and
`vite.config.ts` untouched.

## Review

`/code-review` was not run (worker session; the owner runs it per CLAUDE.md before merge).
