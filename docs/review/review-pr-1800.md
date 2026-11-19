# Review: PR #1800 (R4 door invite link), hard tier

head 7fec6350c4490eede2af3109ce1614fc3755df7e

## Verdict: PASS WITH NITS

## Hard-tier: PASS

Read-only review of `feat/organiser-r4-door-link` at the head above. Ran the vitest files for door, r4, flagOff, auth-otp-routing and src/components: 65 files, 1830 tests, all pass. Not run: tsc, e2e walk, a browser walk.

## Findings by brief item

1. **Token never logged or leaked: OK.**
   - `doorJoinApi.ts:11-17` throws fixed strings (`door_accept_failed`, `door_accept_unknown`), never the token or the server message. There is no `console.*` in the join files.
   - `DoorJoinPage.tsx:20-27` sets `referrer=no-referrer` while mounted. `:49-53` rewrites the address bar to `/door/join` once the token is used up. `:57-59` navigates with `replace` on ok, so the token leaves history.
   - A malformed token never reaches the server: `:31` and `:42` gate the effect on `DOOR_TOKEN_RE` (`/^[0-9a-f]{64}$/`, `doorLink.ts:8`).
   - Nit: signed out, the token rides in `/auth?returnTo=` (`:71`). The code comment says this is deliberate and the token is single use. I did not check whether Sentry breadcrumbs or the `/auth` page record that URL.
   - Nit: no test asserts "no console output" or "no token in logs".

2. **Every result value is handled: OK.**
   - `parseAccept` (`doorJoinModel.ts:26-34`) allows exactly the six results. An unknown result, or `ok` with no series id, returns null, and the API throws, so the page shows Try again.
   - `joinStepOf` (`:46-60`) switches over all six accept results with no fallthrough.
   - `parseMint` (`:97-105`) handles the five mint results. `ok` needs a valid 64-hex token.
   - `DOOR_MINT_WHY` has a message for each non-ok result.
   - `SeatDoorPage.tsx` checks no role and grants nothing. It only reads the night name (`my_door_seats_v1`) for the header. Who may scan is decided by the DB through the existing scan RPCs.

3. **Seat-only door has no path into /account/p3 or organiser screens: OK.**
   - `DoorScreen.tsx` routes every `P3_PATHS` link through the `SeatOnly` context: lines 216, 228, 384, and `EmptySold` at 453-464, where the event-page link is dropped. All exits go to `/`.
   - `SeatDoorPage` renders no organiser header or tab bar.

4. **Sign-in then accept; no open redirect: OK.**
   - `isDoorReturnTo` (`doorLink.ts:22-26`) is anchored. It accepts only `/door/join/<64 hex>` or `/door/<uuid>`, with no `//`, no query and no hash.
   - `buildSignInHref` passes the value through `sanitizeReturnTo`, which rejects `//`, backslashes and control characters.
   - Nit: `TASK_PATHS` now includes `/door` (`auth-otp-routing.ts:112`), so `isTaskReturnTo` accepts any `/door/...` path. This is wider than `isDoorReturnTo`, but it is still same-site and gives no extra access.

5. **Mint only on tap, for the chosen night, stale mint dropped: OK.**
   - `mintFn` is called only from `onCopy` (`R4DoorInvite.tsx:58-70`). There is no mount effect that mints.
   - The occurrence id comes from the event's dates for the next night, excluding cancelled ones (`:40`).
   - `forEvent.current` is compared before every state update (`:66,68,69`), and changing the event resets state (`:46`).
   - Copy is disabled while a mint is running (`canCopy`, `busy`).

6. **/door/* live with organiserR4 off, nothing else exposed: OK.**
   - Three routes were added (`AnimatedRoutes.tsx`): `/door/join`, `/door/join/:token`, `/door/:seriesId`. They are not behind the P3 flag.
   - `/door/:seriesId` sits behind `AuthGuard`. The join page asks the server only when signed in.
   - The only new P3 imports in routes are the two named lazy pages, and `flagOff.test.ts` pins them exactly.
   - The R4 invite page itself stays behind the R4 flag.

7. **Tests and guards: OK, with nits.**
   - Covered: `doorJoin.matrix.test.tsx` (accept results, used-up link, malformed token, signed out, resolving, retry, profile), `r4DoorInvite.matrix.test.ts`, `auth-otp-routing.test.ts` and `flagOff.test.ts`.
   - The catchall guard passes with the three new paths in `catchallClientPaths.ts`. The e2e spec is registered in `check-e2e-spec-coverage.mjs`.
   - Nit: no test covers a stale mint dropped after the event changes.
   - Nit: no test asserts the seat-only door has no `/account/p3` link.

## Not verified

- Phone walk at 390x844 and the e2e spec run.
- tsc on the PR head.
- The server side: that `ticket_door_seat_accept_v1` and `ticket_door_seat_invite_v1` enforce one use, a one-night window and ownership. This review covers the client only.
- Whether `/finish-profile` honours a `returnTo` of `/door/join/<token>`.
