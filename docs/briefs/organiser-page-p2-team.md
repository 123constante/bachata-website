# Brief: Organiser public page P2 (Team: owners, managers, listed people, hide a person; Website only)

Brief-version: 4 (v3 + 2026-11-05 22:30Z: reconciled with the F5/F6 RPC that #1259 actually applies; who may hide, self-hide, refusal codes, and how the sheet learns who is hidden)
Branch: claude/organiser-page-p2-team (Website). Lane: normal. Model: Opus (data wiring plus a write control). Screen work: design record and walk required.
Contract (read first, do not reopen decisions): docs/organiser-page/ACCEPTANCE.md (section 1 Team, J3, J7, E11) and INVENTORY.md on main.
DEPENDS ON: admin #1259 APPLIED to prod at or after the F6 fix (RPCs `organiser_public_team_v1` and `set_organiser_team_member_hidden_v1` exist; F1-F6 decided and fixed; review r4 PASS) AND the hidden-flag read in scope 4a below AND P1 (#1399) MERGED. Do not dispatch before both. One Website branch at a time (Vercel deploy cap).

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
docs/organiser-page/ACCEPTANCE.md (docs-only edit, see scope 6)
src/components/events/EventRow.tsx
src/components/events/SeriesDatesSheet.tsx
src/lib/__tests__/listImpressions.surfaces.test.tsx
docs/design/organiser-page-nights.md (read: chosen sizes)
docs/design/organiser-page-p2-team.md
docs/handover/organiser-page-p2-team.md

7. LARGER NIGHT CARDS (owner feedback 2026-11-05, design record docs/design/organiser-page-nights.md section 'Owner feedback'): resize `EventRow` IN PLACE (imported only by OrganiserProfile.tsx, SeriesDatesSheet.tsx and one test): poster 84px, date badge 38px with 17px day, name 17px up to two lines, grey meta 13.5px at .70 alpha wrapping to two lines (not truncated) so the city survives, tag 12px, chevron 22px, padding 14px, explicit px sizes. Re-check the dates-sheet rows and `listImpressions.surfaces.test.tsx`; walk at 390x844 with a 35-character venue plus city and a two-line name. This is SIZE ONLY: the nights feed swap (all cities, next 20, "next 20 dates" tag, "Showing the next 20 nights" line, city on each night) is a SEPARATE Website brief after admin `get_organiser_nights_v2` is applied.

Do not touch: the hero, src/integrations/supabase/types.ts by hand (regenerate only if the repo does it by a script), anything under supabase/, perf-budgets.json, vite.config.ts, calendar density-exclusion files.

## Step 0: INVENTORY CHECK (before any code)
Read docs/organiser-page/INVENTORY.md. Coverage table at the top of the design record: ACCEPTANCE section 1 Team lines, J3, J7, E11, and section 6 states that mention Team: one row each, in this slice or parked, with file:line. End with a coverage count: N rows, N handled, none silently omitted.

## Scope
1. Read side: call `organiser_public_team_v1(p_organiser_profile_id)` for the page; map rows (`person_id, slug, public_name, avatar_url, sort_key`) into the existing Team section. The RPC returns NO role, so the page trusts `sort_key` for order. Order rule (ACCEPTANCE, review finding F2): owners first, then managers, then listed people by sort_order, then name A-Z. Confirm the applied RPC returns that order (F2 fixed) and render in the order given; extend `organiserTeam.ts` only if it must re-sort. State in the handover which one is the single source of order.
2. OWNER DECISION: show EVERYONE, no "+N more" cap (remove TEAM_VISIBLE_CAP and the overflow path in organiserTeam.ts and its tests; update the matrix). Exactly one person still reads "Run by <name>". No role labels, each person links to their own page via `slug`, avatar with initials fallback, section hidden when the list is empty, solo/list modes as `buildOrganiserTeam` already decides. Dedupe is done in the RPC; add a test that a repeated `person_id` renders once anyway.
3. Error state: if the RPC errors, show the section's own "Couldn't load the team" + Try again line. Never hide the section silently and never read an error as an empty team (same rule as E3/E9).
4. Hide control (J7). WHO (v4, replaces v3's "owners and admins only"; the applied RPC is the truth and the UI mirrors it exactly, from ONE pure function `canSetHidden({callerSeat, callerPersonId, target})` shared by the sheet and its matrix test):
   - a seat OWNER may hide or show anyone on the team (incl. themself and other owners);
   - a seat MANAGER may hide or show listed people and other managers, NEVER an owner (RPC refusal `owner_protected`, hide AND show): no control is drawn on an owner row for a manager;
   - a person may hide or show THEMSELF only (the RPC's self arm); do NOT add a second self switch: the existing "Show me on the public team" (`organiser_team_set_public_v1`, team page) stays the person's own control, and the handover states in one line that the two are different facts (opt-out row vs hide flag) and the public list honours both;
   - a platform admin WITHOUT a seat is refused by the RPC (`not_allowed`); draw no control for them (admins hide via the admin app, J7 note);
   - everyone else (listed people on another's row, contributors, strangers, signed-out): no control.
   Calls `set_organiser_team_member_hidden_v1(p_organiser_profile_id, p_person_id, p_hidden)` -> jsonb `{ok, organiser_profile_id, person_id, hidden, changed}`. Refusals arrive as the error MESSAGE = code, HINT = plain words; the codes are exactly `not_signed_in`, `invalid_input`, `organiser_not_found`, `not_allowed`, `person_not_on_team`, `owner_protected`. ONE shared code-to-copy mapping (use the HINT as the base copy; unknown code falls back to the generic team error), one table-driven test over all six plus a network error. `changed: false` (already in that state) is success, no toast of failure. A hidden person shows in the owner's sheet marked "Hidden from the public page" with a Show button; the public list updates at once (invalidate the team query). If hiding would leave the public list empty, the section's own empty state wording applies (section 6).
4a. HOW THE SHEET KNOWS WHO IS HIDDEN (open dependency, found in the v4 re-read). `organiser_public_team_v1` returns only people who are SHOWN, and `organiser_team_public_hides` has no anon/authenticated grant, so the sheet cannot read the hides directly. Before dispatch the lead picks ONE: (A, recommended) a small admin addition: the owner/manager-readable members RPC the sheet already uses (`organiser_team_v1`) returns a boolean `hidden_from_public` per person (read-only, ACL unchanged, careful lane, own admin brief); or (B) derive it on the client: team people from the sheet's own read that are absent from the public RPC result AND have a visible named dancer profile are shown as "Not on the public page" with a Show button (imprecise: it cannot tell hidden from an inactive profile; the Show call would then answer `changed: false`). If neither is chosen the worker builds Hide only, with an undo toast, and parks "Show from a later visit" in the handover; do not guess.
6. ACCEPTANCE decisions to record in this push (owner clicks 2026-11-05, direct): E7 decided: cancelled nights are HIDDEN everywhere (as main, no change); E4 decided: show ALL the organiser's nights whatever the city, city named on each night; E5 decided: show the NEXT 20 upcoming nights whenever they are. E4 and E5 are built later by the Website switch to the admin RPC `get_organiser_nights_v2` (brief on admin branch brief/organiser-nights-feed); edit only the E4, E5 and E7 rows in section 7 of docs/organiser-page/ACCEPTANCE.md, nothing else in that file.
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
- Table-driven matrix: every Team state x every shape (solo owner; owner plus manager; 2-3 listed; 4+ over the cap of 6; person with no avatar; hidden person; opted-out person; duplicate id; RPC error; empty; loading). One shared mapping per fact. Red first for each new behaviour on unfixed code. The hide/show matrix is caller x target x (hide, show) with the SAME rows as the F5 matrix in admin tests/organiserPublicTeam.db.test.ts (owner, both, manager, optout, listed, stranger, no persona, signed-out) so the UI and the RPC cannot drift; each cell asserts control drawn or not, and for drawn cells the call and the list result. Include a seatless platform admin (no control) and a manager looking at an owner row (no control).
- Every CI job step that applies, run in the sandbox, per-job table in the PR body.
- Walk at 390x844 on prod-shaped organisers: one with owner+manager+listed, one solo, one with a hidden person (hide then show, on a test organiser the owner names; no write to a real organiser). Pictures attached; measure no sideways scroll, no clipping, taps >= 44px, contrast >= 4.5.
- PR body from the repo template, Verified / Not verified block, honest.
- Independent critique by a different worker (impeccable-finish-reviewer) against the design record, ONE round; orchestrator re-runs the reviewer's checks by script.

## Stop and handover
Push once, write docs/handover/organiser-page-p2-team.md (what shipped, what is parked), add the `[worker-done <ticket>]` marker to the final commit message, stop. At 50% context stop with the PARTIAL marker and a "what is left" list.
