# PR #743 body sections (paste into the PR description)

The orchestrator pastes the two sections below into the PR body. Headings and labels match
`scripts/check-pr-phone-qa.mjs` and `scripts/check-pr-real-data-verified.mjs`.

## Phone QA
- Sizes checked: 390x844 and 390x600 (Playwright chromium, mocked auth/RPC/edge function).
- Walked: /account/settings (profile visible, hidden, no profile), /account/settings/ownership, /account/settings/delete (can erase, sole organiser owner with a long page name, admin account), /account/deleted. Measured: document scrollWidth <= innerWidth once the route slide-in has settled, in every one of those states at both sizes (settled overflow 0 everywhere; the only overflow seen was the 0.25s page-slide, 5-16px, see account-settings-fix-handover.md); every control in the content column is 44px or taller. Phone suite and DOM measurements only.
- Not verified: pixels (e2e screenshots come out blank in the cloud harness); a real phone or Safari; real RPC and edge-function responses (all mocked); real email confirmation; a real file download on a phone.

## Verified on real data
- Shapes surveyed: read-only SELECT on prod dancer_profiles, counts only: is_active true = 83 rows, is_active NULL = 83 rows, false = 0. The visibility hook reads NULL as visible (only an explicit false is hidden), so the NULL shape shows the profile as visible and offers Hide. Earlier read-only check (handover): _my_dancer_profile_id_v1 ignores is_active, so a hidden profile still resolves; archived rows do not resolve and show as no profile.
- Checks run: unit and matrix suites (profile state x role, 50 tests, first run with the implementation missing); Playwright account-settings spec at 390x844 and 390x600 and the whole test:e2e step with the CI env vars; per-state overflow probe of all 8 settings states at both sizes; dancer-home "a finished dancer gets the dancer home" 20 of 20 on this branch and 20 of 20 on main.
- NOT verified: the real my_profile_disable_v1, my_account_erase_check_v1, my_account_export_v1 RPCs and the account-erase edge function (mocked here, shipped from the admin repo); no row with is_active = false exists in prod to survey the hidden shape; real email change; real device; /code-review not run.
