# Brief: organiser Get paid link, part B -- sign-in and invite landings that end on Get paid (auth logic)

Brief-version: 2
Branch: claude/organiser-getpaid-auth
Lane: normal, OPUS (auth and callback logic; independent review follows). bachata-website; src + tests + docs, NO migration, no supabase/**, no workflow edit. You never approve or merge. ONE push at the end. Do NOT touch the event screens, the calendar-protected files in CLAUDE.md, or anything under src/modules/organiser/p3/ (part A, branch claude/organiser-getpaid-link, owns the Get paid screen and runs in parallel; you must not import from its files).
Serves: a non-technical organiser who taps ONE WhatsApp link, signs in by emailed link with no password, and lands on the Get paid screen. Two link kinds: someone who already has a login gets a sign-in link whose returnTo is the Get paid path; someone with NO login gets the admin's invite link /join/<token> with `next=get-paid` added.

## What main lacks
Found by the 2026-11-07 read of origin/main 4504f7fb0:
- proof that a sign-in (callback mode=signin) honours a returnTo when the dancer profile is an incomplete stub: the branch at AuthCallback.tsx ~336-420 ends in navigateToSignedInFallback and was not shown to keep the returnTo -- grep: navigateToSignedInFallback
- an invite link that lands on Get paid after the person joins: doneTarget (join/JoinScreens.tsx:169) goes to acceptedInviteLanding, the organiser home -- grep: doneTarget

## Files
src/pages/AuthCallback.tsx (exists: ONLY the returnTo case in 3a; read lines ~286-420 first)
src/lib/auth-otp-routing.ts (exists: isTaskReturnTo, only if 3a is red)
src/modules/admin-organisers/join/JoinPage.tsx (exists: read `next`, keep it through the code step)
src/modules/admin-organisers/join/JoinScreens.tsx (exists: doneTarget and the Done button)
src/pages/__tests__/AuthCallbackGetPaidReturn.test.tsx (new)
src/modules/admin-organisers/join/__tests__/JoinGetPaidNext.test.tsx (new)
docs/handover/organiser-getpaid-auth.md (new)

## What to build
THE ROUTE PATH CONSTANT, agreed with part A: `/account/p3/get-paid` with the query `?o=<organiserId>` (encodeURIComponent). Define the literal ONCE in your own code (an exported const in auth-otp-routing.ts) and use it in both changes; do not import from src/modules/organiser/p3. Add a test line asserting the built string equals exactly `/account/p3/get-paid?o=<id>`.
3a. A person who has a login. Prove FIRST, red, with a mocked-callback test: a sign-in (callback mode=signin) whose returnTo is `/account/p3/get-paid?o=<id>` lands there when (i) the dancer profile is complete, and (ii) it is an incomplete stub (the fix-up branch). If (ii) drops the returnTo, make the smallest change that honours it by extending isTaskReturnTo in lib/auth-otp-routing.ts for this path (no second predicate, no other landing changes). A sign-up with the same returnTo keeps today's behaviour (a row proving no change). The unknown-email case on /auth?mode=signin (it flips to the full sign-up form, Auth.tsx ~286-296) is NOT changed; say in the handover that it is why an organiser with no login must get the invite link, not this one.
3b. A person with NO login. The admin invite link /join/<token> (organiser_invites; JoinPage binds the email with bind_organiser_invite_email_v1, then ONE signInWithOtp with shouldCreateUser true, so an unknown email never sees the full sign-up form or the 403 "limited to approved organisers"; claimOrganisersAtSignIn and find-before-create are untouched). Add ONE optional query param on the join URL, `next=get-paid`, read in JoinPage. When present and the redeemed seat is owner or manager, doneTarget returns `/account/p3/get-paid?o=<redeemed organiser id>` and the Done button reads "Set up payments". Any other value of `next`, or a contributor seat, is ignored (home as today, button as today). `next` must survive the in-page code step (codeStepSearch keeps other params; assert it) and the already-signed-in and already_member paths. Do NOT change what an invite is, who can create one, or bind / redeem behaviour. The organiser id for the Get paid path is the redeem answer's own id, else the person's single matching page, exactly as doneTarget already chooses it; when it is null, land on the organiser home as today.
Both cases are MOCKED: do not assume anything about a real account's state.

## Tests
Table-driven, red first for 3a (record how many rows fail on the unfixed code). AuthCallbackGetPaidReturn.test.tsx: sign-in x returnTo = get-paid path x {complete dancer, incomplete stub}; sign-up unchanged. JoinGetPaidNext.test.tsx: {next=get-paid, absent, other} x {owner seat, manager seat, contributor seat, redeem gives no id} x {unbound link then code step, already signed in, already_member} asserting where Done goes, its button text, and that `next` survives the code step. The existing tests/AuthCallback*.test.tsx and the join tests stay green. Mutate once each (drop `next` from codeStepSearch, treat contributor as manager) and see rows fail.

## Verify
New tests, the existing AuthCallback*.test.tsx and admin-organisers join tests, tests/realDataVerified.test.ts, `npm run typecheck`, `npm run check:mojibake`.

## Done when
Both cases in, tests green with the red-first count for 3a recorded, handover docs/handover/organiser-getpaid-auth.md with Verified / Not verified (Not verified names: real email delivery, a real invite redeem, Ritmo's account state, part A's screen); last commit subject ends with your worker-done marker; one push; do not edit the PR body.
