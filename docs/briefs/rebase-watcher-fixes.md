# Brief: rebase-watcher review fixes (continuation on claude/rebase-watcher, PR #1832)
Independent review PASSED the security checks. Fix ONLY these in scripts/pr-auto-rebase.mjs, pr-auto-rebase.yml and the self-test, then add a self-test case for each:
1. Cap starvation (script ~62-68): do not count toward the 5-PR cap a PR that already has the needs-rebase label AND the marker comment for its current head SHA; skip it without counting.
2. Wrap each PR in try/catch (script ~69-71): record the error in its result row, always `git rebase --abort` in finally, continue with the next PR. A rejected force-with-lease must not kill the run.
3. Paginate comments (script ~130) or search the marker without a 50-comment window, so one comment per head SHA is guaranteed.
4. Add baseRefName to the query; skip any PR whose base is not main (stacked PRs).
5. In decide(): skip when headRefName is main.
6. Hooks off on every git call that checks out or rebases: -c core.hooksPath=/dev/null (use NUL-safe equivalent only if needed; runner is Linux).
7. Workflow: declare permissions contents: write and pull-requests: write (matches the spec); on schedule runs, set dry-run explicitly false by design, and keep workflow_dispatch default dry_run true. Use a longer code fence (or no fence) for rebase.log in the step summary.
Leave everything else alone. No new secrets. Same narrow workflow exception as the original brief applies to pr-auto-rebase.yml only.
Done: npm run pre-ship green, self-test passes, push, commit subject ends [worker-done <ticket>].
