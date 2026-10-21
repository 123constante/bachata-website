# Brief: guard test for the PR template heading (Website PR #937, ONE fix pass)

Repo `123constante/bachata-website`, branch `claude/pr-template-heading` (PR #937, head a6dc159a). Push ONCE at the end. Sonnet.

## Why
PR #937 fixed `.github/pull_request_template.md` heading `## Verified on real data (required)` -> `## Verified on real data`.
The previous worker proved honestly that NO test could catch the old heading: `tests/phoneQaSection.test.ts` parses the
template with the Phone QA checker, not the real-data one. Add the missing check so the mistake cannot come back.

## Task (exactly this)
1. In `tests/realDataVerified.test.ts` add ONE test: read `.github/pull_request_template.md` (same way phoneQaSection.test.ts
   does), fill its `- Sizes checked:` / `- Walked:` / `- Not verified:` lines with real-looking content, and assert
   `parse(filled)` from `scripts/check-pr-real-data-verified.mjs` is `{ ok: true, problems: [] }`; and that the unfilled
   template is `ok: false`. Check the label names the parser expects in that script and fill those.
2. RED FIRST: temporarily put the old heading back in the template, run `npx vitest run tests/realDataVerified.test.ts`,
   record the failure, restore the template (git checkout the file), run again green.
3. Write both runs (command + result) to `docs/handover-pr-template-heading.md` on the branch. Do NOT edit the PR body (`gh pr edit` fails with the bot token); the orchestrator copies it in.

## Rules
Plain git only, never `gh api`. No variables/loops/`$(...)` where a plain command works. Never `--no-verify`.
Final commit subject ends `[worker-done <ticket>]`. Stop after the push and report.
