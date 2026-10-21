# Handover: preview-on-done (job card jc-0025) -- PARKED on budget

Ticket: dt_aa3223f985ee. Brief: `bachata-calendar-admin` branch
`brief/people-d89`, `briefs/people-arc/PREVIEW-ON-DONE.md`
(blob 5607aba440d257180ea089c7642d506cc0bf74b7). Base: `main` @ 811d6eb.

## Outcome

**Not built.** The brief's first gate is a budget measurement: if the
estimated daily Vercel deployment count after the change goes over 70/day, do
NOT flip `vercel.json` `git.deploymentEnabled`, park the question with the
numbers, default "keep off", and stop. The estimate goes well over 70 on the
busy days (about 100-140), so this branch changes **no code and no config**.
`vercel.json`, `scripts/vercel-ignore-build.sh`,
`scripts/check-no-preview-prefixes.mjs` and `docs/pr-batching-policy.md` are
untouched. The only file is this handover.

## Budget measurement (plain git, 2026-10-14 .. 2026-10-21 partial)

Method: `git fetch --shallow-since=2026-10-13` of `refs/heads/claude/*` (245
branches) and `refs/heads/feat/*`, then `git log --since=2026-10-14`, bucketed
by committer date (UTC). Git records commits, not pushes, so claude/* pushes
come out as a range:

- **low** = the larger of (a) commits whose subject contains `[worker-done `
  plus commits whose subject ends `[skip preview]` (each one is a push tip in
  the worker protocol) and (b) distinct (branch, day) pairs;
- **high** = every claude/* commit that is not an ancestor of `main`.

"Builds today" = `main` first-parent commits + `feat/*` commits not on main
(the branches with `deploymentEnabled: true`; each counts as a deployment
whether or not it is skipped).

| day (UTC) | main | feat/* | claude/* worker-done | claude/* skip-preview | claude/* branch-days | claude/* commits | estimate low | estimate high |
|---|---|---|---|---|---|---|---|---|
| 10-14 | 1 | 0 | 0 | 0 | 2 | 7 | 3 | 8 |
| 10-15 | 5 | 0 | 40 | 0 | 20 | 78 | 45 | 83 |
| 10-16 | 5 | 8 | 42 | 0 | 51 | 86 | 64 | 99 |
| 10-17 | 2 | 0 | 41 | 16 | 34 | 71 | 59 | 73 |
| 10-18 | 1 | 0 | 16 | 2 | 8 | 18 | 19 | 19 |
| 10-19 | 1 | 0 | 1 | 0 | 4 | 7 | 5 | 8 |
| 10-20 | 14 | 6 | 77 | 9 | 54 | 95 | **106** | **115** |
| 10-21 (partial) | 8 | 9 | 82 | 11 | 48 | 120 | **110** | **137** |

Estimate = builds today + claude/* pushes (once `"claude/*": true`, every
claude/* push creates a deployment, and an IGNORED build still counts toward
the Hobby limit of about 100 per rolling 24 h).

Read-out:

- The threshold is 70/day. The low estimate is **106** on 10-20 and **110+** on
  10-21 (the day is not over). The high estimate is over 70 on 5 of the 8 days.
- Even if ignored builds did NOT count, the builds the new rule would let
  through (`[worker-done ` subjects alone: 77 on 10-20, 82 on 10-21) are over
  70 on their own, before main and feat/* add anything.
- For reference, the limit was hit on 2026-10-16 with 117 deployments
  (docs/pr-batching-policy.md, "Vercel build budget").

## Parked questions (default applies until the owner answers)

1. **Turn on claude/* deployments with the worker-done rule anyway?**
   Default: **keep off** (`"claude/*": false` stays). On 10-20 and 10-21 it
   would have used the whole daily budget, main included.
2. **A cheaper way to get "one preview per finished job", if still wanted.**
   Options for the owner to pick from (none built):
   - (a) workers push the final commit to a separate prefix with
     `deploymentEnabled: true` (e.g. `preview/<ticket>`), so only the final
     push creates a deployment and checkpoints never do. Cost is about one
     deployment per finished job (the worker-done count above, 40-80/day on
     busy days, still over 70 on peak days);
   - (b) the orchestrator deploys on demand with `vercel deploy` (CLI, using
     VERCEL_TOKEN) for only the PRs it actually walks, instead of every finished
     job;
   - (c) move to Vercel Pro (the limit becomes a bill, not a cap).
   Default: none of them; the orchestrator keeps walking PRs on a local server.
3. **Fewer done-signal pushes.** Several worker-done commits per branch per day
   (82 worker-done commits over 48 branch-days on 10-21) suggest continuation
   and done-signal pushes are part of the volume. Default: no change.

## What a continuation would build if the owner says go

Ready for the next worker; none of it is in this branch:

- `scripts/vercel-ignore-build.sh`: take `claude/` out of
  `ALWAYS_SKIP_PREFIXES` into a new `DONE_ONLY_PREFIXES='claude/'`. For those,
  BUILD only when the SUBJECT contains `[worker-done ` and does not end with
  `[skip preview]`; any other subject, or an empty one, SKIPS (the brief's
  budget exception to fail-safe).
- `scripts/check-no-preview-prefixes.mjs`: the union it checks becomes
  DIFF_RULE + ALWAYS_SKIP + DONE_ONLY, so the four preview workflows' exclusion
  lists (which already list `claude/`) stay equal. No workflow edit.
- `vercel.json`: `"claude/*": true`.
- A table-driven test (the rows in the brief), run RED on main first.
- `docs/pr-batching-policy.md` "Vercel build budget": the rule in plain words.

## Verified / Not verified

- Verified: the counts above, from plain git against `origin` on 2026-10-21.
- Not verified: actual Vercel deployment counts (no Vercel dashboard or REST
  call made; this run did not need VERCEL_TOKEN). Git commit dates are a
  proxy for push times, so pushes are given as a low-high range.
- No tests were added or run: the brief's stop rule applied before any code
  change.
