# BRIEF: independent review of PR #1267 (Live now slice 1), round 1

You are a REVIEWER on a different model from the Opus builder. Read-only: you push only one file, `docs/review/pr-1267-r1.md`, to branch `claude/review-1267-r1`. Never merge/approve; Supabase read-only; no migration.

Target: branch `claude/live-now-s1` (PR #1267, head 9f0cd40). Spec: `docs/briefs/live-now-slice1.md` and `docs/design/live-now-lag/PLAN.md` option C steps 1-2 (git show from origin/brief/live-now-r1 and origin/main). Builder handover: `docs/handover/live-now-s1.md` on the branch.

Check, with file:line evidence, and RUN the tests:
1. With `stateChange: true` ONLY `[eventTag(id)]` is hard-deleted; the rest of the tag list is soft only; never the whole list (11 cold renders on a Hobby team over its CDN cap). Hidden-event path unchanged and checked first. Body without stateChange byte-identical in behaviour.
2. `.data` twin warm: canonical URL, no cache-busting query, no change to festival rows; hidden path warming a `.data` 404: is that harmful?
3. Is the NEW test file able to fail? Mutate the fix (e.g. hard-delete the full list; drop the warm; invert the boolean check) and report which mutants stay green. A mutant with zero failing tests is a finding.
4. Partial-failure route (hard ok, soft throws): correct status and CF purge scheduling?
5. Any path where a non-boolean/forged `stateChange` (string "true", 1, from a caller other than the admin emit) triggers a hard delete. Who can call /api/revalidate (auth)? 
6. TypeScript: branch must add 0 errors vs main (builder reported 104 on main).
7. Zero bytes to /app first load; CI steps that apply; PR body Verified / Not verified honest.

Verdict: PASS / PASS WITH NITS / BLOCK with numbered findings F1..Fn ranked, each with failure scenario. Stopping rule: one round. End the commit subject with the ticket marker given in your prompt.
