# Handover: account-grid-3c (auth screens: D7 code persistence, D8 consent, funnel, a11y)

Branch `claude/account-grid-3c`, from `origin/claude/account-grid` (b58f39d). No PR opened.

## Finding first: D7 was already built on the base branch
`MagicLinkConfirmation` already held the 10-minute sessionStorage code step and the 5-wrong cap, with
`AuthCodeStep.test.tsx` (7 tests green on the base). This slice added what was missing around it; D7 itself is unchanged.
**sessionStorage key: `auth_code_step_v1`** -- already in `PERSON_SCOPED_SESSION_KEYS` (lib/personScopedStorage), so 3a's
sign-out clear-list needs nothing new. No new person-scoped key was added.

## Done
- `src/lib/trackAuthStep.ts`: typed union of the 10 steps / 7 outcomes (+ `S-...` state id, landing only), fire-and-forget,
  swallows reject / throw / error result / never-settles. Sends only `p_step`, `p_outcome`.
  Contract: `tests/fixtures/auth-funnel-contract.sql` pins the SQL allowlists (admin #820, migrations 20261122190000 +
  20261122330000); `trackAuthStep.contract.test.ts` fails if the union and the SQL differ.
- `src/lib/termsConsent.ts`: `acceptTerms()` (`accept_terms_v1(p_kind 'terms_privacy', p_version '2026-10-15')`, never throws),
  `hasAcceptedTerms()` (reads own `consents` via `my_account_export_extras_v1`; any failure answers true = never walls sign-in).
- `ConsentLine` (Terms + Privacy Policy links) under the code box at sign-UP only; `TermsAcceptCard` (one button) at sign-IN
  when the account has no acceptance of the current version. `Auth.tsx` calls `accept_terms_v1` once on a successful sign-up code.
- Funnel wired in `Auth.tsx` / `MagicLinkConfirmation`: `auth_view ok`, `code_sent ok|refused|error`, `code_ok ok`,
  `code_fail wrong|expired|error`.
- a11y: code box `autoFocus` (focus moves to it when it opens after send), error text in an always-mounted `role=alert
  aria-live=assertive` region that `aria-describedby` points at; `autocomplete=one-time-code`, `inputmode=numeric`, label
  already existed. axe (critical/serious) clean on all four states.
- notes.tsx `TODO(1b)` resolved (comment only; the line stays plain text there).
- Grid: `si.code-step-reload` now covered (U + W walk), baseline entry removed; new rows `si.consent.signup`,
  `si.consent.accept-card`. `JOURNEY-GRID.md` regenerated with `build_grid.py`.
- Screenshots 390x844 (prod build, fake backend): `docs/handover/shots-3c/` 1-code, 2-wrong-x5-locked,
  3-signup-consent-line, 4-accept-card. Walk: `tests/e2e-build/auth-consent.build.spec.ts`.

## Left (needs owner or another slice)
1. **`/terms` and `/privacy` are not routes** (404; `navigateTargetsRoutable` already lists them). The links are real per the
   brief and the 404 stays until the pages exist -- owner decision (DECISIONS D8 asked whether the text exists). `TERMS_VERSION`
   in `termsConsent.ts` must match the text's version when published.
2. **E-mailed-link sign-up** lands in `/auth/callback` (not mine; 3b/routing): consent is NOT recorded on that path. The
   sign-in accept card catches those accounts on their next typed-code sign-in, but a link-only person is never asked. 3b
   should call `acceptTerms()` in the callback for `mode=signup`, and could reuse `hasAcceptedTerms()` + `TermsAcceptCard`.
3. `AuthStepper` (ProfileEntryFlow / CreateVideographerProfile) has its own code box: not changed (no clickwrap, no funnel).
4. `accept_terms_v1` is behind `_dancer_area_require_v1` (area_closed for unlisted people): then `acceptTerms()` returns false
   quietly and the card would reappear next sign-in. Admin to decide whether consent should stay behind the beta gate.
5. The funnel RPC is not on prod until admin #820 is applied; calls are swallowed until then.

## Checks run (sandbox)
| Command | Exit |
|---|---|
| `vitest run` trackAuthStep (x2), AuthCodeStep, AuthConsentFunnel (`--pool=forks`; default pool hung in this sandbox) | 0 (23 tests) |
| `vitest run src/pages/__tests__ src/lib/__tests__ src/components src/modules/dancer-app tests/journeys` | 0 (71 files, 1691 passed) |
| red-first: AuthConsentFunnel against base Auth.tsx + MagicLinkConfirmation | 7 failed / 3 passed; with the change 10 passed |
| `npm run build` (inside `playwright.build.config.ts` webServer, production) | 0 |
| `playwright test --config playwright.build.config.ts auth-consent.build.spec.ts` (axe included) | 0 (3 passed) |
| `npm run lint` | 1: only `check:integrity` exit 126 (`bin/check-integrity.sh` not executable here; identical on the base). The other 17 links PASS incl. check:journey-grid, check:rpc-typing; eslint link SKIPPED by the chain |
| `npx eslint` on touched files | errors only on pre-existing lines of Auth.tsx (`any`, set-state-in-effect) |
| `tsc -p tsconfig.app.json --noEmit` | 2: 96 errors, same count (96) on the base; none in touched files |
| `check:journey-grid` + `--self-test` | 0 |

## Verified / Not verified
Verified: the above, on mocked responses and fake backend. Not verified: bundle budget script, `pre-ship`, GitHub Actions,
`check:integrity`, real e-mailed code (OTP spec), real `accept_terms_v1` / funnel RPC on a live project (funnel not applied),
Supabase shape survey (no SELECT run: the screens read no new table).
