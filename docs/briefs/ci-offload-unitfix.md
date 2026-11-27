# Brief: claude/ci-offload-unitfix (hard tier, careful lane, Opus; owner Approve at head)

Goal: make the repo copy of the acer-web systemd unit match what really runs on the Acer, so a re-provision does not break the runner. Nothing is installed or run on any machine by this PR.

Why: the Acer runs with a drop-in (/etc/systemd/system/actions.runner.bachata-website.acer-web.service.d/override.conf) that sets ExecStart= (cleared) then ExecStart=/srv/ghrunner-web/runner/bin/runsvc.sh, and RestrictSUIDSGID=no. Reasons: run.sh copies run-helper.sh into the read-only runner dir (fails under ProtectSystem); tar fails with ENOSYS under RestrictSUIDSGID on Ubuntu 26.04 (proven by bisect). Owner approved both 2026-11-08. NoNewPrivileges and ProtectSystem=strict stay.

Changes (4 files, small):
1. docs/ci-offload/acer-web/actions.runner.bachata-website.acer-web.service: ExecStart=/srv/ghrunner-web/runner/bin/runsvc.sh; RestrictSUIDSGID=no, each with a one-line comment giving the reason above. Nothing else changes.
2. docs/ci-offload/acer-web/provision-acer-web.sh: update the sha256 of that unit in the sums block (heredoc, ~lines 79-80). Compute it the same way the script does (CRLF stripped: `tr -d '\r'`). Leave the COMMIT pin alone (a PR cannot contain its own merge sha); state in the PR body that a one-line pin bump follows after merge and the script must not be re-run before that. Do not change any other line.
3. docs/handover/ci-offload-wave0.md and the files table: fix the stale "104 cases, 21 rules" to the real current figures (run test-gate-hooks.sh and its --mutants run per docs; handover says PASS 313, 36 mutants; verify, do not copy).
4. docs/ci-offload/acer-web/provision-checklist.md: add the missing step: repo secret WEB_RUNNER_READ_TOKEN (fine-grained PAT, Administration: read, this repo, 90-day expiry) and repo variable WEB_RUNNER_LABEL=acer-web. Without the secret the router always picks hosted.

Hard limits: no workflow edits, no change to hooks or workflows.allow (their sums must stay identical), no secrets in text, Supabase read-only, no merge/approve. Run the hook suite (test-gate-hooks.sh) and bash -n on the script; show the new sha256 and prove it with sha256sum on the committed file. Put a per-check table in the PR body. Title: ci(offload): acer-web unit file matches the live Acer (runsvc.sh, RestrictSUIDSGID=no).
