# ER-C4 (website-screen): session editor

Branch `claude/er-c4-sessions` from the ER-C3 branch `claude/er-s1-rules` (base it there; C3's pinned interface is in `docs/organiser-rebuild/er/handover/ER-C3.md`). Rules 3, 21, 22, 25, 27, 28; D1 gaps "Sessions". Read ER-COMMON first.

Build ONE reusable session card/sheet in a NEW dir `src/modules/organiser/sessions/` (used by create, event page, one date, festival days): type (six kinds), NAME (default per kind), start + end pickers (end lists only later times, wrapping past midnight marked "next day"), lesson quick lengths `45 min | 1 h | 1 h 30 | 2 h | Other` (default 1 h; end still shown as a time), level chips (multi, at least one, only Class + Masterclass), line-up SEARCH of existing profiles + "Recent" (last 3 used), label per kind (teacher/DJ/performer/judge), ROOM hidden until "+ Add a room", then every session in the same list shows the box, remove. "Add another session" starts where the previous ends; list in time order. Pure models in `sessionsModel.ts` using `shared/eventRules.ts`.

Tests: table over kinds x lengths x midnight wrap x levels x room-visible rule; impossible end cannot be chosen; focus moves into the sheet and Escape closes it. Touches only `src/modules/organiser/sessions/**`.
