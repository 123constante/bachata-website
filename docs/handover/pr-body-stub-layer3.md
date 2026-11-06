# Handover: pr-body-stub-layer3 (dt_f0316bca69d7)

Brief: `brief/pr-body-stub-layer3:docs/briefs/pr-body-stub-layer3.md` (v2). Branch `claude/pr-body-stub-layer3`.

## Done (scripts + tests, on this branch)
- `scripts/pr-body-stub.mjs` (new): `buildStub(branch)` + `main()` + `--self-test` (16 cases). Every heading,
  label and the marker are IMPORTED from `check-pr-real-data-verified.mjs` and `check-pr-phone-qa.mjs`;
  the test reads the source and fails if one is typed. `BRANCH=claude/x node scripts/pr-body-stub.mjs`
  prints the body; no BRANCH = exit 2. The intro no longer repeats the marker (old body said
  "Replace each TO FILL below"), so a body whose six lines are filled carries no `TO FILL` anywhere --
  the old intro would have kept `~/.claude/bin/auto-merge.mjs` (refuses `TO FILL` anywhere) refusing forever
  unless the session rewrote the intro too.
- `scripts/check-pr-phone-qa.mjs`: `MARKER = 'TO FILL'`; `parse()` now returns `{ ok, pending, problems }`
  exactly like real-data (marker lines on ANY section line -> pending, left out of label checks; pending only
  when every problem is a marker line; ok stays false). `main()` exits 3 with a PENDING log only when a UI
  path changed; docs-only stays 0 / not required. Self-test 28 cases (5 new).
- `tests/prBodyStub.test.ts` (new), `tests/phoneQaSection.test.ts` (pending block, mislabelled
  `Walked (note):` FAIL, 0/1/2/3 table), `tests/realDataVerified.test.ts` (the bot-body test now runs the
  generator instead of evaluating the inline yml array; every existing assertion kept; plus two
  workflow-shape tests: `bot-pr.yml wiring` and `phone-qa-section.yml wiring`).

## NOT done: the workflow part (worker rule: no `.github/workflows/**` edits)
The two wiring tests in `tests/realDataVerified.test.ts` are RED on this branch until the program lead
applies the diffs below to this branch -- they are the proof the diffs land. I applied both diffs
locally, all 228 related tests passed, both files parsed as YAML, then reverted them. The bot step's
body build and its fallback were also run in bash under `set -euo pipefail` (generator ok -> stub;
generator missing -> fallback minimal body).

```diff
diff --git a/.github/workflows/bot-pr.yml b/.github/workflows/bot-pr.yml
index 2b8e0b5..fb0a0e6 100644
--- a/.github/workflows/bot-pr.yml
+++ b/.github/workflows/bot-pr.yml
@@ -8,9 +8,11 @@ name: Bot PR for cloud branches
 # owner's merge) only ever opened empty duplicates (#547, #553, #554). New work goes on a new branch.
 # A PAT-opened PR fires the normal pull_request checks. The cloud session pushes and never
 # opens the PR itself; it may edit the body afterwards with `gh api -X PATCH`.
-# The body carries a `## Verified on real data` section set to TO FILL: real-data-verified
-# reports that as PENDING (a notice), not red, and no merge path accepts it. Sessions
-# REPLACE the three TO FILL lines; a second section is red ("appears 2 times").
+# The body comes from scripts/pr-body-stub.mjs, built from the checkers' own labels: a
+# `## Verified on real data` and a `## Phone QA` section, every line set to TO FILL.
+# real-data-verified and phone-qa-section report that as PENDING (a notice), not red, and
+# no merge path accepts it. Sessions REPLACE the TO FILL lines; a second section is red
+# ("appears 2 times"). If the generator fails the PR still opens with a minimal body.
 
 on:
   push:
@@ -28,6 +30,12 @@ jobs:
     permissions:
       contents: read
     steps:
