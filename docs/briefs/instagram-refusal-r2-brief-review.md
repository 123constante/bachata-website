# Independent review of BRIEF r2 (read-only, no build)

Review docs/briefs/instagram-refusal-r2.md (branch brief/instagram-refusal-r2) against origin/main and prod (Supabase READ-ONLY, project stsdtacfauprzrdebmzg, counts/definitions only). It supersedes r1, which got BLOCK (docs/review/brief-instagram-refusal-r1.md on claude/review-brief-instagram-r1: read it first). Output docs/review/brief-instagram-refusal-r2.md on branch claude/review-brief-instagram-r2, verdict PASS / PASS WITH NITS / BLOCK, then stop. Do not build, do not edit the brief.

Check with file:line or SQL evidence:
1. Are all r1 findings F1-F9 actually fixed in r2, none misapplied?
2. Commit A: where does the person flow keep its step list (personModel.ts, PersonFlow.tsx, personApi.ts, OnboardingFlow.tsx on main)? Is a new DJ step feasible there? Where does _onboarding_missing_v1 read dj_answer and dj_genres, and which existing write path sets them (does the Teach step's save path or an RPC like set_my_role_intent_v1)? Can the step satisfy the missing codes with no migration? If not, say exactly what is missing.
3. Commit A Instagram row -> /app EditScreen with returnTo: does EditScreen or the /app router support a return target today? How big is adding one? Is /app reachable for a person who is mid-onboarding under the gate (organiser_onboarding_gate ON)? Any route guard or flag that would bounce them?
4. Commit B: read dancer-app delta builder (dancerEditorPayloads.ts / delta.ts / api/rpc.ts) and say whether {instagram: link, website_url: null} actually reaches v2 as written. Verify v2's handling once more on prod (pg_get_functiondef).
5. Commit C: confirm 23505 text/shape as surfaced to the client (error object fields) so the mapper can match the index name.
6. Anything the owner decisions in r2 section "Owner decisions" contradict in code; missing acceptance cases; wrong paths. Number findings, evidence each, under 2 pages.
