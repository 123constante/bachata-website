# Brief: pause-switch-web (WEBSITE, SLICE 1 of full automation: the pause switch). Branch claude/pause-switch-web. Repo 123constante/bachata-website.

Brief-version: 2
Lane: careful
Model: Opus
Tier: HARD-TIER (guard-class change: workflows + scripts). It needs the OWNER's Approve at head later; you never approve, never merge, never self-certify.

Context line: stay under 30% of your context; at 25% start nothing new; push + handover by 30%. Never merge/approve/--no-verify. Plain git only (never `gh api`). Supabase is not needed in this slice; if you touch it, READ-ONLY. PUSH ONCE, when the slice is coherent and its tests ran; never add `run-ci` yourself.

Source of truth: the acceptance contract for full automation (rev 3.1), slice 1. You cannot read it, so every rule you need is copied below VERBATIM. Do not widen scope beyond what is written here.

## What main lacks
(Verified by the orchestrator on origin/main of this repo, commit e953482b, 2026-11-04: `git grep -i -E "automation-pause|automation_paused|pause switch"` returns nothing, and every path below is absent.)
- there is no shared pause reader (one fail-closed implementation) that consumers can import -- scripts/lib/automation-pause.mjs
- there is no command-line wrapper for the reader that workflow steps can call -- scripts/automation-pause.mjs
- no workflow or script anywhere consults the pause label, so nothing can be paused today -- grep: automation-paused
- there is no workflow that re-asserts the label when a non-owner removes it, or that disarms already-armed auto-merge when the pause is set -- .github/workflows/automation-pause-guard.yml
- there is no test that proves drill A15 (a pause set mid-run stops the very next merge in the same run) or the fail-closed table -- tests/automationPause.test.ts
- there is no test that proves every merge/approval/write consumer reads the switch before acting, nor a completeness test that fails when a new consumer lacks the reader -- tests/automationPauseWorkflows.test.ts
- there is no test for drill A15b (a bot cannot remove the label; it is re-asserted with an alert) -- tests/automationPauseGuard.test.ts
- there is no operator doc for the switch -- docs/automation-pause.md

## Files
scripts/lib/automation-pause.mjs
scripts/automation-pause.mjs
scripts/autopilot-step.mjs
scripts/lib/autopilot-merge.mjs
.github/workflows/automation-pause-guard.yml
.github/workflows/bot-automerge.yml
.github/workflows/dependabot-automerge.yml
.github/workflows/autopilot.yml
.github/workflows/post-merge-prod-alarm.yml
tests/automationPause.test.ts
tests/automationPauseWorkflows.test.ts
tests/automationPauseGuard.test.ts
tests/autopilot*.test.ts (ONLY to inject a not-paused reader into their harness; no assertion may be loosened)
tests/autopilotTable.ts (same rule)
scripts/check-workflow-artifact-policy.mjs (ONLY to re-derive its MEASURED block after adding a workflow file)
docs/automation-pause.md
docs/automerge.md (one pointer line)
docs/handover/pause-switch-web.md

## Orchestrator-owned items (do NOT do these)
- Creating the pinned issue titled exactly `AUTOMATION PAUSE SWITCH` and the label `automation-paused` is done by the orchestrator, not the worker; the worker reads it by title. Your tests use fakes; you never call the live API.
- Do NOT create any PAT, token, secret, variable or App. No repo variable is read or written by the switch in this slice (the variable half comes in a later slice, after a credential exists). Do not edit `arming` state, `AUTOMERGE_ENABLED`, `BOT_AUTOMERGE_ENABLED`, `AUTOPILOT_LIVE` or `AUTOPILOT_MERGE_MODE` semantics.
- The other repo (bachata-admin) has its own brief and worker. Cross-repo reading is NOT in this slice (GITHUB_TOKEN of one repo cannot read the other private repo; a read credential is a later slice). Each repo reads its own switch; the orchestrator sets both labels when it pauses.

## Contract text you must follow (verbatim)

### Slice 1 row (section 16)
> Pause switch: label on the pinned issue (GITHUB_TOKEN only; the PAUSE token does not exist yet, so nothing about its scope is verified here) + readers in EVERY consumer of section 7 (incl. `bot-automerge.yml`, dependabot-automerge, Apply drift alert); drills A15, A15b; interim message channel (issue comment only). Tier: HARD-TIER (guard). Opus, careful.
> Every slice from 1 on writes its stop messages to the interim pinned-issue channel. Slice 1 lands the pause and its readers before anything else is extended. The current state is NOT "off": bot-automerge is ON in both repos.

