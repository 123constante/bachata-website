# Brief: organiser R4, bring back "Removed from your events."

Repo: Website only. One PR, no migration, no flag change. Look: white + #C2410C, 390x844, plain words, no emoji, tap targets explicit 44px. Do NOT edit R4Shell.tsx or R4Night.tsx (other windows). End with the [worker-done] marker.

## Owner pick (2026-11-19, DESIGN-REGISTRY row "R4Events removed toast"; design = the old toast wording, no new mockup)
After a person removes an event, the Events screen shows the message "Removed from your events." (same words as the old screen).

## Reference
The old screen (git show d0da94da3^:src/modules/organiser/p3/screens/StatusSheet.tsx, line ~195, and its test screens/__tests__/archivedEvent.test.tsx line ~97): Remove navigated to Events carrying the text, shown as a status toast. Find where the R4 flow removes an event (src/modules/organiser/p3/r4) and where R4Events.tsx lands afterwards. If R4 Remove already navigates to Events, pass the text in router state and show it once in R4Events (role="status", 44px, disappears after a few seconds, not shown again on back/refresh). If R4 has no Remove, say so in the PR body and stop with no code change.

## Build
Smallest change. Matrix test: message shown once after remove, not on plain visit, not on reload. Real-data block: read-only prod counts only. Extras noticed: list in PR body, never change.
