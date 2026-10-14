# Brief: organiser edit-in-place placeholder contrast (Website)

Repo: 123constante/bachata-website. Branch to work on: claude/organiser-placeholder-contrast (from main).
You own: `src/modules/organiser/theme.css` and, only if needed, files under `src/modules/organiser/edit-in-place/`. Nothing else.

## Problem (owner's finding)
Placeholder text in the organiser edit-in-place sheets is too faint. Token `--ph: #8f8678` in `src/modules/organiser/theme.css`
(used by `placeholder:text-[var(--ph)]` in `src/modules/organiser/ui/Field.tsx` and a rule near theme.css line 53) on `--card2`.
The theme comment claims AA, but the owner still finds it hard to read in FieldSheet, ContactSheet, CitySheetBody, TeamSheet.

## Task
1. MEASURE first: compute the real contrast ratio of `--ph` against the actual background in each sheet (resolve the CSS variables). Put the numbers in the PR.
2. Change ONE colour (`--ph`) so it reaches at least 4.5:1 on every background it is used on, while staying visibly lighter than typed text (`--fg`).
   If another surface uses its own placeholder colour in these sheets, report it, do not widen scope.
3. Add a table-driven unit test that parses the token values and asserts >= 4.5:1 per background pair. Show it FAILS on the unfixed code first.

## Gates
Read `.github/workflows` and run EVERY CI job step you can in the sandbox (per-job table with command and exit code in the PR body).
Run `npm run build` (production). GitHub Actions may be refused for billing: not a code failure. Include the Phone QA section the PR template asks for.

## Boundaries
- Never merge or approve. Open the PR as the bot (`gh pr create`, `GH_TOKEN` = `GH_BOT_TOKEN`).
- Read and push with PLAIN git. Never `gh api`. No shell variables, loops or `$(...)`.
- Supabase read-only (no DB needed). Never `--no-verify`. No Vercel logins.
- Checkpoint progress in the PR description. If you cannot finish, push what is safe and write what is left.
- Last push commit message must contain `[worker-done <ticket>]`. Stop after the push and report.
