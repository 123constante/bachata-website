# Brief: review-1237-r1 (docs only; branch claude/review-1237-r1; Fable reviewing an Opus build)

Independent review of Website PR #1237 (branch claude/p3-landing): flag-aware organiser landing. While organiserP3 and organiserSelfServe are both on, every organiser door opens /account/p3, and /account/o/* redirects to the P3 equivalent; ?legacy=1 keeps the old area per tab until 2026-11-08. You change NO code. Your only push is docs/review/pr-1237-r1.md on claude/review-1237-r1.
Read: `git fetch origin claude/p3-landing`, `git diff origin/main...FETCH_HEAD`, the PR body, docs/design/p3-acceptance/p3-landing-HANDOVER.md and FIXLIST rows F-01..F-06.
Questions:
1. Flag OFF: is production behaviour byte-identical for every door (organiserHomeTo absent => /account/o, PublicClaimCard without ?o=)? Mutate the flag-off path and show whether the tests catch it.
2. Flag ON: every person shape (no page, 1 page, 2+ pages, helper/member, claimed by me, signed-out, unfinished dancer) x every entry (/account/o, /account/o/events/:id, old /account/new|series|team, claim sign-in landing, JoinScreens Done, DancerHome links). Any redirect loop, any dead end, any deep link that loses its id or query? Does the signed-out redirect run before AuthGuard and keep returnTo?
3. ORGANISER_AREA_HOME_PATH is a build-time constant over the exact `import.meta.env.VITE_X` form. Is it equal to organiserAreaHome(flags) in every combination, including when only one of the two flags is set? Could the production Vercel build env differ from the test stub?
4. Bundle: run `npm run build && npm run check:bundle-budget` on main and on the branch; confirm zero first-load bytes and equal chunk counts. Confirm no dancer-app file is touched (check:dancer-area-isolation).
5. ?legacy=1 per-tab sessionStorage: private mode / storage blocked, expiry after 2026-11-08 (London day), a stale tab. Is R1 still reachable and does it still work if someone needs it?
6. The lead DECISION D13: an unfinished dancer at /account/o now reaches P3 Welcome. Confirm the end-to-end description in the PR body is accurate; flag anything worse.
7. Data shapes: read-only SELECT (Supabase project stsdtacfauprzrdebmzg, counts only): organiser members per number of pages; anyone with an access request pending plus a page.
Output: verdict PASS / PASS WITH NITS / BLOCK, findings F1.. with file:line and a concrete failing scenario, an honest Verified / Not verified list. Commit subject ends [worker-done <ticket>].
