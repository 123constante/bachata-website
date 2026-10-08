# Bot PR auto-merge (rung 2)

`.github/workflows/bot-automerge.yml` asks GitHub to merge a **kiki-claude-bot** PR
by itself once main's required checks are green &mdash; but only when the PR changes
nothing that ships. Rung 1 is `dependabot-automerge.yml` (dev-dependency bumps).
Both are **off** by default. Nothing in this PR switches anything on.

## What qualifies

The decision is `scripts/automerge-classify.mjs` (pure `classify()`, tested in
`tests/automergeClassify.test.ts`). It fails closed: every rule must hold, and any
missing field or unknown path is a refusal.

| Rule | Detail |
|------|--------|
| Author | exactly `kiki-claude-bot`. Owner PRs and Dependabot never qualify here. |
| State | not draft (an unknown draft state refuses); base is `main`; no `needs-owner` label |
| Files | non-empty, and the listed count equals the PR's `changed_files` (a truncated list refuses) |
| Every path | for a rename, **both** the old and new name. Must be on the allowlist and on none of the blocklist; block wins |
| Allowlist | `docs/**`; `*.md` anywhere not blocked; test files (`*.test.*` / `*.spec.*`) under `tests/`, `e2e/`, `__tests__/`; `__snapshots__/*.snap` under `tests/` or `e2e/` |
| Blocklist | `src/ app/ api/ server/ public/ supabase/ scripts/ bin/`; `.github/ .githooks/ .claude/ .husky/ .vercel/`; `middleware.*`; `package*.json`, lockfiles, `.npmrc`, `.nvmrc`; `vercel*.json`; `vite/vitest/react-router/playwright/tailwind/postcss/eslint` configs; `tsconfig*.json`; `.env*`; any `CLAUDE.md` / `AGENTS.md`; any non-markdown path naming auth/login/otp/session/password/magic-link; `tests/helpers|fixtures|client|setup/` (support modules, not tests) |
| Paths must be canonical | `..`, `.`, empty segments, a leading `/`, backslashes or control characters refuse outright, so `docs/../src/x.ts` is never read as a docs path. Matching is case-insensitive (`SRC/x.md` refuses) |
| Deletions | deleting a test file refuses (that is a gate change, not a test change) |
| Size | additions + deletions **under 400** |
| Real data | if `scripts/check-pr-real-data-verified.mjs` (PR #658) exists on main, the body must pass **its** `parse()`, imported from main unchanged. Until #658 merges this rule is inactive. |

Anything outside the allowlist (a root `index.html`, `.gitattributes`, a stray
`tmp_*.json`) refuses because it is not listed, not because someone thought of it.

## How it runs

- **`pull_request_target`**, so the workflow file and the classifier come from
  **main**, never from the PR: a PR cannot rewrite the rules that judge it. The PR
  head is never checked out or executed; the file list and body come from the
  REST API. Do not add a head checkout.
- Re-judged on `opened, reopened, synchronize, edited, ready_for_review,
  converted_to_draft, labeled, unlabeled`. A PR that stops qualifying (a `src/`
  file pushed, `needs-owner` added, draft, switch off) gets auto-merge
  **disabled**. GitHub does not disable it on a push by a writer, so this
  workflow does.
- The merge is pinned with `--match-head-commit` to the head sha that was judged.
- It arms auto-merge with the bot's PAT (`BOT_PR_TOKEN`, already used by
  `bot-pr.yml`), not `GITHUB_TOKEN`. A merge made with `GITHUB_TOKEN` does not
  fire the `push`-to-main workflows (`owner-approval.yml`, `sitemap-submit.yml`,
  `pr-mergeable-guard.yml`, the push runs of the test suites). A missing secret
  is a red job, not a silent skip.

## Kill switch

The job runs only when **both** repo variables are exactly `true`:

- `AUTOMERGE_ENABLED`: the shared switch. It already gates `dependabot-automerge.yml`.
- `BOT_AUTOMERGE_ENABLED`: this rung's own switch, so bot auto-merge can be turned
  on or off without touching Dependabot.

To stop everything, set either to anything else. The workflow still runs for a
bot PR that already has auto-merge on, and disarms it on that PR's next event.
To disarm an idle PR at once, use **Disable auto-merge** on the PR page.

## What the owner must change (nothing here does it)

Read from the API on 2026-10-08:

1. **Settings &rarr; General &rarr; Pull Requests &rarr; Allow auto-merge** is
   **already on** (`allow_auto_merge: true`). Leave it on.
2. **Required checks.** The ruleset **"main checks"** (Settings &rarr; Rules
   &rarr; Rulesets, active on the default branch, no bypass actors) already
   requires these checks, named exactly as the CI job names appear:
   `integrity`, `bundle-budget`, `e2e-smoke`, `wallclock-brand`,
   `masking-check`, `bom-check`, `unit (Europe/London, full)`. All seven run on
   every PR to main with no path filter, so a docs-only PR does receive them.
   **Keep them.** Optionally add `real-data-verified` once #658 merges (see
   decisions).
3. **Settings &rarr; Secrets and variables &rarr; Actions &rarr; Variables**: create
   `BOT_AUTOMERGE_ENABLED` = `true`, and `AUTOMERGE_ENABLED` = `true` if it is not
   already. Setting `AUTOMERGE_ENABLED` also switches on Dependabot rung 1.
