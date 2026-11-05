# Automation foundations (Website, slice 2)

Operator doc for the checked-in files under `.github/automation/` and the code
that reads them. Audience: the owner and any agent working on the merge lane,
bot-automerge or the Dependabot lane. Handover of the build that created all
this: `docs/handover/foundations-web.md`.

Short version: every auto path (the autopilot merge lane, `bot-automerge`, the
Dependabot lane) reads these files from MAIN, never from the PR, and refuses
when one of them says no. Every file here is a GUARD path, so no auto path can
merge a change to any of them: the owner merges, with the owner's Approve at
head.

---

## The files

| File | What it is | Read by |
|---|---|---|
| `.github/automation/required-jobs.json` | The check-run names every merge path must see green at the PINNED head sha (`pr_head`), the path-filtered jobs checked only when present (`conditional`), and the post-merge audit workflows (`post_merge_audits`). | `scripts/lib/required-jobs.mjs` (`checkRequiredJobs`), called by `scripts/autopilot-step.mjs` `mergePr` immediately before the merge PUT; `scripts/check-required-jobs.mjs` (A17b); `scripts/check-ruleset-vs-required-jobs.mjs`. |
| `.github/automation/money-set.json` | The money set (contract 8.1): path globs, table names, function/RPC names, keys (incl. the anchored price-id regex), flag names, env/secret NAMES (never values). | `scripts/lib/is-money.mjs` (`isMoney`), called by the lane (`mergeVerdict` fact `money`), `scripts/automerge-classify.mjs`, and the Dependabot lane through `scripts/automation-money-check.mjs`. |
| `.github/automation/arming.json` | The arming state: `autopilot_live`, `autopilot_merge_mode`, `automerge_enabled`, `bot_automerge_enabled`, `approver`, `audit_escalation`. Replaces the old repo variables (contract 7.2). | `scripts/lib/arming.mjs` via `scripts/automation-arming.mjs` (workflows) and `defaultFoundations().arming` (`scripts/autopilot-step.mjs`); `scripts/owner-approval-audit.mjs` (`audit_escalation` only). |
| `.github/automation/guard-paths.json` | The section 14.1 guard globs for this repo. `scripts/lib/guard-paths.mjs` ALSO imports `GOVERNANCE` and `isAgentInstructionPath` from `scripts/lib/autopilot-merge.mjs` (not copied). | `isGuardPath()`, called by the lane, `automerge-classify.mjs` and `automation-money-check.mjs`; `decideAudit` when `audit_escalation` is on. |
| `.github/automation/secrets-register.json` | One entry per credential: `kind`, `acts_as` (+ `acts_as_state`), `owner_login`, `required_minimum_scope`, `actual_scope` (`NOT VERIFIED` until recorded), `expiry`, `readers_allowed`, and dated `grandfathered` notes. Plus `separate_roles` and `owner_credentials`. | `scripts/check-secrets-register.mjs` (rules a-f), `scripts/check-identity-register.mjs` (A36), `automation-token-expiry.yml`. |
| `.github/automation/components.json` | Component name -> LITERAL path set (+ `status`, + `drills` = drill id -> proving workflow name). `component_sha` = sha256 of `git ls-tree -r main -- <paths>`. | `scripts/lib/component-sha.mjs`, `scripts/check-drill-records.mjs`, `scripts/write-drill-record.mjs`. |

### Who may change them

All six live under `.github/**`, which is a guard path (`guard-paths.json`,
contract 14.1). That means:

1. Layer 1: the lane, `bot-automerge` and the Dependabot lane refuse the PR with
   `guard-path refused: <path>`. `money-set.json` is also a money path, so a PR
   touching it is ALSO refused with `money set: .github/automation/money-set.json`
   (drill A16 case 7).
2. The owner merges it by hand, with the owner's Approve at the head commit.
3. Layer 2: `owner-approval.yml` ("Owner approval audit") checks every push to
   main after the fact (see below).

Every reader of these files reads them from a checkout of MAIN (`ref: main`,
`persist-credentials: false`) or from the main tree the lane runs on. A PR
cannot change what the gate reads about itself.

