# No event start time, Website Slice 1/3: new-event flow + Details row

Brief-version: 3
Branch: claude/no-event-start-time-web-s1
Size: 5 files, 400 lines
Repo: 123constante/bachata-website
Lane: careful. Model: sonnet. Owner clicks 2026-11-25 (DESIGN-REGISTRY row 'Organiser: no event start time'): an event has NO start time of its own; only sessions have times. Series columns default_local_start_time / default_duration will be DROPPED (not in this PR). Admin DB side is merged; read admin docs/handovers/no-event-start-time-d4a.md. Do NOT edit src/integrations/supabase/types.ts.
Build exactly the checklist. Anything else noticed: LIST in the PR, never change. PR body MUST contain a tap table (button | destination | old/new) for every changed screen at 390x844, and a keep-list test (every other badge/line/control on the changed screens unchanged). Never merge. Push once.
## Checklist
1. flows/new/NewFlow.tsx:265-271 + new/model.ts:45,108,120: REMOVE the step 'What time does it start?' (TimeStep, timeCommands, timeBlock, STEP_TITLE.time). Flow goes date step straight to the next step; step counter/progress copy adjusts, no dead-end.
2. NewFlow.tsx:338 + new/model.ts:111 Done screen: 'Live - Friday 23 October, 20:00' -> time part from the FIRST SESSION start if the event has one, else 'Live - Friday 23 October' (no dangling comma/dash).
3. events/Details.tsx:37,65-66,207 + events/eventModel.ts:436,455,489: REMOVE the 'Time' row (DETAIL_KEY.time, detailValue, detailCommand for time). Other Details rows untouched.
4. Delete unit tests that assert the removed step/row; add tests: step absent, Continue never blocked by time, Done line both cases, Details has no Time row, all other rows still render.
## Size
5 files + tests, max 400 lines. Branch: claude/no-event-start-time-web-s1.
