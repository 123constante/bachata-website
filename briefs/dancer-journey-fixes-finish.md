# Brief: dancer journey fixes, FINISHING slice (one pass)

Repo: 123constante/bachata-website. Branch: `claude/dancer-journey-fixes` (already exists; push to THIS branch only).
Model: Opus. You are the only worker on this branch. Do not push to any other branch.

## Why (owner's words)
The owner tested the new account system on a phone and found: "the keyboard hides the search results", the full site
navigation showing during sign-up, a Terms row falsely disabled, a black avatar when there is no photo. Then: "Why am I
having to do this? I am a beginner and you should be the professional that is creating the entire design."
An audit found 68 findings: `git show origin/claude/dancer-journey-audit:docs/audits/dancer-journey-2026-10-16/report.md`.
Three slices fixed most of them. This slice finishes the job so the owner's phone test is a formality.
You own every design decision; never leave a question for the owner. Log each decision in the handover.

## What the branch already has
`claude/dancer-journey-fixes` = main `ecc3432` + `claude/site-keyboard-safe` (keyboard helper) + `claude/djf-auth-chrome`
(slice A: auth + site chrome). Handovers: `docs/handovers/djf-auth-chrome.md` and the keyboard handover on the branch.

## Step 0: merge slice B
`git fetch origin` then `git merge origin/claude/djf-dancer-app` into `claude/dancer-journey-fixes`.
Known conflict: `src/lib/focusMode.ts` was ADDED by both slice A and slice B (add/add). Resolve it into ONE module that
keeps both slices' behaviour (A: sign-up routes in focus mode, the mapping stays a leaf module and the focus bar is
lazy-loaded for the perf ratchet; B: dancer setup focus chrome). One shared mapping, no second copy. Check every importer
of `focusMode` on both sides still compiles and behaves. Read `docs/handovers/djf-dancer-app.md` (slice B's handover)
for its "left / not done" list.

## Step 1: the unowned findings (audit IDs)
- M17: `src/components/ui/city-picker.tsx` combobox has no accessible name. Add a prop (e.g. `aria-label` / labelledby)
  and pass it from every caller; unit test that each caller's combobox has a name.
- M24: the "70%" profile-complete claim (MeScreen, OnboardingScreen). First check the real server rule READ-ONLY via the
  Supabase connector (the function behind `profile-completion` / `my_dancer_edit`); then make the copy say exactly what the
  server enforces (or drop the number). The text and the rule must come from one shared constant, not two copies.
- M4 remainder: owner decision = focus mode is ONLY for sign-up/setup. Account pages (`/account/settings*`, restore,
  deleted) keep normal chrome. Fix whatever else M4 lists for those pages (focus order, landing focus) without focus mode.
- Every item slice B's handover lists as left/not done.

## Step 2: keyboard spec rows (the owner's first bug)
The keyboard spec (from `claude/site-keyboard-safe`) has no rows for: `/account/settings/delete`, the `/app/*` dancer forms
(setup, edit, finish-profile), using fakes like the existing rows. Add them. Each row asserts the focused field and the
results/primary button sit above the simulated keyboard at 390x844. Red-first: show one new row failing with the helper
disabled, paste the red output in the handover.

## Step 3: consistency checks (definition of done)
Table-driven tests over the dancer journey screens: no text points at a control not on screen; every empty state says what
the person can do; any disabled control shows its reason (the owner saw a falsely disabled Terms row); one avatar
component everywhere with a non-black no-photo fallback.

## Gates (CI without paying GitHub)
GitHub Actions may refuse jobs with a "payments have failed / spending limit" annotation: billing, not code. Run EVERY job
step in `.github/workflows/` that runs on pull_request (typecheck, lint, unit incl. timezone runs, `npm run build`
PRODUCTION build, e2e smoke, phone-qa, build-smoke, bundle budget, isolation/integrity scripts). Per-job table (command,
exit code, pass counts) in the handover. Say plainly what you could not run (real phone keyboard, real inbox, upload).
Slice B was fixing e2e failures in `tests/e2e/dancer-app/home-nights.spec.ts`, `options.spec.ts`, and
`tests/e2e-build/account-edges.build.spec.ts` at its end: confirm they pass on the merged branch.

## Rules
- Plain git for read and push (`git fetch`, `git show`, `git push`). NEVER `gh api`. Do NOT open a PR (the orchestrator
  opens it as the bot). Do not edit PR #785.
- Shell commands without variables, loops or `$(...)` where a plain command works.
- Never merge into main, never approve. Never `--no-verify`. Supabase read-only.
- Do not touch organiser screens beyond what a merge needs (a separate session owns the organiser rebuild).
- Push after each step (checkpoint), with the handover `docs/handovers/dancer-journey-fixes.md` updated each time.
- Context: at 25% start nothing new; by 30% push + handover with `PARTIAL [worker-done <ticket>]`.

## Output
Last push carries `[worker-done <ticket>]` in the commit subject; `docs/handovers/dancer-journey-fixes.md` has: done per
audit ID, decisions made (with reasons), red-first output, per-job CI table, not verified.
