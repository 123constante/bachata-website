# Public entry journeys: every way into an account

Owner rule 2026-10-15: every public entry link is mapped, tested, and walked through to its END screen.
The row ids here are the same as in `tests/journeys/publicEntryJourneys.ts`, which is the single row list.
Two specs read that list:

- `tests/journeys/publicEntryJourneys.test.ts` drives each row through the routing model. It uses the same
  functions the pages call, so there is no second copy of the routing.
- `tests/e2e-build/public-journeys.build.spec.ts` walks each row in the production build at 390x844.

Screenshots and the walk table are in `docs/review-packs/public-journeys/`.

## How a person gets in (found by reading the code)

| Entry | Built at | URL produced |
|---|---|---|
| Organiser launch link | shared by the owner | `/auth?mode=signup&userType=organiser&returnTo=%2Faccount%2Fo` |
| Dancer link, and the home banner button (PR #765, `HOME_ANNOUNCE_HREF`) | `src/lib/homeAnnounceBanner.ts` on `claude/home-announce-banner` | `/auth?mode=signup&userType=dancer` |
| Header **Sign in** | `GlobalHeader.tsx` -> `buildSignInHref(here)` | `/auth?mode=signin&returnTo=<this page>` |
| Signed-out deep link `/app/*`, `/account/*` | `AuthGuard.tsx` | `/auth?mode=signin&returnTo=<the page>` |
| Organiser team invite | `inviteModel.ts` -> `/invite/<token>`, then `InviteRedeemPage.tsx` | `/auth?mode=signin\|signup&returnTo=/invite/<token>` |
| "Sign in to claim" on a public organiser page | `publicClaim.ts signInToClaimHref` | `/auth?...&returnTo=/organisers/<slug>?claim=1` |
| Rating card, RSVP, attendance and festival prompts | `AuthPromptModal`, `LevelRatingSignInSheet`, `attendanceAuth.ts` | `/auth?mode=...&returnTo=<the page>`, also stashed in `auth_pending_return_to` |
| Directory / profile links | `Dancers.tsx`, `ProfileEntryRouter.tsx` | `/auth?mode=signin&returnTo=/dancers` or `/profile` |
| E-mailed link (magic link) | `Auth.tsx` `emailRedirectTo` | `/auth/callback?mode=signup\|signin[&returnTo]`. The e-mail template only carries `{{ .ConfirmationURL }}` |
| Expired or invalid link | `AuthCallback.tsx` | `/auth?mode=signin&callbackError=expired\|invalid[&returnTo]` |

How each hop carries the destination:

| Hop | What carries it |
|---|---|
| `/auth` | `returnTo` in the URL, sanitized by `sanitizeReturnTo`. `userType` goes into the sign-up metadata `user_type` and `pending_profile_role`. |
| Code step | `handleCodeVerified` goes to `/auth/callback?mode&returnTo`. |
| `/auth/callback` | `routeOnwards` takes the returnTo, else the stash, else `landingPathAfterAuth`. |
| Gated `/account/o` | `DancerProfileGate` sends the person to `/finish-profile?returnTo=/account/o`. |
| `/finish-profile` | `AllowedRedirect` / `oldDancerHomeRedirect` sends them to `/app/welcome?returnTo=/account/o` (**the fix**: the returnTo used to be dropped here). |
| Photo step | `photoHandoff(returnTo)` goes to `/app/me/photo?return=/app/welcome?returnTo=...` and back. |
| End | The end button calls `onboardingEnd(returnTo)`. |

## The rows

Settings for every row: organiser self-serve is on (as in prod). "Back" means the browser Back button on the
END screen. Every redirect on the way uses `replace`, so Back never returns to `/auth` or to onboarding.

### Organiser link

**`organiser-link-new`: organiser link, new e-mail.** This is the owner's failure on 2026-10-15.

Steps:

1. `/auth` sign-up: name, city, role. The role is Organiser, already set from the link.
2. E-mail, then the 6-digit code.
3. `/auth/callback` goes to `/account/o`, the gate sends the person to `/finish-profile?returnTo=/account/o`, and that redirects to `/app/welcome?returnTo=%2Faccount%2Fo`.
4. Cards: the required ones, then the photo screen and back. Then the "You're in" card, with Boost (years, styles), then the end button "Next: set up your organiser page".

END: `/account/o`, the organiser OnboardingView ("claim your page").

State: the dancer profile is complete, there is no organiser yet, and metadata `user_type` = organiser. A reload stays on `/account/o`.

**`organiser-link-new-reload`: the same, with a reload half way through onboarding.**
The reload re-reads `/app/welcome?returnTo=%2Faccount%2Fo`, and onboarding resumes at the first missing card.
END: `/account/o`.

**`organiser-link-new-closed-tab`: the same, but the person closes the tab half way and later signs in from the header.**
Sign-in lands on `/account/continue`. `signInLanding` sees an unfinished dancer, no organiser and organiser intent
(the sign-up `user_type`), and sends them to `/app/welcome?returnTo=%2Faccount%2Fo`.
END: `/account/o`.

**`organiser-link-magic-link`: the same, but the person opens the e-mailed link in the same browser.**
The link is `/auth/callback?mode=signup&returnTo=%2Faccount%2Fo`, and the rest is the same as the code step.
END: `/account/o`.

**`organiser-link-wrong-code`: the same, with a wrong code first.**
The code step shows an error and stays open. The right code then carries on as in `organiser-link-new`.
END: `/account/o`.

**`organiser-link-expired-link`: the same, but the e-mailed link has expired.**
The person lands on `/auth?mode=signin&callbackError=expired&returnTo=%2Faccount%2Fo`, which says the link expired.
They sign in from there, and the returnTo is kept.
END: `/account/o`.

**`organiser-link-existing-dancer`: organiser link, e-mail that already has a finished dancer.**
The sign-up says "account exists" and switches to sign in, keeping the returnTo. Then the code, and the callback
goes to `/account/o`, where the gate passes.
END: `/account/o`, the OnboardingView. The dancer profile is unchanged.

**`organiser-link-signed-in`: organiser link opened by someone who is already signed in.**
`/auth` sees the session and goes straight to the returnTo, with no form (**new**).
END: `/account/o`.

**`organiser-link-hostile-returnto`: organiser link with `returnTo=https://evil.example/`.**
`sanitizeReturnTo` drops the off-site value. The organiser-type sign-up still lands on `/account/o`
(`landingPathAfterAuth`).
END: `/account/o`. The person is never sent off-site.

### Dancer link and banner

**`dancer-link-new`: dancer link (also the banner), new e-mail.**
Sign-up, then the code. The callback goes to `/account/continue`. One side (the unfinished dancer), so on to `/app/welcome`.
Then the cards, the photo, "Go to Home".
END: `/app/home`. This is unchanged.

**`dancer-link-new-reload`: the same, with a reload half way.**
END: `/app/home`.

### Plain sign-in

**`signin-dancer`: Sign in, existing dancer.**
The code, then `/account/continue`. One side, so straight on.
END: `/app/home`.

**`signin-both`: Sign in, organiser who is also a dancer.**
The code, then `/account/continue`.
END: the "Continue as..." chooser, organiser first.

**`signin-unfinished-dancer`: Sign in, dancer who never finished.**
`/account/continue`, then `/app/welcome`, then the cards.
END: `/app/home`.

### Deep links and invites

**`deep-link-account-o-signed-out`: signed out on `/account/o`, a new e-mail signs up.**
`AuthGuard` sends them to `/auth?...returnTo=%2Faccount%2Fo`, then the same path as the organiser link.
END: `/account/o`.

**`deep-link-app-signed-out`: signed out on `/app/nights`, an existing dancer signs in.**
`/auth?mode=signin&returnTo=%2Fapp%2Fnights`.
END: `/app/nights`.

**`team-invite-new`: team invite link, new e-mail.**
`/invite/<token>` has a sign-up button that goes to `/auth?...returnTo=/invite/<token>`. Then the gate, then
`/finish-profile?returnTo=/invite/<token>`, then onboarding, whose end button says "Next: join the team".
END: `/invite/<token>`, the redeem card.

**`claim-link-new`: "Sign in to claim", new e-mail.**
`returnTo=/organisers/<slug>?claim=1` is a gated target. Then onboarding, whose end button says "Continue".
END: the public organiser page with the claim card.

Not a row: an organiser with **no** dancer row. The prod survey on 2026-10-15 found none (every organiser
account has a dancer profile), and dancer-first gates it onto the Finish screen, which has its own message-us path.

## Decisions made by the worker (no answer in the code before)

1. **Every hop carries the onward destination as `?returnTo=`**, including `/finish-profile` to `/app/welcome`,
   and the photo hand-off there and back. A reload keeps it because it lives in the URL, not in storage.
2. **Closing the tab and signing in again later keeps the organiser intent.** It is read from the sign-up
   metadata `user_type` (the same reading `landingPathAfterAuth` uses). This only applies while the dancer
   profile is unfinished and the person runs no organiser. Once finished, a sign-in is a plain sign-in.
3. **A signed-in person on `/auth` is sent on** to the link's returnTo, or to `/account/continue`, instead of
   being shown a sign-up form again. This never happens once a code was sent, because the code step hands over
   to `/auth/callback` itself.
4. **The end button names where it goes**:

   | Destination | Button |
   |---|---|
   | Home | "Go to Home" |
   | `/account/o` | "Next: set up your organiser page" |
   | `/invite/...` | "Next: join the team" |
   | anything else | "Continue" |

   No copy says Home when it does not go Home.
5. **A finished profile on `/finish-profile?returnTo=X` goes to X**, not to the dancer Home. An explicit
   returnTo always wins.
6. **Only same-site relative paths ride on** (`onwardReturnTo`: `sanitizeReturnTo`, and never `/app/welcome` or
   `/finish-profile`, which would loop). Off-site, `//host`, backslash, control characters and `/auth` are dropped.
7. **The optional questions stay optional.** The owner asked for the FULL setup, so the "You're in" card still
   offers Boost to 100% (years, styles) before the end button. Skip on those cards works as for a dancer.
