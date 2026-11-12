# Handover: e2e spec-list guard (item 1 of 4, e2e audit 2026-11-12)

Brief: `docs/briefs/e2e-spec-guard.md` on branch `brief/e2e-spec-guard`. Branch: `claude/e2e-spec-guard`.

## Done
- `scripts/check-e2e-spec-coverage.mjs`: every `tests/e2e/**/*.spec.ts` (any `live/` dir excluded, as the
  chromium project's `testIgnore` does) must be named in `test:e2e` or `test:e2e:p3` (both run by
  `e2e-smoke.yml`, which the guard also checks), or be in `MANUAL` with a reason and the command that runs it.
  Red: unlisted spec, stale MANUAL entry, spec in both, MANUAL entry missing reason/command, a list naming a
  missing file, a list the workflow no longer runs. Exit 2 on zero specs / missing list / unreadable package.json.
- `--self-test` canary (15 cases, drives `main()`), npm aliases `check:e2e-spec-coverage[:self-test]`.
- **CI path, no workflow edit:** `tests/e2eSpecCoverage.test.ts` runs the guard against the live tree, so the
  `unit` job in `unit-tests.yml` (every pull_request) goes red. Also linked into `npm run lint` (pre-ship), and
  listed in `prove-entry-point-dispatch.mjs` TARGETS.
- Red-first shown: `tests/e2e/foo.spec.ts` made the script exit 1 and the vitest live-tree case fail, naming
  the file and both remedies. Removing the file made both green again.

## Measured (main 8e0b932, 2026-11-12): the brief's numbers were stale
The brief said 20 specs, 15 listed, 5 manual. The real counts are 87 specs: 45 listed (`test:e2e` 31,
`test:e2e:p3` 14), 39 now allow-listed manual, and 3 under `live/` (`test:e2e:live`, live-qa.yml).
The 39 MANUAL specs, by reason: 30 screenshot walks that only produce a report (11 of them need a served
production build), 5 that need real Supabase or E2E credentials, 3 that need a flag or env var at server
start and skip without it, and `console-clean-smoke`, which has no recorded reason (item 2 should look at it).

## Deviation from the brief
The brief said to ignore specs in subfolders and helpers. I did not: `dancer-app/` holds specs the gate runs,
and playwright would also collect a spec placed in `helpers/`. Only `live/` is ignored, because it has its own
config.

## Left / next
- Item 2: decide which MANUAL specs should run in CI. `console-clean-smoke` is the obvious first candidate.
- Known limit: the workflow check is textual. A `run: npm run test:e2e` line under `if: false` still passes.
