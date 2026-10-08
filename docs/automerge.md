# Bot auto-merge (docs and tests only)

`.github/workflows/bot-automerge.yml` asks GitHub to merge a low-risk bot PR by
itself once the `main` ruleset's REQUIRED checks pass. The verdict is
`scripts/automerge-classify.mjs`; its table of cases is
`tests/automergeClassify.test.ts`. It is **OFF** until the owner switches it on
(see "Switching it on"), and nothing in this PR switches it on.

The owner authorised this for a narrow class only. It does not replace "the
owner merges everything" for anything outside that class.

## What qualifies (ALL must hold, else NO)

| Rule | Detail |
|---|---|
| Kill switch | repo variables `AUTOMERGE_ENABLED` AND `BOT_AUTOMERGE_ENABLED` both exactly `true` (otherwise the job does not even start) |
| Base / head | base is `main`; head is a branch of THIS repo (no forks); PR is open and not draft |
| Identity | author `kiki-claude-bot` (any branch), or author `123constante` on a `claude/` or `ccr-` branch (the cloud workers' shared token; see "Identity") |
| Opt-in label | `automerge-ok` present, and the LAST actor who applied it is `kiki-claude-bot` or `123constante` (read from the issue events API) |
| Block labels | none of `needs-owner`, `do-not-merge`, `wip` |
| Paths | EVERY changed file, checking BOTH the old and new name of a rename or copy, is on the allowlist and on no forbidden list (below) |
| No test deletion | a removed test file is a NO: deleting a test weakens a gate, and the owner decides that |
| Test helpers | a file under `tests/` that is not itself a `*.test.*` / `*.spec.*` file is a helper, and qualifies only if no file under `src/`, `app/` or `api/` on main mentions its path (textual scan of the base checkout; over-matching only ever blocks) |
| Size | additions + deletions under 400 (the larger of the PR's own totals and the per-file sum) |
| Completeness | the file list the API returned has exactly `changed_files` entries, and at least one file was judged; an empty or truncated list is a NO |
| Real-data section | if PR #658's parser `scripts/check-pr-real-data-verified.mjs` exists on main, its `parse(body)` must return `ok`. This is STRICTER than #658's own check, which skips PRs that touch no `src/`/`app/`/`api/` (every PR this workflow can merge). A parser that exists but exports no `parse()` is infra (exit 2), never "not required" |

**Allowlist**: `docs/**`; any `*.md` outside the forbidden trees; test paths
`tests/**`, `e2e/**`, `**/__tests__/**`, `*.test.*` / `*.spec.*`.

**Forbidden, whatever the allowlist says**: `src/`, `app/`, `api/`, `server/`,
`public/`, `supabase/`, `scripts/`, `bin/`, `node_modules/`, `.github/`,
`.claude/`, `.githooks/`, `.vercel/`, `middleware.*`, any `package.json` /
`package-lock.json` / `.npmrc`, `vercel.json`, root `vite* / vitest* /
react-router* / playwright* / tailwind* / postcss* / eslint*` configs,
`tsconfig*.json`, any `CLAUDE.md` / `AGENTS.md` (agent doctrine: the owner
reviews it), and any path containing `auth`, `login`, `signin`, `signup`, `otp`,
`magic-link` or `password` (so `tests/e2e/auth-*.spec.ts` stays manual).
A colocated `src/**/x.test.ts` is NOT auto-merged: `src/` wins.

**Path hygiene**: a name with `..`, `.`, an empty segment, a backslash, a NUL or
a leading `/` is a NO. That is what stops `docs/../src/x.ts` from reading as
docs; a prefix check alone would not.

## How it runs

- **Trigger**: `pull_request_target` (opened, reopened, synchronize, edited,
  labeled, unlabeled, ready_for_review, converted_to_draft). `_target` means the
  workflow file and the classifier always come from `main`, so a PR cannot edit
  its way past them. The job checks out `main` (never the PR head), with
  `persist-credentials: false`, and runs no PR code: files, labels, events and
  the body come from the REST API, and no PR text is interpolated into a shell.
- **Qualifies**: `gh pr merge --auto --squash --match-head-commit <sha>` with the
  sha the classifier read. A push after the verdict does not ride along.
  GitHub then merges only when the required checks pass.
- **Does not qualify, or the classifier could not run**: if auto-merge is on,
  it is switched OFF (`gh pr merge --disable-auto`). Every new push re-runs this,
  so a bot PR that later adds a `src/` file, gets `needs-owner`, or goes back to
  draft loses its auto-merge.
- **Exit 2 (infra)**: treated as NO, and the run goes red.

**Race, stated plainly**: between a push and this workflow switching auto-merge
off there is a window of seconds. The required checks re-run on the new head and
take minutes, so the merge cannot complete in that window; `--match-head-commit`
covers the enable side.

## Identity (a decision for the owner)

Bot PRs do not have one author. In the 160 PRs surveyed below:

- 72 are authored by `kiki-claude-bot` (any branch prefix: `claude/`, `feat/`,
  `ci/`, `fix/`, `m5/`, ...);
- 10 are authored by `123constante` on a `claude/` branch: cloud workers push
  with the owner's credential (see `bot-pr.yml`);
- 65 are authored by `123constante` on other branches: the owner's own work AND
  workers that opened their PR with the shared token (e.g. #658 on `ci/...`).
  These cannot be told apart from the PR alone.

So the rule is "bot author, or owner author on a worker branch prefix", PLUS the
`automerge-ok` label as the explicit opt-in. The label is the real gate; author
and branch only narrow it. Nothing is guessed from commit messages or bodies.

**Decision A (recommended)**: workers always open PRs with the bot token
(`kiki-claude-bot`), as `bot-pr.yml` already does for `claude/**`. Then the
`123constante` arm can be deleted from `WORKER_BRANCH`.
**Decision B**: widen `WORKER_BRANCH` to more prefixes. Not recommended: the
owner's own `docs/` and `ci/` branches would then qualify whenever labelled.

The label check trusts whoever applied it LAST. Anyone with triage access can
label; the classifier refuses a label applied by any other login.

## Interaction with existing gates (none is weakened)

- **`owner-approval.yml`** (audit, push to main): reds and opens an issue when a
  commit touching a HARD-tier path (`scripts/`, `bin/`, `.githooks/`, `.github/`,
  `.claude/`) lands without an owner approval at the PR head. Every one of those
  trees is forbidden here, so an auto-merged commit is never HARD tier and the
  audit stays green WITHOUT an approval. Nothing in the audit was changed.
- **Merge token**: auto-merge is enabled with `secrets.BOT_PR_TOKEN`, not
  `GITHUB_TOKEN`. A merge made through `GITHUB_TOKEN` starts no `push`
  workflow, so `owner-approval.yml`, the push-to-main runs of `unit-tests.yml`,
  `e2e-smoke.yml`, `pr-mergeable-guard.yml` and the rest would silently not run
  for that commit. If `BOT_PR_TOKEN` is unset the step fails red and nothing is
  enabled. The bot account needs write access for this (NOT verified, see below).
- **`dependabot-automerge.yml`**: unchanged. It reads the same
  `AUTOMERGE_ENABLED`; this workflow additionally needs `BOT_AUTOMERGE_ENABLED`,
  so the two can be switched on separately. **Proposal, not implemented**: it
  enables with `GITHUB_TOKEN`, so its merges skip the push workflows above too;
  switching it to `BOT_PR_TOKEN` would fix that.
- **`real-data-verified` (PR #658)**: respected, not weakened; see the table.
- **`.claude` pre-push / review-receipt gates**: local, unaffected.

## Switching it on (the owner, in GitHub settings; none of this is done here)

Read 2026-10-08 through the REST API:

- `Settings -> General -> Pull Requests -> Allow auto-merge` is **already ON**
  (`allow_auto_merge: true`).
- Ruleset **"main checks"** (id 24574372, active, default branch, no bypass
  actors) already requires these checks, named exactly as the jobs report them:
  `integrity`, `bundle-budget`, `e2e-smoke`, `wallclock-brand`, `masking-check`,
  `bom-check`, `unit (Europe/London, full)`. All seven ran on recent docs-only
  (#495) and tests-only (#650, #487) PRs, so a qualifying PR will not hang on a
  check that never queues.

**WARNING**: with NO required checks, `gh pr merge --auto` merges IMMEDIATELY.
Never delete the ruleset or its required checks while the switches are on.

Steps:

1. Create the labels `automerge-ok` and `needs-owner` (`Issues -> Labels`).
   Neither exists today.
2. Confirm `kiki-claude-bot` has WRITE access (`Settings -> Collaborators`) and
   that `BOT_PR_TOKEN` (`Settings -> Secrets and variables -> Actions`) is that
   bot's token with `pull_requests: write` and `contents: write` on this repo.
3. `Settings -> Secrets and variables -> Actions -> Variables`: set
   `AUTOMERGE_ENABLED` = `true` and `BOT_AUTOMERGE_ENABLED` = `true`. Setting
   `AUTOMERGE_ENABLED` also switches on `dependabot-automerge.yml`; that is
   already its documented meaning.
4. Optional, recommended: add the typecheck job to the ruleset's required checks.
   Today a tests-only PR that breaks `tsc` but passes vitest would still merge.
5. Optional: the ruleset has `strict_required_status_checks_policy: false`, so a
   PR can merge with checks run against an older `main`. Turning it on makes
   every auto-merge wait for an up-to-date branch (slower, safer).

Do NOT add a "required approvals" rule if you want this to work: auto-merge would
then wait for an approval, which is the manual merge again.

## Kill switch

- **Stop new enables**: set `BOT_AUTOMERGE_ENABLED` to anything but `true`
  (leaves dependabot alone), or `AUTOMERGE_ENABLED` (stops both).
- **In-flight PRs**: with the switch off the job does not run at all, so it does
  NOT switch off an auto-merge it enabled earlier. Disable those per PR
  ("Disable auto-merge" button, or `gh pr merge --disable-auto <n>`), or add
  `needs-owner` BEFORE turning the switch off.
- **Everything**: untick `Allow auto-merge` in Settings -> General. Whether that
  cancels already-pending auto-merges was NOT verified.

## Survey: the last 160 merged PRs (REST, 2026-10-08)

160 merged PRs, merged 2026-09-08 to 2026-10-08, files read from
`/pulls/{n}/files` (every page; #655's 210 files fetched page by page). Each was
run through `classify()` from this PR with the `automerge-ok` label assumed (no
PR carried it; the label is new). "Paths only" re-runs it with the author forced
to the bot, to show what the identity rule costs.

| Author | PRs | Only docs/tests paths | Qualify (paths only) | Qualify (full rules) |
|---|---|---|---|---|
| kiki-claude-bot | 72 | 2 | 2 | **2** |
| 123constante, worker branch (`claude/`, `ccr-`) | 10 | 0 | 0 | 0 |
| 123constante, other branch | 65 | 4 | 1 | 0 |
| dependabot | 13 | 0 | 0 | 0 (out of scope) |
| **Total** | **160** | 6 | 3 | **2** |

By conventional-commit class (title prefix):

| Class | PRs | Touch shipped code | Tooling only (scripts/.github/.claude) | Docs/tests only | Other | Qualify |
|---|---|---|---|---|---|---|
| fix | 44 | 38 | 5 | 0 | 1 | 0 |
| feat | 29 | 29 | 0 | 0 | 0 | 0 |
| chore | 27 | 19 | 5 | 0 | 3 | 0 |
| ci | 27 | 2 | 25 | 0 | 0 | 0 |
| test | 5 | 2 | 0 | 2 | 1 | 2 |
| docs | 4 | 1 | 2 | 1 | 0 | 0 |
| other (no prefix, perf, revert, polish, m5, ...) | 24 | 20 | 3 | 0 | 1 | 0 |

**PRs touching shipped code that qualify: 0.**

**The honest finding**: 2 of 160 would have auto-merged. The "many docs/ci/test"
PRs are mostly `ci:` PRs, and 25 of the 27 change `scripts/` or `.github/`. That
is the HARD tier `owner-approval.yml` exists for, so they cannot be in this
class without weakening that audit. If the owner wants more volume, the lever
is a separate decision about CI-guard PRs, not a wider allowlist here.

### Borderline cases inspected

| PR | Verdict | Why |
|---|---|---|
| #650 | YES | `tests/homeLoaderDegrade.test.ts` only, 8 lines, bot author |
| #487 | YES | four `tests/*.contract.test.ts` timeout bumps, 24 lines, bot author. Its `masking-check` and `unit` runs FAILED and it was merged anyway (before the ruleset existed); under the ruleset `--auto` would have waited for green |
| #495 | NO | `PRODUCT.md` + `docs/seo-backlink-tracker.md`, 4 lines: paths qualify, but author `123constante` on `docs/` (identity rule) |
| #504 | NO | `.claude/rules/*.md`: markdown, but `.claude/` is HARD tier |
| #501 | NO | root `CLAUDE.md` + `src/modules/event-page/CLAUDE.md` (agent doctrine; and under `src/`) |
| #392 | NO | `CLAUDE.md` offload, 252 lines: agent doctrine |
| #493 | NO | `.gitattributes` only, 6 lines: not on the allowlist (line endings affect every file) |
| #476, #455 | NO | `vercel-firewall.json`: deploy-adjacent config, not on the allowlist |
| #482 | NO | `test:` PR that also adds root `diagnose_flags.js` / `diagnose_rpc.ts` |
| #639 | NO | `test:` PR, 865 lines, plus `package.json` and a Playwright config |

## NOT verified

- That `kiki-claude-bot` has write access and `BOT_PR_TOKEN` can enable
  auto-merge (the collaborator-permission API is blocked in the authoring
  sandbox).
- That `GITHUB_TOKEN` can DISABLE an auto-merge the bot enabled (the workflow
  relies on it; a failure there turns the run red, it does not merge).
- Repository variables: the Actions-variables API is blocked in the sandbox, so
  whether `AUTOMERGE_ENABLED` is already set is unknown.
- The workflow on a live event: `pull_request_target` runs from `main`, so it
  cannot run until this file has merged.
