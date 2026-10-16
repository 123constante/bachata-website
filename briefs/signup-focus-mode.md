# Brief: sign-up focus mode + live Terms row

Repo: 123constante/bachata-website. Work branch: `claude/signup-focus-mode` off `main` AFTER the keyboard-safe PR
(`claude/site-keyboard-safe`) has merged (the orchestrator dispatches you only then; check `git log origin/main`
mentions keyboard-safe; if not, stop and report). Model: Opus. One worker, one PR. Stop after the push and report.

## What the owner saw (their words, 2026-10-16 08:21, Android phone, after signing up a new test dancer)
"If we want users to complete the sign up process why do we need the top and bottom nav?"
Screenshot: dancer Options screen with the full top bar (logo, Dancer chip, Events link, avatar) and bottom tabs
(Home, Nights, Me, Options). Same screenshot: the row "Terms and privacy policy" is disabled with "The terms and
privacy pages are not published on the site yet." — false: /terms and /privacy are live since PR #762.

## Owner decisions (ticked 2026-10-16, do not reopen)
1. FOCUS MODE during sign-up: hide the bottom tabs; the top bar shrinks to the logo plus a small "Not now" link.
   Normal navigation returns when sign-up is done, or when the person taps "Not now".
2. Sign-up = email step -> code step -> the one-button accept card -> first dancer-profile setup, until that
   profile is saved. ("Done" = the profile save succeeded; read the real done signal from the code, do not invent one.)

## Orchestrator decisions (logged for the review pack)
- ONE source of truth: a small `useSignupFocus()` (or route-meta) mapping that says "this screen is in focus mode";
  `AppChrome.tsx` / `BottomNav.tsx` / the dancer-app shell read it. No per-screen copies of the rule.
- "Not now" goes to where the person came from (`returnTo` if present, else home) and leaves them signed in;
  it never deletes anything. Coming back later to the dancer area shows the normal nav and the unfinished setup.
- Signed-out sign-in (existing account) is NOT focus mode: only the sign-up path is.
- Terms row: becomes two live links (Terms -> /terms, Privacy -> /privacy), or one row opening /privacy with
  /terms linked; remove `TERMS_REASON` and update `OptionsScreen.test.tsx` (expected values written out by hand).
- Keyboard: the keyboard-safe helper from the previous PR stays as is; do not change its files or behaviour.

## Files (measured on main ecc3432e; re-check after the keyboard PR)
`src/components/AppChrome.tsx`, `src/components/BottomNav.tsx`, `src/pages/Auth.tsx` (sign-up URL is
`/auth?mode=signup`), `src/modules/dancer-app/**` (onboarding screens, shell), 
`src/modules/dancer-app/screens/options/optionsModel.ts:72-94` (TERMS_REASON). Organiser area: do not touch
(another session is planning the organiser rebuild).

## Tests (red first: run on main before your change and record the failures)
- Table-driven over every step of the sign-up path x {390x844, 360x640}: bottom tabs absent, top bar shows only the
  logo + "Not now", "Not now" is tappable (`elementFromPoint`) and lands at returnTo/home signed in.
- After the profile save: normal nav back on every dancer screen.
- Sign-in of an existing account: normal nav (never focus mode).
- Options: Terms and Privacy rows are enabled links to /terms and /privacy; no text anywhere still says the pages
  are not published (grep the whole src for "not published").
- One shared mapping: a test that the chrome and the bottom nav read the same rule (no second copy).
- Mutation proof: break the mapping on purpose, see red, restore.
- Check a PRODUCTION build (`npm run build` + the phone suite as configured), not only the dev server.

## Gates and rules (every one binds)
- Run EVERY CI job step yourself in your sandbox (read `.github/workflows/*.yml` that a PR to main triggers) and put a
  per-job table (job, command, exit code) in the PR body. GitHub Actions billing fails intermittently ("recent account
  payments have failed / spending limit"): such a red is not a code failure; your table is the fallback.
- The PR body needs a `## Phone QA` section, exactly once: `- Sizes checked:`, `- Walked:`, `- Not verified:`.
- Read and push with PLAIN git (`git fetch`, `git show`, `git push`). Never `gh api`.
- Write shell commands WITHOUT variables, loops or `$(...)` where a plain command works.
- Open the PR as the bot with `gh pr create`. Never merge, never approve, never `--no-verify`. Supabase read-only.
- Context: at 25% start nothing new; by 30% push + handover at `docs/handovers/signup-focus-mode.md`, last commit
  subject ending `PARTIAL [worker-done <ticket>]`.

## Output you end with
PR link; the step x size table; red-first run and green run; mutation proof; per-job CI table; Not verified list.
