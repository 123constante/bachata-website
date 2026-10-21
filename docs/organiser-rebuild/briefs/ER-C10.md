# ER-C10 (website-screen): festival

Branch `claude/er-c10-festival` from `claude/er-wave1` (named in your prompt). Rules 14, 15, 26; D1 gaps "Festival". Read ER-COMMON and ER-INTERFACE section 5.

NEW dir `src/modules/organiser/events/festival/**` (plus the create entry from New event's format step, wired through one exported component that C7 mounts): start date + number of days; ticket link ONLY (no pass editor, no other payment codes); every night listed with its own party hours (default 22:00-04:00), tap a night to change it, the open night offers "Use these hours every night"; add/remove a day, move the first day (counts as a change for "Update live event"); Party hours / Artists / Timetable / Flyer / Details / About Edit-bar entries; workshop timetable OPTIONAL, added any time incl. after Go live, using the C4 session card, with "Copy a day"; ONE artist list (search people, role Teacher / DJ / Performer) shown as the line-up. Festival `starts_at` is a TRUE instant (BST!): test across the clock change. Prod: 7 live festivals, median 6 sessions over 4 days, max 14; existing timetables kept untouched. Artist storage: server not landed.

Tests: table over day counts x timetable present/absent x BST boundary; untouched save sends nothing. Touches only `src/modules/organiser/events/festival/**`.
