# No event start time, Website Slice 3/3: display readers + add-date + dead code

Brief-version: 3
Branch: claude/no-event-start-time-web-s3
Size: 5 files, 400 lines
Repo: 123constante/bachata-website
Lane: careful. Model: sonnet. Owner clicks 2026-11-25 (DESIGN-REGISTRY row 'Organiser: no event start time'): an event has NO start time of its own; only sessions have times. Series columns default_local_start_time / default_duration will be DROPPED (not in this PR). Admin DB side is merged; read admin docs/handovers/no-event-start-time-d4a.md. Do NOT edit src/integrations/supabase/types.ts.
Build exactly the checklist. Anything else noticed: LIST in the PR, never change. PR body MUST contain a tap table (button | destination | old/new) for every changed screen at 390x844, and a keep-list test (every other badge/line/control on the changed screens unchanged). Never merge. Push once.
## Checklist
1. p3/v2/EveryBody.tsx:96-98 start/end: from first session start/end (no series column, no default_duration).
2. p3/v2/NightCard.tsx:101: fallback = occurrence materialised_start_utc, else first session; never series column.
3. flows/add/addModel.ts:128-131 + add/Time.tsx:56-78: time input no longer pre-filled from series time; empty box; typing a time still sets it on the new date. Done line 'Added - Fri 23 Oct' (+ ', HH:MM' only when typed).
4. DELETE dead code (no live importer; confirm with grep before deleting): shared/createModel.ts time fields/validators (keep createBlock), seriesModel.ts scheduleSummary/BasicsForm/basicsFormFromSeries/formToDraft, seriesCommands.ts BasicsDraft/basicsPayload/CreateDraft/FIELD_KEY time keys + the two upsert whitelist keys, events/seriesExtras.ts end-time editor, homeModel.ts:30 field, selfServeErrors.ts:249 duration mapping. Grep of default_local_start_time|default_duration in src/ non-generated must be 0 (or listed).
5. Tests updated.
## Size
Likely over 5 files: PUSH A PARTIAL (items 1-3 first), list the rest in the handover. Branch: claude/no-event-start-time-web-s3.
