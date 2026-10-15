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
- `scripts/dancer-area-isolation-allowlist.json` adds `docs/journeys/` to `docPrefixes`.
- New: `docs/journeys/public-entry-journeys.md`, `tests/journeys/publicEntryJourneys.ts` (THE row list),
  `tests/journeys/publicEntryJourneys.test.ts`, `tests/e2e-build/public-journeys.build.spec.ts`, and this folder.

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
See the PR body `## Red first`. That section quotes the unit failure and the production-build Playwright
failure of the `organiser-link-new` row on the unfixed head, e1a0df8.

## What is left / next steps
- The orchestrator repeats the organiser and dancer rows on the real site with a real inbox.
- `steps.tsx` now exports a function next to the component, which gives one react-refresh lint warning
  (a warning, not an error).
