# CI offload stage 3 -- handover (Website)

Ticket dt_6a900570b5d0. Brief: `brief/ci-offload-stage3:docs/briefs/ci-offload-stage3.md` (v1).
Branch `claude/ci-offload-stage3`, base origin/main 01914fa. Status: Part A wired (inert until the
owner registers the runner); baseline committed; Part B NOT built (see "Part B verdict").

## Part A: what is in the PR

- `.github/workflows/workflow-lint.yml` job `bom-check` (the pilot, the ONLY routed job):
  - `runs-on: ${{ (vars.WEB_RUNNER_LABEL != '' && (github.event_name != 'pull_request' || github.event.pull_request.head.repo.full_name == github.repository)) && vars.WEB_RUNNER_LABEL || 'ubuntu-latest' }}`
  - `timeout-minutes: 5`, job-level `permissions: contents: read`. No secrets.
  - The variable is unset today, so the expression evaluates to `ubuntu-latest`: this PR changes
    nothing until the owner sets it. A fork PR evaluates to `ubuntu-latest` even when it is set.
- Workflow files touched (for the allow-list guard, PR #1394 / `check-automation-workflow-allowlist.mjs`):
  **`.github/workflows/workflow-lint.yml` only.** The guard reds this `claude/` branch until the owner
  adds `workflow-lint.yml` to `scripts/data/automation-workflow-allowlist.json` or approves at head.
- Runner drafts, `docs/ci-offload/acer-web/`:
  - `actions.runner.bachata-website.acer-web.service` -- the exact systemd unit.
  - `gate-job-started.sh` / `gate-job-completed.sh` -- the runner job hooks (load gate + walk lock).

### The runner (exact)

| item | value |
|---|---|
| repo | 123constante/bachata-website |
| name | `acer-web` |
| labels | `self-hosted` (default) + `acer-web`, nothing else (`--no-default-labels` is NOT used; do not add `linux`/`x64` by hand) |
| group | Default; not ephemeral (pilot) |
| user | `ghrunner-web` (new, unprivileged, no sudo, nologin shell; NOT `ci`, NOT `offload`) |
| directory | `/srv/ghrunner-web/runner` (runner), `/srv/ghrunner-web/hooks` (gate scripts) |
| unit | `/etc/systemd/system/actions.runner.bachata-website.acer-web.service` (file in this PR) |
| caps | `MemoryMax=4G`, `MemorySwapMax=0`, `Nice=10`, `CPUWeight=50`, idle IO class; one job at a time (one runner = one job) |
| isolation | `ProtectHome=yes`, `InaccessiblePaths=/home /root /srv/laptop-ci-runner-1..4` (CHECK the admin runners' real paths on the Acer and fix the list), `NoNewPrivileges=yes` |
| tools the pilot job needs | `node` 22 on PATH for the runner user, `xxd`, `git` |

Install (as `ci`, which has sudo; the registration token comes from the owner by the private route
and is never written anywhere in the repo or chat):

```
sudo useradd --system --create-home --home-dir /srv/ghrunner-web --shell /usr/sbin/nologin ghrunner-web
sudo -u ghrunner-web mkdir -p /srv/ghrunner-web/runner /srv/ghrunner-web/hooks
# download + verify the actions/runner tarball into /srv/ghrunner-web/runner (same version as the admin runners)
sudo -u ghrunner-web /srv/ghrunner-web/runner/config.sh --unattended \
  --url https://github.com/123constante/bachata-website --token "<from owner>" \
  --name acer-web --labels acer-web --runnergroup Default --work _work
sudo install -o ghrunner-web -m 0755 gate-job-started.sh gate-job-completed.sh /srv/ghrunner-web/hooks/
sudo install -m 0644 actions.runner.bachata-website.acer-web.service /etc/systemd/system/
sudo sed -i 's/\r$//' /etc/systemd/system/actions.runner.bachata-website.acer-web.service /srv/ghrunner-web/hooks/*.sh  # repo checks .service out CRLF
sudo systemctl daemon-reload && sudo systemctl enable --now actions.runner.bachata-website.acer-web.service
```

Do NOT use the runner's own `svc.sh install` (it writes a different unit without the caps).

### Load gate and walk lock (brief A3)

The runner's `ACTIONS_RUNNER_HOOK_JOB_STARTED` hook runs before every job: it waits (up to
`GATE_WAIT_S`=180 s) until `load1 <= SAFE_LOAD_MAX` AND `MemAvailable >= SAFE_MEM_MIN` MiB AND it can
take `flock` on `/tmp/laptop-walk.lock`; it then keeps the lock in a holder process until
`ACTIONS_RUNNER_HOOK_JOB_COMPLETED` releases it. If the machine stays busy the hook exits 1 and the job
goes red (visible), never runs on a busy machine. The unit's `SAFE_LOAD_MAX=3.0` / `SAFE_MEM_MIN=1500`
are PLACEHOLDERS: set them to the values the Acer's existing walk gate uses (not in this repo).

Proven in the cloud container only (NOT on the Acer): with a fake walk holding the lock, the hook
waited and refused (exit 1); with the lock free it took it (exit 0); a walk then could not take the
lock (flock -n exit 1) until the completed hook ran (then exit 0); with load above the max it refused.
**On the Acer, still to prove (brief A3):** start a walk and a routed bom-check at once on purpose and
show the job log line `acer-web gate: ... held (walk running), waiting`. Two assumptions to check there:
(1) walks take the lock with `flock(1)` on the same path (if not, change both sides to one mechanism);
(2) the runner does not reap the hook's background holder before the job ends (if it does, the lock
is released early: move the holder to a `systemd-run --user` scope).

