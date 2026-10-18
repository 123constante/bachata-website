# Brief AW1 -- admin migration: let owners and managers write the series programme, line-up and event organisers (parity wave 1)

Repo `123constante/bachata-admin`, branch `claude/org-r1-parity-aw1`, cut from `main`. Push that branch ONCE at the end (plus one PARTIAL push at the context limit; a continuation worker per slice is normal). Plain git only (never `gh api`), shell commands without variables, loops or `$(...)`, never `--no-verify`. The PR is opened by the bot (claude/** branch); never `gh pr create`.

READ FIRST: `docs/organiser-rebuild/briefs/00-COMMON.md` (Website repo, branch `arc/briefs-organiser-r1`), and the plan `~/.claude` is NOT visible to you, so the facts you need are in this file.

## Why (owner words, 2026-10-18)
"Be complete with all the features the admin editor has." The owner opened the admin editor on a phone and found the organiser editor missing: series-level sessions, line-up per person with role and level, and the event's organisers list. The earlier audit filed these as admin-only "keep"; that was wrong. The owner chose (click, 2026-10-18): widen **programme + line-up** and **co-organisers**; leave Featured/Promoted, promotion cadence, group chat, event type, format convert, rooms admin-only for now (waves 3 and 4).

## Server truth (prod, read 2026-10-18)
`apply_aggregate_write_p5` `v_owner_kinds` is today exactly these 12 kinds: series.upsert, series.add_date, series.remove_date, occurrence.set_time, series.set_lifecycle, occurrence.cancel, occurrence.set_override, series.skip_date, series.unskip_date, series.set_recurrence, series.stop_repeating, series.end_run. Per-date programme editing already has its own migration (`20261109560000_organiser_programme_date_edit_v1.sql`): read it first, it is the model for the daily-edit cap and the audit rows.

## Reserved versions (`next-migration-version.mjs reserve 2`, 2026-10-18), use exactly these
- `20261126220000_organiser_r1_parity_aw1_programme_v1.sql`
- `20261126230000_organiser_r1_parity_aw1_organisers_v1.sql`

## Build
1. **Programme + line-up (series level).** Add `series.set_program` (verify the exact kind name and payload in `00000000000000_baseline_prod_schema_v1.sql:38255` and the admin editor's save path; also any `series.set_program_people` style kind if the editor sends one) to `v_owner_kinds` for role owner AND manager, with the SAME guards the admin path has plus: (a) the actor must be owner/manager of an organiser linked to the series (reuse `_p5_actor_can_write_series` or whatever the existing owner arms call; never a new weaker check); (b) refuse on an ended series and on past dates exactly as `20261109380000_owner_past_date_and_ended_series_refusals_v1.sql` does; (c) count against the daily edit cap (`_assert_organiser_daily_edit_cap_p5`); (d) people ids must resolve to visible profiles only (no unlisted dancers named on a public page); (e) one audit row per command.
2. **Event organisers.** Widen `series.set_organisers` for owner only (NOT manager): an owner may add or remove organisers on their own event; never remove the last organiser; an owner may not remove THEMSELVES if they are the only linked owner; added organisers must be live pages. State in the PR how the existing `20261105860000_organiser_link_writes_p5_v1.sql` guard interacts.
3. **Read RPC** `organiser_series_cast_v1(p_series_id uuid)` (owner/manager/admin, read-only): returns the series' cast = people on the programme with `{ profile_id, display_name, photo_url, roles text[], sessions int }`, plus `recent_people` = the 12 people this organiser put on their last programmes (for the picker "RECENT"). Public-name rules as `_organiser_team_people_p5`.
4. Re-pin the guard `check_owner_command_allowlist_v1` (md5 + the guard table, see `20261121040000`) and `check_self_serve_contract_v1`; the guards must now fail if a kind is added to `v_owner_kinds` without the pin moving.

## Tests (RED first on the E2E project; paste the failing output before the fix)
- owner and manager: set_program on their own live recurring series OK; on another organiser's series refused; on an ended series refused; past date refused; manager refused on set_organisers, owner allowed; last-organiser removal refused; unlisted person refused; cap exceeded refused; audit row written.
- Prod-shaped shapes (read-only survey on prod, counts only, no personal data): series with 0/1/many sessions, with and without line-up, ended, draft, festival day tree (a festival's programme is a DAY tree; state in the PR whether owners may write it in this wave: DEFAULT = refuse festivals for owners, wave 3).
- `check:replay` green after both files; apply both to the E2E project (rehearsal); never to prod (the owner applies prod in the merge train).
- Run EVERY CI job step yourself (read `.github/workflows`), per-job table with command and exit code in the PR body (GitHub may refuse jobs for billing; that is not a code failure).
Handover `docs/organiser-rebuild/handovers/AW1.md` in the admin repo: done / left / CI table / red-first / Verified-Not verified / decisions with reasons. Context under 30%; PARTIAL at the limit.
