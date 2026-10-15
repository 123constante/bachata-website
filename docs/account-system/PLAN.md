# Plan: PRs in merge order, split into worker slices

Built from [`ACCOUNT-MODEL.md`](ACCOUNT-MODEL.md), [`JOURNEY-GRID.md`](JOURNEY-GRID.md), [`GAPS.md`](GAPS.md) and the
recommended answers in [`DECISIONS.md`](DECISIONS.md). If the owner picks a different answer, only the PR
named under it changes.

How the plan is shaped:

- One PR per unit of work, pushed once (`docs/pr-batching-policy.md`).
- Inside a PR, slices share **no files**. Where two slices must meet, the meeting point is pinned below as an
  interface.
- Admin-repo migrations are marked **MIGRATION (admin, owner applies)**.
- Every PR ends with the CLAUDE.md "Definition of done" block. The grid rows it flips are walked at 390x844
  and named in "Verified on real data".

Sizes are rough: S is under 300 changed lines, M is 300-900, L is over 900.

## Shared rule for every slice: `journey-grid.json` has one writer per PR

`docs/account-system/journey-grid.json` is the shared ledger, so no slice edits it. Each slice ends its report
with a block like this:

```
GRID: <row id> built=BUILT covered_by+=J:<id> | R:<title> | E:<spec> | U:<file> | OTP:<spec>
```

The PR's **integration step** (the orchestrator, or one named follow-up worker) applies every block to the JSON,
runs `python3 docs/account-system/build_grid.py`, and from PR-1 onwards runs `npm run check:journey-grid`. Two
slices therefore never conflict on the ledger.

---

## PR-0: #764 `claude/dancer-app-routing` (in flight; merges first)

Not part of this plan. Everything below branches from `main` *after* #764 merges, because #764 owns
`accountRouting.ts` `signInLanding`/F2 and the 19 J rows the grid cites.

## PR-1 (Website): the grid becomes a gate, and the coverage backlog is closed. Size: L

Prod change: **none** (tests, docs and a lint-chain script only).

| Slice | Owns (files) | Does |
|---|---|---|
| **1a: check** | `scripts/check-journey-grid.mjs` (new), `scripts/journey-grid-baseline.json` (new), `scripts/__tests__/check-journey-grid.test.mjs` (new), `scripts/run-lint-chain.mjs` (adds one link), `package.json` (adds the `check:journey-grid` script line only) | Builds the check exactly as JOURNEY-GRID "The proposed CI check" (rules 1-5): ratchet baseline, self-test with a dangling-ref fixture (must exit 1) and a full-coverage fixture (must exit 0). It follows the six rules in `docs/ci-guard-notes.md` |
| **1b: rows + walks** | `tests/journeys/publicEntryJourneys.ts`, `tests/journeys/publicEntryJourneys.test.ts`, `tests/e2e-build/public-journeys.build.spec.ts`, `tests/e2e-build/account-edges.build.spec.ts` (new), `tests/e2e-build/fakes/*` if a fake needs a new person shape | Adds the 13 J rows and 6 build specs listed in MATRIX.md "Proposed follow-up", plus axe (`@axe-core/playwright`) on every J row's END (GAPS G-A2). Today's behaviour is pinned, including D2/D4 defaults. `ac.signout.storage` goes in as `test.fail` with a pointer to PR-3 |

**Pinned interface 1a/1b:** the JSON schema `version: 1` exactly as committed now (`id, matrix, entry, state,
action, end, transition, covered_by[{kind,ref}], people, coverage, decision, built`). 1a reads it; 1b only
reports GRID blocks. Kind `R` matches a **full** test title. Template titles (`${shape}: …`) are expanded by
1a from the `for` table in the spec.

**Integration:** apply the 1b GRID blocks, then run 1a `--write-baseline` once. The baseline then holds only
rows that are truly unwalked (`NOT BUILT` rows and rows waiting for PR-3/4/5).

## PR-2 (admin repo): back-end account hygiene. Size: M. **MIGRATION (admin, owner applies)**

Prod change: the grace erase stops being callable, the disposable domains are blocked, and the funnel table
exists. None of the three changes what a person sees today: the grace path has 0 rows, and the funnel is
write-only.

