# Handover: organiser Get paid link, part B -- sign-in and invite landings (auth logic)

Brief: `brief/organiser-getpaid-auth` `docs/briefs/organiser-getpaid-auth.md` (v2). Branch `claude/organiser-getpaid-auth`,
cut from origin/main `e4689df`. Ticket dt_3bdcfdab2e67. No migration, no supabase/**, no workflow edit, nothing under
`src/modules/organiser/p3/` touched or newly imported.

## The path constant
`GET_PAID_START_PATH = "/account/p3/get-paid"` and `getPaidStartPath(id)` (`?o=` + encodeURIComponent) in
`src/lib/auth-otp-routing.ts` -- the literal lives once; both cases build it. A test asserts the built string is
exactly `/account/p3/get-paid?o=<id>`.

## 3a -- a person who has a login (sign-in link, returnTo = Get paid path)
- Red-first: `src/pages/__tests__/AuthCallbackGetPaidReturn.test.tsx` run against unfixed main with the literal path:
  **0 of 6 landing rows failed** (only the 2 rows that import the new constant failed, for the missing export).
  `/account` is already in `isTaskReturnTo`'s TASK_PATHS, so neither the complete-profile branch nor the fix-up
  branch (stub filled from metadata, or the signed-in fallback when the metadata is too thin) drops this returnTo.
  **No change to `AuthCallback.tsx` or `isTaskReturnTo`** -- the brief's "only if red" condition was not met.
- Rows: sign-in x {complete, stub filled (fix-up), stub too thin (fallback)}; sign-up (dancer complete, organiser
  complete, dancer stub filled) = today's behaviour, all land on the Get paid path with the query intact.
- Mutation: making `isTaskReturnTo` refuse the path fails 2 rows (the organiser sign-up row + the predicate row).
- **Not changed, on purpose:** an unknown email on `/auth?mode=signin` flips to the full sign-up form
  (Auth.tsx ~286-296). That is why an organiser with NO login must be sent the invite link, not a sign-in link.

## 3b -- a person with NO login (admin invite link + `next=get-paid`)
- The real route is `/invite/<token>` (AnimatedRoutes; the brief calls it `/join/<token>`); JoinPage serves it.
  The link to send: `/invite/<token>?next=get-paid`.
- `joinModel.ts`: `interpretJoinRedeem` now reads `member_role` from the redeem answer (prod
  `redeem_organiser_invite_v1` returns it on both `redeemed` and `already_member`, read-only check of the function
  body 2026-11-07); unknown/absent = left out. `redeemAction` passes it on. New pure helpers: `wantsGetPaid`,
  `seatCanSetUpPayments` (owner/manager only), `codeStepSearch(email, keep)` keeps other params,
  `searchAfterCodeStep` / `withoutCodeStep` for leaving the step.
- `JoinPage.tsx`: `next` captured at first render (stripToken rewrites the address at Done) and kept in the address
  through the code step (send and Change email / after verify). The redeemed role is stored next to the redeemed id.
- `joinApi.ts`: the emailed sign-in link's returnTo carries `?next=get-paid` too (tapping the link instead of typing
  the code would otherwise lose it). Only the honoured value rides; any other `next` is not forwarded.
- `JoinScreens.tsx` `doneTarget(..., getPaid)`: with an id and the organiser area on, Done goes to
  `getPaidStartPath(id)` and the button reads "Set up payments" (`JOIN_COPY.done.buttonGetPaid`). No id, area off,
  other `next`, contributor: today's target and words.
- The organiser id is chosen exactly as before (redeem id, else the single matching page). Consequence: an
  `already_member` answer on the **Join tap** sets no id (today's rule), so it lands on the plain organiser home even
  with `next=get-paid`; the **used link opened by its member** keeps the id and goes straight to Get paid. Owner call
  if the Join-tap already_member should also go to Get paid.
- `scripts/lint-runtime-architecture.mjs`: the new test added to the `no-legacy-organiser-fields` allowlist next to
  its siblings (it feeds the redeem answer's `organiser_id`).
- Tests: `src/modules/admin-organisers/join/__tests__/JoinGetPaidNext.test.tsx`, 45 rows: {get-paid, absent, other}
  x {owner, manager, contributor, no id} x {unbound link then code step, already signed in, already_member (used
  link)} + Join-tap already_member + pure codeStepSearch rows. Mutations: drop `next` from codeStepSearch -> 11
  fail; treat contributor as manager -> 3 fail.

## Verified
- New tests green; all `src/pages/__tests__/` (AuthCallback*) and `src/modules/admin-organisers/` tests green,
  plus `tests/realDataVerified.test.ts`: 75 files / 1959 tests.
- `npx tsc --noEmit -p .`: 0 errors. `npm run typecheck`: 0 errors in branch files (main carries pre-existing
  errors elsewhere, e.g. Venues.tsx, joinCopyRoughEdges.test.tsx -- untouched).
- `npm run check:mojibake` clean. `npm run lint:architecture` passes.
- Shape check (read-only SELECT on prod function definitions only): the redeem answer's `member_role` field.

## Not verified
- Real email delivery (OTP code / emailed link).
- A real invite redeem end to end.
- Ritmo's account state (whether they have a login; which link kind they need).
- Part A's Get paid screen (`/account/p3/get-paid`) -- not on this branch; landing there is asserted by path only.
- No browser walk at 390x844 (only the Done button's words/target changed; no layout change).
- eslint on JoinPage.tsx reports pre-existing `react-hooks/refs` errors on untouched lines (arrivedUsed).

## Next steps
- Part A merges the screen at the agreed path; then a phone walk of both link kinds.
- Admin side: produce the `?next=get-paid` invite link for organisers with no login.
