# Brief: organiser public page - acceptance contract (docs only)

Lane: normal, docs only (no code, no database change). Model: Opus. Repo: 123constante/bachata-website. Work branch: claude/organiser-page-contract.

## Goal
Write the ONE whole-area acceptance contract for the organiser public page rebuild (owner rule: no build slice ships until it exists). Output: docs/organiser-page/ACCEPTANCE.md plus docs/organiser-page/INVENTORY.md. No source files.

## Decisions already made (owner, 2026-11-05; do not reopen)
- Hero is unchanged and perfect. Everything below the hero is reworked.
- Order: hero, stats strip, Get in touch (stacked rows: WhatsApp, Instagram, Website, Email; each row tappable with its own Copy button; empty rows hidden; no single main action), Team (one plain list, no role labels, owners and managers automatically, plus anyone listed; each person taps to their page; hidden people never shown), About (only if written), Next nights (when none upcoming: "Recently hosted" leads and one quiet line "No dates announced yet"), Past nights.
- Stats: first 3 that qualify of next night, tickets sold (100+), dancers came, nights hosted (>=5), weekly rhythm (4+ dates and >=60% on one weekday in the last 12 months), running since. Never 0, "--" or a placeholder; hide the strip if none qualify.
- Owner-only prompts like "Not added" never show to visitors; they live in the edit layer.
- Stored but not shown and PARKED (0 of 50 organisers have data): photo gallery, address, map link.
- Later slices: share button with tracked link, owner counts view (organiser analytics arc).
- Audience: visitors and organisers equally. Visitor goals: contact them, learn who they are, see next dates.

## Steps
1. INVENTORY FIRST. Write docs/organiser-page/INVENTORY.md: every field, state and option the admin app, the current Website and the public page support for an organiser, file:line cited (start from ~/.claude/plans/INVENTORY-organiser-public-page.md if you can read it, else rebuild it from src/pages/OrganiserProfile.tsx, src/modules/profile/organiserPublicProfile.ts, src/lib/organiserPublicCols.ts, src/modules/organiser/edit-in-place/*). Line numbers there are stale; re-derive them. End with a coverage count: N rows, N shown, N intentionally not shown with reason, none silently omitted.
2. Real-data shapes (read-only, counts only, Supabase connector SELECT only; prod project stsdtacfauprzrdebmzg): organiser x (has bio, has photo, links count, team size 0/1/2-3/4+, upcoming 0/1-5/6-100/100+, past 0/1-4/5+, claimed/unclaimed, ticketing yes/no, founded year yes/no). Put the table in the contract. Known: 50 public organisers (14 claimed); upcoming 0:23, 1:2, 2-3:2, 4-9:5, 10+:18; past 0:12, 1:6, 2-3:2, 4-9:7, 10-24:7, 25+:16; bio on 3; 1 organiser has ticket orders (8 total); team size 1:37, 2-3:13, none>3, none:4.
3. ACCEPTANCE.md: person types (anonymous visitor, signed-in dancer, organiser owner, organiser manager, a team member who is not a manager, admin) x journeys (find an organiser and see their next night; contact them; learn who runs it; see past nights as proof; share the page later; organiser edits their own page; organiser hides a person; unclaimed page with claim card) x data shapes from step 2. Each cell: expected result in one line plus how it is verified (unit matrix, browser walk at 390x844, or "not verifiable yet" with reason). Include empty/loading/error states (the page today shows a fake empty state when an RPC fails: write the expected error state).
4. Include the defect list from the old inventory that this rebuild must close (E1-E13: verified badge can never show, facebook not in the select, fake empty on RPC error, events filtered to organiser city, 365-day window, hardcoded "elsewhere in London", cancelled nights hidden, etc.), each with its disposition (fixed in slice X / parked).
5. PR: docs-only, normal lane, body from the repo template with Verified / Not verified (state: no browser walk, no code).

## What main lacks
- An acceptance contract for the organiser public page -- grep: docs/organiser-page
- extends: docs/organiser-rebuild/ARC.md only mentions the public page in passing

## Files
- docs/organiser-page/INVENTORY.md
- docs/organiser-page/ACCEPTANCE.md
- docs/handover/organiser-page-contract.md

## Hard limits
Docs only: no source, no tests, no migrations. Supabase read-only counts only, no personal data. Never merge or approve. One push.