### Routing and revert (brief A4, A6)

- Switch ON: owner/Claude sets repo variable `WEB_RUNNER_LABEL=acer-web`.
- Switch OFF (the revert, no push, no deploy, no review): DELETE `WEB_RUNNER_LABEL`.
- Daily rule during the pilot: before and after every pilot day Claude reads
  `repos/123constante/bachata-website/actions/runners` (status online/offline, busy). The moment the
  runner reads offline, or a routed job waits more than 60 s or misbehaves, Claude deletes
  `WEB_RUNNER_LABEL` (no approval needed) and logs it here with the time.
- `timeout-minutes` caps the RUN, not the QUEUE: a job queued for an offline runner still waits up to
  24 h. That is why the variable must be deleted as soon as the runner is offline.

### Guard gap found (for the lead)

`scripts/check-secrets-register.mjs` rule (e) ("a self-hosted runs-on label is reachable from
untrusted triggers") matches the literal text `self-hosted` in `runs-on`. An expression
`${{ vars.WEB_RUNNER_LABEL ... }}` is invisible to it: today it reports "0 self-hosted runners"
with this PR applied. Proposal (stage 4, guard tier, not done here -- out of the brief's allowed
paths): treat any `runs-on` containing `vars.` as possibly self-hosted and require the
`head.repo.full_name == github.repository` condition in the same expression or the job `if:`.

## Eligibility table (brief A5)

Generated mechanically from `.github/workflows/*.yml` at 01914fa + this PR (script: parse each job,
collect `secrets.X` in the job and workflow-level env/defaults, job or workflow `permissions`,
triggers, checkout ref). "default" permissions = the repo's default token setting, which is not
readable from the files: treat as possibly write, so every routed job gets an explicit
`permissions: contents: read`. "needs fork guard" = no secrets, read-only, no
`pull_request_target`/`workflow_run`, but triggered by `pull_request` without the
`head.repo.full_name == github.repository` condition yet. A reviewer re-derives with
`grep -n 'secrets\.\|pull_request_target\|workflow_run\|permissions' .github/workflows/*.yml`.

| job | workflow | secrets.* read | token permissions | pull_request_target / workflow_run | fork PR code | checkout ref | eligible |
|---|---|---|---|---|---|---|---|
| integrity | architecture-guard.yml | none | default | no | PR (fork PR code reachable) | default | yes, needs fork guard |
| identity | automation-identity-check.yml | BOT_PR_TOKEN AUTOMERGE_TOKEN | contents:read | no | no PR trigger | main | NO |
| guard | automation-pause-guard.yml | none | contents:read issues:write pull-requests:write | no | no PR trigger | main | NO |
| disarm | automation-pause-guard.yml | none | contents:read issues:write pull-requests:write | no | no PR trigger | main | NO |
| expiry | automation-token-expiry.yml | none | contents:read issues:write | no | no PR trigger | main | NO |
| arming | autopilot.yml | none | contents:read issues:write | no | no PR trigger | main | NO |
| autopilot | autopilot.yml | BOT_PR_TOKEN AUTOMERGE_TOKEN | contents:read issues:write pull-requests:write actions:write checks:read statuses:read | no | no PR trigger | ${{ github.event.repository.default_branch }} | NO |
| announce-failure | autopilot.yml | none | contents:read issues:write | no | no PR trigger | none | NO |
| decide | bot-automerge.yml | BOT_PR_TOKEN | contents:read pull-requests:write issues:read | prt | no PR trigger | main | NO |
| open-pr | bot-pr.yml | BOT_PR_TOKEN | contents:read | no | no PR trigger | ${{ github.event.repository.default_branch }} | NO |
| canary | ci-budget-guard.yml | none | contents:read | no | no PR trigger | default | YES |
| measure | ci-budget-guard.yml | CI_BUDGET_GITHUB_TOKEN | contents:read | no | no PR trigger | default | NO |
| purge | cloudflare-purge-on-deploy.yml | CLOUDFLARE_API_TOKEN CLOUDFLARE_ZONE_ID | contents:read deployments:read | no | no PR trigger | none | NO |
| live-db-gate | db-contract-check.yml | none | contents:read | no | PR (fork PR code reachable) | default | yes, needs fork guard |
| contract-check | db-contract-check.yml | VITE_SUPABASE_URL VITE_SUPABASE_PUBLISHABLE_KEY P3_RULES_DB_URL | contents:read issues:write | no | PR (fork PR code reachable) | default | NO |
| enable | dependabot-automerge.yml | GITHUB_TOKEN | contents:write pull-requests:write issues:read | no | PR (fork PR code reachable) | main | NO |
| decide | deploy-production-trial.yml | none | contents:read | no | no PR trigger | default | YES |
| deploy-preview | deploy-production-trial.yml | VERCEL_TOKEN VERCEL_ORG_ID VERCEL_PROJECT_ID | contents:read | no | no PR trigger | default | NO |
| canary | deployment-storage-check.yml | none | contents:read issues:write | no | no PR trigger | default | NO |
| measure | deployment-storage-check.yml | VERCEL_TOKEN | contents:read issues:write | no | no PR trigger | default | NO |
| e2e-smoke | e2e-smoke.yml | none | default | no | PR (fork PR code reachable) | default | yes, needs fork guard |
| canary | firewall-drift-check.yml | none | contents:read issues:write | no | no PR trigger | default | NO |
| measure | firewall-drift-check.yml | VERCEL_TOKEN | contents:read issues:write | no | no PR trigger | default | NO |
| gsc-check | gsc-health-check.yml | GSC_SERVICE_ACCOUNT_KEY | contents:read issues:write | no | no PR trigger | default | NO |
| canary | io-health-guard.yml | none | contents:read issues:write | no | no PR trigger | default | NO |
| poll | io-health-guard.yml | IO_HEALTH_SECRET | contents:read issues:write | no | no PR trigger | default | NO |
| live-qa | live-qa.yml | SUPABASE_ACCESS_TOKEN SLACK_WEBHOOK_URL | contents:read issues:write | no | no PR trigger | default | NO |
| no-preview-reason | og-image-check.yml | none |  | no | PR (fork PR code reachable) | none | yes, needs fork guard |
| og-check | og-image-check.yml | CI_BYPASS_HEADER | contents:read issues:write | no | PR (fork PR code reachable) | default | NO |
| og-preview | og-image-check.yml | GITHUB_TOKEN VERCEL_AUTOMATION_BYPASS_SECRET | contents:read deployments:read | no | PR (fork PR code reachable) | default | NO |
| audit | owner-approval.yml | GITHUB_TOKEN | contents:read pull-requests:read issues:write | no | no PR trigger | default | NO |
| no-preview-reason | perf-budget.yml | none |  | no | PR (fork PR code reachable) | none | yes, needs fork guard |
| bundle-budget | perf-budget.yml | none | default | no | PR (fork PR code reachable) | default | yes, needs fork guard |
| lighthouse | perf-budget.yml | GITHUB_TOKEN VERCEL_AUTOMATION_BYPASS_SECRET | contents:read deployments:read | no | PR (fork PR code reachable) | default | NO |
| doc-weight | perf-budget.yml | GITHUB_TOKEN VERCEL_AUTOMATION_BYPASS_SECRET | contents:read deployments:read | no | PR (fork PR code reachable) | default | NO |
| phone-qa-section | phone-qa-section.yml | none | contents:read pull-requests:read | no | PR (fork PR code reachable) | default | yes, needs fork guard |
| phone-qa | phone-qa.yml | none | contents:read | no | PR (fork PR code reachable) | default | yes, needs fork guard |
| build-smoke | phone-qa.yml | none | contents:read | no | PR (fork PR code reachable) | default | yes, needs fork guard |
| probe-new-deployment | post-merge-prod-alarm.yml | VERCEL_AUTOMATION_BYPASS_SECRET | contents:read issues:write pull-requests:write |  workflow_run | no PR trigger | none | NO |
| brake | post-merge-prod-alarm.yml | GITHUB_TOKEN | contents:read issues:write pull-requests:write |  workflow_run | no PR trigger | main | NO |
| mergeable | pr-mergeable-guard.yml | GITHUB_TOKEN | contents:read pull-requests:read checks:read statuses:write | no | no PR trigger | default | NO |
| smoke | prod-smoke.yml | CI_BYPASS_HEADER | contents:read issues:write | no | no PR trigger | default | NO |
| real-data-verified | real-data-verified.yml | none | contents:read pull-requests:read | no | PR (fork PR code reachable) | default | yes, needs fork guard |
| monitor | sentry-monitor.yml | SENTRY_READ_TOKEN SENTRY_UPLOAD_TOKEN SENTRY_WRITE_TOKEN | contents:read | no | no PR trigger | default | NO |
| no-preview-reason | seo-check.yml | none |  | no | PR (fork PR code reachable) | none | yes, needs fork guard |
| seo-check | seo-check.yml | CI_BYPASS_HEADER | contents:read issues:write | no | PR (fork PR code reachable) | default | NO |
| seo-preview | seo-check.yml | GITHUB_TOKEN VERCEL_AUTOMATION_BYPASS_SECRET | contents:read deployments:read | no | PR (fork PR code reachable) | default | NO |
| sitemap-submit | sitemap-submit.yml | CI_BYPASS_HEADER GSC_SERVICE_ACCOUNT_KEY | contents:read issues:write | no | no PR trigger | default | NO |
| sweep | stale-bot-pr-sweep.yml | BOT_PR_TOKEN | contents:read issues:read pull-requests:write | no | no PR trigger | main | NO |
| report | stale-wip-report.yml | GITHUB_TOKEN | contents:read pull-requests:read | no | no PR trigger | default | NO |
| no-preview-reason | synthetic-ssr-monitor.yml | none |  | no | PR (fork PR code reachable) | none | yes, needs fork guard |
| synthetic | synthetic-ssr-monitor.yml | SLACK_WEBHOOK_URL | contents:read issues:write | no | PR (fork PR code reachable) | default | NO |
| synthetic-preview | synthetic-ssr-monitor.yml | GITHUB_TOKEN VERCEL_AUTOMATION_BYPASS_SECRET | contents:read deployments:read | no | PR (fork PR code reachable) | default | NO |
| wallclock-brand | typecheck.yml | none | default | no | PR (fork PR code reachable) | default | yes, needs fork guard |
| autoheal | types-drift-autoheal.yml | TYPES_BOT_TOKEN SUPABASE_ACCESS_TOKEN | contents:read | no | no PR trigger | main | NO |
| types-drift | types-drift.yml | SUPABASE_ACCESS_TOKEN | default | no | PR (fork PR code reachable) | default | NO |
| unit | unit-tests.yml | VITE_SUPABASE_URL VITE_SUPABASE_PUBLISHABLE_KEY | contents:read | no | PR (fork PR code reachable) | default | NO |
| dancer-area-isolation | unit-tests.yml | none | contents:read | no | PR (fork PR code reachable) | default | yes, needs fork guard |
| digest | weekly-digest.yml | GSC_SERVICE_ACCOUNT_KEY VITE_SUPABASE_URL VITE_SUPABASE_PUBLISHABLE_KEY ADMIN_READ_TOKEN GITHUB_TOKEN | contents:read issues:write | no | no PR trigger | default | NO |
| bom-check | workflow-lint.yml | none | contents:read | no | PR, fork-guarded | default | YES |
| masking-check | workflow-lint.yml | none | default | no | PR (fork PR code reachable) | default | yes, needs fork guard |
| notification-check | workflow-lint.yml | none | default | no | PR (fork PR code reachable) | default | yes, needs fork guard |