+      # The default branch's scripts/ (the pushed branch's own copy for a claude/** push);
+      # read-only, nothing is pushed, so no credential is kept.
+      - uses: actions/checkout@v7
+        with:
+          persist-credentials: false
+
       - name: Open the PR as the bot if the branch has none
         env:
           BOT_TOKEN: ${{ secrets.BOT_PR_TOKEN }}
@@ -50,23 +58,15 @@ jobs:
             echo "No PR opened: $BRANCH already shipped in $merged. Put new work on a new branch cut from $BASE." >> "$GITHUB_STEP_SUMMARY"
             exit 0
           fi
-          node -e '
+          # One generator, pinned to both checkers by tests/prBodyStub.test.ts. The PR must
+          # always open: on any generator failure fall back to the old minimal body, warned.
+          if ! body="$(node scripts/pr-body-stub.mjs)" || [ -z "$body" ]; then
+            echo "::warning::scripts/pr-body-stub.mjs failed; opening the PR with the minimal fallback body (no Verified on real data / Phone QA sections)."
+            body="$(printf '%s\n\n%s' "Opened by the bot for cloud branch \`$BRANCH\` so the owner can approve it. The session fills in this description." "Raised by .github/workflows/bot-pr.yml.")"
+          fi
+          BODY="$body" node -e '
             const title = (process.env.SUBJECT || process.env.BRANCH).split("\n")[0].slice(0, 250);
-            // The section is pre-filled with the TO FILL marker so real-data-verified reports
-            // PENDING (exit 3, a notice) instead of RED until the session writes it. Pending is
-            // never a pass: scripts/check-pr-real-data-verified.mjs parse() keeps ok=false.
-            // tests/realDataVerified.test.ts evaluates this array, so keep the [ ... ].join shape.
-            const body = [
-              "Opened by the bot for cloud branch `" + process.env.BRANCH + "` so the owner can approve it. The session fills in this description.",
-              "Replace each TO FILL below in place; do not add a second Verified on real data section.",
-              "",
-              "## Verified on real data",
-              "- Shapes surveyed: TO FILL",
-              "- Checks run: TO FILL",
-              "- NOT verified: TO FILL",
-              "",
-              "Raised by .github/workflows/bot-pr.yml.",
-            ].join("\n");
+            const body = process.env.BODY;
             require("fs").writeFileSync("pr.json", JSON.stringify({ title, head: process.env.BRANCH, base: process.env.BASE, body }));
           '
           code="$(api -o resp.json -w '%{http_code}' -X POST "https://api.github.com/repos/$REPO/pulls" --data @pr.json)"
diff --git a/.github/workflows/phone-qa-section.yml b/.github/workflows/phone-qa-section.yml
index 516e3f8..0d38f2e 100644
--- a/.github/workflows/phone-qa-section.yml
+++ b/.github/workflows/phone-qa-section.yml
@@ -13,7 +13,8 @@ name: phone-qa-section
 # "not required" message from the script.
 #
 # NOT a required status check -- that is a branch-protection decision for the
-# owner. Draft PRs pass with a "skipped" message.
+# owner. Draft PRs pass with a "skipped" message. The bot's TO FILL stub on a UI
+# PR is PENDING (exit 3 -> notice), never a pass.
 
 on:
   pull_request:
@@ -70,4 +71,18 @@ jobs:
         env:
           PR_BODY: ${{ github.event.pull_request.body }}
           PR_FILES: ${{ steps.scope.outputs.files }}
-        run: node scripts/check-pr-phone-qa.mjs
+        # Exit 3 = PENDING: the bot's TO FILL marker (scripts/pr-body-stub.mjs via bot-pr.yml)
+        # is still in the Phone QA section of a UI PR. Reported as a notice and a non-failing
+        # run; it is NOT a pass -- the parser keeps ok=false. Every other non-zero code stays
+        # red. (This check is not in the main ruleset's required list; if it ever is, pending
+        # would satisfy it and must become red there.)
+        run: |
+          set +e
+          node scripts/check-pr-phone-qa.mjs
+          code=$?
+          if [ "$code" = "3" ]; then
+            echo "::notice title=phone-qa-section PENDING::waiting for the description to be filled in (TO FILL marker still present). Not a pass: no merge path accepts it."
+            echo "PENDING: waiting for the description to be filled in (the TO FILL marker is still in the Phone QA section)." >> "$GITHUB_STEP_SUMMARY"
+            exit 0
+          fi
+          exit "$code"
```

