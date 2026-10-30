# Review r1: Website PR #1157, login audit L2 L3 L4 L6 (invite join refusal screens)

Reviewer: zero-context review worker (did not build this). Branch reviewed: `claude/login-fixes-l2-l6` @ `ebe96d6`
against `origin/main` @ `2afd8d9`. Brief: `docs/briefs/review-login-fixes-l2-l6.md` (branch `brief/review-login-fixes-l2-l6`).
No product code changed. No approval, no merge.

## Verdict: PASS (nits only)

No BLOCK, no SHOULD-FIX. All four fixes do what the audit asked, through the one shared mapping (`REDEEM_COPY` /
`reasonScreen()`), and every check I could run is green with zero bytes added to any first load.

## 1. Red first (run, not reasoned)

I put the branch's three test files (`refusalMatrix.test.tsx` (new), `joinJourney.test.tsx`, `joinModel.test.ts`) on
UNCHANGED main source and ran `npx vitest run src/modules/admin-organisers/join/__tests__`:

- **main source: 14 failed / 291 passed (305).** `refusalMatrix.test.tsx` alone: 9 failed / 25 passed (34).
  - L3: `unconfirmed_account -> refused` (matrix + `joinModel.test.ts`), its stop-screen row, and the journey test.
  - L6: `rate_limited` row (`retry='disabled'`), "a disabled Try again says why", "rate_limited carries its wait reason", journey test.
  - L2: `team_full` row (`help=true`), "team_full is the only reason that offers the WhatsApp help link", journey test.
  - L4: `brand_new_reason` row (`retry='enabled'`), journey test.
  - "every refusal and failure keeps the home link" also fails on main, but only because the L3 row produces no stop
    on main (`TypeError: Cannot read properties of null (reading 'kind')`), not because home was missing. Fine.
- **branch: `npx vitest run src/modules/admin-organisers` 25 files, 768 passed, 0 failed.**

Every L2/L3/L4/L6 row is red on main and green on the branch.

## 2. Every refusal reason x screen

Read from `joinModel.ts` `interpretJoinRedeem`, `inviteModel.ts` `REDEEM_COPY`, `JoinScreens.tsx` `StopScreen` /
`ReasonActions` / `DeadScreen`, `JoinPage.tsx` `retry()`.

| Live reason | Outcome | Screen and next action |
|---|---|---|
| `sign_in_required`, raised `authentication_required` | `sign_in` | sign-in flow (unchanged) |
| `unconfirmed_account` | `refused` (was `sign_in`) | "Confirm your account first", home link only |
| `email_unproven` | `email_unproven` | switch account (unchanged) |
| `email_mismatch` | `wrong_account` | WrongAccountScreen (unchanged) |
| `rate_limited` | `rate_limited` from `join` | "Too many tries" (REDEEM_COPY words), Try again DISABLED + "Please wait an hour before trying again." (`aria-describedby`), home |
| `invalid` `used` `revoked` `expired` | `dead` | DeadScreen: no retry, no help (unchanged; matrix covers it) |
| `team_full` | `refused` | "This team is full" + "Message us on WhatsApp" (`SIGNUP_HELP_WHATSAPP_URL`) + home |
| `not_linked` | `not_linked` | unchanged |
| raised `profile_incomplete` (via `_require_complete_dancer_profile_v1`) | `profile_incomplete` | unchanged |
| any other reason | `refused` | fallback "Something went wrong" + Try again (enabled, redeems again) + home |
| empty answer / other raised error | `failed` | network screen, Try again (unchanged) |

- One next action per screen; every refusal keeps the home link; the only disabled control (rate_limited) says why,
  tied by `aria-describedby`. No copy points at a missing control: team_full's "ask the Bachata Calendar team" now
  has the link. `JOIN_COPY.rateLimited.bodyJoin` removed, so the redeem limit's words live in one place.
- `retry()` for a `refused` stop re-runs `join()`. Only the fallback shows an enabled Try again on a `refused` stop
  (`ReasonActions` renders retry only for `action === 'retry'`, and only the fallback and `rate_limited` have it;
  the matrix pins that `retryBlocked` is on `rate_limited` only). The old `rate_limited && from === 'join'` retry
  branch is gone, and the button is disabled, so a redeem rate limit cannot redeem again from this screen.
- Code-send rate limit (`from: 'code'`): same heading, `OTP_RATE_LIMITED_MESSAGE` body, Try again enabled, and
  `retry()` still falls through to `clearStep()` (back to the email box, sends nothing). Unchanged; matrix pins it.
- **`unconfirmed_account` not signing out: safe.** The redeem refuses before any write, so there is no half-made
  membership. The person keeps whatever session they already had; nothing new is created. Prod shape (read-only
  count of `auth.users`): 5 of 43 accounts are unconfirmed and **0 of them have ever signed in**, so no prod
  account can reach this screen today. Signing out, the old behaviour, threw away the reason.

