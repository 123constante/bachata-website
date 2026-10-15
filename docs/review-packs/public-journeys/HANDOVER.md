# Handover: public journeys + organiser-link sign-up fix (dt_3cff64a5b1a5)

Branch `claude/dancer-app-routing` (PR #764), on top of e1a0df8. Brief:
`briefs/public-journeys-organiser-intent.md` (sha 1de67151) on `arc/briefs-dancer-rebuild`.

## The failure, root cause
The organiser link reaches `/account/o` correctly after the code. `DancerProfileGate` then sends an
unfinished account to `/finish-profile?returnTo=%2Faccount%2Fo`. `RedirectIfAllowed` -> `AllowedRedirect` ->
`oldDancerHomeRedirect` replaces that page with a bare `/app/welcome`, and **the returnTo is dropped there**.
Onboarding's end button was then hard-coded to `DANCER_HOME` (`/app/home`), so the person ended in the dancer app.

## What changed (files)
- `src/lib/accountRouting.ts`. This is the one routing model. New functions:

  | Function | What it does |
  |---|---|
  | `onwardReturnTo` | Same-site relative only. Never `/auth`, `/app/welcome` or `/finish-profile`. |
  | `appWelcomeHref` | The onboarding URL, carrying `?returnTo=`. |
  | `onboardingEnd` | Where onboarding ends. |
  | `onboardingEndLabel` | The label for the end button. |
  | `hasOrganiserIntent` | Reads the sign-up role. |

  Two existing functions change. `oldDancerHomeRedirect` now carries `/finish-profile`'s returnTo.
  `profileSides` sends an unfinished dancer with organiser intent and no organiser to `/app/welcome?returnTo=/account/o`.
  The module now imports `lib/authRouting` (also import-free, and already on the header's first load).
- `src/modules/dancer-app/gate/AllowedRedirect.tsx` passes `?returnTo=`.
- `src/modules/dancer-app/screens/onboarding/OnboardingScreen.tsx` reads `?returnTo=`. The end button and the
  done-redirect go to `onboardingEnd`, and the label names where the button goes.
- `src/modules/dancer-app/screens/onboarding/steps.tsx`: `photoHandoff(returnTo)` makes the photo screen return
  to the welcome URL with the returnTo still on it.
- `src/components/account/profiles/useProfileSides.ts` feeds `organiserIntent` from `user_metadata.user_type`.
- `src/pages/Auth.tsx`: a signed-in visitor is sent straight on, to the returnTo or to `/account/continue`.
  This does not happen after a code was sent.
- `src/modules/dancer-app/api/useMyDancerEdit.ts`: a save that changes `complete` resets the dancer gate's
  cached answer (`['profile-completion']`, 60 s stale). The walk found this second bug: with the returnTo
  fixed, `/account/o` still bounced to `/finish-profile` on the stale "incomplete" and showed a blank page.
- `scripts/dancer-area-isolation-allowlist.json` adds `docs/journeys/` to `docPrefixes`.
- New: `docs/journeys/public-entry-journeys.md`, `tests/journeys/publicEntryJourneys.ts` (THE row list),
  `tests/journeys/publicEntryJourneys.test.ts`, `tests/journeys/gateCacheReset.test.ts`,
  `tests/e2e-build/public-journeys.build.spec.ts`, plus `WALK.md` and 205 screenshots under one folder per row, and this folder.

## Decisions and INTERFACE deviations
- Decisions: see "Decisions made by the worker" in `docs/journeys/public-entry-journeys.md` (7 items).
- INTERFACE deviation: the isolation allow-list gains the doc prefix `docs/journeys/`. The brief owns that folder.
  The orchestrator should mirror this into INTERFACE section 5.
- `gh pr edit` could not run: `gh pr` uses GraphQL, which the session refuses with a 403, and `gh api` is
  forbidden. The PR body was updated through the GitHub connector instead.

## Shapes surveyed (prod, read-only, counts only, 2026-10-15)
There are 19 accounts, grouped by sign-up role:

| Sign-up role | Accounts | Unfinished dancer profile | No dancer row |
|---|---|---|---|
| `organiser` | 4 | 2 (the owner's failure shape) | 0 |
| `dancer` | 3 | 2 | 0 |
| none | 12 | 5 | 2 |

`dancer_area_access` has 0 rows. The prior routing survey found 3 dancer+organiser accounts and no account with
two organisers.

## Red-first proof

**1. Unit, unfixed e1a0df8.**
`tests/journeys/publicEntryJourneys.test.ts`, test "the gate's /finish-profile?returnTo=/account/o carries the
destination into onboarding":
```
AssertionError: expected '/app/welcome' to be '/app/welcome?returnTo=%2Faccount%2Fo'
```
The other rows fail on e1a0df8 with `TypeError: photoHandoff is not a function` (the helper does not exist there).

**2. Production build, unfixed e1a0df8, row `organiser-link-new`** (separate worktree, then removed):
```
Error: expect(locator).toHaveText(expected) failed
Locator:  getByTestId('onboarding-home')
Expected: "Next: set up your organiser page"
Received: "Go to Home"
```

**3. Production build, the fix without the gate-cache reset, row `organiser-link-new`:**
```
Error: END screen; hops: /auth/callback?mode=signup&returnTo=%2Faccount%2Fo -> /account/o -> /finish-profile?returnTo=%2Faccount%2Fo -> ... -> /app/welcome?returnTo=%2Faccount%2Fo -> /account/o
Locator: getByTestId('org-onboarding')   Expected: visible   Error: element(s) not found
```
`tests/journeys/gateCacheReset.test.ts` pins the reset at unit level.

## CI per-job table (run in this sandbox, 2026-10-15)
| Workflow / job | Command | Exit | Result |
|---|---|---|---|
| unit-tests | `npx vitest run` | 1 | 8281 passed, 15 failed. All 15 are sandbox-only: the live-DB contracts (eventViewCompat, occurrenceProgram, publicEventPageLineup) and integrityCouldNotRun (exec-bit helper). These are the same 15 the routing handover listed, and none is in touched code. New: 52/52 in `tests/journeys` |
| unit-tests / dancer-area-isolation | `check-dancer-area-isolation.mjs --self-test`, `npm run check:dancer-area-isolation` | 0, 0 | OK. The `docs/journeys/` prefix was added |
| architecture-guard | `bash bin/check-integrity.sh`, `check:legacy-tables`, `check:legacy-program-rpcs`, `lint:architecture`, `AUDIT_STRICT=1 check:images`, `check:image-widths(:self-test)`, `check:plan-hygiene:self-test`, `check:workflow-artifact-policy(:self-test)`, `check:mojibake:self-test` + mojibake grep, `prove:entry-point(:self-test)` | 0 each | pass |
| lint chain | `npm run lint` | 1 in sandbox | 15/16 links pass. `check:integrity` exits 126 because `bin/check-integrity.sh` is not executable in this checkout (CI runs chmod first). Run through bash, it exits 0 |
| typecheck | `tsc -p tsconfig.app.json` | 1 (backlog) | No error in a touched file. The repo has a pre-existing backlog elsewhere |
| eslint (touched files) | `npx eslint <touched>` | 0 errors | `Auth.tsx` has the same 8 errors as on the base. `steps.tsx` has 1 new react-refresh warning |
| perf-budget | 3 self-tests, `npm run build`, `check:bundle-budget`, `check:first-load-requests`, `check:chunk-cycles` | 0 each | dancer-app 359.6/360 KB, auth 291.7/310 KB, event 376.4/381 KB, 238 chunks with no cycle |
| e2e-smoke | `npm run test:e2e` | 0 | 148/148 on the second full run. The first run, beside a production build, had 3 timeouts; those 3 pass alone |
| phone-qa build walk | phone-qa build env + `VITE_ENABLE_ORGANISER_SELF_SERVE=true`, `playwright.build.config.ts` with all 3 `tests/e2e-build` specs | 0 | 30/30 (public-journeys 19/19) |
| ci-budget-guard, db-contract-check (live), og/seo live | - | - | Need secrets or a deploy. Not run |
| real-data-verified, phone-qa-section | PR-body checks | - | Run on the PR |

## 390x844 walk
Done in the production build with a mocked backend; the OTP is mocked. See `WALK.md`: 19 rows and 205
screenshots, with 360x780 for the organiser row. Each end screen asserts `scrollWidth` = viewport.

How to run it:
1. Build: `VITE_SUPABASE_URL=https://phoneqafakenotaproject.supabase.co VITE_SUPABASE_PUBLISHABLE_KEY=<phone-qa.yml placeholder> VITE_ENABLE_ORGANISER_DETAIL=true VITE_ENABLE_ORGANISERS_DIRECTORY=true VITE_ENABLE_ORGANISER_SELF_SERVE=true NODE_OPTIONS='--import ./tests/e2e-phone/fakeSupabasePreload.mjs' npm run build`
2. Walk: `VITE_SUPABASE_URL=https://phoneqafakenotaproject.supabase.co npx playwright test --config playwright.build.config.ts tests/e2e-build/public-journeys.build.spec.ts`

Note: `phone-qa.yml`'s build-smoke step does not set `VITE_ENABLE_ORGANISER_SELF_SERVE`. The orchestrator should
decide whether to add this spec to CI with that flag.

## Verified / Not verified

**Verified:**
- Every journey row, both at the routing-model level and in the production build at 390x844 (19/19). The
  organiser row also passes at 360x780.
- The organiser link ends on the claim screen after the full dancer setup. That covers the photo, the optional
  years and styles cards, a reload, a closed tab followed by a later sign-in, the magic link, a wrong code, an
  expired link, and a hostile returnTo.
- The dancer link is unchanged: it ends on `/app/home`.
- Budgets, the isolation guard, and the e2e smoke suite.

**NOT verified:**
- A real inbox or a real OTP (both mocked).
- The real Supabase: a fake backend was used, so in particular the server's profile_complete flip timing is not proven.
- A real phone.
- A Vercel preview. `VERCEL_TOKEN` is set but was not used: there is no deploy step in this brief.
- GitHub Actions results (they run on the PR).
- `/code-review`: the owner types it, and no owner was present.
- In real sign-ups, the name, city and role cards are pre-filled by `/auth/callback`, so the walk's organiser
  rows start at the photo card. Only `signin-unfinished-dancer` exercises the role card.

## What is left / next steps
- The orchestrator repeats the organiser and dancer rows on the real site with a real inbox.
- `steps.tsx` now exports a function next to the component, which gives one react-refresh lint warning
  (a warning, not an error).
