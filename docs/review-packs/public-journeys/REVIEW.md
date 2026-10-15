# Independent review: PR #764 (`claude/dancer-app-routing` @ 4f0c8e2)

Brief: `briefs/public-journeys-review.md` (sha 683cf2b9) on `arc/briefs-dancer-rebuild`. Ticket dt_7622f3e0d63d.
Read-only review of `git diff origin/main...4f0c8e2 -- src scripts`. Correctness only, at `/code-review low` depth.
The reviewer did not write this code. Nothing under `src/` was changed.

## What was run

| Command | Result |
|---|---|
| `npx vitest run tests/journeys src/lib/__tests__` | 29 files, 777 passed, 1 skipped, 0 failed |
| `npm run build` | exit 0 |
| `tsx` probe of `sanitizeReturnTo` / `onwardReturnTo` / `onboardingEnd` / `appWelcomeHref` with 18 hostile values | Results are in section 1 |

## Findings

### F1. Onboarding that is already finished on arrival can ping-pong with a stale gate (PLAUSIBLE)

- `src/modules/dancer-app/screens/onboarding/OnboardingScreen.tsx:47-62`: when `stageFor(profile) === 'done'` on
  the first load, the screen does `<Navigate to={end} replace />`. Here `end` is `/account/o` when a returnTo is set.
- `src/modules/dancer-app/api/useMyDancerEdit.ts:32` resets `['profile-completion']` only inside
  `writeMyDancerEdit`, which means only on a save in this tab.
- `useProfileCompletion` keeps its answer for the app's default 60 s stale time. `DancerProfileGate` (on
  `/account/o`) and `AllowedRedirect` (on `/finish-profile`, through `ProfileGateContext`) both read that cached
  answer.

Failure scenario: the gate has cached "incomplete" in this tab. The profile then becomes complete with no save in
this tab: another tab or device, an admin link, or a save whose answer arrived after the gate's read. The person
opens the organiser link. What happens next:

1. `/account/o`: the gate reads the stale "incomplete" and sends them to `/finish-profile?returnTo=/account/o`.
2. That redirects to `/app/welcome?returnTo=/account/o`.
3. The onboarding screen calls `my_dancer_edit` (`refetchOnMount: 'always'`), sees "done", and goes to `/account/o`.
4. Back to step 1, with a network call on every turn, until the 60 s stale time ends.

Before this PR, "done" went to `/app/home`, which is not gated, so this cycle could not happen. The two "complete"
definitions are the same four fields (`PROFILE_FIELDS` and `REQUIRED_STAGES`), so a lasting loop would also need the
server's `strength.missing` and `profile_complete_v1` to disagree. The bounded loop above needs only a stale cache.
Not reproduced: it needs a two-tab or server-timing setup that the fake backend does not model.

### F2. Organiser intent is dropped when the tab closes after the required cards (CONFIRMED by reading; owner decision)

`src/lib/accountRouting.ts:292-295` (`profileSides`) only applies `organiserIntent` while `f.dancer === 'incomplete'`.

Failure scenario: someone uses the organiser link and finishes name, city, role and photo, so the profile is now
complete. They reach "You're in", which shows Boost and the button "Next: set up your organiser page". They close the
tab there, or during the optional years or styles cards. Later they sign in from the header:

1. Sign-in lands on `/account/continue`.
2. `signInLanding` finds one side, a complete dancer, and sends them to `/app/home`.

This is the owner's failure shape: they end in the dancer app. The way back is Options, then "Become an organiser",
which is not silent but is not the claim screen either. The worker wrote this down as a decision (journey map,
"Decisions" item 2: "Once finished, a sign-in is a plain sign-in"), and no journey row covers it.

The reload case is fine: `?returnTo=` stays in the URL. The magic-link case is fine: its returnTo is in the link.

### Checked, no defect

1. **Open redirect.** No value leaves the site:
   - Off-site values are refused, and `onboardingEnd` falls back to `/app/home`: `https://evil.example/`,
     `//evil`, ` //evil`, `/\evil`, `/<TAB>/evil`, `javascript:alert(1)`, `%2F%2Fevil`.
   - Encoded slashes stay same-origin paths: `/%2F%2Fevil` and `/%5Cevil` pass the check and become
     `/%2F%2Fevil` and `/%5Cevil` on this site.
   - Onboarding pages are never an onward destination: `/app/welcome/`, `/APP/WELCOME?x`, `/%61pp/welcome` and
     `/finish-profile/` all come back as null.
   - `/auth` is refused by `sanitizeReturnTo`.
   - The photo screen's `?return=` goes through `sanitizeReturnTo` (`photoScreenDeps.ts:8`).

   Hardening only, not a defect: dot segments get past both checks. `/./auth` and `/./app/welcome` are normalised
   by the browser to `/auth` and `/app/welcome`. That costs one extra hop: `/auth` signed in goes to
   `/account/continue`, and `/app/welcome` with no returnTo goes to Home. There is no loop and nothing off-site,
   and only a hand-crafted URL can do it.