---

## Required jobs

### Reading a refusal

The lane refuses with one of:

- `required job missing: <name>` -- no check-run of that name at the pinned head.
- `required job not green: <name>=<state>` -- the LATEST run of that name (highest
  id) at the pinned head concluded something other than `success`, `skipped` or
  `neutral` (e.g. `in_progress`, `queued`, `cancelled`, `failure`, `timed_out`,
  `action_required`, `stale`).

An empty or unreadable check-run list refuses. Only runs whose `head_sha` equals
the pinned head count. The re-read is `GET /repos/{repo}/commits/{sha}/check-runs`
(`per_page=100`, paginated), done AFTER the pause re-read and immediately before
the merge PUT (drill A17).

### How to add a required job

1. Make sure the job exists in a workflow with a `pull_request` (or
   `pull_request_target`) trigger, and that it ALWAYS produces a check-run at a
   PR head to main (a `skipped` conclusion is fine; a docs-only short-circuit
   inside the job is fine). If a workflow-level `paths:` or label filter can stop
   it existing, it goes in `conditional` with a `when` sentence, not `pr_head`.
2. Add the exact check-run name (rule below) to `pr_head` (or `conditional`).
3. Add the same context to the ruleset `main checks` in GitHub settings (owner
   only). Contract 9.3 wants the ruleset list and `pr_head` EQUAL;
   `check-ruleset-vs-required-jobs` reports any difference.
4. Run `npm run check:required-jobs` (A17b: a phantom name is exit 1) and
   `node scripts/check-ruleset-vs-required-jobs.mjs --ruleset-json <file>` against
   a copy of the ruleset JSON.
5. Owner merges (guard path).

To REMOVE a required job, do the reverse; removing one loosens the gate, which
is exactly the kind of change drill A18 says only the owner makes.

### The check-run name rule (what `check-required-jobs` matches)

`scripts/check-required-jobs.mjs` computes the name GitHub gives each job's
check-run:

- job with `name:` -> that name, with every `${{ matrix.<key> }}` substituted
  per matrix leg;
- job with no `name:` and no matrix -> the job id;
- job with no `name:` and a matrix -> `<id> (<v1>, <v2>, ...)` per leg, values in
  key order (axes in declared order, then keys an `include` entry adds).

Matrix legs are EXPANDED: axes product, `exclude` removed, `include` merged or
appended. That is how `unit (Europe/London, full)` resolves from the
`unit-tests.yml` matrix. A matrix whose values are an expression
(`${{ fromJSON(...) }}`) cannot be expanded statically; that job then matches any
`<id> (...)` name / its name template and the check prints a note saying so.
`pr_head` and `conditional` names must come from a PR-triggered workflow;
`post_merge_audits` names must equal a workflow `name:`.

### bot-automerge and Dependabot: the RULESET is the gate, not code

`bot-automerge.yml` and `dependabot-automerge.yml` do not merge in code. They
run `gh pr merge --auto`, and GitHub merges later, when the ruleset's required
status checks pass. There is no merge-time code on those paths to put a re-read
into, and this slice does not pretend there is.

So, plainly:

- On those two paths, the ruleset `main checks` is the required-checks gate.
- A job listed in `required-jobs.json` but NOT in the ruleset is NOT enforced on
  those two paths.
- The autopilot merge lane enforces the FULL list itself, at the pinned head.

`check-ruleset-vs-required-jobs.mjs` is the tool that keeps the two lists equal.
It is NOT on a schedule: reading a ruleset needs administration read, which
`GITHUB_TOKEN` cannot have. Scheduling it is an owner-gated item (slice 2b).

### Why `owner-approval` is a post-merge audit, not a PR-head job

Contract section 9 items 3-4 assume `owner-approval` is a check-run at the PR
head. It is not. `.github/workflows/owner-approval.yml` ("Owner approval audit")
triggers on `push` to main and `workflow_dispatch` only; its own header says
"AUDIT ALARM, not a gate". No `owner-approval` check-run ever exists at a PR
head, so a lane that demanded it at head would never merge anything.