| Slice | Owns | Does | Settles |
|---|---|---|---|
| **2a: retire grace** | 1 migration, timestamp range `20261122100000-20261122100999` | `cron.unschedule('account-erase-due')`. `REVOKE EXECUTE` on `my_account_erase_request_v1`, `my_account_erase_cancel_v1`, `my_account_erase_status_v1`, `_account_erase_run_as_v1` from `anon, authenticated`. Keep the table (D15 option 1). Runbook line: undeploy `account-erase-due` and `organiser-signup` (`supabase functions delete`, owner) | O4, G-P4, G-S10 |
| **2b: blocklist seed** | 1 migration, `20261122101000-20261122101999` | Inserts the disposable-domain list from `docs/runbooks/dancer-area-open-close.md:40-43` into `signup_blocked_domains` (`ON CONFLICT DO NOTHING`), plus an audit row the same way `admin_signup_blocked_domains_add` writes one | D10, G-S1 |
| **2c: funnel** | 1 migration, `20261122102000-20261122102999` | Table `auth_funnel_daily(day date, step text, outcome text, n int)`, PK `(day, step, outcome)`. RPC `record_auth_funnel_step_v1(p_step text, p_outcome text)`: SECURITY DEFINER, anon and authenticated, upsert `n=n+1`, steps and outcomes from a fixed allowlist (else no-op), no user id and no e-mail. Admin read `admin_auth_funnel_v1(p_days int)`. Rate limit: none per person (no identity); the allowlist and the row granularity bound it | D12, G-O1 |

**Pinned interface for PR-3 (2c):** `record_auth_funnel_step_v1(p_step, p_outcome) returns void`. The steps are
`auth_view, code_sent, code_ok, code_fail, callback, landing, onboarding_end, invite_redeem, claim, join_redeem`.
The outcomes are `ok, wrong, expired, timeout, fallback, refused, error`, or a landing state id
(`S-DANCER`, …). Each slice uses its own disjoint migration timestamp range. The guards (positive, negative,
fidelity, non-vacuity) follow admin `docs/guards-and-review-doctrine.md`.

## PR-3 (Website): sign-in, sign-out and settings behaviour. Size: L

Prod change:
- Sign-out clears the device and becomes "this device".
- An empty account lands in dancer setup.
- The team-invite card names who is joining.
- Consent is recorded.
- The code step survives a reload.
- Funnel events start.

Needs PR-2 merged and applied, because of the funnel RPC and the grace revoke.

| Slice | Owns | Does | Grid rows / decisions |
|---|---|---|---|
| **3a: sign-out & settings** | `src/hooks/useAuth.tsx`, `src/lib/personScopedStorage.ts` (new), `src/pages/AccountSettings.tsx`, `src/lib/accountSettings.ts`, `src/modules/dancer-app/api/{rpc,types,fixtures}.ts` (drop `erase_requested_at`), their tests | `clearPersonScopedStorage()` covers every key in GAPS G-P1. It is called inside `signOut` before navigation, and on the `onAuthStateChange('SIGNED_OUT')` event (other tabs). `signOut({scope:'local'})` is the default; Account settings gets "Sign out of all devices" (`scope:'global'`). The export merges `my_account_export_extras_v1` | `ac.signout.storage`, `ac.signout.then-org`, `xd.signout-other-tab`; D1, D6, G-P3 |
| **3b: landing, invite card, re-entry** | `src/lib/accountRouting.ts`, `src/components/account/profiles/useProfileSides.ts`, `src/pages/InviteRedeemPage.tsx`, `src/modules/admin-organisers/inviteModel.ts`, `src/modules/dancer-app/screens/onboarding/OnboardingScreen.tsx`, their tests | `SidesFacts` gains `isAdmin: boolean` (read by `useProfileSides` from `useIsAdmin`). `signInLanding`: 0 sides and not admin goes to `/app/welcome` (O5); admin stays `/` (D2). The invite card shows "Joining as <signed-in e-mail>" plus `SignOutLine` before Redeem (O3). A finished dancer on `/app/welcome` gets the end card (D4) | `si.empty`, `ti.other-person`, `dp.app-welcome.finished`; O3, O5, D2, D4 |
| **3c: auth screens** | `src/pages/Auth.tsx`, `src/pages/AuthCallback.tsx`, `src/components/MagicLinkConfirmation.tsx`, `src/lib/authTelemetry.ts` (new), `src/lib/auth-otp-routing.ts`, their tests | Code-step persistence: sessionStorage `auth_code_step_v1 = {email, mode, returnTo, sentAt}`, 10 min, cleared on success and by `clearPersonScopedStorage` (3a imports the **key name** from the pinned list below). A 5-wrong-code cap then "Send a new code". `autoFocus` and a polite live region on the code input. A consent line on the e-mail step, then `accept_terms_v1` on the callback's first sign-in; an existing login with no consent row gets a one-tap accept. `trackAuthStep(step, outcome)` goes to `dataLayer` and to `record_auth_funnel_step_v1` (fire-and-forget). Reported errors: callback fallback, timeout, expired, with tag `step` | `si.code-step-reload`, `si.dancer.wrong-code`; D7, D8, G-A1, G-O1, G-O2 |

