# Brief: Organiser public page P2 (Team: owners, managers, listed people, hide a person; Website only)

Brief-version: 2
Branch: claude/organiser-page-p2-team (Website). Lane: normal. Model: Opus (data wiring plus a write control). Screen work: design record and walk required.
Contract (read first, do not reopen decisions): docs/organiser-page/ACCEPTANCE.md (section 1 Team, J3, J7, E11) and INVENTORY.md on main.
DEPENDS ON: admin #1259 APPLIED to prod (RPCs `organiser_public_team_v1` and `set_organiser_team_member_hidden_v1` exist, F1-F4 decided and fixed) AND P1 (#1399) MERGED. Do not dispatch before both. One Website branch at a time (Vercel deploy cap).

## Goal (four lines)
1. Who: dancers visiting an organiser page; organisers who own or manage it.
2. After: a visitor sees everyone who runs the organiser (owners first, then managers, then listed people), each linking to their page; an owner or admin can hide one person from that public list and show them again.
3. Worked if: owners and managers appear (P1 could not show them), nobody hidden or opted out appears, no role labels, no duplicate person, no empty heading, hide works at once and can be undone.
4. Limits: hero untouched; no migrations and no admin changes; the RPC contract is read-only input (do not change it); the F1 owner decision is whatever #1259 applied.

## What main lacks
- the Team section is fed only by listed people, owners/managers are never passed -- grep: access: \[\] in src/pages/OrganiserProfile.tsx (after P1)
- the public Team does not call the new RPC -- grep: organiser_public_team_v1 in src/ (expect 0 hits) and in src/integrations/supabase/types.ts (types regenerate in #1259 follow-up; check)
- the order rule cannot see roles because the RPC returns none -- grep: sort_key in src/modules/profile/organiserTeam.ts
- no hide control exists -- grep: set_organiser_team_member_hidden_v1 (expect 0); src/modules/organiser/edit-in-place/TeamSheet.tsx only adds people
- the edit layer team list does not show who is hidden from the public -- grep: hidden in src/modules/organiser/edit-in-place/TeamCard.tsx

## Files
src/pages/OrganiserProfile.tsx
src/modules/profile/organiserTeam.ts
src/modules/profile/OrganiserTeamSection.tsx
src/modules/profile/__tests__/organiserTeam.matrix.test.ts
src/modules/organiser/team/publicTeamApi.ts
src/modules/organiser/edit-in-place/TeamSheet.tsx
src/modules/organiser/edit-in-place/TeamCard.tsx
src/modules/organiser/edit-in-place/__tests__/ (one new matrix test for hide/show)
docs/design/organiser-page-p2-team.md
docs/handover/organiser-page-p2-team.md

Do not touch: the hero, src/integrations/supabase/types.ts by hand (regenerate only if the repo does it by a script), anything under supabase/, perf-budgets.json, vite.config.ts, calendar density-exclusion files.

## Step 0: INVENTORY CHECK (before any code)
Read docs/organiser-page/INVENTORY.md. Coverage table at the top of the design record: ACCEPTANCE section 1 Team lines, J3, J7, E11, and section 6 states that mention Team: one row each, in this slice or parked, with file:line. End with a coverage count: N rows, N handled, none silently omitted.

## Scope
1. Read side: call `organiser_public_team_v1(p_organiser_profile_id)` for the page; map rows (`person_id, slug, public_name, avatar_url, sort_key`) into the existing Team section. The RPC returns NO role, so the page trusts `sort_key` for order. Order rule (ACCEPTANCE, review finding F2): owners first, then managers, then listed people by sort_order, then name A-Z. Confirm the applied RPC returns that order (F2 fixed) and render in the order given; extend `organiserTeam.ts` only if it must re-sort. State in the handover which one is the single source of order.
2. No role labels, each person links to their own page via `slug`, avatar with initials fallback, section hidden when the list is empty, solo/list modes as `buildOrganiserTeam` already decides. Dedupe is done in the RPC; add a test that a repeated `person_id` renders once anyway.
3. Error state: if the RPC errors, show the section's own "Couldn't load the team" + Try again line. Never hide the section silently and never read an error as an empty team (same rule as E3/E9).
4. Hide control (J7): in the edit layer Team sheet, each person row gets Hide / Show for owners and admins only (same gate as `teamPickerAccess`; others see nothing). Calls `set_organiser_team_member_hidden_v1(p_organiser_profile_id, p_person_id, p_hidden)`. Result is jsonb: handle every refusal code the migration defines (read its body on prod/main first, one copy line per code, shared mapping, no text pointing at a missing control). A hidden person shows in the owner's sheet marked "Hidden from the public page" with a Show button; the public list updates at once (invalidate the team query). An owner cannot hide the last visible person by mistake without the result showing the empty state wording from section 6.
5. Do not remove the existing direct-table read of listed people until the RPC read is proven; keep it as the unchanged edit-layer source.

## Standing lines (do not retype elsewhere)
- Prove the data source first: read the live RPC bodies read-only on prod (project stsdtacfauprzrdebmzg); state which table/column each Team field depends on and who writes it.
- Zero bytes to the /app first load: `npm run check:bundle-budget` on main and on the branch; never edit perf-budgets.json or vite.config.ts.
- Push rule: commit as often as needed, PUSH ONCE when coherent and tested; never add `run-ci`; one fix round after review is one more push.
- Design Gate: lead decides look and feel. Existing DESIGN.md tokens and compact density (3-column grids, p-3, text-sm); tap targets >= 44px with explicit px sizes (html font-size near 13.5px on phones). Design record: chosen design, two alternatives in two lines each, why.
- HTML entities for punctuation in JSX (&mdash; &rsquo; &hellip;), never raw Unicode.
- Source files over 2 KB go through scripts/safe-edit.py or scripts/safe-write.py.

## Verification (all required before DONE)
- Shape survey on prod, counts only, no personal data, no write: per organiser, count of RPC rows (owners, managers, listed) and how many seats sit on an inactive team row; compare to the #1259 handover survey (41 of 60 owner/manager seats on an inactive row, subject to the applied F1 rule). State the date.
- Table-driven matrix: every Team state x every shape (solo owner; owner plus manager; 2-3 listed; 4+ over the cap of 6; person with no avatar; hidden person; opted-out person; duplicate id; RPC error; empty; loading). One shared mapping per fact. Red first for each new behaviour on unfixed code. A hide/show test for owner, admin, other-role, and signed-out (no control).
- Every CI job step that applies, run in the sandbox, per-job table in the PR body.
- Walk at 390x844 on prod-shaped organisers: one with owner+manager+listed, one solo, one with a hidden person (hide then show, on a test organiser the owner names; no write to a real organiser). Pictures attached; measure no sideways scroll, no clipping, taps >= 44px, contrast >= 4.5.
- PR body from the repo template, Verified / Not verified block, honest.
- Independent critique by a different worker (impeccable-finish-reviewer) against the design record, ONE round; orchestrator re-runs the reviewer's checks by script.

## Stop and handover
Push once, write docs/handover/organiser-page-p2-team.md (what shipped, what is parked), add the `[worker-done <ticket>]` marker to the final commit message, stop. At 50% context stop with the PARTIAL marker and a "what is left" list.
