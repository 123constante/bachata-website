# Brief: ci-budget-laptop-medium

Branch claude/ci-budget-laptop-medium off main. One PR (bot author). Hard tier (ci-budgets.json). Normal lane, no DB.

Problem: CI Budget Guard is RED on main, exit 2: "COULD NOT MEASURE ... runner label(s) [laptop-medium]". Same class as #1689 (laptop-light).

Job: apply exactly this diff to ci-budgets.json (add laptop-medium multiplier 1 plus its //runnerMultipliers-laptop-medium note). Touch nothing else. Check JSON parses (node -e "JSON.parse(require('fs').readFileSync('ci-budgets.json','utf8'))") and run `node scripts/check-ci-budget.mjs --help` or its unit test if one exists. Docs/config-only PR: delete the Phone QA section of the PR body.

```diff
diff --git a/ci-budgets.json b/ci-budgets.json
index 19537ff3e..d2d9598af 100644
--- a/ci-budgets.json
+++ b/ci-budgets.json
@@ -46,12 +46,14 @@
   "//runnerMultipliers": "GitHub's per-minute price multipliers, matched case-insensitively as SUBSTRINGS of a job's runner labels. A label matching none of these is a hard exit 2 naming the label, NOT a default of 1: an unknown runner silently priced at the cheapest rate is the fail-open shape this whole file exists to prevent. Add the new runner here in the PR that introduces it.",
   "//runnerMultipliers-oracle-light": "oracle-light is a SELF-HOSTED runner label (a bare custom label, not a GitHub-hosted image name; GitHub offers larger runners with custom labels only to Team/Enterprise orgs, and this is a personal account). The 2026-11-05 scheduled sweep (run 41976127044) met a job in a metered private repo labelled only [oracle-light] and exit-2ed. GitHub bills self-hosted minutes at 0, but loadConfig refuses any multiplier <= 0, so it is priced at 1, the cheapest positive rate: it OVER-counts, never under-counts, which is the direction this file is allowed to be wrong in. If the runner is ever replaced by a GitHub larger runner, give it that runner's real multiplier in the same PR.",
   "//runnerMultipliers-laptop-light": "laptop-light is a SELF-HOSTED runner label, the same shape as oracle-light above, and priced the same way: GitHub bills self-hosted minutes at 0, loadConfig refuses a multiplier <= 0, so it is priced at 1 and over-counts, never under-counts. Missing it made the scheduled sweep exit 2 (COULD NOT MEASURE; run 43682498924 on 2026-11-15), so the guard was red and not reading the budget.",
+  "//runnerMultipliers-laptop-medium": "laptop-medium is a SELF-HOSTED runner label, the same shape as laptop-light above, priced the same way (1, over-counts, never under-counts). Missing it made the scheduled sweep exit 2 (COULD NOT MEASURE ... runner label(s) [laptop-medium]).",
   "runnerMultipliers": {
     "ubuntu": 1,
     "linux": 1,
     "windows": 2,
     "macos": 10,
     "oracle-light": 1,
-    "laptop-light": 1
+    "laptop-light": 1,
+    "laptop-medium": 1
   }
 }
```
