# Handover: auto-join-web (typed-code sign-in joins organiser pages)

Branch `claude/auto-join-web`. Brief: bachata-admin `docs/briefs/auto-join/auto-join-web.md`.

## Done
- `claimOrganisersAtSignIn(userId)` in `src/lib/claimMyOrganisers.ts`: the claim plus the invite pre-fill into THE one store (`lib/invitePrefill`), used by BOTH AuthCallback and AuthStepper.
- `parseClaimedOrganisers` reads `via` and `prefill`; old shape unchanged.
- `src/lib/claimSignInLanding.tsx`: shared landing path, toast rule and toast, extracted from AuthCallback.
- `AuthStepper.handleAuthSuccess` claims once after `claimAtSignIn`; explicit returnTo, then pending returnTo, then /account/o; `onAuthenticated` hosts continue in-page after the claim ran.
- Tests: `src/pages/__tests__/AuthSignInOrganiserClaim.test.tsx` (path x claim result table).

## Note
`/auth` page's typed code already hands over to /auth/callback; the gap was AuthStepper hosts (ProfileEntryFlow, CreateVideographerProfile).

## Left
Owner review; real phone/inbox test once admin #947 is applied.
