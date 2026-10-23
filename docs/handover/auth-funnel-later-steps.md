# Auth funnel: counting the steps after the code

Brief: `briefs/wire-auth-funnel-steps.md` (branch `brief/festival-counter`). Website code only; no database change,
no change to `AUTH_FUNNEL_STEPS` / `AUTH_FUNNEL_OUTCOMES` or the contract fixture.

## What is recorded where

| Step / outcome | Where | When |
|---|---|---|
| `code_sent` `fallback` | `src/pages/Auth.tsx` (send catch) | sign-in (not create-account) for an email with no account (422 otp_disabled) |
| `code_sent` `refused` | same | create-account refusal (403 allowlist / blocked provider / signups disabled on create) |
| `callback` `ok` | `src/pages/AuthCallback.tsx` `resolveSession` | session established |
| `callback` `timeout` | `navigateToSignInFallback("timeout")` | the 15 s timer |
| `callback` `error` | `navigateToSignInFallback` for expired / manual / invalid | the 9 s no-session check |
| `landing` `ok` | `AuthCallback` `land()` and the account-restore redirect | where the callback finally navigates; no `S-...` ids (the code has no named landing states) |
| `onboarding_end` `ok` | `src/modules/dancer-app/screens/onboarding/OnboardingScreen.tsx` | the "You're in" or "Nice work" end card is first shown, once per mount. Loaded with a dynamic `import()`: a static one made `trackAuthStep` its own chunk and put `/app/*` one chunk over its ratchet (bundle-budget). Pinning it into `lib-event-rules` was tried and put /city/:slug over its KB budget. |

`callback` and `landing` are guarded by a ref (survives the StrictMode double effect), so each is sent at most once per page load.
No call carries an e-mail, id or name.

## Tests (tests/ because the dancer-area isolation guard only allows tests under `tests/` on a dancer-area PR)

- `tests/client/authFunnelLaterSteps.test.tsx`: code_sent fallback / refused, callback ok once, StrictMode once, 9 s error, 15 s timeout, payload keys.
- `tests/client/onboardingFunnel.test.tsx`: onboarding_end once; none for a 100% profile; none on a required card.
- Red first: against the unmodified source 5 of the 9 new cases failed; the 4 that passed are the negative cases.

## Not verified / known limits

- Cannot sign up on prod; nothing was checked against real data or the live `auth_funnel_daily` table.
- `onboarding_end` also fires for a finished dancer who re-opens `/app/welcome` at 70% (the end card shows), and for the photo hand-off
  re-open (which is the real finish). It does not fire for a 100% profile (redirected before any card). Expect some inflation.
- Organiser onboarding has no single obvious finish point, so it is not recorded.
- `callback` `error` covers both an expired link and a plain missing session (the 9 s check cannot tell them apart without params being read as `expired`).
- Browser walk at 390x844 not done (no visible change; Design Gate does not apply).
