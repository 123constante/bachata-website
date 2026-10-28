# Brief: independent review of PR #1080 W4a, round 1 (Website, normal lane, Fable reviewer)

Review only; do NOT change product code. Branch `claude/review-1080-r1` carries one file `docs/review/pr-1080-r1.md`. Context cap 30%: push early. This is the FIRST independent review of W4a (builder: Opus; two fix rounds done).

Target: branch `claude/p3-w4a-team-switch-page`, head 9bf3884 (fetch it; it merges main, three conflict files `P3Routes.tsx`, `paths.ts`, `p3.css`: confirm both sides survived, W3a's `details`/`prices` routes and lazy screens included, one `lazyWithRetry` import). Read `docs/handover/` for W4a and `docs/design/` for its design record; the owner picked mockup A (You hub), Contributor sees Add someone disabled with a reason, P3 tokens win.

Check, with file:line evidence:
1. Data source first: read the live RPC bodies/policies read-only on prod (project stsdtacfauprzrdebmzg, counts only, never a write) behind Team, Switch page, Hand over, Welcome and Add someone; state which table/column each screen depends on and who writes it. Role rules: Owner / Manager / Contributor can only do what the RPC allows; the UI never offers what the RPC refuses.
2. Every screen x every role/shape: owner, manager, contributor; one team member; many; pending; the last owner; a person with several pages; no pages. No copy pointing at a missing control; every empty state says what the person can do; a disabled control says why.
3. Dangerous actions: Remove, Make Manager, Hand over, Leave: confirm text, double-tap safety, late result after navigating away, stale cache after success.
4. Fix-2 claims: lazy-loading puts /app first load back under 374 KB (`npm run check:bundle-budget`; main has about 10 B spare, so the merged head must add 0 bytes); page-editor org name readable (contrast), pushed screens open on a whole card clear of the top bar (`.p3-main-pushed`; the walker's screenshot is mid-scroll, so reason from CSS/DOM, not the picture), "Add a page" at least 4.5:1.
5. Known open (not findings): Done screen after team changes shows the R1 look; Account and help / Message us / profile wizard / Leave still R1 screens. Anything else is a finding.
6. Flags off = no change; density-exempt files untouched; no raw Unicode punctuation in JSX.
Verdict PASS / PASS with should-fix / FAIL, findings ranked, a concrete failure scenario each. No merge/approve. Final commit subject ends `[worker-done dt_<ticket>]`.
