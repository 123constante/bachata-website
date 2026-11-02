# Brief: review-acceptance-contract-r1 (WEBSITE, READ-ONLY REVIEW, Opus; builder was Sonnet). Branch claude/review-acceptance-contract-r1 -> docs/review/acceptance-contract-r1.md only.

Context line: stay under 35% of your context; push + handover by 50%. Never merge/approve/--no-verify. Plain git only. Supabase READ-ONLY (SELECT only). Docs only.

Review PR #1259 (branch claude/acceptance-contract-r1: docs/acceptance/INVENTORY.md and CONTRACT.md). Brief: git show origin/brief/acceptance-contract-r1:docs/briefs/acceptance-contract-r1.md.
Check:
1. Completeness: every person type x journey x data shape from the brief present? Count the rows yourself; is the coverage count honest and anything silently omitted (e.g. co-hosted, multi-organiser, empty organiser_ids, 100+ dates, cancelled, no contact, festival)?
2. Server rules cited correctly: re-read _assert_can_edit_series_p5 (owner/manager yes, contributor no, empty organiser_ids admin-only), redeem_organiser_invite_v1, claim_organiser_v1 from prod read-only. Any row whose "who can do it" is wrong.
3. Each COVERED row: does the named test or spec exist (grep it) and really assert that row? List rows marked COVERED with no real test.
4. GAP ranking: check the counts from prod read-only (counts only).
5. The 8-row Screen quality bar present and testable.
Deliverable: verdict PASS / PASS WITH NITS / BLOCK, findings ranked with file:line, honest Verified / Not verified. Commit subject ends [worker-done <ticket>].
