# Brief: event editor S1 CONTINUATION (same branch claude/editor-v2-s1)

Class: BUILD-visual, lane normal. Design: canvas https://claude.ai/artifact/4DgYMBS3DnMewdw5jyXPt3 board 7 option 1 (owner pick 2026-11-19), DESIGN-REGISTRY row "Organiser Event Editor". Read docs/briefs/event-editor-s1.md and docs/briefs/event-editor-s1-handover.md on the branch first. Do NOT rebuild; continue from head e27b9a9c0.

Owner decisions (autopilot, 2026-11-19, reversible):
- Row shows 3 dots only: Name+date, Venue, Poster. Tickets and Classes dots come in S4 when that data loads. Text reads "N of 3 ready".
- Guest list button stays hidden (no route on main). Cancel and Edit both go to ORG_PATHS.event.

Left to do:
1. Flag-on render test for EventRow (dots, "N of 3 ready", Edit and Cancel 44px, keep-list testids org-event-row, org-event-chip, data-series-id) and flag-off test (original link unchanged).
2. Run npm run pre-ship; fix reds.
3. Open ONE bot PR titled "feat(organiser): My events readiness dots + Edit/Cancel behind editor-v2 flag (S1)". Body from ~/.claude/docs/pr-body-template.md; list gaps (no Tickets/Classes dots, no Guest list button). No walk needed: the orchestrator does the 390x844 walk.
Push once, handover update, then stop.
