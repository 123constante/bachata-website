# BRIEF: welcome-w1-link-rel-fix (Website; fix round 1 on PR #1524; normal lane; Opus)

Brief-version: 2
Fix round for PR #1524, branch `claude/welcome-w1-link-rel` (push to the SAME branch, one push). Independent review: `docs/review/review-1524-r1.md` on branch `claude/review-1524-r1` (verdict PASS-with-fixes). Read it first.

## What main lacks
- The no-dates Instagram anchor on the DJ role page carrying the shared rel -- grep: PUBLIC_LINK_REL in src/components/dj/DjRolePage.tsx (absent on main)

## What to do (in order)
1. F1: on the DJ role page the no-dates anchor with `target="_blank"` is always the DJ's own Instagram URL (the in-app branch is a `<Link>`). Put `rel={PUBLIC_LINK_REL}` on it. In `tests/publicLinkRel.test.ts` set the DjRolePage row to the right user-link count and remove its exception row. Prove the test red first (revert the source line, see it fail).
2. F2: fill the PR body: remove every `TO FILL` line; add the changed/left table for every anchor in the original brief list; the per-job CI table; and a "Verified on real data" block with the read-only prod counts (live DJ rows 44, 7 with an Instagram per the review; recount yourself, counts only, no personal data, no writes) and a "Not verified" block.
3. F3: delete the 3-line placeholder handover or fill it with the real state.
4. N1: add a one-line comment at the two WhatsApp sites saying why they differ (app-built wa.me link, no user text).
5. `npm run test:unit`, `npm run lint`, `npm run pre-ship`. No other change.

## Files
- `src/components/dj/DjRolePage.tsx`
- `src/components/dj/DjTiles.tsx`
- `src/modules/person-page/worlds/dancer/DancerWorld.tsx`
- `tests/publicLinkRel.test.ts` (new on the PR branch)
- `docs/handover-welcome-w1-link-rel.md` (new on the PR branch)
