# Handover: guard test for the PR template heading (PR #937)

Added one test to `tests/realDataVerified.test.ts` ("PR template"): reads `.github/pull_request_template.md`,
fills the `Shapes surveyed` / `Checks run` / `NOT verified` lines, asserts `parse(filled)` is
`{ ok: true, problems: [] }` and that the unfilled template is `ok: false`.

## RED (old heading `## Verified on real data (required)` put back in the template)

Command: `npx vitest run tests/realDataVerified.test.ts`

Result: FAILED, `Tests 1 failed | 39 passed (40)`.
`expected { ok: false, ... } to deeply equal { ok: true, problems: [] }`, problem:
`Section "## Verified on real data" is missing`.

## GREEN (template restored with `git checkout .github/pull_request_template.md`)

Command: `npx vitest run tests/realDataVerified.test.ts`

Result: PASSED, `Tests 40 passed (40)`.

## Not verified
Full `npm run lint` / `pre-ship` chain not run; only the targeted vitest file. PR body not edited
(`gh pr edit` fails with the bot token): the orchestrator copies this in.
