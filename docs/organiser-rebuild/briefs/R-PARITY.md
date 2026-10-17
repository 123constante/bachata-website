# Parity audit brief R-PARITY -- what can the admin event editor do that the R1 organiser area cannot?

Why: the owner opened the rebuilt screens on a phone and found things missing one at a time (for example, Change time shows one bare start time while the admin editor shows every session of the date). He should never have to list omissions. Our reviews compared the build to its own specs, never to the full capability set of the editors it replaces. This audit is the missing check.

Repos: `123constante/bachata-website` (branch `claude/org-r1-integrate`, head e04dea0) and `123constante/bachata-admin` (default branch). You are a READ-ONLY AUDITOR. You change no source file in either repo. Work on branch `claude/org-r1-parity` of the website repo (create from `claude/org-r1-integrate`); you commit ONLY `docs/organiser-rebuild/PARITY-GAP.md` (+ optional `docs/organiser-rebuild/parity/*.md`). Opus, xhigh. Plain git only, never `gh api`; shell commands without variables, loops or `$(...)`. Under 30% context; at 25% start nothing new; by 30% push PARTIAL. ONE push; last commit subject ends `[worker-done <ticket>]`. Supabase prod `stsdtacfauprzrdebmzg` is SELECT only.

## Sources of capability (build the full list from ALL of these)
1. The admin event editor in `bachata-admin` (find it: search `modules/` and `src/` for the event/series editor, create and edit forms, the program/sessions/lineup editors, venue, pricing/tickets, media, repeats/dates, visibility). Every field, toggle, list and action it exposes for an event / series / date / session / program item.
2. The previous organiser editor on website `origin/main` (`src/modules/organiser/events/EventEditorPage.tsx`, `EditorRows`, `EditorSheet`, `dates/**`, programme editors). Everything it let an organiser do.
3. The server: the series commands the admin and organiser actually send (`series.*`, `occurrence.*`, set_time, set_day, venue, programme, cancel, skip, end_run, etc.) and which of them an organiser (owner/manager/contributor) is ALLOWED by the RPC's access check. Read the RPCs in prod with `pg_get_functiondef` (SELECT) and the migrations in `bachata-admin/supabase/migrations`.

## What the R1 side is
`src/modules/organiser/**` on `claude/org-r1-integrate`: Home, New event (`flows/new`), My events / One event / Details (`events/`), Change a date (`flows/change`: which event, which date, what changes, time, day, venue), Add a date (`flows/add`), Cancel a date (`flows/cancel`), pause/end/put back, Team, My page + More, Cover (`flows/fix`). Also main's date page (`dates/`) is still reachable from R1.

## Output: `docs/organiser-rebuild/PARITY-GAP.md`
One table, one row per capability (be exhaustive; list all rows, even ones that match), columns:
`# | capability (plain words) | admin editor (file:line) | old organiser editor (file:line) | R1 screen that does it (file:line) or MISSING | an organiser may do it on prod? (RPC + role, file:line) | verdict | recommended default`.
Verdicts: MATCH / PARTIAL (say what is missing) / MISSING-ALLOWED (organiser may do it, R1 cannot: this is the list the owner needs) / MISSING-ADMIN-ONLY (organiser must not: fine) / DROPPED-BY-DECISION (cite the D-number from `R1-PLAN.md` or the brief; if you cannot cite one, it is NOT a decision: mark MISSING-ALLOWED).
Then: (a) a short ranked list of MISSING-ALLOWED and PARTIAL rows by how often a real organiser needs it (use read-only prod counts where useful: how many live series have 2+ sessions per date, multi-day, tickets, lineup, etc.); (b) for each, the smallest R1 change that closes it (screen, command, whether it needs a new read or an admin RPC change); (c) the TEST that would have caught it: a parity matrix (`capability x R1 screen`) the repo can keep, written as a table-driven vitest outline (names only, you do not write it); (d) Verified / Not verified.
Specifically answer: what does the date "sessions" model look like (class + social inside one date), what does the admin editor show for it, what can an organiser edit on prod, and what would "Change time" need to show it?

## Rules
- Never claim MATCH from a title; open the code and name the line.
- Every row cites file:line on BOTH sides, or says "not found" with the search you ran.
- No personal data in the report (counts only).
