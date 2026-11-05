# Design record: organiser page P2 Team (owners, managers, listed people; Hide)

Author: website-18. Status: DRAFT for the lead (design is the lead's call), NOT yet independently critiqued. Mock-up: five states A-E at 390 wide, kept by website-18 as `p2-team-mockup.html` (scratchpad; to be published as an artifact after critique).

## INVENTORY (admin + current Website + public page)
| # | Surface | Where | What it does today | In P2? |
|---|---|---|---|---|
| 1 | Public Team section | Website `src/modules/profile/OrganiserTeamSection.tsx:37-79` (P1 branch) | 3-col grid of 64px ringed circles, serif "Team" heading, no roles, "+N more" via `team.overflow` (:50, :72-76), error line :39-48 | Yes: remove the overflow button; add the solo line |
| 2 | Team mapping | `src/modules/profile/organiserTeam.ts:23` (TEAM_VISIBLE_CAP = 6), `:64` TeamMode, `:178` mode, `:182` solo line | order owners > managers > listed, solo/list/empty | Yes: drop the cap, keep solo/empty |
| 3 | Public data source | `src/pages/OrganiserProfile.tsx:715-728` (query key `organiser-lineup`, table `organiser_team_members`) | listed people only; owners/managers never read | Yes: swap to `organiser_public_team_v1` once #1259 is applied |
| 4 | Owner Team card | `src/modules/organiser/edit-in-place/TeamCard.tsx:12-21` | count line + "Add a person" | Yes: also says who is hidden |
| 5 | Owner Team sheet | `src/modules/organiser/edit-in-place/TeamSheet.tsx:82` (props), `:192` result list | add people only, no Hide | Yes: Hide / Show per row |
| 6 | Person's own "show me on the public team" | `src/modules/organiser/team/publicTeamApi.ts:36-46`, `:43` PUBLIC_TEAM_FULL ("already shows 20 people") | a person opts in or out; a 20-person limit on listed people exists | Parked: question Q1 below |
| 7 | Admin team tab | admin repo OrganiserTeamTab ("at least one Leader") | admin edits roles | Not changed; columns stay (#1259 review) |
| 8 | Person link | `ROLE_PAGE_BASE` in `organiserTeam.ts` | each person links to their own page | Unchanged |
Coverage: 8 rows, 8 handled or parked with a reason, none silently omitted.

## Chosen design (ONE)
Keep P1's look so the page has one voice: a grid of 64px gold-ringed circles with the name beneath, three per row, EVERYONE shown (no "+N more"). Public visitors see no role words and no owner or manager marker; the ORDER is the only signal (owners, managers, listed). Exactly one person: a single quiet line "Run by <name>" with a 40px ring beside it. Nobody: no section. Load error: the existing "Couldn't load the team. Try again" line.
Owner view (edit layer, never visible to visitors): list rows of a 40px ring, the name and a 44px Hide button. A hidden person stays in the owner's list, dimmed, with "Hidden from the public page" and a Show button. A manager sees no Hide button on an owner row.

## Alternatives (two lines each)
- A. Row list with a role word per person ("Owner", "Manager"): clearer for admins, but it breaks the owner decision (no role labels) and exposes internal roles. Rejected.
- B. Horizontal scroll strip of faces: saves height with 9+ people, but hides people off screen, is hard to tap, and "show everyone" suits a plain grid better. Rejected.

## Why
Matches the merged P1 section and the density rule (3-column mobile grid, p-3, text-sm), keeps taps at 44px, and shows exactly what the owner decided: one plain list, no labels, everyone, hidden people never seen.

## Open questions for the lead (not for the owner)
- Q1: the existing 20-person limit on LISTED public people (`PUBLIC_TEAM_FULL`) conflicts with "show everyone". Keep it or lift it? (It sits in `organiser_team_set_public_v1`, an admin RPC.)
- Q2: nine people is three rows at 3 columns; acceptable? No organiser has 4+ active listed people today.

## Self-running checks on the real build
Contrast of cream on black >= 4.5; every tap >= 44px; no sideways scroll at 390x844; states A-E all reachable; no text pointing at a missing control; empty state shows nothing rather than "No team".
