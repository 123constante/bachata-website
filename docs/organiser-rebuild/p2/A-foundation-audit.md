# P2-A FOUNDATION AUDIT (Website, Opus, careful lane, READ-ONLY)

Read `docs/organiser-rebuild/p2/COMMON.md` on this brief branch first. It is binding.

## Your job
Audit the FOUNDATION under the organiser area, on BOTH `origin/main` and the integrated rebuild head `origin/claude/er-c8-eventpage` (94a7e5ea). You are not judging single screens (the 8 ER audits did that); you are finding the structural reasons screens keep breaking, and what a rebuild can safely keep.

## Audit, in this order (file:line evidence for every claim)
1. **Routes and shell.** Every organiser route on main and on the rebuild head; the old-vs-rebuilt switch (`VITE_ORGANISER_REBUILD`, per-event allowlist); where old and new screens can reach each other (root cause of W1). Back/navigation model: history vs explicit parents; deep links; what happens on refresh mid-flow.
2. **Data layer.** Every way an organiser screen reads an event (`event_view_p5`, `admin_event_workspace_p5`, others) and saves one (`series_command_p5`, `occurrence_command_p5`, others, legacy writers). Count the distinct read and write paths per entity. Caching/query keys, invalidation after save, optimistic updates.
3. **State.** Draft, autosave, undo, dirty tracking ("untouched save sends nothing"), conflict when a co-organiser edits the same event, error mapping from server refusals to copy (root cause of W5).
4. **Data normalisation.** Where stored values meet UI options (music styles case W2, pay methods, levels, formats); is there one mapping per concept or copies?
5. **Components.** Inventory against Ember `DESIGN.md` and `src/modules/organiser/ui/**`: duplicates, one-off styles, hand-rolled sheets/lists/buttons, inconsistent labels (W3), tap sizes (W4), alignment primitives (W7), date formatting helpers (W6).
6. **Error / empty / loading patterns.** List each pattern in use; which screens lack one; do empty states say what the organiser CAN do; do disabled controls say why.
7. **Accessibility.** Tap >= 44px (site html font-size ~13.5px on phones, so rem lies), contrast >= 4.5, focus order, labels, sheets trapping focus.
8. **Performance.** Bundle per organiser route (run the build if your sandbox can, else estimate from imports), request waterfalls on the event page and home, 100dvh scrollers.
9. **Observability.** Sentry coverage of organiser screens and save failures; what an admin would see when an organiser hits an error.
10. **Tests.** Which tests walk real prod shapes, which are table-driven, which are vacuous (would pass on a wrong implementation). Run the organiser test files you can; report counts.
11. **Launch scope gaps** (from COMMON's owner answers): what in the foundation blocks courses ON, simple stats (views/saves), line-up from real profiles, co-organiser invites, instant publish, the 5-organiser pilot switch, non-London cities, and the connection to the invite journey (day-one takeover of an existing event).
12. For each of W1-W7: the ROOT CAUSE in the foundation (not the screen fix).

You may run read-only SELECT counts on prod to size a finding (counts only).

## Output (ONE file, ONE push)
Branch `claude/er-p2-foundation-audit` from `origin/main`. File `docs/organiser-rebuild/p2/AUDIT-foundation.md`:
1. **Owner summary** (max 15 lines, plain words): the 5 biggest foundation problems and what the rebuild must do about each.
2. **Gap list** table: id, area (1-11 above), severity blocker/major/minor, evidence file:line (main and/or rebuild head), what, failing scenario an organiser would hit, rebuild requirement in words.
3. **W1-W7 root causes** table.
4. **SALVAGE list** table: module/file(s), verdict KEEP AS IS / KEEP WITH CHANGES / DROP, reason, what tests prove it. Include server commands AD1-AD4 callers, `event-rules.json` + helpers, Ember ui primitives, the invite-journey pieces.
5. **Numbers**: read paths, write paths, component duplicates, test counts, bundle sizes.
6. **Verified / Not verified.**
Do NOT edit source, open a PR, or add labels.
