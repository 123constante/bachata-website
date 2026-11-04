# Handover: pause-switch-web (slice 1, Website)

Branch `claude/pause-switch-web`. HARD-TIER (guard-class): needs the OWNER's Approve at head.
Nothing ships armed; no variable, secret, token, flag or mode was created or changed.

## Deviation from the brief (read first)

**Issue listing order is `direction=desc`, not `asc`.** This repo already has ~1350 issues+PRs.
An oldest-first walk capped at 5 pages (500 items) can never reach a newly created
`AUTOMATION PAUSE SWITCH` issue, so the reader would report `pause issue missing` = PAUSED
forever (bot-automerge would never enable again). Newest-first finds it on page 1 now; once
500 newer items exist it falls out of the window and every reader fails CLOSED (loud).
Orchestrator decision needed for the long term: GraphQL `repository.pinnedIssues`, a higher
page cap, or re-creating the issue periodically. Pinned by a test (the query URL) so a change
is deliberate.

## What was built, per consumer

- `scripts/lib/automation-pause.mjs`: `readPause` (fail-closed table, no caching, Link paging
  up to 5 pages, refuses a next link off api.github.com), `postPauseNotice` (one comment per
  key, marker de-dup over 3 pages), `decideReassert` (pure, A15b), `PausedError`,
  `assertNotPaused`, plus `findPause` / `readPauseIssueEvents` for the guard.
- `scripts/automation-pause.mjs`: check (0 / 3), `--info` (always 0), `--guard` (0 / 1). Env
  only; unknown args = paused (3). Uses `isEntryPoint` (script-conventions R6).
- `scripts/autopilot-step.mjs`: `opts.pauseReader` (default = real `readPause` with
  `GH_TOKEN` + `opts.fetch`). Read FIRST per repo; `gh` and `bot` are wrapped so EVERY
  non-GET (perform: run-ci/relabel-ci/update-branch/rerun, pack/ping comments, status
  comment create/edit, createStatusIssue, ensureLabels, setStateLabel) re-reads the switch
  and throws `PausedError` when paused; `mergePr` re-reads explicitly before each merge
  (`switchPaused`, not the existing `paused` = main-red). Paused rows say `paused: <reason>`;
  summary says `Automation pause switch: PAUSED (...)`; exit 0. Once seen, the pause holds for
  the rest of that repo's run.
- `bot-automerge.yml`: `issues: read`; reader after checkout of main (`pause`) and again
  immediately before Enable (`pause2`); Enable needs both `paused == 'false'`; the disable
  step's `if` is `always() && !(<enable if>)`, so a pause disarms.
- `dependabot-automerge.yml`: `issues: read`; checkout `ref: main`, `persist-credentials:
  false`, setup-node, reader before Enable; new step disables an armed auto-merge when the
  switch is not positively running.
- `post-merge-prod-alarm.yml`: checkout of main + `--info` before the disable steps, both
  `continue-on-error` so the brake ALWAYS runs.
- `automation-pause-guard.yml` (new): `issues [labeled, unlabeled]`, every 30 min,
  `workflow_dispatch`; `contents: read, issues: write, pull-requests: write`; job `guard`
  (`--guard`), job `disarm` (on labeled with the pause label on the switch issue: disable
  auto-merge on every open PR). Names compared in `if:` only.
- `autopilot.yml`: unchanged (checkout is `default_branch`, `GH_TOKEN: github.token`,
  `issues: write` already); asserted by `tests/automationPauseWorkflows.test.ts`.
- `scripts/check-workflow-artifact-policy.mjs`: MEASURED re-derived to 36 files / 58 jobs /
  380 steps (it was NOT red before: main measured 35 files against a block of 34 and passed).
- `continue-on-error` on reader steps carries `# soft-signal:` reasons (lint-workflow-masking).

## Red, then green

Tests committed first in `5c18176` (before any implementation). Red run: `npx vitest run
tests/automationPause` -> 3 files failed (two suites could not import the absent reader/CLI;
the workflow suite failed 10 structure/completeness tests on the unchanged workflows), 8
passed. Green after the implementation: `tests/automationPause* tests/autopilot*
tests/automergeClassify` 674/674 passed, twice. The A15 mutant (mergePr without its re-read)
makes the A15 drill fail; each consumer with its reader steps removed fails its structure
test; the completeness canary goes red for a new merger/approver.

## EXEMPT list (completeness test)

- `bot-pr.yml`: opens a PR for a claude/** push; no merge, no approval.
- `types-drift-autoheal.yml`: force-pushes `bot/types-regen`, opens/refreshes one PR; no merge.
- `automation-pause-guard.yml`: the guard itself (re-assert + disarm are protective).

The first two were found outside the contract reader list: the orchestrator decides whether
a later slice wires them.

## Interaction notes (not solved here)

- A label re-added by the guard with GITHUB_TOKEN fires no new workflow, so `disarm` does not
  run on a re-assert; the 30-minute schedule does not disarm either. Auto-merge armed while
  the label was briefly off stays armed until the next readers/brake disable it.
- The bot-automerge reader runs on every qualifying event: up to 2 extra API reads per run
  (5 pages max each once the repo grows).
- Dependabot token may not be able to read issues (then it fails closed, `reason=HTTP 403`).
- `/code-review` was not run on this diff (worker context budget); the owner's independent
  review is still required by the guard-class rule.

## What is left

- Orchestrator: create the issue + label, then a read-only live check of
  `node scripts/automation-pause.mjs` against it; check the Dependabot token case live.
- Decide the long-term listing approach (see Deviation).
- Later slices: variable (b), `resume`, cross-repo read, readers for consumers 7-12.

## Fix round r1 (brief docs/briefs/fix-1361-r1.md, 2026-11-04)

Done:
- Reader author check: only an issue CREATED by the repo owner counts. `PAUSE_ISSUE_AUTHOR_BOTS`
  is deliberately EMPTY. Review found that listing kiki-claude-bot would let the paused automation
  create a fresh unlabelled issue and un-pause itself. Foreign same-title issues are ignored with
  a `::warning::`. Two owner issues = paused.
- Guard workflow: the scheduled run also runs `disarm` (needs: guard, always()). It disables
  auto-merge unless `--info` reads `paused=false`, so a label present OR any doubt disarms.
- Tests (red on mutants first): autopilot reader throws / malformed / default reader with
  GH_TOKEN; the author-check table; event x label table over the real `if:` expressions.

Left for the owner / orchestrator (review findings skipped as out of the r1 scope):
- the `issues`/labeled disarm still matches on title only, not author (disarm is the safe direction).
- `workflow_dispatch` does not disarm.
- the reader warning goes to console, not the CLI `out`.
- the owner is compared in two places (case-insensitive author check vs the case-sensitive
  `decideReassert`).
- the disarm job does one extra issues read.

Next steps: create the real `AUTOMATION PAUSE SWITCH` issue AS THE OWNER, because an issue
created by a bot is now ignored. Then do a live read-only `--info` and watch one scheduled
guard run.

Local env note: this container's node_modules lacked `qrcode-generator` (added on main in #1359).
After installing it, build passed. typecheck is 109 = main 109. bundle-budget /
first-load-requests are red on main too. The live-DB contract tests and integrityCouldNotRun
fail in this sandbox on files the diff does not touch.
