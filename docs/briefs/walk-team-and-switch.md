# Brief: walk C -- a page-holder adds a teammate and switches between two pages (REPORT ONLY), Sonnet

Brief-version: 2

Lane normal, model Sonnet, branch `claude/walk-team-and-switch`. REPORT ONLY: no product code, no feature PR, no `.github/**`. Supabase read-only (prod `stsdtacfauprzrdebmzg`, counts only, no personal data). Under 40% context. Push ONCE; last commit subject ends `[worker-done <ticket>]`.

## Why
Owner goal: 10 real organisers claim a page and update an event. Many hold two pages or share one with a co-organiser. If Team, Switch page or You loses them, they stop. This walk ranks the dead ends in that area only.

## What main lacks
- a ranked dead-end report for Team (search a person, add a chip, requests badge), Switch page (2+ pages, Add a page) and You, with file:line -- docs/handover/walk-team-and-switch.md
- (optional) one phone spec for the 2-page switch and the team add on fake Supabase with 390x844 pictures -- tests/e2e-phone/walk-team-and-switch.spec.ts

## Files
- docs/handover/walk-team-and-switch.md
- tests/e2e-phone/walk-team-and-switch.spec.ts (only if no existing spec drives it)

## Do
1. Read: `src/modules/organiser/p3/you/YouScreen.tsx`, `youRows.ts`, `AddPageScreen.tsx`, `surface.tsx`; `src/modules/organiser/p3/screens/PageScope.tsx` (Switch page control, around lines 30-45); routes `youTeam`, `youTeamAdd`, `youTeamPerson` in `p3/shell/paths.ts`; `docs/design/p3-acceptance/AUDIT-team.md` and `docs/handover/organiser-team-mapping.md` for what is already known (do not repeat it; mark each known item still-open or fixed).
2. States: one page, two pages, page with 0 team, requests pending, owner vs admin vs member roles (`p3/model/roles.ts`), adding a person who has no account, switching while on a sub-screen (does it keep the person on that screen).
3. Run the existing evidence: vitest `p3/you/__tests__/`, `p3/shell/__tests__/P3Shell.test.tsx`, `screens/__tests__/pageScope.matrix.test.tsx`; phone spec `tests/e2e-phone/organiser-team-picker.phone.spec.ts`. Open every picture before describing it.
4. Prod SHAPES, counts only: organisers with 2+ pages, pages with 2+ team members, pending team requests.
5. Rank worst first (max 10) by "would an organiser give up here"; coverage count at the end (N states, N tested, N code-read only).

## Not verified (write this block honestly)
A real invite to a second person, real two-page accounts, real sign-in, a real phone. Fake Supabase and code reading only.

## Hard rules
Do not edit `src/**`. No ticketing or door files. Handover line `DONE [worker-done <ticket>]`.
