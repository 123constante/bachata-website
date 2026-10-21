# RELEASE-B-WEB handover (integration of B-WEB3 + B-WEB4)

Branch `claude/people-release-b-web`, from `origin/main` (fb91b8a). No PR opened.

## Merges
1. `git merge origin/claude/people-b-web3` (54fbbda): merge commit, no conflicts.
2. `git merge origin/claude/people-b-web4` (a8c8dd8): merge commit, no conflicts. `src/lib/areaPaths.ts` was byte-identical on both sides.

No other conflict; nothing to resolve.

## Seams
New tests in `src/modules/areas/__tests__/releaseBSeams.{routes,empty}.test.tsx` (11 tests, all green).

| Seam | Result | Where |
|---|---|---|
| (a) New sign-up chose Teacher / DJ, empty record: `/account/t` and `/account/dj` render | PASS: "No details added yet", ONE button ("Edit details"), line-up card says "No line-ups yet" + what fills it; no blocked or error state | empty.test |
| (b) `/account/areas` for the same person | PASS: all four roles listed, one action each; teacher and DJ read "Not added" with "Add" | empty.test |
| (c) Every area link, sign-up landing and Your areas open target is a REGISTERED route | PASS: each `AREA_PATHS` value is a `<Route>` in `AnimatedRoutes.tsx` and in `CATCHALL_CLIENT_PATHS`; `signupIntentLanding` returns only those or today's landing | routes.test |
| (d) Signed out, each area path goes through `AuthGuard` and returns there | PASS: `/auth?mode=signin&returnTo=<path>` for areas, t, dj | routes.test |

Seam bug fixed (test-only): `ProfileWizard.test.tsx` (B-WEB3) typed `saveRole` with no parameters, so `saveRole.mock.calls[0][1]` was a new tsc error (TS2493). Typed the mock's two parameters. Typecheck is back to the main baseline.

## CI steps run locally (job | step | command | exit)
| job | step | command | exit | vs origin/main |
|---|---|---|---|---|
| typecheck | tsc | `npm run typecheck` | 2 (99 errors) | main also 99 errors: inherited (the +1 above is fixed) |
| typecheck | rpc typing | `npm run check:rpc-typing` | 0 | |
| typecheck | wallclock | `npm run check:wallclock-brand` | 0 | |
| architecture-guard | integrity | `bin/check-integrity.sh` (after `chmod +x bin/*.sh` as CI does) | 0 | |
| architecture-guard | legacy tables / program rpcs | `npm run check:legacy-tables`, `check:legacy-program-rpcs` | 0, 0 | |
| architecture-guard | architecture | `npm run lint:architecture` | 0 | |
| architecture-guard | images | `AUDIT_STRICT=1 npm run check:images` | 0 | |
| unit-tests | dancer isolation | `npm run check:dancer-area-isolation` | 0 | |
| unit-tests | vitest | `npm run test:unit` | 1: 15 failed in 4 files | the same 4 files, same 15 failures on origin/main: inherited (live-DB contract tests `eventViewCompat`, `occurrenceProgram`, `publicEventPageLineup` need network; `integrityCouldNotRun` is sandbox-bound) |
| lint | chain | `npm run lint` | 1: only `check:integrity` exit 126 (script not executable in this checkout) | passes with the chmod above; every other link PASS |
| build | production | `npm run build` | 0 | |

Not run (need secrets, live deploy or live DB): `ci-live-db-gate`, `db-contract-check.yml`, e2e-smoke, perf-budget, og-image, seo.

## Verified
- Merges clean; both slices' own tests pass inside the merged tree (areas, wizard, AuthSignupRoleIntent, AuthCallbackRoleIntent).
- Seams (a)-(d) above, with a prod-shaped fake server at the RPC boundary.
- Production build green; typecheck at main's baseline.

## Not verified
- **Screens at 390x844** (a)-(b) under `docs/people-arc/screens/RELEASE-B-WEB/`: NOT produced. Needs a signed-in session against the Release B RPCs, which are not on prod; no harness built in this run. Next worker: render the two pages with the fake server from `releaseBSeams.empty.test.tsx` in Playwright.
- **Real server behaviour**: `my_role_details_v1` for a person with NO teacher record is not specified in B-DB1 (the brief for it was not in the files I read). The tests assume it returns the role with empty details. If it instead refuses (e.g. an unknown code), the page shows the generic "did not save/load" error with Retry, not an empty state. Check once the RPC is on a branch DB.
- **(b) intent**: Your areas reads only `my_roles_v1`; it does not read `my_role_intent_v1`. A sign-up that chose Teacher shows "Not added" + "Add" unless the server's `my_roles_v1` counts intent as active. Product call: if the owner wants the choice reflected, that is a server change (or a client read of intent), not done here.
- Browser walk, phone test, the `real-data-verified` block (Release B RPCs are unapplied, so prod-shape survey of the new RPCs is impossible).
- Supabase read-only: no query was run.
