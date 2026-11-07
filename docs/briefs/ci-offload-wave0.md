# Brief: Website CI offload, wave 0 (groundwork): runner hook allow-list and provisioning checklist

Brief-version: 2
Branch: claude/ci-offload-wave0 (Website). Lane: careful, hard tier (runner hook, runner sandbox). Model: Opus. Push once, `[skip preview]`, no `src/`. Do NOT edit `.github/workflows/**`.
Owner rules: the Dell/Acer helps but MUST NOT crash, hang or red a PR; the repo is PUBLIC and user-owned (no runner groups exist), so the runner hook is the ONLY access control; no secret ever reaches a self-hosted runner. Nothing runs on the Acer or Dell from this branch; never create or print a token.
Read first (in the lead's plans folder, paths from the lead): AUDIT-website-offload-eligibility-2026-11-07.md (facts F1-F9, findings A-O), OFFLOAD-WEBSITE-PILOT-FILES-2026-11-07.md, DESIGN-memory-slot-gate-2026-11-07.md, and `docs/handover/ci-offload-stage3.md`.

## Goal (four lines)
1. Who: the owner (GitHub minutes bill) and PR authors waiting on CI.
2. After: the Acer runner hook accepts a reviewed allow-list of workflows instead of only bom-check.yml, so waves 1-3 can route more jobs safely.
3. Worked if: the hook refuses every unlisted workflow, event, ref or author (table-driven tests with mutants), bom-check still passes, no required check renamed, no new red vs main.
4. Limits: no workflow file edits, no runner registered by this PR (the owner token step comes after merge), no secrets.

## What main lacks
- an allow-list of workflows for the runner hook; today it is hard-coded to one workflow -- grep: workflows.allow
- reading the trigger event from the runner's own event payload file, so a job env cannot fake it (the hook reads GITHUB_EVENT_PATH through a new function) -- grep: read_event_payload
- a recorded result for whether job env can shadow the GITHUB values the hook reads, for the reviewer -- grep: env-shadow-result
- a provisioning checklist for tools the routed jobs need without sudo (npm 11, python3-yaml, Playwright browsers on a read-only path) -- grep: PLAYWRIGHT_BROWSERS_PATH
- a resolver-versus-IPAddressDeny check in the provisioning notes -- grep: resolver-allow

## Files
docs/ci-offload/acer-web/gate-job-started.sh
docs/ci-offload/acer-web/test-gate-hooks.sh
docs/ci-offload/acer-web/actions.runner.bachata-website.acer-web.service
docs/ci-offload/acer-web/workflows.allow (new)
docs/ci-offload/acer-web/provision-checklist.md (new)
docs/handover/ci-offload-wave0.md (new)

## Tasks, in this order (each gets a test or a recorded proof; red first)
1. Hook allow-list: replace the hard-coded `G_WORKFLOW` with `workflows.allow` (one `.github/workflows/<file>.yml` per line, default = bom-check.yml only). Each entry is checked blob == origin/main blob at run time, as bom-check is today via GITHUB_WORKFLOW_SHA / GITHUB_WORKFLOW_REF. Refuse (exit 1, job falls back hosted) on: unlisted workflow, event other than push-to-main or pull_request, ref not same-repo, author not in TRUSTED_AUTHORS, PR touching PROTECTED_PREFIXES (rules live in scripts/ci/route-runner.mjs; do not duplicate, reuse or mirror with a test that they agree). Table-driven tests in test-gate-hooks.sh: every refusal reason plus the accept case, plus a mutation per rule (remove the rule, a test must fail).
2. Event source: read the event name, actor, repository and PR head repo from the file at GITHUB_EVENT_PATH, not from env. Prove or disprove with a shell test whether a job-level env override of GITHUB_ACTOR / GITHUB_EVENT_NAME / GITHUB_REPOSITORY reaches the hook; if it cannot be tested without a registered runner, say so plainly in the handover and keep the file-based read.
3. Sandbox mismatch (audit finding E): update the service unit so routed jobs get writable HOME and cache paths under `_work` only, and a read-only root-owned PLAYWRIGHT_BROWSERS_PATH; keep NoNewPrivileges and ProtectSystem=strict; no sudo. In provision-checklist.md list what the owner/Acer must pre-install as root (npm 11, python3-yaml, Playwright chromium and OS libs) and how to check the resolver address against IPAddressDeny (add only the resolver, never the LAN ranges).
4. Memory: describe in the handover how this runner joins admin's memory gate (own lane label, one job at a time, MemoryMax raised above 4 GB only after the Acer's RAM is read by the owner); do not change admin files.
5. Handover docs/handover/ci-offload-wave0.md: exact unit file, user, allow-list format, task 2 result, a Verified / Not verified block, and the owner steps after merge (the token step, about 1 h token lifetime; ask for it only when this PR has merged).

## Do not touch
src/**, supabase/**, vite.config.ts, any `.github/workflows/**` file, scripts/ci/route-runner.mjs rules (read only), the admin repo and its runners, Vercel settings.

## Verification (all before DONE)
- test-gate-hooks.sh green with every mutant caught; bom-check required-check name unchanged.
- `check-secrets-register` and workflow-lint jobs green; per-job CI table in the PR body.
- Verified / Not verified block, honest that nothing ran on a real runner.

## Stop and handover
Push once; `[worker-done <ticket>]` on the last commit. At 40% context stop with PARTIAL and a what-is-left list.
