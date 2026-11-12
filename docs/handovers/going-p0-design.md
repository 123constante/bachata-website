# Handover &mdash; Going P0 design (Design Gate stages 1&ndash;2)

PR #970. Brief: `brief/going-p0-design:briefs/going-p0-design.md` (blob bcd8973). Branch
`claude/going-p0-design`. Ticket dt_362edd249752. Docs only, no product code.

## Done
- `docs/going/shape-survey.md`: prod read-only survey (counts only).
- `docs/design/going/brief.md`: stage-1 brief.
- `docs/design/going/option-{a,b,c}.html`: 3 whole-feature options at 390px, each showing every
  required state; `gen-mockups.py` regenerates them.
- `docs/design/going/README.md`: plain-words A/B/C comparison and a suggested pick (A).

## Findings the build PR must handle
1. 0 of 271 upcoming live nights have anyone going; the all-time total is 7 attendance rows.
2. 30 of 170 dancer profiles are complete; 136 lack a dance role. "Finish profile" is the main path.
3. 3 of the 4 users who already said going have no complete profile (joined on `claimed_by`) and
   2 rows are `interested`. Decisions 2 and 6 need a data plan in the admin-repo migration.
4. There is no privacy column yet. "Show me as going" needs a new column and a faces RPC (admin repo).
5. Two write paths exist: `set_attendance` (series-level, used by FestivalHub / `useAttendance`)
   and `set_my_occurrence_attendance_p5_v1` (per night). Decision 3 means retiring the series-level one.
6. All 7 live festivals have exactly 1 occurrence today.
7. 42 future nights belong to `ended` series. They must show the ended state, not a live button.

## Not done / not verified
- No owner pick yet (stage 3). No product code, no tests (none apply to docs).
- Mockups were rendered with Playwright Chromium at 390px: no horizontal scroll, and screenshots
  were checked by eye. They have not been viewed on a real phone.
- The local git hooks are not executable in the cloud container, so pre-commit/pre-push did not run.

## Next steps
Owner picks A/B/C (or mixes) &rarr; stage 3 spec &rarr; admin-repo migration (privacy column,
faces RPC, complete-profile check on write, interested cleanup) &rarr; web build behind a flag.
