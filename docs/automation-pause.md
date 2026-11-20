# Automation pause switch (slice 1)

One switch that stops every automated merge, approval and write in this repo. Guard-class
code: `scripts/lib/automation-pause.mjs`, `scripts/automation-pause.mjs`, the reader steps and
`.github/workflows/automation-pause-guard.yml` change only with the OWNER's Approve at head.

## The rule

PAUSED = ANY of:

- (a) the label `automation-paused` on the issue titled exactly `AUTOMATION PAUSE SWITCH`;
  only an issue CREATED by the repo owner counts (`PAUSE_ISSUE_AUTHOR_BOTS` is deliberately
  empty); a same-title issue by anyone else is ignored with a `::warning::` and never pauses;
- (c) any doubt: no such issue, more than one owner-created one, the one issue closed, or ANY read error
  (HTTP 401/403/404/429/5xx, network, timeout, a body that is not JSON / not an array, an item
  without a `labels` array, no token, an invalid repo).

(b), the repo variable, and the `resume` comment workflow are later slices. Each repo reads
its own switch; the orchestrator sets both repos' labels when it pauses.

## How to

- **Pause**: add the label `automation-paused` to the pinned `AUTOMATION PAUSE SWITCH` issue
  (works in the GitHub mobile app). The owner or any loop in doubt may set it. The guard
  workflow then disables auto-merge on every open PR.
- **Resume (slice 1)**: the OWNER removes the label. Nobody else can: a removal by anyone
  else (bots included) is re-added within 30 minutes (or at once on the `unlabeled` event)
  with one comment on the issue naming who removed it.
- **Check**: `GH_TOKEN=... GITHUB_REPOSITORY=123constante/bachata-website node scripts/automation-pause.mjs`
  prints `paused=` / `reason=`; exit 0 running, 3 paused.

## Who reads it

| Consumer | Reads | While paused |
|---|---|---|
| `scripts/autopilot-step.mjs` (autopilot + merge lane) | at the start of each repo, then again before EVERY write (every non-GET through the guarded API) and explicitly before EACH merge (`mergePr`) | writes nothing, merges nothing; PR rows say `paused: <reason>`; summary says PAUSED; exit 0 |
| `bot-automerge.yml` | after checkout of main, and again immediately before `Enable auto-merge` | no enable; the existing disable step runs (an armed auto-merge would merge later) |
| `dependabot-automerge.yml` | checkout of main, before `Enable auto-merge` | no enable; an armed auto-merge on the PR is disabled |
| `stale-bot-pr-sweep.yml` (daily 04:23 UTC + manual) | after checkout of main, before the sweep step | closes nothing; a notice step says so (a failed read is treated as paused) |
| `revert-on-red.yml` (merge tiers) | before it opens a revert PR | skips SILENTLY: no revert PR, no comment, the job ends green; only the step log says paused |
| `post-merge-prod-alarm.yml` (brake) | `--info`, logged only | the brake ALWAYS runs: a pause stops merging, never alerting |
| `automation-pause-guard.yml` | `--guard` (A15b), every 30 min + on label events; `--info` before the scheduled disarm | label added, OR a scheduled run that does not read RUNNING (a label set with GITHUB_TOKEN fires no `issues` event): disarms auto-merge on every open PR |

Not readers (EXEMPT in `tests/automationPauseWorkflows.test.ts`, each with a reason):
`bot-pr.yml` (opens PRs, never merges) and `types-drift-autoheal.yml` (refreshes one PR,
never merges). A new workflow that merges/approves/writes without a reader turns that test red.

## Honest limits

- The re-assert and the "nothing removes the label" grep are TRIPWIRES that catch mistakes
  and most attacks, not guarantees.
- The reader finds the switch with the Search API (`GET /search/issues`, query
  `repo:<repo> is:issue in:title "AUTOMATION PAUSE SWITCH" author:<owner>`), issues only, so
  no number of newer issues/PRs can push it out (the old newest-500 listing could, and did on
  2026-11-20: every reader said `pause issue missing`). The exact-title and owner-author checks
  still run on every result. Fail closed: `incomplete_results` not `false`, a non-object body,
  `items` not an array, more than 10 pages, or any read error = PAUSED.
- The search index lags a NEW issue by seconds to minutes: a freshly re-created switch reads
  `pause issue missing` (= PAUSED) until GitHub indexes it. Search has its own rate limit
  (30 requests/min per token); a 403/429 there is a read error = PAUSED.
- If the token of a Dependabot-triggered run cannot read issues, Dependabot auto-merge never
  enables (`reason=HTTP 403` in the step log).
- The interim message channel is ONE comment on the switch issue per notice key; no push
  notification.

## Stale bot-PR sweep

Owner click 2026-11-04. `bot-pr.yml` no longer opens a PR for `claude/review-*` or `claude/done-*` (tests/botPrSkip.test.ts evaluates the real job `if:`). `stale-bot-pr-sweep.yml` runs `scripts/sweep-stale-bot-prs.mjs` with `BOT_PR_TOKEN`: the daily schedule passes `--apply`; a manual run is a DRY RUN (decisions logged, nothing closed) unless its `apply` input (boolean, default false) is ticked. When applying it it closes at most 5 (`MAX_CLOSES`, oldest first) of the bot's own `claude/*` PRs idle more than 3 days (`STALE_DAYS`) that are superseded (a later open or merged PR for the same ticket), say `chore: ... already on main`, or change zero files. A PR with `automerge-ok`, `ap:hold`, `owner-reserved` (`PROTECTED_LABELS`) or any `RESERVED_LABELS` entry, an owner Approve at its current head, any hard-tier path (pack `HARD_RULES` or review-scope `isRiskyPath`, as the merge lane; a file list not read in full counts as hard-tier), a draft, or any other author is never touched; branches are never deleted. Each close posts `Closed by the stale-bot-PR sweep: <reason>. Reopen if this was wrong.` The decision is `scripts/lib/stale-bot-pr.mjs`, tested in tests/staleBotPr.test.ts.
