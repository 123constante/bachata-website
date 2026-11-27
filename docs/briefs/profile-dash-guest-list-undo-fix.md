# Brief: admin PR #1577 guest list, add the Undo section (careful lane, continuation)
Branch: claude/profile-dash-organiser-guest-list-build (head c9911591). Repo bachata-admin. Push to this branch only; the PR is #1577.

## Why
Independent review verdict FIX, one blocker: the migration has no Undo section.

## Do
1. Add a pasteable Undo block to the guest list migration, in the same style as other admin migrations (copy the header/Undo convention from a recent merged migration):
   - DROP FUNCTION for all 17 functions: _guest_list_night_v1(uuid), _guest_list_team_role_v1(uuid[]), _guest_list_night_counts_v1(uuid,uuid), _guest_list_organiser_gate_v1(uuid,boolean), _guest_list_entry_gate_v1(uuid,uuid,boolean), organiser_guest_list_night_v1(uuid,text,text,integer,integer), organiser_guest_list_set_night_v1(uuid,boolean,integer,text), organiser_guest_list_add_v1(uuid,text,boolean), organiser_guest_list_remove_v1(uuid,uuid), organiser_guest_list_restore_v1(uuid,uuid), organiser_check_in_guest_v1(uuid,uuid), organiser_undo_check_in_guest_v1(uuid,uuid), organiser_guest_list_scan_v1(uuid,uuid), guest_list_night_public_v1(uuid), submit_my_guest_list_entry_v1(uuid,text), remove_my_guest_list_entry_v1(uuid), get_my_guest_list_entry_v1(uuid).
   - DROP the 2 new tables, the 3 added columns, and uq_guest_list_user_night.
   - GRANT SELECT back on whatever the migration revoked/narrowed.
   - Restore the 4 replaced function bodies (get_event_guest_list, submit_guest_list_entry, _claim_entry_slot_v1, _guest_list_door_headcount_v1) to their pre-migration bodies; the md5 pins are in the migration lines 40-45 (prod md5: edc71421, c13dbe7d, 82d5198f, d44dc72b). Take the bodies from prod (read-only) or the last migration that defined them, and check each md5 matches.
2. Order the undo correctly (restore bodies and drop dependents before dropping tables/columns).
3. Run the repo checks that cover migrations (replay proof job, header/undo checks); put the per-job table in the PR.
4. Merge current main into the branch if checks need it; assign migration versions with `node scripts/assign-migration-versions.mjs` if placeholders remain.
5. Do NOT apply to prod. Do NOT merge. Push once, then write the handover. Supabase read-only.

## Not in scope
No behaviour change to the functions. Names-public notice is a Website build requirement, later.
