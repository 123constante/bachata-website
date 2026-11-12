# Brief: Organiser dashboard slice 1, CONTINUATION (admin 1535), Website, normal lane, Sonnet
Branch: claude/profile-dash-organiser-build2 (already has dfaf651 model/view/flagged Home/tests and ac16b74 handover). Continue ON it; do not recreate. Open ONE PR for it (gh pr create may say it already exists because the open-pr workflow auto-opens one: then edit that PR body).
Read first: docs/design/pr-organiser-dash-handover.md and pr-organiser-dash.md on the branch, then the original brief: git fetch origin brief/profile-dash-organiser-build2; git show FETCH_HEAD:docs/briefs/profile-dash-organiser-build2.md (contract and the 9 fixes are inlined there). Cloud session cannot read bachata-admin issues.
Do, in order:
1. Wire the share handlers (real page link, night link, WhatsApp, caption sheet) using existing Website helpers; no fictional domains.
2. Flag: keep VITE_ENABLE_ORGANISER_DASH, default OFF is fine for merge, but every screenshot and test must run with it ON; say in the PR body how it is switched on.
3. Reads that do not exist (per-night opens, per-type clicks, Tickets tile): omit the tile, no DB change; list omitted tiles in the PR body.
4. Real-data shape survey (read-only SELECT, counts only), 390x844 screenshots of all 9 shapes (new, upcoming, zero, huge, cancelled, selling, loading, error, contributor), PR body with exact Verified on real data and Phone QA labels, npm run pre-ship, check:mojibake, tsc, per-job CI table.
Do not touch dancer files (branch claude/profile-dash-dancer-build1).
