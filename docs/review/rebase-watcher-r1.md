# Review r1: PR #1834 auto-rebase watcher (`pr-auto-rebase.yml` + `scripts/pr-auto-rebase.mjs`)

Independent delta review, read-only, one round. Brief `docs/briefs/review-rebase-watcher.md`
(branch `brief/review-rebase-watcher`, sha `a637616`). Reviewed branch `claude/rebase-watcher`
at head `43ca09a24` (merge-base with `main`: `e43b9395f`). Files judged: `.github/workflows/pr-auto-rebase.yml`,
`scripts/pr-auto-rebase.mjs`, `.github/automation/secrets-register.json`, `tests/automationRegister.test.ts`,
`docs/ci-guard-notes.md` (plus the `package.json` script lines and the `prove-entry-point-dispatch.mjs`
TARGETS line the PR also touches). No source edited on the reviewed branch. No Supabase call (none needed).

Line numbers below are from `git show 43ca09a24:<file>`. `wf:` = the workflow, `js:` = the script.

## Verdict: PASS WITH NITS

## Hard-tier: PASS

The workflow touches `.github/workflows/` and `scripts/` (HARD tier). Nothing found that can lose
work, push to a branch other than the PR's own head, or leak a token. Every push is
`--force-with-lease=refs/heads/<head>:<observed head oid>` to `refs/heads/<headRefName>` of a
same-repo, non-draft, base-`main`, head-not-`main` PR that was quiet for 10 minutes. Nothing from a
PR branch is ever executed (hooks off, script already loaded before the checkout, no install after).
All items below are NOTE. The one that changes the owner's day is item 5 (approval at the old head
no longer counts after the watcher pushes).

## Items

### 1. Token, secrets register, permissions -- NOTE

- Token: `BOT_PR_TOKEN` for both the checkout credential and the API/push token.
  `wf:40` `token: ${{ secrets.BOT_PR_TOKEN }}` with `wf:41` `persist-credentials: true`;
  `wf:58` `GITHUB_TOKEN: ${{ secrets.BOT_PR_TOKEN }}`. The script reads only `env.GITHUB_TOKEN`
  (`js:208`). Reason stated in the header comment (`wf:8-9`): a `GITHUB_TOKEN` push starts no
  `pull_request` run, so the rebased head would never get checks. Correct, and consistent with
  `docs/automerge.md` ("Merge token").
- No new secret. The register diff adds `pr-auto-rebase.yml` to `readers_allowed` of the existing
  `BOT_PR_TOKEN` entry (`entries[1]`, verified by parsing the JSON) and one `grandfathered` sentence
  dated 2026-11-19; `tests/automationRegister.test.ts:80` widens the date regex to `1[369]` and line
  84 adds the name to the expected key list. `npx vitest run tests/automationRegister.test.ts` at
  `43ca09a24`: 81 passed.
- Permissions (`wf:22-24`): `contents: write`, `pull-requests: write`. These scope the
  **`GITHUB_TOKEN`**, which this workflow never uses (every write goes through the PAT). The house
  pattern for PAT-driven automation is `permissions: contents: read` (`autopilot.yml`,
  `automation-identity-check.yml`, `auto-merge-on-open.yml`). NIT: drop to `contents: read`
  (or `permissions: {}`). Not a leak: the unused `GITHUB_TOKEN` is never exposed to PR code.
- `persist-credentials: true` leaves the PAT in `.git/config` for the run. It is needed (the
  script pushes with plain `git push`). PR-branch content is checked out into that workspace
  (`js:132`) but never run: `js:30` `HOOKS_OFF = ['-c', 'core.hooksPath=/dev/null']` is
  prepended to every git call (`js:129`; self-test `js:372-377` asserts it), and the Node process
  has already imported everything it will ever import (`js:20-22`) before the first checkout.
  Only `queue-worker.yml` does the same today. NOTE, no action.

### 2. Push safety -- NOTE (no finding)

- The only push: `js:254`
  `git push origin rebase-work:refs/heads/<headRefName> --force-with-lease=refs/heads/<headRefName>:<headOid>`.
  The lease is pinned to the head oid read from GraphQL at list time (`js:196`), not a bare
  `--force-with-lease`, so a push that landed between listing and pushing is refused ("stale info"
  is caught per PR, `js:77-80`, self-test `js:338-346`).
- Target is always the PR's own head ref. `main` is excluded twice: `js:43` skips a PR whose head IS
  `main`; and a PR's head can never be `main` as a push target because the ref name comes from the
  PR object itself. `js:44` skips stacked PRs (base not `main`), so a rebase onto `origin/main` is
  never pushed to a branch whose PR targets something else.
