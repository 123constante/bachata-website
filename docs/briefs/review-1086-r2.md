# Review r2: Website PR #1086 after fix round 1 (branch claude/ambassador-a1-build, head 88cfcec)

Independent re-review, zero context. Read `docs/reviews/review-1086-r1.md` (branch claude/review-1086-r1) = round 1 BLOCK, and the "Fix round 1" section of `docs/design/ambassador-a1-build.md`. Diff to review: `git diff 6240ab7 88cfcec`. Write `docs/reviews/review-1086-r2.md` on branch `claude/review-1086-r2`.

Stopping rule: this is the last review round. Verdict PASS / PASS with should-fix / BLOCK.

Check, with the read-only Supabase connector (prod stsdtacfauprzrdebmzg, SELECT only, counts only):
1. F1 fixed for real: an authenticated ambassador can SELECT their own `entity_members` row AND `cities` rows under the RLS policies actually live (read pg_policies for both, and for `cities` grants/policy). Column names `entity_id`, `entity_type`, `member_role`, `user_id` exist as used. Would the page work for the A0a-created ambassador (`admin_add_entity_member_v1` / `_entity_member_write_p5`: what exactly does it write: entity_type value, member_role value, any status/active column that the RPCs filter on and the page does not)?
2. Error handling: every string in decisionError/listError against the live function bodies; no path shows "connection" for a permission refusal; sign-in link target correct (buildSignInHref vs AuthGuard).
3. Gone path: item removed locally, no re-send; success path unchanged.
4. Currency/fixtures/100-cap copy as claimed; no raw Unicode symbols in JSX (use entities).
5. No regression: run the ambassador unit tests and lint on the branch; confirm bundle-budget/DB-contract reds exist on main.
6. Anything newly broken by the fixes (they are unreviewed code).
End with Verified / Not verified. Do not edit source; docs file only.
