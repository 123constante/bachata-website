# No event-level start time, CODE-WEBSITE: organiser area stops reading and writing the series default time

Brief-version: 2
Branch: claude/no-event-start-time-code-website
Size: 5 files, 300 lines (tests count inside; if over, push a PARTIAL and list what is left)
Repo: 123constante/bachata-website
Design: owner click 2026-11-25 (editor start warnings removed; organiser forms unchanged unless owner says) ; no mockup, invisible only.
Lane: careful. Model: sonnet. INVESTIGATE FIRST, build only the invisible part.

## What main lacks
Owner decision 2026-11-24: an event has NO start time of its own; only sessions have times; `materialised_start_utc` / `materialised_end_utc` on `event_occurrence_p5` are the derived cache. DB readers/writers are merged and applied. `event_series_p5.default_local_start_time` / `default_duration` and `event_occurrence_override_p5.custom_local_*` are about to be DROPPED. Owner click: public site shows the SAVED NIGHT time for starts and ends. Read `docs/handovers/no-event-start-time-d4a.md` in the ADMIN repo (123constante/bachata-admin) first.

## Files
Website files naming the columns (non-test): `src/modules/organiser/shared/seriesModel.ts` (26-28, 91-92, 298-299, 389-395: `scheduleSummary`, `basicsFormFromSeries`), `seriesCommands.ts` (29-30, 173-174, 312-315: create/edit payload), `homeModel.ts:28`, `createModel.ts`, `eventType.ts`, `selfServeErrors.ts:144`, `scripts/check-occurrence-p5-materialised-canonical.mjs`, plus tests/fixtures. `src/integrations/supabase/types.ts` is GENERATED: do not edit it.

1. INVENTORY FIRST: write INVENTORY.md (every time field, state and option in the admin app, the current Website and the public page, file:line cited, GAPs listed) BEFORE building, ending with a coverage count; it is the table below. READ-ONLY FIRST: for each use, say where the value comes from after the columns are gone (the workspace/home RPC output; query prod read-only via the Supabase connector for the current output keys of `organiser_home_v1` and the series workspace RPC, project stsdtacfauprzrdebmzg). Put the table in the PR body.
2. Where the same text can be shown from the saved night/session times (schedule summary line "Weekly · Sundays · 19:30–21:30"), switch the reader to that source with IDENTICAL output for existing data. Show a before/after table over real organiser series.
3. Writers: stop sending `default_local_start_time` / `default_duration_minutes` ONLY if the server already seeds the first session from the create payload another way. If removing them would change what an organiser can do or see (create form start/end fields, basics form time fields), DO NOT build it: open NO PR, post the findings as a comment on the issue and stop. That is a product decision for the owner.

## KEEP-LIST
Every organiser-screen field, label, badge and error message stays; no visual change. `selfServeErrors.ts` message text stays (only the match key may change if the server error name changes: state it).

## Checks the PR must show
`npm run test:unit` for touched tests (CI runs tsc); a grep of the four names in `src/` non-generated = 0 or listed; real-data before/after for the schedule summary.

## Rules
Push once. One PR, never merge. Handover lists: what was kept and why, anything not verified.