### Section 7.1 Design (the label half only applies in slice 1)
> PAUSED = ANY of: (a) the label `automation-paused` on the pinned issue `AUTOMATION PAUSE SWITCH` in either repo; (b) the repo variable `AUTOMATION_PAUSED` equal to `true` in either repo; (c) any read error on (a) or (b). The label is set with GITHUB_TOKEN `issues:write`; the variable is set with the PAUSE token by `automation-pause.yml`. Setting is allowed to the owner and to any loop on doubt. CLEARING needs BOTH, in this order: the owner removes the label (works in the GitHub mobile app), then the owner comments `resume` on the pinned issue ... No other workflow contains code that writes `false` or removes the label (CI grep check in the guard set). Honest wording: that grep and the re-assert on an unexpected change are TRIPWIRES that catch mistakes and most attacks, not guarantees.
In slice 1 ONLY (a) and (c) exist. There is no variable and no `resume` workflow yet: clearing = the owner removes the label. Do not build (b) or `resume`.

### Section 7 readers (each must test-read the switch FIRST, and again BEFORE EACH MERGE, APPROVAL or WRITE inside a loop, not once per run)
> 1. autopilot  2. merge lane (re-checked before each of up to 3 merges in a run)  3. migration queue (admin only)  4. `bot-automerge.yml` (the one actually ON today)  5. `dependabot-automerge.yml`  6. post-merge brake  7. canary and revert workflows (a pause stops REVERT MERGING, never the canary's reading or alerting)  8. worker dispatcher  9. Apply workflow (admin only)  10. the notifier (it still sends while paused)  11. the APPROVER workflow  12. walk gate dispatch
Present in THIS repo today: 1, 2 (inside the autopilot script), 4, 5, 6. Items 3 and 9 are admin only. Items 7, 8, 10, 11, 12 do not exist in this repo (they arrive in later slices; do not build them; later slices will add their readers).

### Drill A15 (expanded) and A15b (tests you must write; they run in CI)
> Drill A15 (expanded): set the switch with a loop MID-RUN; the NEXT merge in that same run does not happen; every reader above logs `paused` and writes nothing; Apply posts the drift alert; the label is not removable by any bot (drill A15b).
> Table row A15 kill switch: injected fault "set the pause mid-run"; pass signal "next merge in the SAME run does not happen; all 12 readers log `paused`; Apply posts the drift alert; the approver does not approve".
> Table row A15b: injected fault "a bot tries to remove the label"; pass signal "label re-asserted, alert, no bot code path removes it".
> Existing finer switches stay (read from the arming file where they were variables): `queue-stopped`, per-PR `do-not-merge` / `needs-owner` / `owner-reserved` / `held-overlap`.
> Every drill uses a throwaway PR or test path, injects one fault, and passes only if the system stops or self-heals and the named signal appears. (In this slice the drills run as CI tests with fakes; no live fault is injected.)

### Guard-class rules (condensed from sections 14.1, 6.1a, 6.2; wording kept)
> The automation can NEVER merge a PR touching `.github/**`, `scripts/lib/autopilot*`, `scripts/automerge-classify.mjs`, the pause switch's reader code, hooks/CLAUDE.md/permissions. Such changes are HUMAN: the OWNER Approves at head (batched), after an independent review. The pause switch's reader code is itself a guard path.
> Poisoning rule: PR title, body and branch name text is NEVER interpolated into a shell, a `run:` block or a `github-script` evaluated string. Every NEW workflow carries a test: shell metacharacters in a title/body/branch name must stay inert data.
> No automation credential may authenticate as the owner's own GitHub login. Self-hosted runners never run a `pull_request` workflow with secrets (does not apply to Website: all its workflows are GitHub-hosted).
> Identity note: "owner login" for the guard = `github.repository_owner` (123constante); compare via an env var, never interpolated into the script text.

## Design you must implement (one implementation; fail closed)

### 1. `scripts/lib/automation-pause.mjs` (Node built-ins only, no npm install; the workflows call it without `npm ci`)
Exports:
- `PAUSE_ISSUE_TITLE = 'AUTOMATION PAUSE SWITCH'`, `PAUSE_LABEL = 'automation-paused'`.
- `readPause({ repo, token, fetch, timeoutMs = 10000 })` -> `{ paused: boolean, reason: string, issue: number | null }`. NO caching and NO memoisation (each call hits the API; this is what makes "again before each merge" real). One request in the normal case: `GET /repos/{repo}/issues?state=all&per_page=100&sort=created&direction=asc`, following `Link: rel=next` up to 5 pages; ignore items that have a `pull_request` key; match the title EXACTLY (case-sensitive, trimmed). Decision table, every row is a test case:
  - exactly one matching OPEN issue, label `automation-paused` NOT present -> `paused:false`.
  - label present (labels may be objects `{name}` or plain strings; exact name match, so `automation-paused-x`, `Automation-Paused` and a label on a PR do NOT count) -> `paused:true, reason:'label'`.
  - zero matching issues -> `paused:true` (reason `pause issue missing`). Exactly one but CLOSED -> `paused:true`. More than one matching -> `paused:true` (reason `ambiguous`).
  - ANY read error -> `paused:true` with a reason naming it: HTTP 401, 403, 404, 429, 500, 502, a network throw, a timeout (AbortController), a body that is not JSON, a body that is not an array, an item whose `labels` field is missing or not an array, a missing `token`, a missing/invalid `repo` (must match `^[\w.-]+/[\w.-]+$`; `repo` comes from `GITHUB_REPOSITORY`, never from PR-controlled text).
  - It never throws to its caller and never returns `paused:false` unless it positively read exactly one open issue without the label.
- `postPauseNotice({ repo, token, fetch, key, text })`: the INTERIM CHANNEL = ONE comment on the pinned issue, de-duplicated by a marker `<!-- automation-pause-notice key=<key> -->` (reads existing comments, up to 3 pages, and skips when the key is already there). Returns `{ posted, skipped, error }`; never throws. A consumer that is merely skipping a merge only LOGS (no comment, so an hourly loop never spams); only the Apply-style "hold and alert" cases in later slices and the guard's re-assert use a notice. No push notification, no other channel.
- `decideReassert({ labelPresent, events, ownerLogin })` (pure): given the pinned issue's events (`GET /repos/{repo}/issues/{n}/events`, `event: 'labeled'|'unlabeled'`, `label.name`, `actor.login`, `created_at`, `id`), return `{ reassert: boolean, eventId, actor }`. Rule: if the label is absent AND the most recent label event for `automation-paused` is an `unlabeled` by an actor that is not `ownerLogin` (this includes `kiki-claude-bot` and `github-actions[bot]`) -> reassert. An `unlabeled` by the owner is the legitimate clear -> no action. No label event ever -> no action. Unreadable/odd events -> `{reassert:false, error:'...'}` (the guard then reports red, never silently green).
Also export a tiny `PausedError` and `assertNotPaused(...)` if it makes the call sites shorter.

### 2. `scripts/automation-pause.mjs` (CLI over the lib; env `GH_TOKEN`, `GITHUB_REPOSITORY`)
- `node scripts/automation-pause.mjs` (check): prints `paused=true|false` and `reason=<text>` lines to stdout and to `$GITHUB_OUTPUT` when set; prints `::notice::paused: <reason>` when paused; exit 0 = running, exit 3 = paused (including every fail-closed case). It never exits 0 on an error.
- `--info`: same output, but ALWAYS exits 0 (for the brake, which must never be stopped by the switch).
- `--guard`: runs the A15b check: read the issue, read its events, call `decideReassert`; on reassert re-add the label (`POST /repos/{repo}/issues/{n}/labels`) and post ONE notice (key `reassert:<eventId>`) naming the actor and event; exit 0 after a successful re-assert or when nothing to do; exit 1 when it could not read or could not re-assert.
- No argument is ever interpolated into a shell; only env and fixed flags are used.

### 3. Consumers (read FIRST, and again immediately before EACH merge / approval / write)
| Consumer in this repo | What you change | Behaviour while paused |
|---|---|---|
| `scripts/autopilot-step.mjs` (autopilot + the merge lane, both live in this script) | Add an injectable reader (`opts.pauseReader`, default = real `readPause`) called at the start of `run()` per repo, then again inside EVERY write: `mergePr` (THE one merge call site), `perform` (run-ci, relabel-ci, update-branch, rerun), the pack/ping comment writes in `packAndPing`, the status-comment create/edit, `createStatusIssue`, `ensureLabels`, `setStateLabel`. A merge loop of up to 3 re-reads before each merge. NOTE: the script already has a local variable named `paused` (main red after its own merge): name yours `switchPaused` to avoid confusion | writes nothing, merges nothing; each held PR row says `paused: <reason>`; the run summary says the automation is paused; the run exits 0 (a pause is not a failure). Dry-run runs still read and report. |
| `.github/workflows/bot-automerge.yml` (`pull_request_target`; the one actually ON) | After the checkout of `main` and setup-node, add a step that runs the CLI, and read AGAIN in a step immediately before `Enable auto-merge`. Add `issues: read` to `permissions` (nothing else). | does NOT enable auto-merge, and DOES run the existing "Disable auto-merge" path: GitHub merges an armed PR later by itself, so a pause that left an armed auto-merge in place would be a merge while paused. Disabling only removes merge power; it is the one write allowed under pause. |
| `.github/workflows/dependabot-automerge.yml` (`pull_request`, runs as dependabot) | This job currently checks out nothing. Add a checkout of `ref: main` with `persist-credentials: false` (never the PR merge ref: the reader is guard code and must come from main) + setup-node + the CLI step before `Enable auto-merge`; add `issues: read` | does not enable auto-merge; if one is armed on this PR, disable it. KNOWN RISK to state in the PR body, do not try to solve it: if the token a Dependabot-triggered run receives cannot read issues, fail-closed means Dependabot auto-merge never enables. Make the failure reason visible in the step output (`reason=HTTP 403`) so the orchestrator's live check can see it. |
| `.github/workflows/autopilot.yml` | Add `issues: read` is NOT needed (the job already has `issues: write`); pass nothing new; confirm `GH_TOKEN` is `github.token`. Add an assertion in the workflow test that the reader runs from main's checkout. | covered by the script row |
| `.github/workflows/post-merge-prod-alarm.yml` (the brake) | Add one step `node scripts/automation-pause.mjs --info` (needs a checkout of `main`) before the disable steps, so the log shows the switch state. | The brake ALWAYS runs: disabling auto-merge on every open PR and opening/updating the alarm issue are protective, never skipped by a pause. The contract says a pause stops merging, never alerting. |
| `.github/workflows/automation-pause-guard.yml` (NEW) | Triggers: `issues` types `[labeled, unlabeled]`, `schedule` every 30 minutes, `workflow_dispatch`. `permissions: contents: read, issues: write, pull-requests: write`. Runs on `ubuntu-latest`. Checkout `ref: main` only. Job 1 (`guard`): `node scripts/automation-pause.mjs --guard` (A15b). Job 2 (`disarm`, runs only on `issues` `labeled` where `github.event.label.name` is `automation-paused`): disable auto-merge on every open PR, exactly like the brake does (`gh pr list --state open --json number,autoMergeRequest`, `gh pr merge --disable-auto N`). Compare label name and issue title in an `if:` expression or via `env:` only; never inside a `run:` text. No PR code is ever checked out. | n/a |
| notifier, worker dispatcher, canary, revert, approver, walk gate | do not exist in this repo | nothing to do; the completeness test (below) must fail if a new auto path appears without a reader |

Found while reading the workflows and NOT in the contract's reader list (do not wire them in this slice; list them in your handover for the orchestrator): `bot-pr.yml` (opens a PR for a claude/** push; no merge, no approval) and `types-drift-autoheal.yml` (force-pushes the rolling `bot/types-regen` branch and opens/refreshes one PR; no merge). Put both on the explicit EXEMPT list of the completeness test, each with a one-line reason.

### 4. Behaviour when NOT paused = unchanged
No behaviour change at all when the issue exists without the label: every existing test passes with the same assertions; the only edit allowed to an existing test is its harness injecting `pauseReader: async () => ({ paused: false, reason: '', issue: 1 })` through ONE shared helper. Add one test proving that with no injection the real reader is called (so the default really is the real reader). Nothing ships armed: you set no variable, no flag, no mode.

## Tests FIRST (red, then green). Commit the tests before the implementation and record the red run in the handover.
1. `tests/automationPause.test.ts`: the full decision table of `readPause` (every row above, plus a fake `fetch` that returns pages with a `Link` header); `postPauseNotice` de-duplication; `decideReassert` table (owner removal, `kiki-claude-bot` removal, `github-actions[bot]` removal, never set, present, odd events); CLI exit codes (0, 3, `--info` always 0) with a fake fetch; A15 as a run-level test: an autopilot `run()` with three mergeable PRs where the label appears right after the FIRST merge call -> exactly ONE merge call, no write (POST/PUT/PATCH/DELETE) after the flip, every later PR row says `paused`; plus the same with the label present from the start (zero writes) and with the read failing from the start (zero writes).
2. `tests/automationPauseWorkflows.test.ts` (CRLF-agnostic like `tests/autopilotWorkflow.test.ts`: assert on the text as read AND a CRLF copy; parse with `yaml`): per consumer workflow, the pause step exists, precedes every merge/approval/write step, the merge/enable step's `if` depends on it, `permissions` gained nothing but `issues: read` (and the guard has its stated set), the checkout is `ref: main` with `persist-credentials: false` wherever the trigger is `pull_request`/`pull_request_target`, the reader is called with `github.token` (never a PAT). A COMPLETENESS test: scan every file in `.github/workflows` for merge/approve/write patterns (`pr merge`, `/merge`, `--approve`, `createReview`, `update-branch`, `/dispatches`, `jobs/.*/rerun`, label POST/DELETE, `pulls/.*/reviews`) and require each such workflow to be either a reader (contains the CLI step) or on the explicit EXEMPT list with a reason; a new unlisted consumer must turn this red. MUTANT checks: for each consumer, a string-mutated copy with the pause step removed must make its structure test fail (prove the test can fail); also a mutant of the autopilot that skips the re-read before the second merge must make the A15 run-level test fail.
3. `tests/automationPauseGuard.test.ts`: A15b: the guard workflow's triggers/permissions/no PR checkout/no interpolated PR text (inert-text test: titles/branch names/bodies with `$(touch /tmp/x)`, backticks, `"; rm -rf`, newlines appear only as data in the CLI path and nowhere in a `run:` string); a static tripwire test that NO file under `.github/workflows/**` or `scripts/**` (tests and this brief excluded) contains code that removes the label (patterns such as DELETE on `labels/automation-paused`, `--remove-label automation-paused`, `removeLabel`) or deletes the pinned issue; the only label-adding code is the reader CLI `--guard` and it never removes.

## CI steps to run locally before you push (read `.github/workflows` yourself and run every step that applies; state each result)
`npm ci`; `npx vitest run tests/automationPause tests/autopilot tests/automergeClassify` (all must pass); `npm run test:unit`; `npm run typecheck`; `npm run lint` (the chain; the trailing eslint is informational); `npm run check:script-conventions` and `npm run check:script-conventions:self-test` (read the six rules in `docs/ci-guard-notes.md` first; your two new scripts must comply); `node scripts/lint-workflow-masking.mjs`; `node scripts/lint-workflow-notification.mjs`; the BOM check of `workflow-lint.yml` (no BOM in any workflow file); `npm run check:workflow-artifact-policy` and its `:self-test` (adding a workflow file changes the MEASURED counts: re-derive that block from the tree, record the new numbers, and say in the PR body that it was red before your change if it was); `bin/check-integrity.sh`; `node scripts/pre-ship.mjs` if it runs offline. Website file-write rule: any source file over 2 KB goes through `scripts/safe-edit.py` (existing file) or `scripts/safe-write.py` (new file / full rewrite); `.md` is not guarded; use HTML entities only in JSX (none here); ASCII only in scripts and tests.

## If the push of a `.github/workflows/**` file is refused
Cloud sessions may lack permission to push workflow files. If GitHub refuses, do NOT try another route, do NOT touch any credential. Push everything else, put the exact final text of each workflow under `docs/proposals/pause-switch/workflows/<name>.yml`, say so first in the handover, and end with PARTIAL (the orchestrator copies the files). Your tests must still read `.github/workflows/*` as the real target.

## Deliverable
Branch claude/pause-switch-web, one push, subject ending with the done marker from your prompt. PR body from your prompt's skeleton, including a "Verified / Not verified" block that is honest: Verified = tests and CI steps you ran, with counts. NOT verified (say so): a live read of the real pinned issue (it did not exist when you ran; the orchestrator does it read-only after creating it), the real shape of the GitHub issues response beyond the fixtures taken from existing tests, whether the Dependabot token can read issues, and the live behaviour of the guard workflow. Handover `docs/handover/pause-switch-web.md`: what you built per consumer, the red-then-green record, the exempt list with reasons, the two consumers found outside the contract, the interaction notes you saw (none to solve), and "what is left". No migration is needed or allowed in this repo.

## Hard limits (repeat)
- Guard-class change: owner Approve at head is required later; you never approve or merge. Nothing ships armed. No behaviour change when not paused. No secrets in code, tests, docs or PR text. No PAT, App, variable or secret is created or read beyond `github.token`. No permission widening beyond `issues: read` (readers) and the guard workflow's stated `issues: write` + `pull-requests: write`; never `contents: write`, never `actions: write`, never `workflows`.
- Do not touch the calendar density-exclusion files, `vite.config.ts` or `perf-budgets.json`.
