# Claim-first organiser invite: fix1 (CI reds on PR #1636)
Continue on branch claude/claim-first-organiser-invite (PR #1636). Previous worker finished (done e35892f7; main refreshed into the branch, head 0c8f5bd4). Fetch first.
Fix ONLY these two real `integrity` reds, nothing else, no scope growth:
1. src/modules/admin-organisers/join/ClaimFirst.tsx:17 `<img>` lacks a loading attribute (audit-images). Add loading="lazy" (or the form scripts/audit-images accepts; run it to confirm).
2. src/modules/admin-organisers/join/__tests__/claimFirst.matrix.test.tsx:107 the mock returns `organiser_id` and trips the no-legacy-organiser-fields guard (lint:architecture). Rename the mock field the guard accepts without changing what the test proves (check what the real redeem_organiser_invite_v1 response key is and use a key the guard allows, or build the key from parts).
Then run: npm run lint:architecture, the images audit, npx tsc --noEmit -p ., and the claimFirst tests. Also check contract-check at the new head and fix only if it names your files.
Gates: no RLS, no prod writes, no new flag. Push once, final commit subject ends "[worker-done <ticket>]". Update the PR body Verified/Phone QA lines (labels exact). Report head SHA, per-job checks, Verified / Not verified.