**Pinned interfaces in PR-3:**

- **Storage keys (3a owns the list, 3c adds one name).** `PERSON_SCOPED_KEYS` in `src/lib/personScopedStorage.ts`
  is fixed now as:
  - `auth_form_state_v1`
  - `auth_last_email`
  - `pending_profile_role`
  - `profile_entry_role`
  - `auth_pending_return_to`
  - `pending_level_rating`
  - `auth_code_step_v1` (session)
  - `finish_profile_prompt_pending` (session)
  - `finish_profile_skipped` (session)

  3c writes `auth_code_step_v1` under exactly that name and does not edit `personScopedStorage.ts`.
- **`SidesFacts.isAdmin: boolean`.** It is optional in the type until 3b lands; `undefined` counts as
  `false`. Only 3b edits `accountRouting.ts`.
- **`trackAuthStep`** is used only by 3c's files. 3b's invite event waits for PR-4, which owns telemetry for
  `/join` and adds the `/invite` call there, so no slice imports another slice's new file.

## PR-4 (Website): dancer invite `/join/:token` (O6). Size: M

Prod change: invite links from `dancer-invite-send` start working. 0 have been issued, so nobody is stranded
today. Needs the admin env `DANCER_INVITE_SITE_ORIGIN` set to the Website origin (owner; check it once).

| Slice | Owns | Does |
|---|---|---|
| **4a: route + page** | `src/modules/dancer-invite/*` (new: `JoinPage.tsx`, `joinModel.ts`, `api.ts`), one line in `src/components/AnimatedRoutes.tsx` (`/join/:token`), `src/lib/authTelemetry.ts` (adds the `join_redeem` and `invite_redeem` calls; PR-3 has merged by now), `src/pages/InviteRedeemPage.tsx` (one `trackAuthStep` call) | Flow: `peek_dancer_invite_v1` (status card), signed out goes to `/auth?mode=signup&userType=dancer&returnTo=/join/<t>` with the e-mail fixed (dancer link + claim, O6), signed in calls `redeem_dancer_invite_v1`, then `onboardingEnd` / `/app/welcome`. `email_mismatch` shows the D11 card. The token is stripped from the URL, with `no-referrer` as on `/invite`. `/join` is NOT dancer-gated (`isDancerGatedPath` is unchanged: the invite is how the profile arrives) |
| **4b: tests** | `src/modules/dancer-invite/__tests__/*`, `tests/journeys/publicEntryJourneys.ts` (rows `dancer-invite-new`, `dancer-invite-other-email`, `dancer-invite-dead`), `tests/e2e-build/dancer-invite.build.spec.ts` (new), fake additions under `tests/e2e-build/fakes/` | Covers grid rows `di.*`, with a red-first unit test against the route-less code |

**Pinned interface 4a/4b:** `joinModel.interpretPeek(status) -> 'open'|'expired'|'redeemed'|'revoked'|'invalid'`
and `interpretRedeem(result) -> 'ok'|'email_mismatch'|'redeemed_other'|'rate_limited'|'error'`. These are the
admin statuses, verbatim (`M/20261121180000_dancer_invites_v1.sql:226-336`).

