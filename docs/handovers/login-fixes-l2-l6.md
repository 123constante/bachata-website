# Handover: login audit FIX LATER L2, L3, L4, L6 (invite join screens)

Branch `claude/login-fixes-l2-l6`. Class: BUILD-visual (small). Source: `docs/audits/login-journeys-2026-10-29.md`
(branch `claude/p3-journey-audit`), section FIX LATER. Not touched: `src/pages/Auth.tsx`, or anything that
decides where sign-in lands.

## What changed

One shared mapping, `REDEEM_COPY` / `reasonScreen()` in `src/modules/admin-organisers/inviteModel.ts`, now
carries the next action as well as the words: two new optional fields, `help` (show the WhatsApp help link)
and `retryBlocked` (show Try again DISABLED, with this reason). The join stop screen renders only what the
mapping says, through one new `ReasonActions` piece in `join/JoinScreens.tsx`.

| Item | Fix |
|---|---|
| L2 `team_full` | `help: true`, so the screen shows "Message us on WhatsApp" (`SIGNUP_HELP_WHATSAPP_URL`, the same link the blocked-domain and no-profile screens use) as well as the home link. |
| L3 `unconfirmed_account` | `joinModel.ts` no longer maps it to `sign_in` (which signed the person out). It falls through to `refused`, so the screen shows "Confirm your account first". |
| L4 unknown reason | The `refused` stop now renders the fallback's `action: 'retry'`: Try again (redeems again) plus the home link. `JoinPage.retry()` re-runs `join()` for a `refused` stop. |
| L6 `rate_limited` (after Join) | `action: 'retry'` + `retryBlocked: 'Please wait an hour before trying again.'`: Try again is disabled, the reason sits under it (`aria-describedby`). Body copy comes from `REDEEM_COPY` (the duplicate `JOIN_COPY.rateLimited.bodyJoin` is removed). The code-send rate limit ("wait a minute") is unchanged: its Try again only goes back to the email box and sends nothing. |

Tests: new `join/__tests__/refusalMatrix.test.tsx` (every redeem reason + an unknown one + an empty answer,
x the post-Join stop screen and the dead-link screen: title, help link, retry none/enabled/disabled, home
link, no raw code). `joinModel.test.ts` row for `unconfirmed_account` now expects `refused`.
`joinJourney.test.tsx` gains four journey tests (L2/L3/L4/L6). Phone e2e E8 (`tests/e2e-phone/invite-join.phone.spec.ts`)
now expects a disabled Try again with its reason and uses the home link as the primary control.

## Verified

- The diff by reading it: no raw Unicode punctuation added (copy uses plain ASCII; the test uses a `’` escape).
- All source edits went through `scripts/safe-edit.py` / `safe-write.py` (mount-verified; their TS parse
  phase did NOT run because `typescript` is not installed).

## Not verified (this machine has no `node_modules`; `npm ci` / `npm install` needed an approval this
non-interactive session could not get)

- `npm run test:unit`: NOT RUN (`vitest: not found`). So the red-first run was NOT done either. Expected red on
  unchanged code, from reading it: L3 rows (`unconfirmed_account` -> `sign_in`, no stop screen), L2 (no help
  link), L4 (no `join-retry` on the refused screen), L6 (Try again enabled, `retryBlocked` undefined), and the
  three "mapping itself" tests.
- `npm run typecheck`: NOT RUN (`react-router: not found`).
- `npm run lint`: NOT RUN meaningfully (chain links exit 127/2 without dependencies).
- `npm run check:bundle-budget` on main and branch: NOT RUN (needs `npm run build`). Expected zero bytes to the
  `/app` first load: the change is inside the lazy invite route's existing modules, no new import.
- `npm run test:e2e` / the phone e2e spec: NOT RUN.
- Browser walk at 390x844: NOT DONE.
- Live reason list: NOT READ. The Supabase MCP `execute_sql` permission was not granted, so the body of
  `redeem_organiser_invite_v1` on prod (`stsdtacfauprzrdebmzg`) was not read. The matrix uses the reason list the
  existing tests record from the live body of 2026-10-11 plus `team_full` and A2's `not_linked`.
- `/code-review` has NOT run (Ricky types it); no review stamp.

## For the PR body, under "Verified on real data"

- Shapes: the distinct `reason` values `redeem_organiser_invite_v1` can return on prod, read-only from
  `pg_get_functiondef` (this worker could not; the lead or a worker with MCP access should). Every value must be a
  row in `refusalMatrix.test.tsx` `ROWS` (the "every reason REDEEM_COPY knows" test catches only the reverse).
  If prod returns a reason not in `REDEEM_COPY`, it now gets the fallback with Try again (L4), which is correct.
- The unit, typecheck, lint, bundle-budget (main vs branch) and phone e2e runs above, with real output.
- Browser walk at 390x844 of the four stop screens (team_full, unconfirmed_account, unknown reason, rate_limited
  after Join), with mocked redeem answers, since none can be safely produced on prod.
- Honest "Not verified": none of these refusals was produced against prod data.

Next: install dependencies, run the four commands, confirm the matrix is red on `main` (check out the new test
file only) and green here, then `/code-review` (user-facing: two rounds).
