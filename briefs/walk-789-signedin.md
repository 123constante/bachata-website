# Brief: signed-in 390x844 walk of PR #789 on prod-shaped TEST accounts (read-only worker, no product code)

Repo: 123constante/bachata-website. PR #789, branch `claude/dancer-journey-fixes`, head `987a5e59`. Model: Sonnet. One narrow job.
You are the only worker on this. You change NO product code and open NO PR.

## Why
The owner is a beginner and works from a phone. The orchestrator already walked the SIGNED-OUT parts of the #789 preview
(sign-up focus layout, sign-in, account redirects: fine). It cannot sign in anywhere (rule: no real logins, no accounts on live
sites). You can, because you run the app in YOUR sandbox with TEST accounts that exist only there. That is allowed:
local dev host + test users + a Supabase BRANCH or the repo's own e2e fixtures/seed. Never production, never a real person.

## Setup (decide the simplest route that is real)
- Make a worktree of the #789 head: `git fetch origin claude/dancer-journey-fixes`, then `git worktree add ../w789 FETCH_HEAD`.
- Read how the repo's own phone-qa / e2e specs sign a test user in (look under `e2e/`, `tests/`, `playwright.config.*`,
  `docs/`). Reuse that mechanism and the repo's seed/fixture files. Do not invent credentials; do not repeat any credential in output.
- Run a PRODUCTION build (`npm run build`) and serve it on localhost, not only the dev server. Use Playwright, Chromium, viewport
  390x844, deviceScaleFactor 2, isMobile + hasTouch.

## Shapes to walk (from the 2026-10-15 read-only prod survey; use fixtures of these shapes)
no dancer profile | setup unfinished | finished profile | hidden profile | organiser WITH a dancer side | organiser WITHOUT one |
upcoming nights | past nights only | no nights (empty state).

## Screens x shapes (screenshot each; record text + measurements)
1. Sign-up (Create account), city picker incl. "City not in the list?", code step, clickwrap row above "Email me a link".
2. Dancer app: home, nights, options. Every empty state must say what the person CAN do.
3. Options -> Account settings: "Back to Options" present and working; `?from=app`.
4. Delete-account page: breadcrumbs, the control is disabled WITH a reason where it cannot work.
5. Sign-out: lands on HOME; local/session storage cleared; works even if the server call is slow (throttle it).
6. Avatar with no photo: neutral fallback, not black; the same avatar on every screen it appears.
7. An event page RSVP signed in vs signed out.
8. Profile-strength text matches the server rule.
Measure on every screen: horizontal overflow, `elementFromPoint` at the centre of each primary button (must hit that button),
tap targets under 44 px in the first viewport (list name + size), text pointing at a control that is not on screen, the same fact
worded differently on two screens, saving an untouched record sends nothing (watch the network).

## Output (the ONLY thing you push)
Branch `claude/done-walk-789`, created from `origin/main` (so its vercel.json skips the preview build). Push ONCE.
Files: `docs/review-packs/dancer-journey-fixes/WALK.md` (a table: screen x shape -> OK / BUG with the measured number, then a
"Bugs found" list with route, shape, steps, expected vs actual, and a "Not verified" list), plus `shots/*.png` (keep under 5 MB total;
JPEG quality 70 if needed). Last commit subject must end with `[worker-done walk-789]`.
Do NOT fix bugs. List them; the orchestrator briefs the fix.

## Rules
- Plain git for read and push; never `gh api`. Shell commands without variables, loops or `$(...)` where a plain one works.
- Never merge or approve. Never `--no-verify`. Supabase: read-only on production; use a branch DB or local fixtures only.
- Say plainly what a sandbox cannot verify (real phone keyboard, real photo upload, real inbox).
- Context: at 25% start nothing new; by 30% push what you have as `PARTIAL [worker-done walk-789]` with what is left.
