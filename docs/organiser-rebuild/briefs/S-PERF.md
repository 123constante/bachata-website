# Brief S-PERF -- "Add a performance" on the series Programme screen (Website PR #809)

Repo `123constante/bachata-website`, branch `claude/org-r1-integrate` (PR #809, head dcbce840; you push this branch, ONE push at the end, nothing before). Plain git, never `gh api`; shell commands without variables, loops or `$(...)`. Run the lint chain, typecheck, `npx vitest run src/modules/organiser src/modules/admin-organisers` and a PRODUCTION build (`npm run build`). GitHub Actions may be refused for billing: that is not a code failure; run every CI job step you can in your sandbox and put a per-job table (command, exit code) in your handover. Nothing on the owner's PC. Supabase read-only; no migrations here. Stay under 30% context. HTML entities in source. SMALL slice: finish fast, one push.

## The ask (owner, in his words, on the programme screenshot)
"You've got to add a performance." The series Programme screen offers "Add a class" and "Add a party" only. The per-date screen (`src/modules/organiser/dates/`) already knows the session type `performance` (`dateModel.ts`: a performance takes nobody from the add control; levels never show for a party or a performance, see `levelsByType.matrix.test.tsx`). The owner wants the same on the series programme.

## Do
1. `src/modules/organiser/events/ProgrammeSeries.tsx` (the add buttons, `START_SECTIONS`, `add(kind, type)`) and `programmeSeriesModel.ts` (`addSession`, `addRoleFor`, `setType`): add a third button "Add a performance" (name it exactly that) with test id `prog-add-performance`. Find out from the admin program tree what section kind a performance lives in (read `c:\dev\bachata-admin-11april` program tree code and the stored `program` shape; prod survey: counts only, which section kinds hold items of type `performance` today). Use that kind; do NOT invent a new section kind the admin editor cannot read back. Put the finding and the evidence in the handover.
2. A performance: no levels (shared rule, not a copy), no teacher/DJ add control with the existing reason line ("Performers and the MC are added by the Bachata Calendar team." is already in the model: reuse, do not retype), appears in the session type chips of the session sheet if the type list there is per-section; keep the existing types working. Sorting (S-SORT) applies unchanged.
3. Empty-state copy "No sessions yet. Add a class or a party so dancers see what is on." must now match the buttons on screen (add the performance). Disabled states keep their reason (festival/off).
4. Tests, table-driven, RED-FIRST (show failing on the current head): buttons present per mode; adding a performance builds the right item (type, section kind, no levels, people refused with the reason); the saved command carries it; an untouched programme still sends nothing; existing tests green. Mutate your own rule (put levels back on a performance; wrong section kind) and show each turns a test red.
5. Walk (390x844, prod build, mocked backend): one screenshot of the Programme with the three Add buttons and a performance row, `docs/organiser-rebuild/walk-PERF/a-programme-add-performance.png`; read it yourself.

## Rules
Nothing else changes (no clock picker: the owner chose to keep the phone's own time wheel; no copy or layout changes elsewhere).

## Report
Handover `docs/organiser-rebuild/handovers/S-PERF.md`: change (file:line), section-kind evidence, red-first counts, mutation table, per-job table, screenshot, Verified / Not verified. ONE push; last commit subject ends `[worker-done <ticket>]`; no `[skip preview]`.