## 3. Live redeem RPC (read-only, prod `stsdtacfauprzrdebmzg`)

`redeem_organiser_invite_v1(text)`, from `pg_get_functiondef` (SELECT only):

- Returned `reason` values: `sign_in_required`, `unconfirmed_account`, `email_unproven`, `email_mismatch`,
  `rate_limited`, `invalid`, `used`, `revoked`, `expired` (the last three via `v_reason`), `team_full`, `not_linked`.
- Raised: `authentication_required`; `profile_incomplete` via `PERFORM public._require_complete_dancer_profile_v1()`;
  `redeem_not_linked` inside the A2 sub-block (handled in the body, surfaces as `reason: 'not_linked'`).
- **Every live reason is a row in `refusalMatrix.test.tsx` `ROWS`, and has a `REDEEM_COPY` entry or a dedicated
  outcome. None missing.** Anything raised by the helpers it calls (`claim_my_dancer_profile_v1`,
  `_organiser_member_set_p5`) lands on `failed` (Try again), which is the right default.

## 4. Phone e2e E8

Before: `screenOk(page, 'E8-rate-limited-join', 'join-retry')`, which proved the (wrong) enabled retry was tappable.
After: `toBeDisabled()` on `join-retry`, exact text of `join-retry-why`, and `screenOk` on `invite-home` (visible,
>= 44 px, in the 844 px viewport, what a tap reaches, no overflow). That is stronger, not weaker: it pins the L6
behaviour and still proves a hittable way on. Not run against main, but `toBeDisabled()` cannot pass there (main
renders the button enabled).

Ran `npx playwright test --config playwright.phone.config.ts tests/e2e-phone/invite-join.phone.spec.ts` on the
branch: **56 passed (5.5m)**, all projects incl. 360x640.

## 5. Scope, bundle, copy

- Files touched: only `src/modules/admin-organisers/{inviteModel.ts, join/*}`, their tests, the phone spec and the
  handover. Nothing in `src/pages/Auth.tsx`, `auth-otp-routing`, `AnimatedRoutes` or anything deciding where
  sign-in lands.
- `npm run build` + `npm run check:bundle-budget`, main vs branch: **every route's KB and file count identical**
  (`/app/*` 373.6 KB across 49 files on both, budget 374 KB; all budgets respected on both). Only chunk hashes differ.
  Zero bytes to the `/app` first load.
- `npm run typecheck`: exit 2 on BOTH main and branch with the identical 100 pre-existing errors (sorted diff empty);
  none in `admin-organisers`. The PR adds none.
- `npx eslint` on the changed `.ts`/`.tsx` files: clean.
- British English throughout. No raw Unicode in shipped source (see N1 for the test file).

## Findings

**BLOCK:** none.

**SHOULD-FIX:** none.

**NIT**

- **N1** `src/modules/admin-organisers/join/__tests__/refusalMatrix.test.tsx:48`: the `not_linked` title literal
  contains a raw U+2019 (`couldn’t`). The handover says "the test uses a `’` escape"; it does not. Test-only, never
  rendered, so harmless, but the handover claim is wrong and CLAUDE.md's no-raw-Unicode rule exists because of the
  FUSE mount. Use `’` or import the copy constant.
- **N2** `inviteModel.ts` `REDEEM_COPY.unconfirmed_account`: the screen offers only home, and "Confirm your email
  address from the message we sent you" assumes a message the person may not have (code sign-in confirms the address).
  Unreachable on prod today (0 unconfirmed accounts have signed in), so a copy tweak at most; no change needed for
  this PR.
- **N3** (pre-existing, out of scope) `JoinPage.tsx:151`: the bind step's `rate_limited` reuses `from: 'code'`, so it
  shows "wait a minute" with an enabled Try again. I did not read the live `bind_organiser_invite_email_v1` body,
  so whether its window really is a minute is unverified. Worth a line in a later audit, not this PR.

## Not verified

- Browser walk at 390x844 of the four stop screens by eye. The phone e2e did run them at phone sizes with mocked
  redeem answers and took screenshots, but I did not look at the shots.
- None of these refusals was produced against prod data (none can be safely produced); the live reason list was
  read from the function body, not from audit rows.
- Phone e2e and the full `npm run test:unit` / `npm run lint` chain / other CI jobs were not run on main; only the
  admin-organisers unit suite (branch), the join tests (main source, red-first), the phone invite spec (branch),
  typecheck, eslint on changed files, and bundle budget (both) were run.
- `bind_organiser_invite_email_v1` live body not read (N3).
- `/code-review` rounds for the PR are still the builder's / Ricky's step; this is an independent read, not that.
