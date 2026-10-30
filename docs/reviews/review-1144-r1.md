# Review: Website PR #1144, P3 Go live wiring (round 1, read-only)

Brief: `brief/review-1144-r1` `docs/briefs/review-1144-golive.md`. Reviewed `claude/p3-golive-wiring` at head
`9d1c8f1d9c2f12ec997c3775717f3eb0122e6bb4` against `main` (`7540dae`). Reviewer did not build it; no code changed.
Ticket `dt_e7147b168fb6`.

## Verdict: PASS with should-fix

The wiring is sound. Every answer the live RPC body can give has a mapped screen, there is no unmapped
fall-through, one tap sends one command, the server owns eligibility and ownership, no flag moves, and the
mapping tests fail under mutation (three mutants, all caught). One should-fix: the refusal the client calls
"signed-out" is keyed on a RAISE that a signed-out browser never reaches, so a real expired session reads as a
network failure with a Try again that cannot succeed. Nothing blocks the merge.

## What was checked, and how

| # | Brief check | Result |
|---|---|---|
| 1 | Live RPC body vs client mapping | PASS. `pg_get_functiondef` of `complete_organiser_onboarding_v1`, `_onboarding_missing_v1`, `_city_requires_review_p5` and the `organiser_profiles_lifecycle_chk` constraint read on prod 2026-10-29 (SELECT only). See the table below. |
| 2 | Double tap, slow network | PASS. `inFlight` ref + `busy` state; three synchronous taps send one call (unit test, and mutant 2 removed the guard and the test went red). Busy label "Going live..." with `aria-disabled`. |
| 3 | No client-side permission or eligibility decision | PASS. Ownership is never decided client-side (the RPC's `not_found`). The pre-tap "blocked" / "in-review" / "closed" states come from `organiser_onboarding_status_v1`, which calls the same `_onboarding_missing_v1`; the RPC re-checks on every call and the client maps its refusal. |
| 4 | Failure states say what the person can do | PASS (see NIT 3 on "Ask the team" with no link). |
| 5 | Flags untouched | PASS. The diff touches no `.env*`, `vercel.json` or workflow file; `flags.organiserDetail` is only read. `GO_LIVE_NOT_DEPLOYED` survives for tests only. |
| 6 | Tests assert the mapping | PASS. The pure tests pin literal RPC shapes to literal outcomes; the 30-cell Review matrix asserts the rendered screen equals `reviewCopy`/`goLiveState`. Mutants: pending_review titled "You're live" (4 red), no double-tap guard (1 red), `not_found` dropped to failed (2 red). 60/60 green at head. |
| 7 | Copy | PASS. British English throughout; G3 guard (`consistency.matrix.test.tsx`) green; the incomplete text points at rows that are on screen (server `missing` merged into the list before the alert shows). |
| 8 | Screenshots match the code states | PASS. The six 390x844 dark shots (review-ready, live, live-review, review-incomplete, review-pending, review-error) each show the title, sub, foot alert and button label the mapping gives for that state. |

### Live RPC body -> client mapping (read on prod 2026-10-29)

| Server answer | Where in the body | Client | Screen |
|---|---|---|---|
| RAISE `authentication_required` | `auth.uid()` null | `signed-out` | Review + "You were signed out..." + Sign in again (returns to `?at=review`) |
| RAISE `not_found` | not `owner` member, null id, or row gone | `not-owner` | Review + "Only the page owner..." + Go to Home |
| `{ok:false, reason:'incomplete', missing}` | `_onboarding_missing_v1` non-empty | `incomplete` | Review, rows from `missing`, Go live disabled with the alert, status re-read |
| `{ok:true, changed:false, lifecycle, review}` | already live / pending_review | `live` / `pending_review` | Live, or its review variant |
| `{ok:false, reason:'invalid_state', lifecycle}` | lifecycle not draft/rejected: only `archived` per the check constraint | `invalid-state` | Review + "can't go live from here" + Go to Home |
| `{ok:true, changed:true, lifecycle:'pending_review', review:true}` | city has an ambassador | `pending_review` | "Sent for a quick check", no confetti, Home only |
| `{ok:true, changed:true, lifecycle:'live', review:false}` | otherwise | `live` | "You're live", confetti, View / Share / Home |
| any other shape or error | | `failed` | Review + "Couldn't go live..." + Try again |

No client branch maps a result the body cannot send; no body result lacks a branch. `goLiveOutcomeFrom` throws
`failed` for any unknown shape, so there is no silent fall-through to "You're live".

Prod shapes (counts only): 49 organiser pages, all `live`; 0 ambassadors across 319 cities, so the review
variant has no real path today and is verified only through the mocked client and the walk.

## Findings

### 1. SHOULD-FIX: the "signed-out" refusal is keyed on an error a signed-out browser never produces

`src/modules/organiser/p3/onboarding/pageModel.ts:403-406` maps only the message `authentication_required`
to `signed-out`. That RAISE fires only when a request reaches the function body as `authenticated` with a null
`auth.uid()`, which supabase-js does not produce. The two real signed-out shapes are:

- session expired and refresh failed: supabase-js sends the anon key, the role is `anon`, and EXECUTE is
  denied before the body runs (ACL is `postgres, authenticated` only): message
  `permission denied for function complete_organiser_onboarding_v1`, code 42501;
- stale JWT still attached: PostgREST answers 401 `JWT expired` (PGRST301).

Both fall to `failed`, so Review shows "Couldn't go live. Check your connection and try again" with Try again,
and every retry fails the same way. The test at `__tests__/goLive.matrix.test.tsx:121` pins the
`permission denied` message to `failed`, which cements the wrong branch. `OnboardingFlow.tsx:192` blanks the
flow once `useAuth` learns of the sign-out, which bounds the harm to the window before the auth listener
fires; it does not remove it.

Scenario: a person leaves Review open overnight on a phone, the refresh token is revoked (signed out on another
device), they tap Go live in the morning. They see a connection error and a Try again that never works.

Fix (small, in `goLiveRefusalOfMessage`): treat `permission denied for function`, `JWT expired`, and
`PGRST301` as `signed-out`; flip the test row at line 121 to expect `signed-out` and add a `JWT expired` row.
Keep `authentication_required` as well.

### 2. NIT: a late status refetch can leave "Try again" on a disabled button

`OnboardingFlow.tsx:803-806`: after a `failed` refusal `refused` is kept, and if the status query refetches
with new `missing` (window refocus; no invalidate happens on failure) the button goes `aria-disabled` while
still labelled "Try again" and still showing the connection alert instead of the "Finish the N things" reason.
A tap toasts the right reason, so the person is not stuck. Clearing `refused` when `status.missing` changes
would remove the mismatch.

### 3. NIT: two refusals say "ask the team" with nobody to ask

`pageModel.ts:427` and `:429` (invalid-state, not-owner) end on "Ask the Bachata Calendar team" / "Ask them"
with Go to Home as the only control. The handover already lists a WhatsApp help link as fix-later; noted here so
it is not lost. Not a pointer at a missing control, so it passes check 7.

### 4. NIT: the walk is in the e2e gate by name but skips itself on the gate's server

`tests/e2e/walk-p3-golive.spec.ts:45` skips when `organiserP3` is off, which is the `e2e-smoke` server today, so
the gate addition in `package.json:76` is a no-op until the flag is on in CI. Same pattern as the other P3 walks;
recorded so nobody reads the green as coverage.

### 5. NIT: "We will let you know" is a promise this repo does not keep

`pageModel.ts:366` and `:448` promise a notification once the city team has checked the page. Whether an
approval in admin notifies the organiser was not verifiable from this repo. If admin does not send one, soften
to "Check back here" or wire the notice before the first city gets an ambassador.

## Verified

- Live RPC body, ACL, `search_path`, the helper functions and the lifecycle check constraint (prod, SELECT only).
- Prod counts: lifecycle distribution, ambassador count, city count.
- `goLive.matrix` (60), `pageScreens.matrix` (50) and `consistency.matrix` (58) green at head `9d1c8f1` in a
  worktree; three mutants each turned the matrix red.
- The PR diff in full (7 code files, package.json spec list, handover doc, 24 screenshots).
- The six 390x844 dark screenshots against the code states.
- PR #1144 check runs at head: 26 completed, all success or skipped; `phone-qa`, `unit (Europe/London, full)`,
  `build-smoke` and `e2e-smoke` were still in progress at the time of writing.

## Not verified

- A real Go live (never called, by rule) and the real review path (no city has an ambassador).
- The exact supabase-js message for an expired session against this project (finding 1 is from PostgREST and
  Postgres behaviour and the function ACL, not a live reproduction).
- The walk itself was not re-run here; the screenshots were read from the branch.
- Typecheck and the full lint chain were not re-run locally; CI carries them.
- Light theme and 320x568 screenshots (the brief asked for the 390x844 dark ones).
