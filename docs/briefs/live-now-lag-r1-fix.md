# Brief: live-now-lag-r1-fix (WEBSITE docs only, Opus, ONE fix round on PR #1260). Branch claude/live-now-lag-r1 (continue it; never push another).

Context line: stay under 35% of your context; push + handover by 50%. Never merge/approve/--no-verify. Plain git only. Supabase READ-ONLY. Docs only. Calendar protected files read-only.

Independent review (BLOCK, two doc edits then PASS): `git fetch origin claude/review-live-now-lag-r1` then `git show FETCH_HEAD:docs/review/live-now-lag-r1.md`. Apply to docs/design/live-now-lag/PLAN.md, INVENTORY.md and the handover, nothing else:
F1. The "Live now" check reads a public `version` that does not exist (event_view_p5 and app/routes/event.tsx carry none; Done screen DoneState has no slug or saved version). Rewrite the check: it needs an admin migration adding `version`/`updated_at` to the public payload plus a loader change plus Done-screen plumbing; count that in option C's cost; reject comparing content fields (cancel-then-restore false positive).
F2. Option C's hard delete must be scoped to the EVENT tag only, not city-<slug> or seo-landing (re-read app/routes/api.revalidate.tsx:142, app/cacheTags.ts:174, app/edgeCacheControl.ts busy-route comment). Correct the cost ("one cold SSR") and risk claims; say what the city and SEO pages do instead (existing TTL / soft purge).
F3. Add the inventory omissions the review lists; recount surfaces honestly.
Also apply every other numbered finding in the review that is a doc edit. Handover docs/handover/live-now-lag-r1.md with Verified / Not verified. Commit subject ends [worker-done <ticket>]. Do NOT add the automerge-ok label.
