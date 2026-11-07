# People find before create (Website): /join/<token> must land on the existing person, never a second record

Brief-version: 2
Branch: claude/people-find-before-create-web
Lane: normal, Opus (touches the sign-in claim path: data integrity). Hard-tier files not expected; if the fix needs an RPC change, STOP and write an admin brief request in the handover.
Repo: Website. Owner approved model 2 on 2026-11-07. Report: C:/tmp/people-audit/REPORT.md step 6 and the review correction about the inline creator. The inline creator (lib/createInlinePersonForSession.ts) lives in the ADMIN repo, so it has its own brief: people-find-before-create-admin-inline.md. Two repos, two PRs.
Blocked by: admin #1292 merged AND applied, if you need its instagram-link rule (read its final claim_my_dancer_profile_v1 body first; if #1292 is not on prod yet, build only against today's body and say so). Does NOT depend on #1297.

## What main lacks
- A person who signs in through /join/<token> can end with a second record: the claim links ONE unclaimed admin-made profile by email only and otherwise leaves the auto sign-up stub -- proof: src/lib/claimMyDancerProfile.ts (statuses linked, already_linked, no_match, ambiguous, email_unproven, not_applicable)
- The join page runs the claim before reading the persona but does nothing different for no_match, ambiguous, email_unproven -- proof: grep: `claimAtSignIn` at src/modules/admin-organisers/join/JoinPage.tsx
- A person-bound invite carries person_profile_id and an email-bound invite carries an email, but the page never uses them to say "this is you" -- proof: src/modules/admin-organisers/join/joinApi.ts (organiser_invite_preview_v1, bind_organiser_invite_email_v1, redeem_organiser_invite_v1)

## Files
- src/modules/admin-organisers/join/JoinPage.tsx, join/joinApi.ts, src/lib/claimMyDancerProfile.ts and src/lib/__tests__/claimMyDancerProfile.test.ts, src/pages/AuthCallback.tsx (:86-:280, same claim order)
- Prod bodies, read-only: claim_my_dancer_profile_v1, organiser_invite_preview_v1, redeem_organiser_invite_v1, _dancer_profile_link_matches_v1
- SURVEY FIRST (counts only, in the PR body): open invites, split person-bound vs email-bound vs neither; for email-bound ones, how many have an unclaimed profile with that email; how many sign-up stubs (auto_stub) have an unclaimed same-first-name pre-made record (4 pairs per the audit).

## Build
1. Using only what the invite already proves (its person_profile_id or bound email), make the outcome table explicit: linked or already_linked continue as today; no_match with a person-bound invite is not presented as a new person, and the message says what happens next; ambiguous or email_unproven do NOT create or choose anything: show "We could not match you automatically. The organiser's admin can join you to your existing profile", with the one action available (continue to the organiser home).
2. NO new search over other people's data from a signed-in non-admin (privacy). Find-before-create on this route means using the invite's own person or email, never a search by name.
3. One shared mapping from claim status x invite kind to screen copy and next step (reuse CLAIM_STATUSES); every cell has copy that names a control on screen.

## Tests (table-driven, red first)
Claim status (6 + unavailable) x invite kind (person-bound, email-bound, neither) x signed-in shape (new login, login with empty same-id stub, login already claimed). No copy points at a missing control; empty states say what the person CAN do; the claim failing never blocks sign-in (existing contract kept); untouched page sends nothing extra.

## Tables touched
Read only from this PR: dancer_profiles, organiser invites (through RPCs), person. Writes only through the existing claim and redeem RPCs (dancer_profiles.claimed_by, person pointers, entity_members seat). No migration, no new table.

## Must NOT do
- No migration, no supabase/**, no workflow, no .env*, no perf-budgets.json or vite.config.ts edit; zero bytes to the /app first load (check:bundle-budget main vs branch).
- No name-based person search for signed-in non-admins; no prod write; Supabase read-only; never claim, link or join real profiles in a test or a walk.
- Do not change the claim RPC; do not block a sign-in on any failure.
- Push once, bot PR, never --no-verify; "Verified on real data" block with honest "Not verified" (the 390x844 walk of /join/<token> with a real invite is the lead's); end with [worker-done <ticket>].
