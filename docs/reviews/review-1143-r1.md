# Review: Website PR #1143 (login dead ends F1 + F2), round 1

Reviewer: independent cloud worker (did not build it). Read-only: no code changed.
Reviewed: `claude/p3-login-deadends` @ `00f6627` against `main` @ `2f81eec` (merge base).
18 files, +100/-28.

## Verdict: PASS with should-fix

F1 is done properly and nothing turns anything on. F2 removes every live link to the two
retired paths, but the flag-off replacement target is `/auth` (the sign-in page), which
is not a listing route and is one of the things the owner says switches on later. Fix
finding 1 before merge if the Organisers directory flag can be on while self-serve is off.

## Findings

1. **Should-fix: flag-off "Join" / "Get Listed" send people to sign-in, not to a listing route.**
   `src/pages/Organisers.tsx:819` and `src/components/organiser/GetListedHoloCta.tsx:6` now
   use `flags.organiserSelfServe ? "/account/new" : "/auth"`. With the flag off:
   - `/auth` is the sign-in page. The owner intent is that sign-in switches on later
     together with the organiser area; the header deliberately shows no account entry while
     the flag is off (`src/lib/featureFlags.ts:59-61`). This link is a new public way in.
   - After signing in, `landingPathAfterAuth` with the flag off returns `/`
     (`src/lib/auth-otp-routing.ts:164-167`; Auth.tsx:115 also falls back to `/`). So
     "Are you an organiser? Add your events in minutes" -> Join -> sign in -> homepage:
     the same dead end F2 set out to remove, one step later, and the copy points at a
     capability that is not there.
   - The brief asks for "the working listing route". The working listing surface with the
     flag off is `ListingRequestForm` (section `organisers_directory`), opened inline the way
     `src/components/listing/EmptyCityNote.tsx:20,113` does. There is no standalone route for it.
   Suggested fix: with the flag off, open `ListingRequestForm` inline (or hide the CTA);
   keep `/account/new` for flag on.
   Impact today: the Organisers page sits behind `ComingSoonGate` (`organisersDirectory`),
   and `GetListedHoloCta` has no importer anywhere in `src/` or `app/` (dead component).
   So the exposure is only when `organisersDirectory` is on and `organiserSelfServe` is off.
   Prod env values not verified (see below).

2. **Low: a retired path survives in a template literal the new guard cannot see.**
   `src/pages/Onboarding.tsx:97` still does ``navigate(`/create-${pendingRole}-profile`)``.
   The PR changed only `VALID_ROLES` values to `/` (lines 16-19), but those values are never
   read: the map is only a membership check here and in `src/pages/AuthCallback.tsx:166`.
   The source-scan test (`loginDeadEnds.table.test.tsx:37`) matches the literal string, so it
   passes while the path is still produced. `Onboarding` has no route and no importer, so no
   user impact; but either delete the branch or point it at `/` so the guard means what it says.
   The `AuthCallback` value change is behaviour-neutral (confirmed: only the key is tested).

3. **Low: role-entry copy now points at home.** `ProfileEntryFlow.tsx:56-66` still offers
   "Organiser - Publish events and manage tickets." and "Videographer - Share work and get
   booked." but routes both to `/`; `OrganiserDashboard.tsx:94` "Use wizard" became a "Home"
   button. All of these are reachable only through `src/pages/Profile.tsx` -> `ProfileEntryRouter`,
   and `/profile` has no route (unrouted 2026-09-12). Dead code, no user impact; worth a
   follow-up to delete rather than keep re-pointing.

4. **Low: `/create-videographer-profile` remains** in `src/components/profile/VendorDashboard.tsx:47`
   and `src/components/profile/VideographerDashboard.tsx:25` (still in `KNOWN_UNROUTABLE`).
   Outside the brief's two paths and in dead files; noted for completeness.

5. **Nit: `DoneScreen`'s `selfServe` defaults to `true`** (`JoinScreens.tsx:164`), i.e. fails open
   to the organiser-home link. The only caller (`JoinPage.tsx:344`) passes the flag explicitly, so
   it is correct today; a required prop would make a future caller fail closed.

6. **Nit: flag-off copy makes a promise** (`joinCopy.ts:82`): "We will tell you when they are".
   British English and no missing control, but I did not find a mechanism that notifies team
   members at launch. If none exists, soften to e.g. "Your place on the team is saved for when
   they open."

## Checks from the brief

1. **Link targets / retired paths.** Every changed target is a route in
   `src/components/AnimatedRoutes.tsx`: `/` (122), `/auth` (283), `/account/new` (239, redirects
   home when the flag is off), `/account/o/*` (256). Whole-repo grep at `00f6627`:
   `/create-organiser-profile` - no remaining uses outside the new test's regex.
   `/listing-request` - only comments (`AnimatedRoutes.tsx:158,168`), a test id in
   `teachersGate.routes.test.tsx`, and the new test's regex. Caveat: finding 2 (template literal).
   `KNOWN_UNROUTABLE` entries for the three fixed links were removed, so the existing scan now
   guards them.
2. **DoneScreen both branches.** Flag on: unchanged (`JOIN_COPY.done.body`, link to
   `ORG_PATHS.home`). Flag off: honest body plus one next step, "Go to Bachata Calendar" -> `/`.
   `loginDeadEnds.table.test.tsx:45-55` renders both and asserts the org name, the href and that
   the href is routable. It does not assert the body copy per branch (minor gap).
   `joinJourney.test.tsx` now pins `organiserSelfServe: true`, so its existing journey assertions
   keep testing the flag-on path.
3. **Landing after sign-in with the flag ON: unchanged.** The only edit to
   `landingPathAfterAuth` deletes the flag-off `LEGACY_ROLE_ROUTES` line; the flag-on code below
   it is byte-identical. The flag-on tests in `auth-otp-routing.test.ts` were not modified and pass.
   The `AuthCallback` `VALID_ROLES` value change does not affect routing (finding 2).
4. **Copy.** British English throughout ("organiser"). No new text points at a missing control,
   except the pre-existing Organisers CTA in finding 1 and dead-code labels in finding 3.
5. **authCallback regression row is a real expectation.** I ran the PR's
   `tests/regression/today/authCallback.today.test.tsx` against `main`: the changed row
   ("organiser-type, self-serve OFF") **fails on main** (1 failed / 24 passed) and passes on the
   PR. So it pins the new behaviour; it was not loosened. All other rows are unchanged.

## Tests run (on `00f6627`)

`npx vitest run` on `loginDeadEnds.table`, `auth-otp-routing`, `navigateTargetsRoutable`,
`src/modules/admin-organisers/join/**`, `authCallback.today`: 8 files, 438 tests, all passed.

## Not verified

- Browser walk at 390x844 (flag on and off). Not done.
- The full CI job set for the PR (lint chain, pre-ship, e2e smoke, integrity) - only the
  targeted vitest files above were run.
- Production Vercel values of `VITE_ENABLE_ORGANISERS_DIRECTORY` and
  `VITE_ENABLE_ORGANISER_SELF_SERVE` (no token used; `.env.example` leaves them blank), which
  decide whether finding 1 is reachable in prod today.
- Whether any launch notification to invited team members exists (finding 6).
- Supabase shape survey: not applicable (routing and copy only; no data reads changed).