## Red first (against unfixed code)
New tests run before any script change: 22 failed / 126 passed (prBodyStub could not import; every
Phone QA pending case and the `pending: false` shape failed; the generator-based bot-body test and both
wiring tests failed).

## Mutants (each turned tests red, then rolled back)
| Mutant | Result |
|---|---|
| Phone QA `if (pending)` branch removed | 10 failed (8 beyond the 2 wiring tests) |
| marker counts as filled (`markerLines = []`) | 11 failed (9 beyond) |
| stub drops one label per section | 6 failed in prBodyStub + its own self-test 6 FAIL |

## Merge-path check (FINDING, not fixed -- scope)
`bot-automerge.yml` calls `scripts/automerge-classify.mjs`, whose only body check is
`if (realData) { ... v = realData(String(pr.body || "")) ... if (!v || v.ok !== true) no(...) }` with the
real-data parser. It never reads the Phone QA section or the marker. Proved with a node run: the new stub
with ONLY the three real-data lines filled (Phone QA still `TO FILL`), docs-only file, bot author +
`automerge-ok` -> `{"qualifies":true,"reasons":[],"classes":["docs"]}` while `body.includes('TO FILL')`
is true. Practical risk is low (auto-merge is docs/tests-only, where Phone QA is not required) but a
leftover `TO FILL` body can merge through `bot-automerge.yml`, unlike `~/.claude/bin/auto-merge.mjs`.
Suggested fix for a later brief: refuse any body containing the marker in `classify()`.

## Verified / Not verified
- Self-tests: real-data 18 PASS, phone-qa 28 PASS, stub 16 PASS.
- Stub through both checkers: real-data exit 3, phone-qa exit 3 on a UI PR, 0 docs-only. On main's
  phone-qa checker the same stub was exit 1 (the RED this fixes).
- Last three merged PR bodies (#1315, #1316, #1317, read via the GitHub MCP, section lines run as
  PR_BODY; #1316 abridged around the sections): real-data 0/0/0, new phone-qa 0/0/0, main phone-qa
  0/0/0 -- no behaviour change on real filled bodies.
- `npm run lint` 24 of 24; `npm run check:mojibake` clean; eslint on the 5 touched files clean;
  related vitest 226 pass / 2 fail (the wiring tests above, by design until the diffs land).
- NOT verified: the workflow diffs on a real Actions run (not applied); full `npm run test:unit`;
  typecheck of tests (tests are not in tsconfig.app.json); no independent `/code-review` round yet
  (stopping rule in the brief: one review, one fix round -- left for the lead); PR CI per job not read.

## Next steps (lead)
1. Apply the diff above to this branch; the two wiring tests go green.
2. One independent review, one fix round; owner Approves at the PR head (hard-tier).
3. Optional follow-up brief: marker refusal in `automerge-classify.mjs`.

## PR and CI
- PR: #1323 (opened by the bot from the first push; body replaced, both checkers exit 0 on it).
- automerge-ok NOT added: the PR changes `scripts/` (not docs/tests-only) and is hard-tier.
- CI per job: NOT read at the final head (a cloud worker cannot wait on runs). Expected: unit tests RED on
  the 2 wiring tests until the workflow diffs land; everything else as on main.

## Second finding (orchestrator prompt skeleton)
The dispatch prompt's PR skeleton heading `## Phone QA (only when a .tsx or .css UI path changed)` does
NOT match `HEADING_RE` (`^##\s+phone\s+qa\s*#*\s*$`): on a UI PR that body reports "Section ## Phone QA
is missing" (exit 1). It only passed here because no UI path changed. Fix the skeleton to a bare
`## Phone QA` (or loosen the regex in a separate brief).
