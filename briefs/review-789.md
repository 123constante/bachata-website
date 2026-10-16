# Brief: independent review of PR #789 (dancer journey fixes), READ-ONLY on the PR branch

Repo: 123constante/bachata-website. PR #789, head branch `claude/dancer-journey-fixes` at `d176c86`.
Model: Opus. You did NOT write this code. You push ONLY to your own branch `claude/review-789` (create it from
`origin/claude/dancer-journey-fixes`); never push the PR branch.

## Why (owner's words)
The owner phone-tested the account system and found four real bugs in minutes ("the keyboard hides the search results",
full navigation during sign-up, a falsely disabled Terms row, a black avatar), then said: "Why am I having to do this? I am
a beginner and you should be the professional that is creating the entire design." This PR fixes the audit
(`git show origin/claude/dancer-journey-audit:docs/audits/dancer-journey-2026-10-16/report.md`). Your job: find what would
make the owner's next phone test fail, BEFORE they see it.

## Read first
`docs/handovers/dancer-journey-fixes.md`, `docs/handovers/djf-auth-chrome.md`, `docs/handovers/djf-dancer-app.md` on the
branch, then `git diff origin/main...origin/claude/dancer-journey-fixes`.

## Check, in this order
1. Correctness bugs in the diff (routing, sign-out, focus mode, the `focusMode.ts` merge of two slices, keyboard helper,
   `?from=app` param, avatar fallback, breadcrumbs, profile-strength copy vs prod `_dancer_strength_v1` (read-only SQL)).
2. Each audit ID the handovers call "fixed": is it really fixed on screen? Spot-check at least 10 with a production build
   (`npm run build` then the build-smoke harness or a preview server) at 390x844 and 360x640.
3. Consistency: the same fact reads the same on every screen (one shared mapping), no text points at a control that is not
   on screen, every empty state says what the person can do, every disabled control shows its reason.
4. Tests that cannot fail: pick 3 new tests and revert the fix they guard; they must go red. Report which you tried.
5. Regressions on organiser screens or public pages from the shared files (AppChrome, GlobalHeader, contactLinks,
   keyboard helper, vite manualChunks).
Do NOT review `scripts/dancer-area-isolation-allowlist.json`; the orchestrator is updating it separately.

## Output
`docs/review-packs/dancer-journey-fixes/REVIEW.md` on `claude/review-789`: findings ranked (BLOCKER / SHOULD / NIT), each with
file:line, the failure a person would see, and the exact fix; plus the mutation results and what you could not check.
No code fixes. Last commit subject ends with the done marker from your dispatch prompt.

## Rules
- Plain git for read and push. NEVER `gh api`. Never edit PR #789 or its body.
- Shell commands without variables, loops or `$(...)` where a plain command works. Check a PRODUCTION build.
- Never merge or approve. Never `--no-verify`. Supabase read-only.
- Context: at 25% start nothing new; by 30% push REVIEW.md as it stands with `PARTIAL [worker-done <ticket>]`.