2. **Organiser intent.** These rows end on `/account/o` by code reading and the unit rows:
   - new e-mail
   - reload (returnTo is in the URL)
   - magic link (returnTo is in `emailRedirectTo`)
   - wrong code
   - expired link (`callbackError` keeps the returnTo)
   - existing finished dancer (sign-in honours the returnTo)
   - signed-in visitor (`Auth.tsx:99-103`)
   - closed tab while unfinished (`organiserIntent`)

   Exceptions: F1 and F2.
3. **The dancer link and plain sign-in are unchanged.**
   - A `userType=dancer` sign-up, and a sign-up with no role (`roleDraft` defaults to `dancer`), go to
     `/account/continue`. That page finds one unfinished side, so `/app/welcome` with no returnTo, then
     "Go to Home", then `/app/home`.
   - `hasOrganiserIntent` is false for `dancer` and for missing metadata. Prod has only `organiser`, `dancer` and
     no role, per the handover survey.
4. **`useMyDancerEdit` reset.** It cannot loop or storm:
   - It runs only from `save()` and `usePutMyDancerEdit`, which are user actions.
   - The refetched `['profile-completion']` never writes `my-dancer-edit`.
   - On `/app/*` nothing unmounts on gate `loading`: the dancer shell does not read `ProfileGateContext`.
   - An empty `before` (cache cleared) causes one extra refetch, which is harmless.

   The gap is the missing reset on the no-save path. That is F1.
5. **`Auth.tsx` signed-in redirect.**
   - It does not skip the code step. `magicLinkSent` stays true from the send until `handleCodeVerified` hands
     over to `/auth/callback`, so the session the OTP creates does not trigger it.
   - It cannot loop with `AuthGuard`. `AuthGuard` redirects only on a resolved `user === null`, and this effect
     needs a user.
   - It does stop a signed-in person from reaching the form to sign in as someone else. Sign-out is available in
     Options, the profile switcher, Account settings and the organiser onboarding (`SignOutLine`), so they are not
     trapped.
   - Minor and dev-only: the effect does not check `user.is_anonymous`, which every other signed-in check does.
     Anonymous sessions only come from `devAuthBypass`.
   - Minor: a signed-in person who reaches `/auth?callbackError=expired` is sent on without seeing the notice.
6. **One routing model.** Every screen imports its decision from `lib/accountRouting`: `OnboardingScreen`,
   `steps.tsx`, `AllowedRedirect` / `redirectModel`, `ContinueAsPage`, `useProfileSides` and the switcher. Two
   known restatements remain, and neither is a new fork:
   - `SIGNED_IN_LANDING_PATH` in the import-free `auth-otp-routing.ts` restates `CONTINUE_AS_PATH`. A test pins the
     two equal.
   - `landingPathAfterAuth` keeps its `/account/o` literal, which predates this PR.

## Verified / Not verified

**Verified:**
- The targeted unit tests are green.
- The production build passes.
- The sanitizer's behaviour on 18 hostile values, by running it.
- Every focus item, by reading the code paths named above.

**Not verified:**
- F1, by running it. It needs a stale gate cache across tabs or server timing.
- The browser walk. The worker's 19-row build walk was not re-run.
- The full `vitest` suite.
- GitHub Actions on #764.
- Real Supabase and a real inbox.

## Verdict: fix-first

Exact fix list:

1. **F1 (required).** In `OnboardingScreen.tsx`, before navigating to a gated `end` (any `end !== APP_HOME_PATH`),
   reset the gate's cache so its answer is fresh, the same way `writeMyDancerEdit` does. The minimal change is in
   the `start === 'done'` branch: call `qc.resetQueries({ queryKey: ['profile-completion'] })` before
   `setRedirectHome(true)`. Better still, do it in one shared helper next to `writeMyDancerEdit`, so there is no
   second copy of the key.

   Add a journey unit row in `tests/journeys/gateCacheReset.test.ts`: the cache says "incomplete", `my_dancer_edit`
   says "done", the URL is `/app/welcome?returnTo=/account/o`, and the gate is refetched before the redirect.
   Run that row red on 4f0c8e2 first.
2. **F2 (owner decides, then pin it).** Either:
   - (a) Keep decision 2 and add a journey row `organiser-link-closed-tab-after-required` whose END is `/app/home`,
     so the drop is mapped rather than silent. Or:
   - (b) In `signInLanding` (`accountRouting.ts`), send a single complete dancer side with `organiserIntent`, no
     organisers and no open request to `ORGANISER_HOME_PATH`. Leave the dancer side's `to` unchanged, so the
     switcher's dancer entry still opens the dancer app. Add that row with END `/account/o`.

   Option (b) changes where all 4 prod organiser-type accounts land on every sign-in until they run an organiser.
