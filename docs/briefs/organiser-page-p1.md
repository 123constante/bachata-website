# Brief: Organiser public page P1 (visitor page, Website only)

Brief-version: 2
Branch: claude/organiser-page-p1 (Website). Lane: normal. Model: Opus (new page logic wired to real data). Screen work: design record and walk required.
Contract (read first, do not reopen decisions): docs/organiser-page/ACCEPTANCE.md and docs/organiser-page/INVENTORY.md on main. Plan: ~/.claude/plans/luminous-crunching-goose.md (lead has it; the decisions are copied into ACCEPTANCE section 1).
Freeze: the lead pushes no Website PR and dispatches nothing while Vercel is paused (site 402). Dispatch this brief only after the lead says go.

## Goal (four lines)
1. Who: dancers visiting an organiser page, and the organisers who share it.
2. After: a visitor sees proof (stats strip), how to contact, who runs it, the next night, or Recently hosted when nothing is upcoming.
3. Worked if: no visitor sees 0, `--`, "Not added" or a fake empty state; every real shape reads credible (ACCEPTANCE section 3 shapes).
4. Limits: hero UNTOUCHED (except deleting the dead Verified badge, E1). No migrations, no admin changes. Page order: hero, stats strip, Get in touch, Team, About (only if written), Next nights, Past nights.

## What main lacks
- extends: src/pages/OrganiserProfile.tsx renders its own stats strip with 0 and `--` -- grep: is_verified
- the page does not use the merged stats mapping -- src/modules/profile/organiserStats.ts exports buildOrganiserStats (PR #1391, #1397) but no page imports it
- the page does not use the merged team mapping -- src/modules/profile/organiserTeam.ts exports buildOrganiserTeam (PR #1392) but no page imports it
- the empty-upcoming copy hardcodes "elsewhere in London" -- grep: elsewhere in London
- Get in touch is split rows plus "Online" pills, Instagram and Website have no Copy -- grep: Online

## Files
src/pages/OrganiserProfile.tsx
src/modules/profile/organiserEmptyState.ts
src/modules/profile/__tests__/organiserPage.matrix.test.tsx
src/modules/profile/OrganiserGetInTouch.tsx
src/modules/profile/OrganiserTeamSection.tsx
src/modules/profile/OrganiserStatsStrip.tsx
docs/design/organiser-page-p1.md
docs/handover/organiser-page-p1.md

Do not touch: src/modules/profile/organiserStats.ts or organiserTeam.ts logic (merged, reviewed; a change needs a stated reason in the handover), the hero block, the edit-in-place layer except removing owner-only prompts from the visitor render, any calendar density-exclusion file, perf-budgets.json, vite.config.ts, anything under supabase/.

## Step 0: INVENTORY CHECK (before any code)
Read docs/organiser-page/INVENTORY.md. Write a short coverage table at the top of the design record: for each of ACCEPTANCE sections 1 (decisions), 5 (J1-J8), 6 (page states) and 7 (E1-E13), one row: in this slice (S1/S2/S3/S5 part of P1) or parked, with file:line. End with a coverage count: N rows, N handled, none silently omitted.

## Scope of this PR (ACCEPTANCE slices S1, S2, S3-read, S5, and the S4 copy parts that need no RPC)
1. S1 layout + stats: mount buildOrganiserStats in a stats strip (first 3 that qualify, none = no strip), section order as above, delete the dead Verified badge (E1), remove owner-only "Not added" and "Just getting started" lines from the visitor render (E10).
2. S2 Get in touch: four stacked rows WhatsApp, Instagram, Website, Email. Each tappable, each with its own Copy button. Empty rows hidden; no row = no section. Facebook is NOT a row (E2 closed by decision). Contact RPC error shows a Try again line, never silently hides rows (E9).
3. S3 Team (read side): mount buildOrganiserTeam with the listed people the page already reads. Owners and managers are not publicly readable yet (needs an admin RPC; out of scope), so pass access as empty and state this in the handover. No role labels, each person links to their own page, section hidden when empty.
4. S5 page states: loading skeleton with the hero shape and no headings; entity read error shows "Couldn't load this organiser" + Try again, NOT "not found", no noindex on a transient error (E8); a failed feed shows that section's error line and never "No dates announced yet" and never a stat derived from the failed feed; every feed failing still renders hero + Get in touch + Team.
5. S4 copy only: nothing upcoming shows "Recently hosted" first with one quiet line "No dates announced yet"; replace "elsewhere in London" with the organiser's own city or no city (E6). City scope and window (E4, E5) need an admin RPC: NOT in this PR; record it in the handover as a ticket for admin.
6. E7 cancelled nights: the contract marks this as proposed and awaiting the owner. Do NOT build it. Leave cancelled handling as on main.

## Standing lines (do not retype elsewhere)
- Prove the data source first: read the live RPC bodies for the organiser read, contact RPC and calendar feed read-only on prod (project stsdtacfauprzrdebmzg), state in the handover which table/column each section depends on and who writes it.
- Zero bytes to the /app first load: run `npm run check:bundle-budget` on main and on the branch; never edit perf-budgets.json or vite.config.ts.
- Push rule: commit as often as needed, PUSH ONCE when coherent and tested; never add `run-ci`; one fix round after review is one more push.
- Design Gate: lead decides look and feel. Use existing DESIGN.md tokens and the compact density rules (3-column grids, p-3, text-sm); tap targets at least 44px with explicit px sizes (the site sets html font-size near 13.5px on phones). Design record docs/design/organiser-page-p1.md: chosen design, two alternatives in two lines each, why.
- HTML entities for punctuation in JSX (&mdash; &rsquo; &hellip;), never raw Unicode.
- Source files over 2 KB go through scripts/safe-edit.py or scripts/safe-write.py.

## Verification (all required before DONE)
- Shape survey on prod, counts only, no personal data, no write: reuse ACCEPTANCE section 3 and re-run it; state the date.
- Table-driven matrix `organiserPage.matrix.test.tsx`: every section x every shape (large ticketed 100+ upcoming; weekly class; brand new; past-only; no nights; no team; 2-3 team; feed error one section; every feed fails; entity read error; not found; loading). One shared mapping per fact; no text pointing at a missing control; empty states say what the person can do; red first for each E row on the unfixed code.
- Every CI job step that applies, run in the sandbox, per-job table in the PR body.
- Walk at 390x844 on prod-shaped organisers (one each: weekly with 100+ upcoming; past-only; no nights; 2-3 team). Attach pictures to the PR; measure no sideways scroll, no clipping, taps >= 44px, contrast >= 4.5.
- PR body from the repo template, Verified / Not verified block, honest.
- Independent critique by a different worker (impeccable-finish-reviewer) against the design record, ONE round; the orchestrator checks the fixes by script (re-run the reviewer's own checks).

## Stop and handover
Push once, write docs/handover/organiser-page-p1.md (what shipped, what is parked: E4, E5, E7, owners/managers on Team, hide-a-person, share link, owner counts), add the `[worker-done <ticket>]` marker to the final commit message, stop. At 50% context stop with the PARTIAL marker and a "what is left" list.
