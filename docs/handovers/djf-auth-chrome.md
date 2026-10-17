# Handover: dancer-journey fixes, Slice A (auth + site chrome)

Branch `claude/djf-auth-chrome`, cut from `main` at `ecc3432`. Brief:
`arc/briefs-dancer-rebuild:briefs/dancer-journey-fixes.md`. Audit:
`claude/dancer-journey-audit:docs/audits/dancer-journey-2026-10-16/report.md`.
No PR opened (the orchestrator merges the slices).

## Interface delivered to Slice B (pinned, unchanged)

`src/lib/focusMode.ts`:

- `isSignupFocusPath(pathname, search, profileComplete): boolean`
- `FOCUS_NOT_NOW_LABEL = 'Not now'`
- Extra, optional: `focusNotNowHref(search)`, exported from `src/components/layout/FocusHeader.tsx` (not from focusMode). It returns the safe in-site `returnTo`, or `/`, and never a path back into the flow. Slice B can use it for its own "Not now".
- `focusMode.ts` is a **leaf** module (no imports) on purpose. AppChrome loads it on every route, and an import from it once cost +1 first-load request on every page; the perf-budget ratchet caught it. `FocusHeader` is lazy-loaded. Slice B: keep focusMode import-free.

True for:
- `/auth` in every mode except `signin`. This includes no mode, because Auth.tsx draws the sign-up steps for every mode but `signin`.
- `/auth/callback?mode=signup`.
- `/app/welcome` and `/app/me/photo?return=/app/welcome`, while `profileComplete` is false.

Matching is case-folded and ignores a trailing slash, as the router does. The code step and the terms card sit on the same `/auth` URL, so they are covered.

The site chrome (`AppChrome`) reads it. On a focus path it draws `FocusHeader` (the logo, which is not a link, plus "Not now") and hides GlobalHeader, the section row (BottomNav) and the footer. On `/app/*` the dancer shell draws its own chrome, so Slice B must read the same function there.

## Findings

