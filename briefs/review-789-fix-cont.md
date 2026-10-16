# Brief: PR #789 review fix CONTINUATION (gates + mutants), one pass

Repo: 123constante/bachata-website. Branch: `claude/dancer-journey-fixes` (PR #789, head `b9fd165`). Push to THIS branch only.
Model: Opus. You are the only worker on this branch.

## Why
The previous fix worker stopped at its context limit (PARTIAL). All review findings B1, S1-S7 and the dancer-area
isolation seams are DONE and pushed. Read first: `docs/handovers/dancer-journey-fixes.md` (sections "Review fix" ...
"Left (next worker)") and `git show origin/claude/review-789:docs/review-packs/dancer-journey-fixes/REVIEW.md`.
The owner found bugs on a phone that our checks should have found; nothing reaches the owner before every gate is green.

## Its "Left" list, quoted
1. Step 5: re-run the review's 10 mutants that touch changed code (focusMode x3, pickerAccessibleName x2,
   avatarSurfaces x2, journeyGuards, optionsAudit settings link, termsConsent) and confirm all still red.
   `optionsAudit` M4 mutant: the link is now `APP_ACCOUNT_SETTINGS_PATH` from accountRouting.
2. The full gate pass: `npm run test:unit` (and its 3 TZ runs), lint chain (`chmod +x bin/*.sh` first),
   architecture-guard, typecheck job steps, e2e-smoke, full phone-qa (phone + build), build-smoke; fill the table.
3. (skip: no /code-review needed; instead read your own diff of `scripts/dancer-area-isolation-allowlist.json` and
   the self-test change once and confirm the self-test still breaks every rule on purpose.)
4. (not yours: organiser sign-outs belong to the organiser session; the orchestrator has told it.)

## Do
Items 1, 2 and 3. Fix any real red you find (smallest change, same style); a red that also fails on `origin/main` is
pre-existing: prove it by running it on main and say so. Replace the per-job table in the handover with the final one
(command, exit, counts) and update "Not verified".

## Rules
- GitHub Actions may refuse jobs ("payments have failed / spending limit"): billing, not code. The sandbox table is the record.
- Plain git for read and push. NEVER `gh api`. No new PR, no labels, do not edit PR #789.
- Shell commands without variables, loops or `$(...)` where a plain command works.
- Never merge or approve. Never `--no-verify`. Supabase read-only.
- Context: at 25% start nothing new; by 30% push + handover with `PARTIAL [worker-done <ticket>]`.

## Output
Last push carries `[worker-done <ticket>]` in the commit subject.