- Fork PRs: `js:45` `if (pr.isCrossRepository) return { action: 'skip', reason: 'fork' }`
  (self-test `js:383-387`). Only open PRs are listed (`js:153` `states:OPEN`), so a branch not
  tied to an open PR is never touched.
- Conflict never pushes: `js:97-99` pushes only when `r.ok`.

### 3. Cap, cron, dry run -- NOTE (no finding)

- Cap: `js:25` `CAP = 5`; `js:70-75` turns the sixth `rebase` decision into
  `skip -- cap 5 per run` (self-test `js:398-404`). Flagged PRs are skipped before the cap counter
  (`js:50-52`), so a backlog of already-commented conflicts cannot starve the fresh ones
  (self-test `js:331-337`).
- Cron: `wf:16` `cron: '*/15 * * * *'`. With `timeout-minutes: 10` (`wf:34`) and the concurrency
  group, at most one run is ever queued behind another.
- Dry run: `wf:59-60` `DRY_RUN: ${{ github.event_name == 'workflow_dispatch' && inputs.dry_run || 'false' }}`
  -> `wf:64` `--dry-run` flag -> `js:207`. Every write is gated: push `js:98`, label `js:105`,
  comment `js:106-107`, unlabel `js:67`. The local rebase still runs (`js:96`) so the report is
  real; nothing leaves the runner (self-test `js:405-409`). Dispatch default is `true` (`wf:21`);
  schedule runs are real (`inputs` is empty there; the `|| 'false'` branch covers it, and a boolean
  `false` input also lands on `'false'`). Correct.

### 4. The six robustness findings -- all present, NOTE

- a. Conflict aborts cleanly, branch untouched: `js:134` `run(['rebase', 'origin/main'])` in a
  try; on throw `js:139` collects `diff --name-only --diff-filter=U`, `js:142` `rebase --abort` in
  a `finally`; `js:246-252` runs a second `rebase --abort` per PR as `cleanup`. The real-git
  self-test (`js:413-443`) asserts `status --porcelain` is empty after the conflict case. Nothing is
  pushed on the conflict path (`js:100-119`).
- b. No loop on a PR that stays conflicted: `js:50-52` -- label present AND a comment containing
  `<!-- pr-auto-rebase:conflict sha=<headOid> -->` (`js:32-34`) => `skip -- already flagged for this
  head`; no rebase attempt, no write. A new head oid gets exactly one new comment (`js:326-330`).
  Comments are read across all pages (`js:167-177`), not a 50-comment window. If the comment list
  cannot be read the PR is forced to `isDraft = true` for the run (`js:239`, fail closed) rather
  than risk a duplicate comment.
- c. Draft and bot-owned branches: draft `js:42`. There is NO explicit bot-owned-branch exclusion;
  the protection is the quiet window `js:46-49` (`updatedAt` within 10 min => skip; a worker push
  bumps `updatedAt`). A worker session that pushes less often than every 10 minutes can find its
  branch rewritten under it: its next plain `git push` is refused (non-fast-forward), nothing at the
  remote is lost (the lease replaced exactly the commits it had read, with their rebased
  equivalents). NOTE: the worker must `git pull --rebase` before pushing; a brief line for cloud
  workers ("if push is refused on your own branch, fetch and rebase; never force") would close
  this. Optional hardening: skip heads with a live session lock or author `kiki-claude-bot` touched
  within 60 min instead of 10.
- d. Rate limit: no backoff. `js:162` throws on any non-2xx except 422; in the list call that is
  exit 2 (`js:228-230`, a red run, nothing written); in the comment read it skips the PR
  (`js:237-240`); in label/comment/push it is the per-PR `ERROR:` row (`js:77-80`). Volume per run
  is bounded: 1 GraphQL, up to N x pages of comments for DIRTY PRs only (`js:234`), at most
  5 x (2 label + 1 comment) writes. 96 runs/day is far under the PAT's 5000/h. NIT: `api()` treats
  422 as OK for every call (`js:162`), needed only for the label-create POST (`js:260`); a 422 on
  the comment POST would be swallowed and the comment retried next run (one attempt per run, no
  storm). Make the 422 tolerance local to `label`.
- e. Concurrency group: `wf:26-28` `group: pr-auto-rebase`, `cancel-in-progress: false`. Two runs
  cannot push at once; a queued run waits rather than killing a push in flight. Correct.
- f. Failure reports once, not every run: the conflict comment is once per head sha (item b).
  The step summary (`wf:66`) is written every run but notifies nobody. NOTE: a persistent exit-2
  cause (PAT revoked, API down) reds the scheduled run every 15 minutes, and GitHub mails the
  workflow's last committer on each scheduled failure. Not a correctness issue; if it ever
  happens, the fix is the same as `ci-budget-guard.yml` (exit 2 is deliberate there too).