| ID | Status | What changed |
|---|---|---|
| H2 | fixed | Sign-up focus mode: `focusMode.ts`, `layout/FocusHeader.tsx`, `AppChrome.tsx`. The sign-up form and code step lose their second exit ("Continue browsing"), so "Not now" is the only one. Sign-in keeps the normal chrome. |
| H7 | fixed | `OTP_RESEND_COOLDOWN_SECONDS = 60` in `auth-otp-routing.ts` is the one value, used by both `MagicLinkConfirmation` and `AuthStepper`. `onResend` now resolves `'sent' \| 'wait' \| 'failed'`. A 429 shows "We sent you a code a moment ago. Wait a minute, then try again." under the code box and restarts the wait. A plain failure shows its reason and can be retried at once. **Also fixed:** after a reload of the code step, Resend used the empty form e-mail and failed silently. It now resends to the address on screen. |
| H8 | fixed | `ConsentLine` links open in a new tab, so the step behind them survives. The spent code step is forgotten before the terms card shows. |
| H9 | fixed | "Continue browsing" goes to the explicit returnTo, else `/`. It never goes to `/account/continue`, the guarded signed-in landing. |
| M1 | fixed in my file | Both e-mail fields have `enterKeyHint="send"`, and Enter sends. The keyboard inset itself belongs to `claude/site-keyboard-safe`. |
| M4 | partly | `/auth/callback?mode=signup` is in focus mode. Account pages (`/account/settings*`, restore, deleted) are Slice B files, and the owner decision limits focus mode to sign-up. Unowned here. |
| M6 | fixed | Consent links have a 44 px tap area, drawn by an invisible `before:` box so the sentence keeps normal line spacing, and open in a new tab. |
| M7 | fixed | The clickwrap now sits above "Email me a link": "By tapping Email me a link you agree to our Terms and Privacy Policy." The code step line now reads "Entering the code confirms you agree to our...", because there is no Continue button there. |
| M10 | fixed | RSVP buttons are `h-[44px]`, in both the block and its placeholder. The sticky Share / Calendar buttons are 44x44. The hint dismiss has a 44 px invisible hit area, so its look is unchanged. |
| M11 | fixed | `DIALOG_CLOSE_44` (`lib/auth-labels.ts`) makes the close button 44 px from each dialog's own className, so `ui/dialog.tsx` is untouched (CLAUDE.md). Buttons are `min-h-[44px]`. Applied to the event sign-in prompt and the level-rating sheet. |
| M12 | fixed | One vocabulary, from `AUTH_ACTION_LABELS` (Sign in / Create account), used by the /auth tabs, the prompt and the sheet. The RSVP prompt is now "Save this night. Sign in or create an account to save this night. Your nights are private to you." That is the /privacy wording. |
| M13 | fixed | `PINK_FALLBACK_SURFACE` changed from `#E13A8A` (4.06:1) to `#C42A72` (5.36:1). The ErrorScreen pink-on-white text moved with it. |
| M15 | fixed | The details step is left only by its Continue. A form that arrives already filled still starts past it. |
| M17 | unowned | The combobox's accessible name needs a prop on `ui/city-picker.tsx`, which is in neither slice. |
| M18 | fixed | Neutral refusal copy ("We can't create an account for this email yet. New accounts are open to invited people for now. Message us...") and a neutral WhatsApp prefill. The prefill is derived from the one shared number, not a second copy. The `contactLinks.tsx` organiser prefill itself is unchanged; it is not mine. |
| M24 | unowned | The "70%" claim lives in Slice B screens (MeScreen, OnboardingScreen), and the event page has no profile gate. Needs a server-rule check first. |
| M25 | not fixed (decision) | The header keeps one "Sign in" slot (44 px; it is tight at 360 next to search). The page it opens shows the "Create account" tab and "New here? Create an account" on the first screen. Overrule if wanted: the label would become "Join". |
| M28 | fixed (sign-up) | Under City: "City not in the list? Message us to add it" (WhatsApp, prefilled). The setup city card is Slice B. |
| L1 | fixed (code step) | The e-mail breaks at "@" first (`<wbr>`, `overflow-wrap:anywhere`). The delete and deleted pages are Slice B. |
| L5 | fixed | "Three quick steps, then we email you a code." |
| L6 | fixed | The card reads "To carry on, please accept our Terms and Privacy Policy." |
| L7 | fixed (auth) | `showGradientBg={false}` on /auth and /auth/callback. Account pages and /finish-profile are Slice B. |
| L8 | fixed | Header search pill is 44 px. Home rail tabs get a 44 px hit area with no taller rail. Map credits, breadcrumbs and footer links are not touched (footer links are the shared `contactLinks`; breadcrumbs are density-ruled). |
| L20 | fixed | Code slots `w-7` below 360 px, so all 8 fit a 320 px screen. |
| L25 | fixed | "I'm an organiser / teacher / DJ / videographer / vendor". |
| L26 | fixed (callback) | `AuthCallback` uses `&hellip;`. `ProfileSwitcher` is Slice B. The raw em dash in `TapHintSticker` is fixed too. |
| H1, H12, M2, M3 | not mine | Keyboard class, branch `claude/site-keyboard-safe`. |
| H3-H6, H10, H11, M5, M8, M9, M14, M16, M19-M23, M26, M27, M29, L2-L4, L9-L19, L21-L24, L27 | Slice B | Dancer app, account, legal. |

## Tests (red on main, then green)

| Test | Red on main | Green |
|---|---|---|
| `src/lib/__tests__/focusMode.test.ts` (37 cases, table-driven) | module absent | 37/37 |
| `tests/client/signupFocusChrome.test.tsx` (H2) | 4 failed / 9 | 9/9 |
| `src/pages/__tests__/AuthJourneyFixes.test.tsx` (H7, H8, H9, M7, M15, M18, L5, L6) | 8 failed / 9. One case is a returnTo guard that already passed. | 9/9 |
| `tests/client/eventSignInPrompt.test.tsx` (M10, M11, M12) | 5 failed / 6 | 6/6 |
| `tests/client/chromeTapAndContrast.test.ts` (M13, L8) | 3 failed / 3 | 3/3 |

**Mutation proof (focus mapping).**
- Ignoring `profileComplete` turned 2 cases red.
- Narrowing `/auth` to `mode === 'signup'` turned 2 cases red (no mode, nonsense mode).
- Restoring the code turned them green.

**Updated existing tests**, for intended copy only:
- `AuthOtpDisabled`, `AuthSignupDanceRole` (refusal copy and the WhatsApp href), `tests/client/authPage` (organiser toggle label), `rsvpBlock` (prompt title and the Sign in label).
- The `today` regression snapshots for auth, eventRsvp and festivalHub. Every changed line is one of the copy or label changes above. Reviewed line by line.

