# BRIEF: queue worker must merge main into an existing issue branch

Branch: claude/queue-merge-main. Careful lane (workflow file). One file: .github/workflows/queue-worker.yml (plus one line in docs/queue.md).

## Failure (run 43531028249)
`Error: Cannot find module '.../scripts/queue-sdk-worker.mjs'` at step "Run the worker (Sonnet, Agent SDK)". "Prepare the branch" checks out the existing remote branch claude/queue-<issue> as-is; claude/queue-1645 predates the merge of #1649, so it lacks the script.

## Change
In "Prepare the branch", directly after `git fetch origin "$b" && git checkout -B "$b" "origin/$b"`, add:

    if ! git merge --no-edit origin/main; then
      git merge --abort || true
      echo "::error::could not merge origin/main into $b (conflict)"
      exit 1
    fi

With a comment: older issue branches predate scripts added to main since. Nothing else changes; the checkpoint step already pushes the branch.

## Checks
Run every CI step that applies to a workflow change (actionlint if the repo has it, check-script-conventions). Add one line to docs/queue.md: an existing issue branch gets main merged in. Open the PR as the bot with a real body at once.
