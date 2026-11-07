# CI offload wave 0 (groundwork) -- handover (Website)

Ticket dt_6fcc76e12c22. Brief: `brief/ci-offload-wave0:docs/briefs/ci-offload-wave0.md` v2
(blob 549f67bd). Branch `claude/ci-offload-wave0`, PR #1470. Builds on `docs/handover/ci-offload-stage3.md`.
Nothing here is live: no runner is registered by this PR, no workflow file is edited, no secret
or token is created or read. The lead's plans-folder files the brief lists (AUDIT / PILOT-FILES /
DESIGN-memory-slot-gate) were NOT reachable from this cloud worker; the work follows the brief text
and the stage 3 handover only.

## What changed

| file | change |
|---|---|
| `docs/ci-offload/acer-web/gate-job-started.sh` | identity section rewritten: allow-list, event payload, merge-commit and changed-files checks (below); `_home` emptied per job, `_cache` kept |
| `docs/ci-offload/acer-web/workflows.allow` (new) | the allow-list; ships with `bom-check.yml` only |
| `docs/ci-offload/acer-web/test-gate-hooks.sh` | table-driven: 104 cases + `--mutants` (21 rules, every mutant caught) |
| `docs/ci-offload/acer-web/actions.runner.bachata-website.acer-web.service` | HOME / XDG / npm cache under `_work`, read-only `PLAYWRIGHT_BROWSERS_PATH`, `ExecStartPre` mkdir |
| `docs/ci-offload/acer-web/provision-checklist.md` (new) | what root installs; resolver check |

## Exact unit and user

- Unit: `/etc/systemd/system/actions.runner.bachata-website.acer-web.service` = the repo file
  (Dell: same file, `acer-web` -> `dell-web`). User/group `ghrunner-web`, supplementary group
  `laptop-walk`, no sudo, `NoNewPrivileges=yes`, `ProtectSystem=strict`, `ProtectHome=yes`.
- New env: `HOME=/srv/ghrunner-web/runner/_work/_home`,
  `XDG_CACHE_HOME=/srv/ghrunner-web/runner/_work/_cache`,
  `XDG_CONFIG_HOME=/srv/ghrunner-web/runner/_work/_home/.config`,
  `npm_config_cache=/srv/ghrunner-web/runner/_work/_cache/npm`,
  `PLAYWRIGHT_BROWSERS_PATH=/opt/ms-playwright` (root-owned, read-only),
  `PLAYWRIGHT_SKIP_BROWSER_DOWNLOAD=1`. `ReadWritePaths` unchanged (all of the above writable
  paths are already inside `_work`).
- Installed files: hooks in `/usr/local/lib/ghrunner-web/hooks/` (root 0755), allow-list at
  `/etc/ghrunner-web/workflows.allow` (root 0644), `gate.conf` at `/etc/ghrunner-web/gate.conf`.
  `gate.conf` key `WORKFLOW_PATH` (stage 3) is GONE; new keys `ALLOW_FILE`, `PROTECTED`.

## Allow-list format (`workflows.allow`)

One `.github/workflows/<name>.yml|.yaml` per line; blank lines and `#` comments (also trailing)
ignored. Any other line (bare name, `..`, spaces inside, anything) -> the hook refuses EVERY job
(fail closed); an empty list likewise. Missing file -> `bom-check.yml` only. A listed workflow is
accepted only when its blob at `GITHUB_WORKFLOW_SHA` equals the blob on main, fetched fresh.
Waves 1-3 add one line per PR, each a review item.

## The hook's checks, in order (each a `#@rule` tag; every one has a refusal row + a mutant)

`allow-malformed`, `workflow-repo`, `workflow-unlisted`, `event-path`, `payload-missing`,
`event-agree`, `event-kind`, `payload-repo`, `env-repo`, `sender`, `env-actor`, `sha-format`,
`push-ref`, `env-ref`, `push-after`, `head-repo`, `pr-author`, `head-sha-format`, `identity`,
`merge-head`, `protected`. Not tagged: "cannot list changed files" (unreachable once `merge-head`
passed with a depth-2 fetch; kept as fail-closed) and the fetch/mirror failures (stage 3).

Rules reused, not re-invented: `G_TRUSTED` / `G_PROTECTED` in the hook mirror `TRUSTED_AUTHORS` /
`PROTECTED_PREFIXES` in `scripts/ci/route-runner.mjs` (read only, unchanged); the first rows of
`test-gate-hooks.sh` fail if they ever disagree. The hook cannot import the `.mjs` (it must not
run code from the job's checkout, and node is not guaranteed before the job's setup-node).
Protected paths are now checked ON THE RUNNER too: the hook diffs the PR merge commit against its
first parent (base) in its own mirror -- no API token needed.

## Task 2 result (`env-shadow-result`)

