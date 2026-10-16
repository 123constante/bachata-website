# Brief: fix the new-dancer journey audit (2 parallel slices, one final PR)

Repo: 123constante/bachata-website. Audit to fix: `docs/audits/dancer-journey-2026-10-16/report.md` on branch
`claude/dancer-journey-audit` (68 findings: 12 high, 29 medium, 27 low; screenshots beside it). Read it fully:
`git fetch origin claude/dancer-journey-audit` then `git show FETCH_HEAD:docs/audits/dancer-journey-2026-10-16/report.md`.
Model: Opus. Each slice: its OWN branch off `main`, push, NO PR (the orchestrator merges the slices plus the
keyboard branch into one PR branch and opens the PR). Stop after the push and the report.

## Why (owner's words, 2026-10-16)
"Why am I having to do this? I am a beginner and you should be the professional that is creating the entire design."
The owner found 4 of these on a phone in minutes. After this work, the owner's phone test must find nothing.
YOU make every design decision (copy, layout, flow) like a senior product designer; never leave a design question
open. Log each non-obvious decision in your handover with its reason (the owner can overrule in the review pack).

## Owner decisions already made (do not reopen)
- FOCUS MODE during sign-up: from "Create account" through email -> code -> terms card -> first dancer-profile setup
  (`/app/welcome`, photo step included) until the profile save succeeds: bottom tabs hidden; top bar = logo + a small
  "Not now" link (goes to returnTo or home, stays signed in, deletes nothing). Normal nav when done or after Not now.
  Sign-in of an existing account is NOT focus mode. ONE shared mapping read by every chrome component.
- Terms/privacy are live (/terms, /privacy): every "not published" text and disabled row goes.

## NOT yours: the keyboard class
Audit IDs H1, H12, M1, M2, M3 (and any other row whose checklist number is only 1) belong to branch
`claude/site-keyboard-safe` (another worker, nearly done: `src/lib/keyboard/**`, `app/root.tsx`, `src/index.css`
keyboard rules, `tests/e2e-phone/keyboard.phone.spec.ts`, organiser `useKeyboardInset.ts`). Do not touch those files.
If a finding needs `enterKeyHint`/submit-on-Enter on a field inside YOUR files, do it in your file.

## Slices (file ownership is exclusive; a finding goes to the slice that owns its file)
**Slice A - auth + site chrome** (branch `claude/djf-auth-chrome`): `src/pages/Auth.tsx`, `src/pages/AuthCallback.tsx`,
`src/components/MagicLinkConfirmation.tsx`, `src/components/auth/**`, `src/lib/auth-*.ts`, `src/components/AppChrome.tsx`,
`src/components/BottomNav.tsx`, `src/components/layout/**`, the new focus-mode mapping (`src/lib/focusMode.ts`),
RSVP sign-in prompt and event-page RSVP block components, home/event page components.
Covers at least H2, H7, H8, H9 and every medium/low in those files.
**Slice B - dancer app + account** (branch `claude/djf-dancer-app`): `src/modules/dancer-app/**`,
`src/components/account/**`, `src/pages/Account*.tsx`, the `/finish-profile` page, `src/pages/legal/**`,
`src/lib/legalVersions.ts`, `src/lib/termsConsent.ts`. Covers at least H3, H4, H5 (setup screens call Slice A's
mapping; see interface), H6, H10, H11 and every medium/low in those files.
**Interface between slices (pinned):** Slice A creates `src/lib/focusMode.ts` exporting
`export function isSignupFocusPath(pathname: string, search: string, profileComplete: boolean): boolean` and
`export const FOCUS_NOT_NOW_LABEL = 'Not now'`. True for `/auth?mode=signup` (every step), the code step and terms card
reached from sign-up, `/app/welcome`, and `/app/me/photo?return=/app/welcome` while `profileComplete` is false.
Slice B never edits it; Slice B makes sure the dancer-app shell/header reads it (import only) and hides its own
tabs/header links when it returns true. If Slice B starts first, code against this exact signature.
Any finding whose file is in neither list: do NOT fix; list it in your handover under "unowned".

## For every finding you fix
- Red first: a test (vitest, or the phone suite `playwright.phone.config.ts` + `tests/e2e-phone/fakeSupabase.mjs` at
  390x844 and 360x640) that fails on `main` for that finding, then passes. Table-driven where the same fact shows on
  several screens (one shared mapping, not copies). Record red and green runs.
- Empty states say what the person CAN do; a control that cannot work is disabled WITH a true reason; no text points
  at a control not on screen; saving an untouched record sends nothing.
- Use the audit's prod-shape seeds (no profile, empty stub, long name/email, 0 and 15 nights, broken photo URL,
  hidden, deletion pending).
- Mutation proof for the shared mappings (focus mode, avatar fallback): break on purpose, see red, restore.
- A finding you judge wrong or not worth fixing: say why in the handover (one line), do not silently skip.

## Gates and rules (every one binds)
- Before the final push run EVERY CI job step a PR to main would run (read `.github/workflows/*.yml`) and put a per-job
  table (job, command, exit code) in your handover. GitHub Actions billing fails intermittently ("recent account
  payments have failed / spending limit"): that is not a code failure. Check a PRODUCTION build (`npm run build`).
- Handover file: `docs/handovers/djf-auth-chrome.md` (A) or `docs/handovers/djf-dancer-app.md` (B): finding ID ->
  fixed / not fixed (why) / unowned; tests red->green; decisions with reasons; CI table; Not verified.
- Read and push with PLAIN git. Never `gh api`. Shell commands without variables, loops or `$(...)`.
- Never open a PR, merge, approve or `--no-verify`. Supabase read-only.
- Context: at 25% start nothing new; by 30% push + the handover with an exact "left" list, last commit subject ending
  `PARTIAL [worker-done <ticket>]`.
