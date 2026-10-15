# RED-first evidence: MATRIX.md "Proposed follow-up" rows and specs, on base 2abac36

Base = 2abac36 (claude/dancer-app-routing, PR #764), production build built by
`playwright.build.config.ts` (fake Supabase env); re-runs used `BUILD_QA_SKIP_BUILD=1`
(no src change). Ran on port 4291 (`BUILD_QA_PORT`).

## 1. Red on base (the decided END is not what the code does yet)

### Build walk (`npx playwright test --config playwright.build.config.ts --reporter=line`)

```
1) account-edges.build.spec.ts:27:1 > home banner href equals DANCER_LINK
   Error: src/lib/homeAnnounceBanner.ts holds the home banner's href (PR #765)
   Expected: true / Received: false
2) account-edges.build.spec.ts:39:1 > sign out then a different person signs up: no trace of A
   Error: storage keys still holding A after sign-out
   + Array [ "auth_last_email", "auth_form_state_v1" ]
3) account-edges.build.spec.ts:154:1 > a different signed-in person opens an invite: the card names who is joining (M57)
   Error: expect(locator).toContainText(expected) failed
   Expected pattern: /You are joining as (Ana|ana\.new@example\.com)/
   Received string:  "Something went wrongWe could not use this link. Check your connection and try again.Try again"
4) public-journeys.build.spec.ts > dancer-link-back-each-card: ... -> /app/home
   Error: Back from the END re-opened "You're in"
   expect(locator).toBeHidden() failed
5) public-journeys.build.spec.ts > organiser-link-back-each-card: ... -> /account/o
   Error: Back from the END re-opened "You're in"
   expect(locator).toBeHidden() failed
6) public-journeys.build.spec.ts > signin-unfinished-dancer-with-organiser: ... (M35) -> /account/o
   Error: expect(locator).toBeVisible() failed   Locator: getByTestId('continue-as')
   (first run: "Continue as..." flashed, then locator.click timed out waiting for
   [data-testid^="continue-as-organiser"]; the page ended on the OLD /finish-profile
   "Finish your profile" form, not the /app/welcome onboarding)

Full suite on base with the new tests: 7 failed, 44 passed (51 tests, 6.4m)
```

### Routing model (`npx vitest run tests/journeys`)

```
FAIL publicEntryJourneys.test.ts > ... (routing model) > signin-unfinished-dancer-with-organiser
  AssertionError: expected { end: '/finish-profile', ...(1) } to deeply equal { end: '/account/o', trail: [ ...(3) ] }
  trail: /account/continue -> /account/o -> /finish-profile?returnTo=%2Faccount%2Fo
  (oldDancerHomeRedirect returns null for an organiser: organiserCount > 0 -> accountHome 'organiser')
FAIL publicEntryJourneys.test.ts > ... > organiser intent rides every onboarding hop
  AssertionError: signin-unfinished-dancer-with-organiser: expected 0 to be greater than 0
Tests  2 failed | 73 passed (75)
```

## 2. Pins (green on base), each proved to exercise its path by a mutation

### Journey rows: every new row's END path swapped (`/account/o` <-> `/app/home`, invite / `/app/welcome` -> `/app/home`)

Routing model with the mutant rows: `Tests  14 failed | 57 passed (71)` -- all 13 new rows red
(plus the returnTo-hop check), restored after.

Build walk with the mutant rows (the 10 that pass on base), all red, each after walking its path:

```
organiser-link-unfinished-dancer-signed-in   Error: expect(locator).toHaveText(expected) failed   (end button label: onboarding ran)
organiser-link-magic-link-other-device       Error: expect(locator).toHaveText(expected) failed   (end button label: onboarding ran on device 2)
organiser-link-organiser-signed-in           Error: expect(page).toHaveURL(expected) failed
organiser-link-open-request-signed-in        Error: expect(page).toHaveURL(expected) failed
dancer-link-existing-dancer                  Error: expect(page).toHaveURL(expected) failed
signin-open-request                          Error: expect(page).toHaveURL(expected) failed
team-invite-existing-dancer                  Error: expect(page).toHaveURL(expected) failed
team-invite-unfinished-dancer                Error: expect(locator).toHaveText(expected) failed   (end button label)
bookmark-app-welcome-finished                Error: expect(page).toHaveURL(expected) failed
bookmark-finish-profile-finished             Error: expect(page).toHaveURL(expected) failed
10 failed
```

### account-edges pins: one expectation per spec mutated in a throwaway copy (deleted after)

```
sign out in tab 1 ... (returnTo '/app/home' -> '/app/nights')         Error: expect(page).toHaveURL(expected) failed
two organisers ... (after the switch expect ?o=<other> not ?o=<ORG>)   Error: expect(page).toHaveURL(expected) failed
admin-only opens /app/home ... (returnTo '/account' -> '/account/o')  Error: expect(page).toHaveURL(expected) failed
two tabs mid-onboarding ... (card after the stale save 'in' -> 'photo') Error: the card after the stale save
4 failed
```

## 3. Status per row / spec on base

| Row / spec | Base 2abac36 |
|---|---|
| dancer-link-back-each-card | RED (M24: Back from END re-opens "You're in") |
| organiser-link-back-each-card | RED (M10: same) |
| organiser-link-magic-link-other-device | pin, green on base |
| organiser-link-unfinished-dancer-signed-in | pin, green on base |
| organiser-link-organiser-signed-in | pin, green on base |
| organiser-link-open-request-signed-in | pin, green on base |
| dancer-link-existing-dancer | pin, green on base |
| signin-unfinished-dancer-with-organiser | RED in both harnesses (M35: old Finish form, never onboarding) |
| signin-open-request | pin, green on base |
| team-invite-existing-dancer | pin, green on base (today the page redeems at once; the walk presses a join button if M57 adds one) |
| team-invite-unfinished-dancer | pin, green on base |
| bookmark-app-welcome-finished | pin, green on base (the fixture still has optional cards, so the 'in' card shows) |
| bookmark-finish-profile-finished | pin, green on base |
| home banner href equals DANCER_LINK | RED (banner module from PR #765 not on base) |
| sign out then a different person signs up | RED (M76: auth_last_email, auth_form_state_v1 survive) |
| sign out in tab 1 sends tab 2 to /auth | pin, green on base |
| two organisers: switch sheet | pin, green on base |
| admin-only opens /app/home | pin, green on base |
| two tabs mid-onboarding | pin, green on base |
| invite card names who is joining (M57) | RED (no such card yet) |

M44 has no row in the follow-up table; nothing was added for it.
