# Brief: P3 W4a FIX 1 (found in the orchestrator's 390x844 walk), Website, normal lane

Repo 123constante/bachata-website. Continue on `claude/p3-w4a-team-switch-page` (PR #1080, draft). Merge fresh `origin/main` first.

## What the walk found (walked as the walk test account, flags organiserP3 + organiserSelfServe, branch head fd48e83, screenshots at 390x844)
1. `/account/p3/you/page` (Organiser page): the page editor keeps the OLD black and gold R1 look. It is a black block inside the cream P3 frame (a colour seam; the Design Gate says no colour seams between surfaces). Mockup `mockups/p3-w4a/A.html` draws it in P3 cream/terracotta tokens. The page title ("test org") is also CLIPPED at the top edge of the black block (its top half is cut off under the header).
2. Same screen: a second "Team" row sits under the editor's own Team section ("On the team: 3 owners, 1 manager" + "Add a person"). Team is already one tap from the hub; two Team entries on one screen is clutter and "Add a person" duplicates Team > Add someone. Keep one: the editor's Team section may stay as information only, with ONE link to Team. Decide from A.html; say which in the PR.
3. Handover left-over #2: the Done screens after Remove / Make Manager / Hand over / Add / page Save still show the R1 look and "Back to Home" goes to R1 Home. In P3 they must use the P3 frame and return into P3 (Team / You).

The rest of the walk was clean: You hub, Team (4 people, owner view), Add someone: P3 tokens, no sideways scroll, 0 taps under 44px.

## Do
- Red first: table-driven test per screen x shape that fails for (a) a surface whose background is not a P3 token, (b) a title element overlapping the sticky header (assert the heading is not inside a negative-offset container), (c) a Done screen whose primary link points at an R1 path while `surface.kind === 'p3'`. Run them against the current code first and show them red.
- Fix by re-skinning through the surface/tokens already in `p3/you/surface.tsx` (no second token file). Behaviour, hooks, RPCs and R1 look with the flag off must not change (R1 tests unchanged).
- Re-run every CI job step that applies; per-job table in the PR body. One push at the end (Vercel cap), last commit ends with the done marker.
- Do not walk; the orchestrator re-walks.

## Do not
Merge, approve, touch Supabase/migrations, edit the density-exempt calendar files.