**Not testable without a registered runner.** Whether a workflow's job-level `env:` can shadow
`GITHUB_ACTOR` / `GITHUB_EVENT_NAME` / `GITHUB_REPOSITORY` inside the job-started hook cannot be
reproduced in a shell; GitHub's docs say `GITHUB_*` defaults cannot be overwritten, but that is
not proven here for hooks. What IS proven (shell tests, rows `event-path`, `sender`,
`event-agree`, `pr-author`, `head-repo`, `merge-head`, `push-after`): the decision no longer
depends on those env values being honest.

- Event, sender, repository, PR author, PR head repo and head sha are read by
  `read_event_payload` from the runner's own `event.json` at the PINNED path
  `$WORK_DIR/_temp/_github_workflow/event.json` (from `gate.conf`, never env). A
  `GITHUB_EVENT_PATH` naming any other file is refused, not followed.
- Env values that also exist must AGREE with the payload (narrowing only): a trusted-looking env
  with an untrusted payload sender or author is refused.
- `GITHUB_WORKFLOW_SHA` is tied to the payload: for a push it must be the payload's `after`; for a
  PR it must be a merge commit whose second parent is the payload's head sha.

Residual (needs the live check from stage 3, owner step 4 below): `GITHUB_WORKFLOW_REF` (which
workflow file is running) exists only in env; if it could be shadowed, a PR's own workflow could
claim to be `bom-check.yml`. Also `pull_request` and `pull_request_target` payloads have the same
shape; a `pull_request_target` run is still refused because its workflow sha is a base commit, not
a merge commit (`merge-head`). Every routed workflow must keep `pull_request`, never
`pull_request_target` (check-secrets-register already flags the latter).

## Memory (task 4; admin files not touched)

Joining admin's memory gate, proposal for the owner/lead:
1. Own lane label: this runner keeps its own label (`acer-web` / `dell-web`); admin's runners and
   this one never share a label, so admin's routing never hands this runner an admin job.
2. One job at a time: a self-hosted runner runs one job; plus the shared walk lock
   (`/var/lib/laptop-walk/walk.lock`) the hook already takes, so a Website job never overlaps the
   laptop walk / admin jobs that take the same lock, and the load + `MemAvailable >= 1500 MiB`
   gate (same values as admin's `laptop-safe.mjs`).
3. `MemoryMax=4G` stays until the owner reads the Acer's RAM (`free -m`) AND wave 1 measures the
   routed job's peak (`systemctl show -p MemoryPeak` after a run); raise only then, leaving at
   least `SAFE_MEM_MIN` + the admin runners' caps free.
4. If admin's DESIGN-memory-slot-gate adds a slot file, the hook's step 2 is where this runner
   would take a slot; not built here (no design text was reachable).

## Owner steps after merge (ask for the token ONLY after this PR has merged)

1. Provision as root: `docs/ci-offload/acer-web/provision-checklist.md` sections 1-4 (incl. the
   resolver check).
2. Install: hooks + `workflows.allow` + `gate.conf` (keys above) root-owned; the unit file;
   `systemctl daemon-reload`.
3. Register the runner: GitHub -> repo Settings -> Actions -> Runners -> New self-hosted runner
   gives a registration token valid about **1 hour**; run `config.sh --url ... --token <it>
   --labels acer-web --disableupdate --unattended` as `ghrunner-web` within that hour; never paste
   the token anywhere else. Then `systemctl enable --now`.
4. Live env-shadow check (stage 3 open item): a scratch workflow (NOT allow-listed) with job
   `env: GITHUB_ACTOR: x, GITHUB_EVENT_NAME: push, GITHUB_WORKFLOW_REF: ...` on `runs-on: acer-web`
   must show "refused" in the hook log; record what the hook saw.
5. Set `WEB_RUNNER_LABEL=acer-web` only after 1-4.

## Verified / Not verified

Verified (this sandbox, Linux, git 2.x, python3):
- `bash docs/ci-offload/acer-web/test-gate-hooks.sh` -> PASS 104 cases.
- `bash docs/ci-offload/acer-web/test-gate-hooks.sh --mutants` -> PASS all 21 mutants caught.
- `npx vitest run tests/routeRunner.test.ts` -> 96 passed (incl. the shell-test + IDENTITY-mutant cases).
- No `.github/workflows/**`, `src/**`, `supabase/**`, `vite.config.ts` or `route-runner.mjs` change;
  the `bom-check` required-check name is unchanged (workflow untouched).

- tsc run on a850696: 0 errors in branch files (no TS file touched).
- `npm run lint` chain exit 0; `check-secrets-register`, `lint-workflow-masking`, `check:mojibake` clean.

Not verified:
- GitHub PR checks: not read back by this worker before stopping (see the PR checks tab).
- NOTHING ran on a real runner, the Acer or the Dell. The unit was not loaded by systemd
  (`systemd-analyze verify` not run here). The real `event.json` path and shape on a live runner
  (`_temp/_github_workflow/event.json`) are from runner behaviour, not observed here.
- Task 2 env shadowing (above). The `--mutants` mode is not in CI (about 75 s); vitest runs the
  plain suite plus the IDENTITY mutant.
- The lead's plans-folder documents (unreachable); findings A-O not cross-checked.
