# Brief: count the sign-up steps after the code (auth funnel)

Lane: NORMAL (Website code only, NO database change). Repo: bachata-website. Branch: `claude/auth-funnel-later-steps`
(from `origin/main`). One PR, push ONCE.

## Why
The owner is about to invite the first 10-20 real dancers and wants to see where they get stuck. The prod counter table
`auth_funnel_daily` (written by admin RPC `record_auth_funnel_step_v1` via `src/lib/trackAuthStep.ts`) only ever records
`auth_view`, `code_sent`, `code_ok`, `code_fail`. The steps `callback`, `landing` and `onboarding_end` are in the
allowlist (`AUTH_FUNNEL_STEPS`, pinned by `tests/fixtures/auth-funnel-contract.sql`) but **no code calls them**
(grep `trackAuthStep(` outside tests: only `src/pages/Auth.tsx` and `src/components/MagicLinkConfirmation.tsx`).
So we cannot see whether anyone finishes setting up.

Also, `code_sent` + `refused` today mixes two different cases (`src/pages/Auth.tsx` ~line 338):
(a) a SIGN-IN for an email with no account (`isOtpSignupDisabled && !isCreateAccount`, which then auto-switches to
"Create account" -- harmless), and (b) a real refusal (allowlist / blocked email provider, 403).

## What to do
1. `code_sent`: record case (a) as outcome `fallback`, keep `refused` only for a real 403 refusal. `fallback` is already an
   allowed outcome.
2. `callback`: in `src/pages/AuthCallback.tsx`, record `ok` once when the session is established, `error` on a failure
   path, `timeout` if the page has a timeout path. Once per page load (guard against React double effects; follow the
   sessionStorage-marker pattern already used there for the consent-once fix).
3. `landing`: record once per sign-in where the callback finally sends the person (outcome `ok`; only use an `S-...` state id
   if the code already has named landing states -- do not invent any).
4. `onboarding_end`: record `ok` once when the dancer onboarding finishes
   (`src/modules/dancer-app/screens/onboarding/OnboardingScreen.tsx`, the step that completes it). If organiser onboarding has
   an obvious single finish point, record it there too; otherwise leave it.
5. Every call stays fire-and-forget (`trackAuthStep` already never throws). No email, id or name in any call.
6. Do NOT change `AUTH_FUNNEL_STEPS` / `AUTH_FUNNEL_OUTCOMES` or the contract fixture (they match prod).

## Tests (red first against current code)
- Table-driven vitest: each of the cases above calls `trackAuthStep` with exactly the expected (step, outcome), once.
  The sign-in-without-account case gives `fallback`, a 403 gives `refused`.
- A double-mount (StrictMode) of the callback records `callback` once.
- Existing `trackAuthStep.contract.test.ts` stays green.

## Done means
- Every CI job step that applies is run in your sandbox (read `.github/workflows/*.yml`, including any dancer-area / module
  isolation checks); per-job table in the PR body.
- "Verified on real data" section filled honestly (you cannot sign up on prod; say so).
- No visible change, so the Design Gate does not apply; say so.
- Handover file `docs/handover/auth-funnel-later-steps.md` (what is recorded where, what you did not verify).
- Do NOT push again after your final commit.