It is therefore listed under `post_merge_audits` as `Owner approval audit`:
existence-checked by A17b (the workflow must exist), never re-read at head. The
premise mismatch is recorded for the orchestrator in the handover.

---

## Money set

`isMoney({ files, statements, set })` scans (a) every changed path against
`paths`, (b) every ADDED and REMOVED line of every changed file, including `.md`
and `.json` (a docs path is NOT exempt), (c) `statements` the caller supplies
(a migration's parsed statements; no migrations exist in this repo). Names match
as whole identifiers. The first hit gives the reason `money set: <name>`.

Fail closed: an unreadable set, or a file whose `patch` is missing or truncated
(GitHub omits it for big files), is `money set: unreadable (<why>)`.

Known over-match, kept on purpose: `tickets` is a table name in the set and a
whole-word hit, so ANY changed line containing the word `tickets` (docs prose
included) makes the PR money, and the owner merges it. A false "money" costs one
owner merge; a false "not money" could ship a payments change.

---

## Arming

`arming.json` on main is authoritative. The old repo variables
(`AUTOPILOT_LIVE`, `AUTOPILOT_MERGE_MODE`, `AUTOMERGE_ENABLED`,
`BOT_AUTOMERGE_ENABLED`) are passed to the reader as env `ARMING_VAR_<NAME>`
and used ONLY as drift input; nothing reads them to decide behaviour. A
missing, unreadable or unknown value reads as the safest value (off/false) plus
a drift line.

With an arming key off, `bot-automerge` and the Dependabot lane still run their
first steps (checkout of main, setup-node, the reader) and finish GREEN with a
visible `::notice::`; every later step is skipped. Before this slice the job was
skipped instead.

### How to read a drift alert

Format:

    arming drift: <VAR>=<value> but arming.json says <value>

Meaning: an old repo variable has a value the file does not. The variable
changed NOTHING: every reader used the file. Action for the owner: delete the
variable (planned in the slice 2b baby-step sheet) or, if the file is what is
wrong, change `arming.json` by an owner-merged PR. Never "fix" drift by setting
the variable.

Where it appears: the step summary and a `::notice::` of every reader run, and
ONE notice per distinct drift on the pinned `AUTOMATION PAUSE SWITCH` issue
(key `arming-drift:<VAR>:<value>`), posted ONLY by the `arming` job of
`autopilot.yml` (hourly; it holds `issues: write`). `bot-automerge` and the
Dependabot lane have `issues: read` and only log. With today's values
(`AUTOMERGE_ENABLED=true`, `BOT_AUTOMERGE_ENABLED=true`, the others unset) and
the file mirroring them, there is no drift.

---

## Guard paths and the audit (A18)

Layer 1: `isGuardPath(path)` in every auto path, reason
`guard-path refused: <path>`, additional to the lane's existing refusals.

Layer 2: the owner-approval audit on main. `decideAudit` with
`audit_escalation` OFF (the default, and what ships) behaves exactly as before:
RED = red run + issue. With it ON, guard paths count as hard, and a RED verdict
also sets the pause label on the pinned `AUTOMATION PAUSE SWITCH` issue (through
`setPauseLabel` in `scripts/automation-pause.mjs`, the one label-adding site the
slice 1 tripwire allows) and posts ONE notice (key `audit-red:<sha>`) naming the
sha and PR(s).

### audit_escalation: next step (DESIGN ONLY, not built)

Contract 14.1 layer 2 also wants a revert PR, not merged, with a message to the
owner. Design:

1. On a RED escalated verdict, after the pause label is set, the audit job
   creates branch `claude/audit-revert-<shortsha>` from main and adds a commit
   `git revert --no-edit <sha>` (a merge commit uses `-m 1`).
2. It pushes with `BOT_PR_TOKEN` and opens a PR titled
   `revert: <sha> (owner-approval audit RED)`, body naming the sha, the PR(s),
   the guard paths touched and the audit run URL. Labels: none that arm a merge
   (never `automerge-ok`). The PR is a guard change itself, so no auto path can
   merge it.
3. The audit then comments the revert PR link on the pause issue (same
   `audit-red:<sha>` notice).

Why it is not built: it widens what the audit job reads (it would need
`BOT_PR_TOKEN`, a register reader change for `owner-approval.yml`, and a push
from a push-to-main workflow). The orchestrator decides; the owner approves the
register change.

---

## Secrets register and identity (A36, A34 static half)

`check-secrets-register.mjs` fails when: (a) a `secrets.<NAME>` in a workflow is
not registered (except `GITHUB_TOKEN`); (b) a measured reader is not in
`readers_allowed`; (c) a workflow reading a register secret is reachable from
`pull_request`, `pull_request_target` (unless main-only checkout) or a push to
a non-main branch, and is not grandfathered; (d) an `acts_as` equals
`owner_login`; (e) a self-hosted runner is reachable from those triggers (zero
today); (f) `actual_scope` is not `NOT VERIFIED` and not a subset of the
minimum.

Grandfathered readers carry a dated reason and are an OWNER REVIEW list, not a
fix list (see the handover).

`automation-identity-check.yml` (push to main on the register, weekly,
dispatch) calls `GET /user` with `BOT_PR_TOKEN` and `AUTOMERGE_TOKEN` (passed by
`env:` only) and fails on a login that differs from `acts_as`, equals the owner
login, or makes two `separate_roles` resolve to one login. It prints logins only.
`npm run check:identity-register` is the offline form (recorded `acts_as` only).

The live A34 drill (a bot push that adds a workflow file is rejected by GitHub)
needs the real token and is not run here.

`automation-token-expiry.yml` (daily, dispatch) posts one notice 7 days and 1
day before an `expiry`, and goes red past expiry. No expiry is recorded yet.

### A22 log-runner: next

`scripts/check-workflow-log-secrets.mjs` has the pure matcher
(`findSecretLeaks`: `ghp_`, `gho_`, `ghs_`, `github_pat_`, `sbp_`, `sk_live_`,
`sk_test_`, `whsec_`, `rk_live_` + length patterns) and a `--logs` runner over
the last 20 runs, both tested with fixtures. NEXT: a scheduled workflow with
`actions: read` that runs `--logs` and goes red on a hit. Not wired in this
slice (lowest priority in the brief).

---

## Components and drill records (A32)

`components.json` paths are LITERAL files or directory prefixes, because
`git ls-tree` does not expand globs (and `:(glob)` was refused). Built today:
`merge-lane`, `pause-readers`; the other eight are `not built` with no paths.

`check-drill-records.mjs` requires each `DRILL RECORDS` comment to be JSON with
`drill`, `component`, `component_sha`, `date`, `pass`, `actors`, `run_url`,
`run_id`, authored by `github-actions[bot]`, `pass === true`, a re-fetched run
with conclusion `success`, the drill's workflow name and the record's head sha,
and a `component_sha` equal to today's for a `built` component. Records also
carry `head_sha` (written by `write-drill-record.mjs`), the one field beyond the
contract list, because the checker matches it to the run. `--require-all`
(slice 15) makes a missing drill exit 1; the lint chain runs
`--components-only`.

---

## Open items

- Ruleset check scheduling (`check-ruleset-vs-required-jobs`): needs
  administration read; owner-gated, slice 2b.
- Required jobs not in the ruleset (handover list): owner decides whether to add
  them to both lists.
- Identity check first live run is likely RED: both PATs are inferred as
  `kiki-claude-bot` and `separate_roles` keeps `[author, merge]`. Owner decides:
  a separate merge-bot account, or drop that pair.
- Unrecorded logins: `CI_BUDGET_GITHUB_TOKEN`, `TYPES_BOT_TOKEN`,
  `ADMIN_READ_TOKEN`.
- Grandfathered readers (handover list): owner review.
- Revert PR by `BOT_PR_TOKEN` (design above); A22 scheduled log runner.
- Slice 2b (owner): PAUSE token and baby-step sheet, M1 scope check, the
  variable half of the pause switch (A33), deleting the old arming variables,
  creating the pinned issues, Website CODEOWNERS.
- Drill workflows named in `components.json` do not exist yet (later slices).
