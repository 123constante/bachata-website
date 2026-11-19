# Handover: event editor S1 (branch claude/editor-v2-s1)

Done: flag `organiserEditorV2` (VITE_ENABLE_ORGANISER_EDITOR_V2, off by default); `events/readiness.ts` + unit test; EventRow shows dots, "N of 3 ready" text, Edit and Cancel buttons (44px) when flag on. Flag off returns the original link untouched.

Reported gaps (brief rules):
- Tickets and Classes/programme dots left out: organiser_home_v1 does not load them (no migration/RPC allowed here).
- "Poster+text" is "Poster" (cover image only); poster text is not loaded.
- Guest list button hidden: no guest-list route in ORG_PATHS on main.
- Edit and the row link both go to ORG_PATHS.event (per brief).

Left: 390x844 browser walk (flag on/off) with screenshots; flag-on render test; owner to decide on extending the payload for Tickets/Classes.
