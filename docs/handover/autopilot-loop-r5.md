# Handover: autopilot-loop-r5 (Website copy of the admin autopilot loop, ships OFF)

Brief: `brief/autopilot-loop-r5:docs/briefs/autopilot-loop-r5.md`. Ticket dt_e884a94c666c.
Source: `123constante/bachata-admin` main at `f2b16a5` (r3/r4/r4b/r4c merged). Admin was read only, never edited.

## Done

- **Ported** `.github/workflows/autopilot.yml`, `scripts/autopilot-step.mjs`, `scripts/lib/autopilot.mjs`,
  `scripts/lib/autopilot-merge.mjs`, `scripts/lib/autopilot-pack.mjs` and the admin test suite
  (`tests/autopilot.test.ts`, `autopilotMutants.test.ts`, `autopilotWorkflow.test.ts`, `autopilotTable.ts`,
  `autopilotR2/R3/R4b/R4c.test.ts`; admin `autopilotR4.test.ts` became `tests/autopilotMerge.test.ts`).
- **Ships OFF.** A scheduled run is a dry run unless the owner sets the repo variable `AUTOPILOT_LIVE=true`;
  a dispatch is a dry run unless `dry_run` is exactly `false`; the merge lane is off unless `AUTOPILOT_MERGE_MODE`
  is set. `announce-failure` only fires when live. No variable, secret or label is written by this PR.
  REPOS input defaults to `123constante/bachata-website`; runner `ubuntu-latest` (the Website has no `laptop-light`).
- **Website hard tier** (`HARD_RULES` in the pack): `.github/`, `scripts/`, `supabase/`, `guards.json`, `vercel.json`,
  `package.json` and lockfiles. Website `review-scope.isRiskyPath()` also holds all of `src/`, so any screen is hard-tier.
  `SCREEN_RE` (any `.tsx/.jsx/.css/.scss`, anywhere) refuses the rest as "screen / app path". `SOFT_APP_ALLOW = []`:
  the lane can only ever say MERGE for a docs-only PR (tests stay owner-merged, r4b N3b).
- **Merge-lane adapter**: the Website `automerge-classify.mjs` has no `pathRefusal` / `isDocsClassPath`, so
  `autopilot-merge.mjs` maps them onto the Website `pathProblem()` / `pathClass()`; docs need a lowercase
  `.md/.png/.jpg/.webp/.gif` extension (admin DOC_EXT); the admin GOVERNANCE refusal is ported with the Website doctrine
  docs (`docs/pr-batching-policy.md`, `docs/testing-doctrine.md`, `docs/ci-guard-notes.md`, `docs/automerge.md`, ...).
- **r4b + r4c refusals** copied with their tables and mutants (agent-instruction names at any depth, `.claude/`,
  `.gemini/`, `.cursorrules`; labels case-insensitive; placeholder Verified; tests by class).
- **Vercel-safe** (requirement 4): `runCiRefusal()` refuses run-ci on a docs-only PR, a `[skip preview]` head subject,
  or an unread file list / subject (fail closed -> `stop`). `update-branch` only on a branch whose vercel.json
  `git.deploymentEnabled` is `false` (`deploymentEnabledFor()`, exact key beats glob); an unread vercel.json refuses.
  vercel.json is read GET-only per repo (`/contents/vercel.json`). The loop makes no deployment.
- **Proof run**: the Website's PR workflows run on every `pull_request` push (there is no `run-ci` label switch here),
  so `RUN_CI_GATED = false`: any `pull_request` run at the head is the proof. The admin "label on an older head /
  relabel once" deriveFacts rows were replaced by Website rows. run-ci is therefore effectively inert here; it is still
  capped (25 / 24 h, bot-only counting).
- **Red also on main** (requirement 5, ~10 lines): `redAlsoOnMain(jobs, mainRed)` in `scripts/lib/autopilot.mjs`
  compares each failing check name at the PR head with the same name on main's latest head; the pack prints
  `red also on main: yes|no|not read` under the per-job table.
- `detectRunnerDeath` inlined into `autopilot.mjs` (the admin `queue-dry-run.mjs` does not exist here).
- The shebang was dropped from `autopilot-step.mjs` (vitest could not parse `#!` with CRLF); the workflow calls `node`.

## Verified

| check | result |
|---|---|
| `npx vitest run tests/autopilot` (8 files) | 473 passed, 0 failed |
| r5 mutants (7: run-ci refusal, docs-only, skip preview, subject unread, files unread, vercel unread, update gate) | all caught |
| r1-r4c mutants ported | all caught (unmutated copies pass: harness honest) |
| `npm run check:script-conventions` | pass |
| `npm run check:integrity` / `check:mojibake` / `check:no-preview-prefixes` | pass |
| `node scripts/check-workflow-artifact-policy.mjs` | exit 1: MEASURED block stale (recorded 43 jobs). Stale on main already (main has 33 workflow files vs 30 recorded); this PR adds 2 jobs. Not re-derived here (out of scope). |

## Not verified

- **Requirement 7, read-only dry run of the real `run()` against the live Website repo: NOT DONE.** This session
  has no GitHub API token for a GET-only fetch shim (the prompt forbids `gh api`). Next session: run
  `DRY_RUN=true REPOS=123constante/bachata-website GH_TOKEN=<read token> node scripts/autopilot-step.mjs` with a
  fetch shim that throws on any non-GET, and table the decisions here.
- Red-first for the r5 decide rows was shown via mutants (each r5 gate removed -> a row turns red), not by running the
  table against the raw admin copy (that copy cannot load here: it imports `queue-dry-run.mjs`).
- `ci-budget` guard: needs `CI_BUDGET_GITHUB_TOKEN` (not set). Hourly `ubuntu-latest` minutes are not measured.
- The workflow has never run on GitHub; the PR's own CI is the first run of the tests there.

## Next

1. Independent review (website-18). 2. Owner Approves at head. 3. Live dry run (above) and table it.
4. Owner decides `AUTOPILOT_LIVE=true` later; `AUTOPILOT_MERGE_MODE` stays unset until then.
5. Separately: re-derive the MEASURED block in `check-workflow-artifact-policy.mjs` (red on main too).
