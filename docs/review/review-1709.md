# Review of PR #1709 -- price bare laptop, acer-web, dell-web runner labels at 1

Repo 123constante/bachata-website, branch `claude/ci-budget-laptop-bare`,
head 676028204c918334274408f0493f91897f14501c
Reviewer: independent worker (ticket dt_43f1e86e9fb0). Review only; no product code edited.

## Findings

1. **Diff scope -- OK.** `git diff --stat origin/main...676028204c` = `ci-budgets.json | 7 ++++++-`
   only. Changes: two new `//` note keys (`ci-budgets.json:50-51`) and three new
   `runnerMultipliers` entries `laptop`, `acer-web`, `dell-web` = 1 (`ci-budgets.json:59-62`);
   the only modified line is the trailing comma added to `"laptop-medium": 1`. No other key's
   value changed. `python3 -m json.tool` parses the file at head: valid JSON.

2. **Multiplier 1 over-counts, never under-counts -- OK.** `scripts/check-ci-budget.mjs:202-206`
   (`loadConfig`) refuses any multiplier `<= 0`, so 1 is the cheapest legal rate for a self-hosted
   runner GitHub bills at 0. Same pricing rationale as the existing `oracle-light` /
   `laptop-light` / `laptop-medium` entries.

3. **Substring matching -- no priced result changes.** `runnerMultiplier`
   (`scripts/check-ci-budget.mjs:303-338`) tries an EXACT key first (`:310-311`), so
   `laptop-light` and `laptop-medium` still hit their own exact entries; the substring loop
   (`:328-330`) is only reached for labels with no exact key. Probed at head:
   `laptop`=1, `laptop-light`=1, `laptop-medium`=1, `acer-web`=1, `dell-web`=1,
   `[self-hosted, laptop]`=1, `ubuntu-latest`=1, `oracle-light`=1, `windows-latest`=2,
   `macos-14`=10 -- all unchanged where previously priced. `node scripts/check-ci-budget.mjs
   --self-test` at head: `PASS self-test -- 98 cases`.

4. **Other runner labels in use.** `.github/workflows/*.yml`: 70x `runs-on: ubuntu-latest`,
   1x `runs-on: ${{ needs.route.outputs.runner }}` (`bom-check.yml`), which emits either the
   hosted image or a bare label from `WEB_RUNNER_LABEL` (`scripts/ci/route-runner.mjs:59`,
   e.g. `acer-web`, `dell-web`) -- both now priced. No unpriced label found in this repo.

## Nits (non-blocking)

- N1. `laptop` as a SUBSTRING key now also silently prices any future label containing
  "laptop" (e.g. `laptop2`, named in `scripts/lib/walk-hosts.mjs:55`) at 1 instead of the
  guard's fail-closed exit 2. Harmless today (all self-hosted, true cost 0), but it narrows the
  "unknown label is a hard failure" net; an exact-match-only key would keep it.
- N2. A job labelled ONLY `[self-hosted]` would still exit 2 (no key matches). Not seen in this
  repo; other metered repos' labels were not inspected (no API access from this worker).

## Verdict: PASS WITH NITS
## Hard-tier: PASS

## Not verified
- Did not re-run CI Budget Guard against live API (needs token); run 43781669007 not re-read.
- Runner labels used in other metered repos listed in `requiredRepos` were not surveyed.
