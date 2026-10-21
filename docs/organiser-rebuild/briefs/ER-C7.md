# ER-C7 (website-screen): New event

Branch `claude/er-c7-new` from the integration of C2, C3, C4, C5 (the orchestrator creates `claude/er-wave1` by merging those branches locally and names it in your prompt). Rules 3-6, 10, 12, 14, 17, 22, 26, 29; prototype New event steps (phone and desktop two panes with live "How dancers will see it" preview). Read ER-COMMON.

Rebuild `src/modules/organiser/flows/new/**` entirely (the rebuild owns it; Release B does not touch it): name, format (Weekly / One-off / Course = first date + weeks; Festival goes to ER-C10's flow entry), venue (C5 picker), first date, first session(s) (C4 card), flyer, How to pay (>=1 of Ticket link / Pay at the door / Bank transfer beforehand / Cash / Free), optional details step, review. NO start-time step, NO category. Publish = live at once; quieter "Save as draft"; blockers disabled with a reason, read from `series_go_live_check_v1` via `shared/goLiveCheck.ts` AND the local `eventRules` (both). Server pieces not landed: "server not landed" in the PR.

Tests: table over formats x blockers; no time input; untouched draft save sends nothing; the check reads the server result. Touches only `src/modules/organiser/flows/new/**`.
