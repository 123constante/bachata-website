# Brief: organiser public page - Team list mapping (pure logic + tests, no screen)

Brief-version: 2
Lane: normal (no database change). Model: Opus. Repo: 123constante/bachata-website. Work branch: claude/organiser-team-mapping.
Everything you need is restated here (the plan lives outside the repo).

## Goal
One shared pure function that turns the people tied to an organiser into the single public "Team" list. It does NOT edit OrganiserProfile.tsx, any screen, or any RPC. The database half (one RPC that merges the sources and a hide switch) is a later admin slice; this function takes its output shape as input and also accepts today's two raw sources so the screen can use it before the RPC exists.

## Owner decisions (2026-11-05)
- ONE public list called "Team". No role labels (no Leader, Member, Owner, Manager, Teacher, DJ) on the public page.
- Members = anyone listed on organiser_team_members (all are dancer profiles; today 64 rows across 53 organisers; only 16 claimed by a login) PLUS every owner and manager of the organiser (entity_members: 22 owners, 45 managers) automatically, shown by their public name only (never email).
- Order: owners first, then managers, then the listed people by their sort_order, then name A-Z. A person who is in more than one source appears once, at the best rank.
- Each person links to their own page (dancer profile) when they have one; a person without a page is shown but not tappable.
- Hidden people never appear for visitors: hide can be set by the organiser's owners/managers or by the person themselves (input flag `hidden`).
- One person alone reads as "Run by <name>"; more than one is a list of chips; more than 6 shows 6 and a "+N more" expander (the cap is a named constant); zero people means the section is hidden for visitors and an "Add people" prompt for the organiser.
- Survey: 37 of 53 organisers list exactly one person; 13 list 2-3; none list more than 3; 4 list nobody.

## Input and output (define these types)
Input: `{ listed: [{ personId, name, avatarUrl?, slug?, sortOrder, hidden }], access: [{ personId?, userId, name, role: 'owner'|'manager', avatarUrl?, slug?, hidden }] , cap?: number }` (a person is matched across sources by personId; if an access row has no personId treat it as a distinct person).
Output: `{ people: [{ personId, name, avatarUrl, href|null, initials }], overflow: [...same], mode: 'solo'|'list'|'empty' }`. Initials fallback when no avatar. Names are trimmed; blank names are dropped (never render an empty chip).

## What main lacks
- A shared Team mapping module -- grep: organiserTeam
- The page today draws Leader/Member-tagged "Teachers & DJs" from a different mapping inside OrganiserProfile.tsx (around lines 700-725 and the TeamCircle component); that stays untouched in this slice.

## Files
- src/modules/profile/organiserTeam.ts
- src/modules/profile/__tests__/organiserTeam.matrix.test.ts
- docs/handover/organiser-team-mapping.md

## Steps
1. Read the current team fetch and rendering in src/pages/OrganiserProfile.tsx (query key 'organiser-lineup') and src/modules/organiser/edit-in-place TeamSheet so your input type matches real rows. Describe in the handover which exact fields feed each input.
2. Write the pure function and types. No I/O.
3. Matrix tests (red first): 0 people; 1; 2; 3; 7 (cap shows 6 + overflow 1); duplicates across sources; owner also listed (appears once, owner rank); hidden person; blank/whitespace names; very long name (unchanged, truncation is the screen's job); person with no slug (href null); unicode names; ordering ties; an organiser with owner+manager and zero listed.
4. Run the new test file and the repo gates your change needs; no screen change so no walk.
5. PR body from the repo template, Shape survey with the real numbers above, Verified / Not verified (not wired into the screen yet).

## Hard limits
Do not edit OrganiserProfile.tsx, perf-budgets.json, vite.config.ts or any admin file. Zero bytes to /app first load (module not imported by any screen yet). Never merge or approve. One push. ASCII punctuation only in source.
