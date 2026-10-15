# Brief: Website: bring PR #761 (nav to the top) up to date with main

Repo `123constante/bachata-website`. Read FIRST `briefs/dancer-rebuild-COMMON.md` and `briefs/site-nav-top.md` on
`arc/briefs-dancer-rebuild` (`git fetch origin arc/briefs-dancer-rebuild` then `git show FETCH_HEAD:<path>`).
Then the repo's `CLAUDE.md` and `docs/review-packs/site-nav-top/HANDOVER.md` on the branch.
Plain git only, never `gh api`. Shell commands without variables, loops or `$(...)` where a plain command works.
Check a PRODUCTION build (`npm run build` + preview), not only the dev server.

BRANCH: `claude/site-nav-top` (PR #761, already open, bot). Push to it. Never merge the PR, never force-push.

## Why
PR #761 is CONFLICTING with main in `src/components/AppChrome.tsx` and `src/components/BottomNav.tsx`. Since the
branch point `bc43fb6f`, main gained:
- `2260d46b` #759 dancer app 1a (AppChrome: the closed `/app` area has its own chrome; keep that exactly).
- `9a8351cf` "no band above the BottomNav": BottomNav row 58 -> 61 px so it matches AppChrome's 64 px bottom spacer,
  and the home shell / `.route-shell` subtract 124 px (= 60 header + 64 nav). With the nav moved to the TOP that
  bottom-spacer math is obsolete: find every place that subtracts or pads for the bottom bar (grep 124, 64px,
  nav spacer, safe-area) and make it right for the new layout (header + top row, nothing fixed at the bottom).
- `865bd82b` (storage) touched one of these files too; keep its change.

## Task
1. `git merge origin/main` into `claude/site-nav-top` (a merge commit, no rebase). Resolve keeping BOTH: main's /app
   behaviour from #759, and #761's top row. No band/strip at the top row's edge or at the page bottom.
2. Run every step of `.github/workflows/*` that runs on a PR (read them) in your sandbox: lint, typecheck, unit,
   build, the phone specs incl. `tests/e2e-phone/site-nav-top.phone.spec.ts` and `organiser-save-bar.phone.spec.ts`.
   GitHub Actions may be refused for billing; that is not a code failure. Put a per-job table (command, exit code)
   in `docs/review-packs/site-nav-top/HANDOVER.md` under `## CI run in the worker sandbox` (the orchestrator copies
   it into the PR body; do not use `gh` at all).
3. Re-take the 390x844 AFTER shots of home, event, festival, organisers, account-save (production build, prod-shaped
   data) into `docs/review-packs/site-nav-top/after/`, plus one `/app` shot signed-out (must show the dancer app's own
   sign-in/landing unchanged, no public top row there).
4. Update `docs/review-packs/site-nav-top/HANDOVER.md`: what conflicted, how resolved, the new spacing numbers you
   measured (header+row height at 390, page-bottom gap = 0).

Owned files: only the files PR #761 already touches plus any file that carries the 124/64 bottom-bar math. Do NOT
touch `src/modules/dancer-app/**` or routing (another worker owns dancer routing on `claude/dancer-app-routing`).

Stop after the push and report.
