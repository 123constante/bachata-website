# Brief: P3 W4a re-skin Team, Switch organiser, Organiser page (Website, normal lane, Design Gate stages 1-2 first)

Repo 123constante/bachata-website. Branch `claude/p3-w4a-team-switch-page` from fresh main (other arcs keep landing on these screens, e.g. #737 team picker 10-27: re-read main at start and again before the PR).

## Goal
P3 (`src/modules/organiser/p3`, cream/terracotta, bottom tabs Home/Events/Stats/You) has no home for three old-area screens that earlier arcs (R1, people pages, invites) built and that still ship: Team (`src/modules/organiser/team`: team, team/:userId, team/add, handover/:userId, the person picker, PublicToggle), Switch organiser (`switch/`, incl. Welcome), Organiser page and profile (`page/`, `profile/`, cover/:seriesId; public `OrganiserProfile.tsx` is NOT in scope). Owner decision 2026-10-27: P3 re-skins them (order a: these three first). NO freeze: keep their behaviour, models, APIs and existing tests; change shell, placement, tokens and wording to P3's.

## Owner decisions (final)
- P3 theme tokens win; do not create a second token file.
- Keep every capability that exists today (parity): owners/admins roles, team picker + chip add, public toggle, handover, switch with welcome states, own-page editor fields. Inventory these from the code first.
- Placement is yours to propose in mockups (likely: Team and Switch and Organiser page under the You tab); the owner picks.

## Phase A (this dispatch): design only, nothing built
1. Inventory every route/state/action of the three areas (read-only; one table in the design record).
2. Design brief (5 lines) in `docs/design/p3-w4a.md`; 2-3 standalone HTML mockups at 390x844 in `mockups/p3-w4a/` covering every screen x shape (single-organiser vs multi-organiser user, owner vs admin vs member, empty team, team of 12, long names, no page yet vs published page, pending invites, error/loading). Every empty state says what the person can do; disabled controls say why.
3. Push, report. STOP for the owner's pick; a continuation dispatch builds.

## Phase B (later)
Build per pick; table-driven consistency matrix screen x shape; shape survey on prod first (Supabase MCP read-only, counts only, prod project stsdtacfauprzrdebmzg); walk 390x844 as the walk test account (flags organiserP3 + organiserSelfServe); contrast >= 4.5, taps >= 44px (public site html font ~13.5px on phones: use px sizes); independent critique; no regression on the old-area routes while organiserP3 is off.

## Do not
Merge, approve, touch Supabase/migrations, edit the density-exempt calendar files, or alter public profile pages.
