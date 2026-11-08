# Organiser Get paid link, part A (branch claude/organiser-getpaid-link)

## Done
- `paths.ts`: `GET_PAID_START`, `getPaidStartPath(id)`, `getPaidSignInLink(origin, id)`; `stripeBack(..., from?: 'start')` (default unchanged, so You > Get paid still works).
- `GetPaid.tsx`: `GetPaidStart` (lazy route) + `startView`, the ONE mapping for heading / notes / the single primary button; `askOwner`; `addTicketPath` (exactly one live listed series goes straight to that event, else Events). `GetPaidScreen` markup and test ids untouched.
- Polling after `stripe=return`: refetch every 3 s up to 60 s, stops on connected, unmount, timeout; "Check again" restarts it.
- `P3Routes.tsx`: `get-paid` route, own frame, behind `flags.organiserTicketing`, before the P3Shell group.
- Tests: `getPaidStart.matrix.test.tsx` (36), walk `tests/e2e/walk-getpaid-start.spec.ts` (pictures to `GETPAID_SHOTS`), WALKS + MAP rows in `scripts/auto-walk-manifest.mjs`.

## Deviation from the brief
`data.ts` was listed read-only, but `useStartOnboarding` needed an optional second argument `from?: 'start'` so Stripe returns to the start path. Two-line change; the default behaviour is identical.

## Verified
- vitest: new matrix (36), whole `p3/tickets` folder, `tests/autoWalkManifest.test.ts` green.
- Mutations: dropping the polling stop fails "stops on connected"; dropping the `o` mismatch guard fails "an unknown o never shows another page". Code restored.
- Walk spec (5 scenarios) passes at 390x844 with route-mocked organiser fake: taps >= 44 px, no sideways scroll.
- `npx tsc --noEmit -p .`: 0 errors. `npm run check:mojibake`: clean.

## Not verified
- A real Stripe round trip; real email delivery; part B's sign-in landing (the `returnTo` is checked only with `sanitizeReturnTo`).
- The signed-out redirect row is covered by AuthGuard wrapping the routes (source-level), not by a rendered test.
- Prod-shape survey was not re-run (no schema or read change; the screen reuses existing reads). `npm run pre-ship` and the full CI job set were not run locally.

## Next
Part B (claude/organiser-getpaid-auth) lands sign-in; then send the `getPaidSignInLink` to Ritmo Latino.