4. Confirm the secret `BOT_PR_TOKEN` (kiki-claude-bot's PAT) has
   `pull_requests: write` and `contents: write` on this repo. It opens PRs today;
   enabling auto-merge needs the same write access.

> **WARNING:** `gh pr merge --auto` merges **immediately** when the branch has no
> required checks. If the "main checks" ruleset is ever disabled, deleted, or
> loses its required checks, switch auto-merge off **first**: set
> `AUTOMERGE_ENABLED` to `false`.

## How this sits with the existing gates

- **Owner approval.** The "main checks" ruleset has no pull-request (approval)
  rule, so nothing blocks a merge on review today. If one is added later, every
  auto-merge waits for it: the bot cannot approve its own PR, so this rung stalls
  safely rather than bypassing it. `owner-approval.yml` is an after-the-fact audit:
  a commit on main that touches a HARD-tier path (`scripts/ bin/ .githooks/
  .github/ .claude/`) without the owner's approval at the PR head goes red and
  opens an issue. Every HARD-tier path is on this classifier's blocklist, so an
  auto-merged PR cannot trip that audit, and the audit is unchanged.
- **Required checks** are unchanged and are what `--auto` waits for.
- **Real-data-verified (#658)** is applied as-is when on main, never loosened. Its
  own workflow skips PRs that touch no app code, which is every PR this rung
  merges, so the classifier applies the parser itself.
- **Deploys.** A docs or test merge still deploys production today. The parallel
  `vercel.json` / `scripts/vercel-ignore-build.sh` change is what stops that. This
  rung does not depend on it.

## Survey: the last 160 merged PRs (real data)

Read-only, via the REST API on 2026-10-08. The PRs are #385&ndash;#659, merged
2026-09-08 to 2026-10-08. Authors: 75 owner, 72 kiki-claude-bot, 13 Dependabot.
The real classifier ran on each PR's real file list, labels and author.

| Class | PRs | Would qualify |
|-------|----:|--------------:|
| Touches shipped code (`src/ app/ api/ public/ supabase/`, middleware, package, vercel, vite/router config) | 113 | **0** |
| Touches a HARD-tier path (`.github/ scripts/ .githooks/ .claude/ bin/`) but no shipped code, possibly plus docs or tests | 40 | 0 (owner-approval tier) |
| `CLAUDE.md` + docs only | 1 (#392) | 0 (owner decision below) |
| Other root files (`.gitattributes`, `tmp_*.json`, `diagnose_*`) | 3 | 0 (not on allowlist) |
| Docs / markdown only | 1 (owner-authored, #495) | 0 (human author) |
| Test files only, by the bot | 2 (#650, #487) | **2** |
| **Total** | 160 | **2** |

With #658's parser applied, **0** qualify: neither body has the section, since
both predate it. The owner's count of "many docs/ci/test/chore" PRs is real, but
nearly all of them are CI and guard changes. Those are HARD tier on purpose and
stay manual. On the current allowlist this rung saves about 2 merges a month.
The volume is in `.github/` and `scripts/`, and this rung deliberately does not
reach there.

Borderline cases inspected:

| PR | Files | Verdict | Why |
|----|-------|---------|-----|
| #650 | `tests/homeLoaderDegrade.test.ts` (8 lines) | qualifies | test file only |
| #487 | 4 &times; `tests/*.contract.test.ts` (24 lines) | qualifies | test files only (live-DB contract tests, read-only) |
| #651 | `.github/workflows/post-merge-prod-alarm.yml` + a test | refused | workflow file |
| #495 | `PRODUCT.md`, `docs/seo-backlink-tracker.md` | refused | owner-authored; files would pass |
| #392 | `CLAUDE.md` + 2 docs (252 lines) | refused | `CLAUDE.md` |
| #502 | `.claude/settings.local.json`, `CLAUDE.md`, docs | refused | agent config |
| #525 | `.githooks/pre-push` + a test | refused | hook |
| #493 | `.gitattributes` (6 lines) | refused | not on allowlist (changes checkout of every script) |
| #613 | `vite.config.ts` (19 lines) | refused | build config ships |
| #605 | `package.json`, `package-lock.json` (bot revert) | refused | dependency manifest |
| #470 | deletes root `tmp_event_page_detail_payload.json` | refused | not on allowlist |
| #482 | removes root `diagnose_*.{js,ts}` + a test | refused | not on allowlist |

## Decisions for the owner

1. **`CLAUDE.md` / `AGENTS.md`.** These are excluded because they are the agents'
   operating rules: auto-merging them lets the bot change its own doctrine. Allow
   them? Recommendation: no.
2. **Require `real-data-verified`** in "main checks" once #658 merges? That gates
   every PR, not only this rung. This rung already enforces the section without it.
3. **Test edits can weaken an assertion.** This rung allows modified and added
   test files, but not deleted ones. If that is too much, drop the `test` class:
   it is the only class that qualified in the survey.
4. **Dependabot is out of scope here.** A proposal for later: widen rung 1 to
   production-dependency **patch** bumps when `e2e-smoke` and `bundle-budget` are
   green. That is not implemented. Note that `AUTOMERGE_ENABLED` already gates
   rung 1.
5. **Higher yield.** The volume is CI and guard PRs. Reaching them means relaxing
   the HARD tier, which is what `owner-approval.yml` protects. Not recommended
   without a second reviewer, for example a required Claude review check.
