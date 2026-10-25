# Wave B0 (Website): organiser hygiene after admin waves A1-A5 (move date callers, friendly refusal text, venue city)

Lane: NORMAL (Website only, NO database change; context cap 50%, nothing new at 45%). Repo `123constante/bachata-website`, branch
`claude/wb-b0-organiser-hygiene` from `origin/main`. Opus. Bot-authored PR (`gh pr create` with the bot token only; never the MCP
create_pull_request tool). One slice = one branch = one push (Vercel cap). Never merge/approve. Supabase connector READ-ONLY.

## Why
Admin waves A1 (lock-downs), A2, A3, A4 and A5 are APPLIED on prod. They added server refusals that the Website does not yet explain, and one
Website caller still uses a command the server will later lock. Recorded as "Wave B Website tasks" in the orchestrator plan:
1. `eventModel.ts` (Website `src/modules/organiser/events/eventModel.ts`, remove_date callers near lines 236 and 248) still sends
   `series.remove_date`. Owner answer 20: organisers never delete dates. The replacement is `occurrence.move_date` (move) or `occurrence.cancel`
   (cancel) as the situation requires. Move the callers, then ADMIN will lock `series.remove_date` in a later wave (not your job).
2. Friendly text for the refusal codes `city_follows_venue`, `slug_admin_only`, `category_admin_only` (A1) in
   `src/modules/organiser/shared/selfServeErrors.ts`, plus the other new stable codes from A2/A3 that have no friendly text yet (list them from
   the admin handovers on `origin/main` of `123constante/bachata-admin`: `docs/briefs/er-p4-a1-lockdown-handover.md`,
   `er-p4-a2-series-owner-handover.md`, `er-p4-a3-occurrence-owner-handover.md`; e.g. `occurrence_cancelled`, `date_cap`, value-rule refusals for
   title / music / gallery / passes). Plain words, say what the person CAN do next (Design Gate rule: no dead ends).
3. Venue options: the venue chooser should carry the venue's `city_id` and the organiser-city fallback should be dropped (A1 review L2/L3). FIRST
   check whether the existing RPC the chooser calls already returns `city_id`. If it does, wire it. If it needs a DATABASE change, DO NOT build it:
   write it in the handover as "needs admin RPC change" and leave the code as is.

## Do
- Read `docs/ui-quality-bar.md` / the Design Gate notes in the repo first; wording-only changes still need the 390x844 look.
- Caller trace FIRST (grep the whole Website for `series.remove_date`, `removeDate`, the three codes) into the handover as a table.
- Table-driven tests: every refusal code -> one friendly string (no raw code ever shown, none that points at a missing control); every changed
  caller sends the right command with the right payload on each date shape (future scheduled, past, cancelled, added, one-off); an untouched save
  sends nothing. Red first for the callers.
- Do not edit a file another open Website PR owns: `gh pr list --state open` and name any overlap (open now: #1032 er-c8-eventpage, #1033-#1036
  parked front-door screens). If the file overlaps, narrow your change or stop and say so.
- Gates: run every CI job step from `.github/workflows/` in your sandbox, per-job table in the PR body; `tsc`, lint, unit tests, `check:integrity`
  equivalents the repo defines; the PR's own checks must be green. A walk at 390x844 is the orchestrator's job after your push: list the exact
  screens and clicks to walk in the handover.

## Output
PR body: what, why, caller-trace table, per-job table, Verified / Not verified. Handover `docs/briefs/wb-b0-organiser-hygiene-handover.md`.
Push once; last commit subject ends `[worker-done <ticket>]`; if you pass 45% context push a PARTIAL handover.