## PR-5 (Website + test project): real e-mail code journeys (O7). Size: M

Prod change: none. CI only.

| Slice | Owns | Does |
|---|---|---|
| **5a: harness** | `playwright.otp.config.ts` (new), `tests/e2e-otp/helpers/otp.ts` (new), `.github/workflows/otp-journeys.yml` (new; nightly plus `paths:` on account files) | Runs against the **E2E test project** (the admin E2E environment, never prod). Reads the code through the service-role admin API `auth.admin.generateLink({type:'magiclink', email})` → `properties.email_otp`. This verifies the real verify endpoint, the code length (8) and the expiry. One extra spec reads the delivered e-mail from a catch-all test mailbox via the Resend inbound API, if the owner adds one (D9 follow-up); otherwise that spec is marked Not verified. Secrets: `OTP_TEST_SUPABASE_URL`, `OTP_TEST_SERVICE_ROLE` (owner adds) |
| **5b: specs** | `tests/e2e-otp/*.spec.ts` | Grid rows `dl.new.real-otp`, `si.unconfirmed-later`, `ac.email-change`, `ac.erase`, `ac.erase.re-signup`, plus the sign-up kill-switch rehearsal (G-R1: area flag false refuses a new e-mail; an allowlisted one passes). Each spec cleans up its own logins |

**Pinned interface:** `getEmailOtp(email: string): Promise<string>` and
`newTestEmail(tag: string): string` (`otp+<tag>-<ts>@<test domain>`), exported from
`tests/e2e-otp/helpers/otp.ts`.

## PR-6 (Website + dashboard): hardening. Size: S-M

Prod change: the Turnstile widget on sign-up, a redirect-loop guard, and a contract check that pins the Auth
config.

| Slice | Owns | Does |
|---|---|---|
| **6a: Turnstile** | `src/components/auth/TurnstileField.tsx` (new), one insertion in `src/pages/Auth.tsx` (PR-3 has merged), `.env.example` key | Passes `captchaToken` to `signInWithOtp`. The **owner** turns CAPTCHA on in the dashboard in the same window (D10). The order matters: deploy the Website first, then flip the dashboard, otherwise sign-in breaks |
| **6b: auth-config contract** | `scripts/check-auth-config.mjs` (new), one step in `.github/workflows/db-contract-check.yml` | Calls the Management API `GET /v1/projects/{ref}/config/auth` with `SUPABASE_ACCESS_TOKEN` and pins: the hook URI is v2, `otp_expiry <= 900`, `otp_length = 8`, `security_captcha_enabled = true`, `rate_limit_email_sent >= <agreed>`, `sessions_inactivity_timeout = 90d` (D12). It skips with a loud notice if no token is set (never green-by-absence: exit 2 per `docs/testing-doctrine.md`) |
| **6c: loop guard** | `src/lib/redirectLoopGuard.ts` (new), `src/App.tsx` mount (one line) | Reports `redirect_loop` and shows a "Go Home" card (G-O3) |

The owner tasks from DECISIONS.md (DMARC `rua`, inbound MX, the e-mail rate limit, the hook switch) are listed
in PR-6's body as a checklist. They are not code.

## Order and dependencies

```
#764 → PR-1 ─┬→ PR-3 → PR-4
PR-2 (admin) ┘          ↘
                         PR-5 (needs PR-3 for consent and the code step; can start the harness in parallel)
                                  → PR-6
```

- PR-1 and PR-2 run in parallel (different repos).
- PR-3 needs both.
- PR-5a can start any time; 5b waits for PR-3/PR-4 to know the ENDs.
- PR-6a waits for PR-3 (it touches `Auth.tsx`).
- Mergeable rule: every PR from PR-1 on is held to `check:journey-grid`. A PR that flips a row to `BUILT`
  adds its walk in the same diff (O8).

## Not in this plan (recorded so it is not lost)

- A device list ("where you're signed in") and a new sign-in e-mail (G-S8): after launch.
- Grant, decline and team-add e-mails (G-O4): after launch, admin edge fn.
- The legacy-media sweep on erase (G-P5): admin, after launch.
- The analytics consent banner (G-P6): checked in PR-6. A separate PR if GTM loads trackers without consent.
