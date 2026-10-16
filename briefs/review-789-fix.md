# Brief: PR #789 review fix, ONE pass (blocker + shoulds + isolation allow-list)

Repo: 123constante/bachata-website. Branch: `claude/dancer-journey-fixes` (PR #789, head `d176c86`). Push to THIS branch only.
Model: Opus. You are the only worker on this branch.

## Why (owner's words)
The owner phone-tested the account system and found real bugs in minutes, then said: "Why am I having to do this? I am a
beginner and you should be the professional that is creating the entire design." An independent review of #789 found that
the owner's next phone test would still fail: Options -> Account settings -> Sign out lands on "Welcome back" (the sign-in
form), the exact bug (H10) this PR fixes elsewhere. Read the review in full first:
`git show origin/claude/review-789:docs/review-packs/dancer-journey-fixes/REVIEW.md`

## Do
1. **B1 (required)**: every sign-out button goes through the ONE shared sign-out-to-home path; no second copy. Add a
   table-driven test over every sign-out entry point (the review lists them) asserting the landing page is home, not
   /auth. Red-first on `d176c86`, paste the red.
2. **S1-S7**: do the review's exact fix for each. Your call where the review offers options; log the choice and reason.
   S5 touches the organiser PreviewBar only to restore its hide-while-typing on Android (a regression from our keyboard
   helper); change nothing else on organiser screens (a separate session owns the organiser rebuild).
   S6: keep `lib-account` off routes that do not need it, measured with `check:bundle-budget` and
   `check:first-load-requests`; do not raise a budget.
3. **NITs**: only the ones that are a few lines in files you already touch.
4. **dancer-area isolation (orchestrator decision, made)**: this PR is a deliberate cross-area fixes PR. In
   `scripts/dancer-area-isolation-allowlist.json` add every file `npm run check:dancer-area-isolation` reports (the
   protected legacy files it changes and the site files) to `seams`, each with a `seamNotes` entry
   "dancer journey audit fixes 2026-10-16 (#789)". Remove the same paths from `protected` where listed. Do not loosen the
   doc prefixes or the rules. The check and its `--self-test` must both exit 0. Do NOT edit any file on
   `arc/briefs-dancer-rebuild` (the orchestrator mirrors the list into `briefs/dancer-rebuild-INTERFACE.md`); list the
   paths you added in the handover so the orchestrator can mirror them.
5. Re-run the review's 10 mutants that touch code you changed; all must still go red.

## Gates (CI without paying GitHub)
GitHub Actions may refuse jobs with a "payments have failed / spending limit" annotation: billing, not code. Run EVERY
pull_request job step in `.github/workflows/` your sandbox can run (unit incl. the 3 timezone runs, typecheck, lint chain
with `chmod +x bin/*.sh` first, architecture-guard, perf-budget/bundle-budget on a PRODUCTION `npm run build`, e2e-smoke,
phone-qa, build-smoke, dancer-area isolation). Per-job table (command, exit, counts) in the handover.

## Rules
- Plain git for read and push. NEVER `gh api`. Do not edit the PR or its body (the orchestrator does).
- Shell commands without variables, loops or `$(...)` where a plain command works.
- Never merge or approve. Never `--no-verify`. Supabase read-only.
- Push after each numbered step with `docs/handovers/dancer-journey-fixes.md` updated (add a "Review fix" section:
  done per finding, decisions, red-first output, seams added, per-job table, not verified).
- Context: at 25% start nothing new; by 30% push + handover with `PARTIAL [worker-done <ticket>]`.

## Output
Last push carries `[worker-done <ticket>]` in the commit subject.
