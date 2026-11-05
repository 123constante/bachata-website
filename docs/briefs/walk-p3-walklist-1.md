# Brief: PR #1308 mojibake fix (re-save the evidence files as UTF-8, meaning unchanged)

Repo 123constante/bachata-website. Branch claude/walk-p3-walklist-1 (continue it, PR #1308, head 8b1a8f67). Lane fast/docs. Model Sonnet. ONE push.
Request 2026-11-05 from the program lead (website-45-f): #1308 is BLOCKED only because its `integrity` check is red: "cp1252->UTF-8 mojibake detected. Re-save the affected files as UTF-8 (charset declared in .editorconfig)." Nothing else is wrong with it. Do not merge, do not approve.

## Task
1. `git fetch origin main claude/walk-p3-walklist-1`, check out the branch, merge origin/main into it (plain git merge, no rebase) so the checks run on current main.
2. Find the affected files: run `npm run check:mojibake` (read scripts/check-mojibake.mjs or whatever it runs first, to see what it flags and in which files).
3. Repair each affected file so the garbled sequences (for example the cp1252 round-trip of an em dash, apostrophe or arrow) become the intended characters, saved as UTF-8 without BOM, keeping the file's existing line endings. MEANING UNCHANGED: do not edit wording, numbers, tables, JSON values or pictures (never touch .png files); if a JSON line holds garbled text, repair that string only. If the repo offers a repair mode (`npm run repair:corrupt` or a --fix flag), read what it does first and use it only if the resulting diff stays text-only.
4. Verify: `npm run check:mojibake` exits 0; `git diff --stat origin/main...HEAD` shows only the docs/evidence paths the PR already had (no new files); every .json/.jsonl file you touched still parses (node -e JSON.parse, per line for .jsonl).
5. Commit with a message ending `[worker-done <ticket from your prompt>]`, ONE push to claude/walk-p3-walklist-1.

## What main lacks -- grep: mojibake check green on this branch

## Files
- the evidence files already in PR #1308 (docs/** and observation files) that the mojibake check names; no others.

Do NOT touch src/**, scripts/**, .github/**, perf-budgets.json or vite.config.ts. PR body: leave as is unless it fails the repo's body checks (docs-only PR: no Phone QA section needed).
Handover: a 5-line note in your final report (files repaired, check result); no new repo file.
