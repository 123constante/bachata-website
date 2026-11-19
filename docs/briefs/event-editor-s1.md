# Brief: event editor S1, My events row gets readiness dots + quick actions

Class: BUILD-visual. Lane: normal. Flag: `VITE_ENABLE_ORGANISER_EDITOR_V2` (off by default; flag off = today's screen byte-for-byte in behaviour).
Design: canvas https://claude.ai/artifact/4DgYMBS3DnMewdw5jyXPt3 board 7, OPTION 1 (owner picked 2026-11-19). Registry row "Organiser Event Editor". Audit: docs/design/event-editor-job-audit.md.

## Build
File: `src/modules/organiser/events/EventList.tsx` (EventRow). Add, only when the flag is on, under the existing row:
1. Readiness dots (5): Name+date, Venue, Tickets, Classes/programme, Poster+text. Orange = filled, grey = missing; text "N of 5 ready" plus the first missing names ("Tickets missing"). Derive from data the list already loads (`eventsApi.ts`); if a field is not loaded, extend the existing query's select with explicit columns, no `*`, no migration, no new RPC. A dot you cannot derive honestly stays out and you report it (never fake).
2. Three buttons, 44px tall, explicit px: Edit (primary orange) -> `ORG_PATHS.event(series.id)`; Guest list -> existing guest list route if it exists on main, else hide that button and report; Cancel -> existing cancel flow route for the series.
## KEEP-LIST (must not change)
Name (15px, 2-line clamp), status chip from `lifeChip` with its tones, chevron, whole existing row still one tap target opening the event, `data-testid` values `org-event-row`, `org-event-chip`, `data-series-id`, Past collapsed section, empty/error/skeleton states. No date box, no venue (owner declined).
## Check
Unit test for the readiness derivation; 390x844 walk with flag on and off on prod-shaped data; screenshots in PR. English UK copy, `&mdash;`-style entities in JSX. One branch `claude/editor-v2-s1`, one PR, bot-authored.
