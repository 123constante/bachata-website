# Brief: rebase claude/prepush-gate-names onto main (PR #1603)
Goal: PR #1603 (unit gate names its failing files) conflicts with main in `.githooks/pre-push` only. Merge `origin/main` into `claude/prepush-gate-names`, resolve that one file keeping BOTH main's changes and the PR's failing-file naming, push once (subject ends [worker-done]). Do not change anything else; keep the PR body as is.
Acceptance: PR #1603 mergeStateStatus CLEAN; `bash -n .githooks/pre-push` passes; unit gate output still lists failing file names (run the gate's existing test for it if one exists, else say not verified).
Lane normal, Website only, no DB. Hard-tier path (.githooks): say so in the handover; Verified / Not verified block.
