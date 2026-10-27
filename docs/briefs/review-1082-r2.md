# Brief: ROUND 2 review of the fixes to PR #1082 (P3 W3a) -- READ-ONLY, findings doc only

Repo 123constante/bachata-website. Review branch `claude/p3-w3a-details` at head 47e6753 (fix round 1 = commits c817401, 46e4efc, 47e6753) against `4da101f` (the head round 1 reviewed). You did not build it. You write ONE file on branch `claude/review-1082-r2`: `docs/reviews/1082-r2.md`. No source edits, no tests added, no DB write (Supabase read-only: function bodies and counts only, no personal data).

## Round 1 context
`git fetch origin claude/review-1082-r1` then `git show FETCH_HEAD:docs/reviews/1082-r1.md`: found stale-version save (1), Prices save that sends nothing (2), venue city left behind (3), false "someone else saved" after step 1 of 2 (4), festival `free` (5), caps (6), cover control (7); plus a bundle-budget overage. The fix table is in `docs/design/1082.md` "Review round 1". Fixes to findings are unreviewed code: review ONLY `git diff 4da101f..47e6753` first.

## Judge
1. For each r1 finding: really fixed? Trace it with a concrete input, not the test name. Did the new tests fail on 4da101f (the design record says 16 red)? Spot-check two by reading the test, not just the count.
2. NEW defects the fixes could introduce: (a) saving against the OPENED version while name is still sent: can a person with stale typing ever overwrite newer data (the design record says the opened version makes it impossible: verify against the prod `series.upsert` version check, read-only)? Is a stale save refused with plain copy and does "Start again from the saved version" work? (b) SessionSheet now saves typing against the version it began on and reuses the SAME key: could a legitimate re-save after the user edits more text reuse a key with a different payload (idempotency collision: what does the server do with a replayed key and a different body)? (c) `useEditForm.landed` moving the screen's version to a landed step: can that mask a REAL someone-else save between step 1 and step 2? (d) the place-city lookup: Save held while "Finding the place's city"; can Save stay held forever, or can a fast tap on Save beat the lookup? (e) `trayLines` emptying when the plan is empty: can a real change (e.g. clearing a field to empty, removing the only price, switching "It's free" off) be hidden by it so the person cannot save? Test the clear-a-field and remove-last-price cases explicitly.
3. Bundle: is the dancer-app first-load under the 374 KB pin without raising it (`perf-budgets.json` unchanged)? Is `useAreaLeaveBlocker` split a real fix or a pin dodge; does the P3 area stay lazy? Read the CI log of `bundle-budget` at head 47e6753 if it has run (`gh run list --branch claude/p3-w3a-details`).
4. Flag-OFF guarantee and scope: no P3 import in an always-loaded route; `/account/o` untouched; only W3a + W2d-nit files changed; append-only edits in shared P3 files.

## Output
Findings ranked most severe first, each: file:line, what is wrong, a concrete failing input, severity (blocks merge / fix before arc end / nit). Mark each CONFIRMED (you traced it) or PLAUSIBLE. End with "Not reviewed". Zero findings is valid if you say what you checked.

## Done =
Push `claude/review-1082-r2` once; final commit subject ends with the done marker from your prompt. Stop at 30% context with a PARTIAL marker.
