# Brief: ci-budget-laptop-bare

Branch claude/ci-budget-laptop-bare off main. One PR (bot author). Hard tier (ci-budgets.json). Normal lane, no DB.

Problem: CI Budget Guard push run 43781669007 (main b4163256) was RED exit 2: "COULD NOT MEASURE: a job ran on runner label(s) [laptop], which match no entry in ci-budgets.json runnerMultipliers". Matching is by substring of the job label, so the existing laptop-light and laptop-medium keys do not cover the bare label "laptop". Later runs are green only because that job left the window; it will recur.

Job: in ci-budgets.json add runnerMultipliers key "laptop": 1 plus a "//runnerMultipliers-laptop" note, same shape and wording style as the laptop-medium note (self-hosted, priced 1, over-counts never under-counts, cite run 43781669007). Also add "acer-web": 1 and "dell-web": 1 with one shared note "//runnerMultipliers-web-hosts" (WEB_RUNNER_LABEL=acer-web in use; route-runner.mjs lists acer-web,dell-web as self-hosted web hosts; same pricing logic). Touch nothing else. Check JSON parses (node -e "JSON.parse(require('fs').readFileSync('ci-budgets.json','utf8'))") and run the check-ci-budget unit test if one exists. Docs/config-only PR: delete the Phone QA section of the PR body.