## Decisions (owner can overrule)

1. **No mode, or any mode but signin, counts as sign-up focus.** That mirrors what Auth.tsx draws.
2. **The logo in the focus bar is not a link.** One exit, not two: the audit's L9 class is exactly the problem of two controls doing the same thing.
3. **Sign-up has no "Continue browsing".** "Not now" in the top bar replaces it. Sign-in keeps it.
4. **Consent sits on both the e-mail step and the code step.** The e-mail step is where the account is created. The code step is where the acceptance is recorded. Each is worded for its own control.
5. **Legal links open in a new tab** rather than a sheet. It is the smallest change that keeps the step alive.
6. **A refused resend restarts the cooldown only for "too soon"**, not for a network error.
7. **The pink fallback goes to `#C42A72`.** It is the nearest shade that passes AA with margin.
8. **M25 is left as is** (see above).

## CI (every PR job step, run locally at `ae6825c`, then the two failing jobs re-run after the fix)

A billing or spending-limit failure on GitHub Actions is not a code failure. Secrets-only steps cannot run in a worker.

| Workflow / job | Command | Exit | Result |
|---|---|---|---|
| all | `npm ci` | 0 | pass |
| architecture-guard / integrity | `bin/check-integrity.sh`, `check:legacy-tables`, `check:legacy-program-rpcs`, `lint:architecture`, `AUDIT_STRICT=1 check:images`, `check:image-widths` (+ self-test), `check:plan-hygiene:self-test`, `check:workflow-artifact-policy` (+ self-test), `check:mojibake:self-test` + git-grep guard, `prove:entry-point` (+ self-test) | 0 each | pass |
| typecheck / wallclock-brand | `check:rpc-typing`, `check:wallclock-brand` | 0 | pass |
| workflow-lint | BOM, masking, notification (+ self-test) | 0 | pass |
| unit-tests / unit | `npm run test:unit` | 1 | 12 `*.contract.test.ts` need the live Supabase secrets (skipped). 5 in `tests/integrityCouldNotRun.test.ts` also fail on main (pre-existing). Offline: 338/339 files pass. |
| unit-tests | `test:unit:timing`; New_York and Sydney TZ runs | 0 | pass |
| unit-tests / dancer-area-isolation | self-test + check | 0 | pass |
| db-contract-check | `check-migration-stamps`, every `--self-test`, guest-list self-test, day-rollover, script-conventions | 0 | pass |
| db-contract-check | `precheck-supabase-secrets` + live `check-*` steps | 2 / - | needs secrets (placeholders in a worker) |
| e2e-smoke | `npm run test:e2e` | 0 | 146 passed, 2 flaky, 1 skipped |
| perf-budget / bundle-budget | `npm run build`, `check:bundle-budget`, `check:first-load-requests`, `check:chunk-cycles` (+ self-tests) | 0 | pass **after the fix**. The first run was +1 first-load chunk on every route: focusMode imported authRouting. |
| perf-budget / lighthouse, doc-weight; og, seo and synthetic preview | - | - | need a Vercel preview + bypass secret |
| phone-qa / phone-qa | `playwright test --config playwright.phone.config.ts` | 0 | 188 passed, 74 skipped |
| phone-qa / build-smoke | fake-env `npm run build` + `playwright.build.config.ts` | 0 | 62 passed **after the fix**. The first run had 19 red: the harness expected the old auto-advance that M15 removes. It now presses Continue. |
| phone-qa-section, real-data-verified | PR-body checks | - | need the PR body (orchestrator's PR) |

## Verified on real data

- **Shapes.** The audit's prod survey is used, not re-queried (counts only): 23 users, 18 with no profile, a 37-char longest e-mail, a 23-char longest name. The tests seed past those: a 49-char e-mail, refusals, 429, reload.

## Not verified

- A real phone, a real keyboard, and real e-mail delivery: the Supabase 429 shape is taken from the docs and the audit.
- **Browser walk.** Only the production-build smoke screenshots at 390x844 were looked at, for sign-up steps 1-3 and the code step. They show the focus bar (logo + "Not now", no other links), the clickwrap above "Email me a link", and the Continue-gated details step. The 360x640 size was not looked at by eye; it is covered by the phone suite.
- Slice B's shell reading `isSignupFocusPath` (their branch).
- Lighthouse and doc-weight on a real preview.