- Extra (not in the six): `js:39-40` treats `mergeStateStatus === 'UNKNOWN'` (GitHub still
  computing, even after the 4 s retry `js:200-201`) as "not DIRTY" and REMOVES the label from a
  flagged PR; the next run re-adds it (no second comment, marker still present). A label flap, two
  `updatedAt` bumps, nothing lost. NIT: `if (pr.mergeStateStatus === 'UNKNOWN') return skip`.
- Extra: `js:153` `first:100` -- with more than 100 open PRs the least-recently-updated are never
  seen. Not the case today. NIT only.

### 5. Does the rebase push re-trigger CI and void the approval? -- NOTE (effect, not a defect)

Yes to both, and the second one matters for HARD-tier PRs.

- CI: the push is made with the bot PAT, so GitHub emits `pull_request: synchronize` for the new
  head and every PR workflow re-runs. That is the point of the watcher and why `GITHUB_TOKEN` is
  not used (`wf:8-9`). `auto-merge-on-open.yml` arms `gh pr merge --auto --match-head-commit`
  and says so itself (`auto-merge-on-open.yml:16`: "a push after classification voids the arming
  (synchronize re-runs it)"), so bot-tier PRs self-heal on the next event.
- Approval: `scripts/owner-approval-audit.mjs:167` counts an owner approval ONLY when
  `last.commit_id === pr.headSha`. After the watcher rewrites the head, an approval given at the
  old head no longer sits "at the PR head". For a PR touching `scripts/`, `.github/`, `.claude/`,
  `bin/`, `.githooks/` that then merges without a fresh approval, `owner-approval.yml` goes RED on
  main and opens an issue (`owner-approval-audit.mjs:98,221`). `docs/automerge.md:215` says the
  repo deliberately has no required-approvals ruleset, so GitHub itself will not block the merge;
  the audit catches it after the fact.
- Effect in one sentence: **after the watcher pushes a rebase, the owner must Approve again at the
  new head before a HARD-tier PR is merged, exactly as after a manual rebase.** Merge flow is not
  broken (the alternative, a conflicted PR, cannot merge at all), but the approval must come after
  the rebase, not before. Suggest one line in `docs/ci-guard-notes.md` next to the new row, and
  that the conflict comment / step summary say "approval at the old head no longer counts".
- Commit authorship: `git rebase` keeps each commit's author; the committer becomes the
  `github-actions[bot]` identity set at `wf:53-54`, pushed by the PAT account. Any commit signature
  on the originals is dropped. No signature ruleset was found in docs; NOTE only.

### Observed on the branch, outside the five items -- NOTE

- The PR head predates `#1847` (`f956b14`, which added `pr-auto-rebase.yml` to
  `scripts/data/automation-workflow-allowlist.json` on `main`). At `43ca09a24` the allow-list check
  FAILS against the branch's own data file and PASSES with `main`'s
  (`HEAD_REF=claude/rebase-watcher PR_AUTHOR=kiki-claude-bot PR_FILES=... node scripts/check-automation-workflow-allowlist.mjs`,
  both runs done here). The `pull_request` CI runs on the merge ref, which carries `main`'s file, so
  the gate is green for the PR as it stands; a rebase of #1834 onto `main` makes it true on the
  branch too. Ironically #1834 is itself a candidate for the watcher it adds.
- `git diff origin/main...43ca09a24 -- package.json` shows `react-day-picker` re-appearing. That is
  `main` having removed it after the merge-base (`#1844`), not the PR adding it; the PR's own
  `package.json` change is the two `pr-auto-rebase*` script lines only.

## Verified

- `node scripts/pr-auto-rebase.mjs --self-test` at `43ca09a24`: `PASS self-test -- 18 cases`
  (includes the real-git clean/conflict case).
- `npx vitest run tests/automationRegister.test.ts` at `43ca09a24`: 81 passed.
- `node scripts/check-script-conventions.mjs` at `43ca09a24`: passed.
- `node scripts/prove-entry-point-dispatch.mjs` at `43ca09a24`: 95 entry points proven, includes
  `scripts/pr-auto-rebase.mjs`.
- `check-automation-workflow-allowlist.mjs` run both with the branch's data file (fails, expected:
  predates #1847) and with `main`'s (OK, 17 names).
- Every code line quoted above read in `git show 43ca09a24:<file>`; register parent entry
  confirmed by parsing the JSON.

## Not verified

- No live run of the workflow (no dispatch, no dry run on GitHub) and no token used. The
  `DRY_RUN` expression was reasoned from the Actions expression rules, not executed.
- GitHub's `pull_request: synchronize` firing for a PAT force-push, and approval-dismissal
  behaviour, are from the repo's own docs and the audit script, not re-tested live.
- Whether any ruleset requires signed commits (no doc mentions one).
- `npm run pre-ship` / full CI for #1834 itself: not run here (review lane, docs only on this branch).
