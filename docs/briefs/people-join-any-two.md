# People join any two: two-profile search on the duplicates screen (preview, then confirm)

Brief-version: 2
Branch: claude/people-join-any-two
Lane: normal, Sonnet (no new rule: reuses a live RPC and the existing preview-then-confirm). Tier: normal, not hard tier.
REPO NOTE FOR THE LEAD: the duplicates screen is in the WEBSITE repo (src/modules/admin-organisers/duplicates/), not admin; only the RPC and its migration live in admin. This brief therefore dispatches to repo `website`. Owner approved model 2 on 2026-11-07 (one person id, find before create, one Join action). Report: C:/tmp/people-audit/REPORT.md step 1.
Blocked by: nothing. admin_join_duplicate_people_v1 is live on prod (migration 20261207440000). Does NOT need admin #1292 or #1297.
Do not collide with: READY-QUEUE row 119 (admin Merge Review "pair any two", needs #1292). Row 119 is the admin Merge Review screen, which records a verdict only; this brief is the Website duplicates screen, the only screen that can execute a join. Different repo, no shared file.

## What main lacks
- No way to pick two arbitrary people and join them: the duplicates screen lists only pairs the finder returns, and the finder needs both records ACTIVE on the same team (Florian's sign-up team row is off) -- proof: src/modules/admin-organisers/duplicates/duplicatesApi.ts fetchDuplicates (only source is rpc check_invitee_duplicates_v1)
- previewJoin and joinPeople take a DuplicatePair from the finder only -- proof: grep: `joinArgs = (p: DuplicatePair` at src/modules/admin-organisers/duplicates/duplicatesApi.ts
- A people search the admin invite flow already uses exists to reuse -- proof: grep: `admin_search_people_v1` at src/modules/admin-organisers/invitePersonApi.ts

## Files
- src/modules/admin-organisers/duplicates/duplicatesApi.ts, duplicatesModel.ts, duplicatesCopy.ts (JOIN_REFUSAL_COPY: every refusal code has copy), DuplicatesAlert.tsx, DuplicateReview.tsx (the preview-then-confirm panel)
- src/modules/admin-organisers/duplicates/__tests__/duplicates.matrix.test.tsx (the existing matrix to extend)
- src/modules/admin-organisers/invitePersonApi.ts (how the people search is called and shaped)
- Prod body of admin_join_duplicate_people_v1 (read-only pg_get_functiondef) and admin repo migration 20261207440000_admin_join_duplicate_people_v1.sql: refusal codes two_real_logins, no_signed_in_login, anonymous_login, keep_claimed_by_other, login_has_other_persona

## Build
1. A "Join two people" block on the same duplicates screen: two search boxes (Keep this one / Fold this one in), each using the existing people search; a result row shows name, city, Instagram if any, "has a login" or "no login", team pages count. Both slots must hold different ids.
2. "See what will change" calls previewJoin with the chosen pair (dry run, p_dry_run true). The existing DuplicateReview panel renders the change list and refusals. The real run happens only from the existing second confirm ("Yes, join them").
3. Reuse DuplicatePair, previewJoin, joinPeople, JOIN_REFUSAL_COPY unchanged; build a DuplicatePair from the two chosen results (keepId / foldId). One swap button (keep and fold), because the order decides which record stays.
4. Copy: every empty and error state says what the person CAN do (no results: "Try the first name or the Instagram"; refusal: the existing code copy). The button is disabled with a reason until two different people are chosen.
5. After a successful join, invalidate DUPLICATES_KEY and clear both slots.

## Tests (table-driven, red first)
Shapes (fixtures, not live writes): pre-made no login vs sign-up stub with owner seat (Florian shape); both logins have signed in (two_real_logins refusal); neither signed in (no_signed_in_login); same person picked twice (disabled); archived result; zero search results; search error; dry run returns an empty change list; join already done (idempotent answer). One mapping from refusal code to copy, asserted for every code, plus "no text points at a missing control". Untouched screen sends no RPC at all. Preview never calls the real run (assert p_dry_run true on every preview call; the real call happens only after the second confirm).

## Real-data check (read-only)
Florian test shapes: profiles 3c30fd5f (pre-made, no email, photo, Leader team row active) and f30ae44f (sign-up stub "Flori", Instagram, owner seat on East London Bachata). These ids are TEST SHAPES ONLY: describe the shape in the PR body from SELECT counts and put synthetic ids with the same shape in fixtures. NEVER run admin_join_duplicate_people_v1 with p_dry_run false against any real profile. The worker also does not run the dry run on them (needs an admin session); the lead walks the preview later. Any write to Florian's profiles needs the owner's separate yes.

## Tables touched (for ordering same-table work)
Read: dancer_profiles, person_roles, organiser_team_members, entity_members, auth.users (through the RPCs and the people search). Write: none from this PR's code except through admin_join_duplicate_people_v1 after the second confirm, which writes dancer_profiles, person, person_roles, organiser_team_members, member_profiles, admin_action_log. No migration, no new table.

## Must NOT do
- No migration, no supabase/** edit, no workflow edit, no .env*, no edit to perf-budgets.json or vite.config.ts.
- Never call the real join (p_dry_run false) from a test against a live client, a script, or a walk. Mocks only.
- No write to prod; Supabase read-only (SELECT counts only, no personal data in the PR body).
- Do not add a new join function or change the RPC; if the dry run lacks something you need, stop and write it in the handover (needs an admin brief).
- Zero bytes to the /app first load: `npm run check:bundle-budget` main vs branch; the screen is admin-only and must stay lazy.
- Standing header lines apply: push once, bot PR, never --no-verify, PR body "Verified on real data" with an honest "Not verified" (the dry run on the real Florian pair and the 390x844 walk are the lead's), end with [worker-done <ticket>].
