# No event start time, Website Slice 2/3: remove 'usual time' idea

Brief-version: 3
Branch: claude/no-event-start-time-web-s2
Size: 5 files, 400 lines
Repo: 123constante/bachata-website
Lane: careful. Model: sonnet. Owner clicks 2026-11-25 (DESIGN-REGISTRY row 'Organiser: no event start time'): an event has NO start time of its own; only sessions have times. Series columns default_local_start_time / default_duration will be DROPPED (not in this PR). Admin DB side is merged; read admin docs/handovers/no-event-start-time-d4a.md. Do NOT edit src/integrations/supabase/types.ts.
Build exactly the checklist. Anything else noticed: LIST in the PR, never change. PR body MUST contain a tap table (button | destination | old/new) for every changed screen at 390x844, and a keep-list test (every other badge/line/control on the changed screens unchanged). Never merge. Push once.
## Checklist
1. flows/change/Time.tsx:97,197: REMOVE the 'Back to the usual time (20:00)' button and the own-time flag that shows it.
2. p3/v2/WhenSheet.tsx:68-73: REMOVE usualStart, ownTime, 'Back to the usual times' action (backToUsual/resetTimeCommand use here only).
3. p3/data/dateFacts.ts:56 + changeModel.ts:225 hasOwnTime: remove ownTime fact and helper if no other caller.
4. p3/data/home.ts:76-82: REMOVE the 'changed'/own-time marker; row time = that date's own start (first occurrence materialised_start_utc / session), never the series column.
5. Tests: no button, no marker, rest of sheets/home rows identical.
## Size
max 5 files + tests, 400 lines. Branch: claude/no-event-start-time-web-s2.
