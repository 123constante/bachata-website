# Brief: Acer web runner unit-file fix into the repo (hard tier)
Brief-version: 2
Branch: claude/ci-offload-unitfix
Lane: careful, Opus. Docs/ops files only, NO workflow edits. Hard tier: owner Approve at head, then Claude merges.
Serves: owner priority 3 (CI offload to the Acer). Two fixes exist only on the Acer machine and the next re-provision would lose them. Source: ~/.claude closing note by website-8d (Acer facts: override.conf on the machine, bom-check passed on run 42483686046).

## What main lacks
- the unit file ExecStart must be exactly `/srv/ghrunner-web/runner/bin/runsvc.sh` (run.sh copies run-helper.sh into the read-only runner dir and fails under ProtectSystem) -- grep: bin/runsvc.sh
- `RestrictSUIDSGID=no` in the unit's [Service] section (tar fails with ENOSYS under it on Ubuntu 26.04, proven by bisect); add a one-line comment saying why and that other sandbox rules are untested without root -- grep: RestrictSUIDSGID=no
- the sha256 of that unit file in the `sums` here-doc of provision-acer-web.sh must match the new file as the script prepares it (CRLF stripped with `tr -d '\r'`); recompute it and any other sum whose file changed; if the script pins a commit sha, say in the handover that the pin must be bumped after merge (do not invent a sha) -- grep: actions.runner.bachata-website.acer-web.service
- the stale "104 cases, 21 rules" text in docs/handover/ci-offload-wave0.md must match the real current output of `bash docs/ci-offload/acer-web/test-gate-hooks.sh` (run it, quote the real totals; run `--mutants` too) -- grep: ci-offload-wave0 totals
- provision-checklist.md has no step for the WEB_RUNNER_READ_TOKEN repo secret (without it the router always picks hosted runners); add a numbered step: create a fine-grained read-only token, store it as the repo secret WEB_RUNNER_READ_TOKEN, note it expires 90 days after creation (PAT made 2026-11-08) -- grep: WEB_RUNNER_READ_TOKEN

## Files
- docs/ci-offload/acer-web/actions.runner.bachata-website.acer-web.service
- docs/ci-offload/acer-web/provision-acer-web.sh
- docs/ci-offload/acer-web/provision-checklist.md
- docs/handover/ci-offload-wave0.md
- docs/handover/ci-offload-unitfix.md (new)

Do not touch .github/workflows, secrets or the Acer. Run test-gate-hooks.sh and any script lint the repo has (shellcheck if present). Never commit a token. Push once; last commit subject ends with the worker-done marker. PR body: per-job CI table, what was run, Not verified (the real Acer re-provision is the owner's/lead's later step).
