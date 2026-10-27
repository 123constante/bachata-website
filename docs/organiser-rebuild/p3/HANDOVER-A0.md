# Handover: P3 slice A0 (survey + server contract)

Brief: `brief/p3-a0-contract:briefs/p3-a0-contract.md`. Branch: `claude/p3-a0-contract`.
Output: `docs/organiser-rebuild/p3/CONTRACT.md`. Docs only: no src, SQL or migrations.

## Done
- Prod shape survey (read-only SELECT, counts only, 25 Oct 2026), CONTRACT.md section 1.
- Screen → RPC map for every C3 screen and sheet (section 2).
- Gap contracts sized as admin migrations A1/A2/A3 (section 3): inputs, outputs, errors, ACL, idempotency.
- Per-gap breakage plus the CI checks to add (section 4).
- Conflicts with event-truth P1 and going/people (section 5).
- C3 open items in/out of P3 and three owner forks F1-F3 (section 6).

## Findings that change the plan
1. Per-date name, music, photos and price (`occurrence.set_override` `title`, `music_styles`, `gallery`, `passes`)
   are **already owner-writable** on the server. The public event page applies them. Only the Website
   key list and the calendar's music read are missing.
2. History (`organiser_series_history_v1`) and Undo (`organiser_undo_last_change_v1`, upsert only, 24h) are
   live and uncalled.
3. Live bug for admin: `_cmd_series_set_recurrence_p5` does not run `_validate_recurrence_payload_v1`.
4. `_command_failure_code_p5` has no `has_bookings` arm, so those failures are audited as `unknown`.
5. `admin_event_workspace_p5` returns only the 100 newest dates; one live series has 131.
6. PR #750 / `feat/event-truth-p1p3` does not exist on the remote.

## Left / next steps
- The owner answers F1 (Make a copy), F2 (500 note) and F3 (undo window).
- Admin repo: A2 R3 (workspace reader) first, then A1, then A3. Each migration ships with the
  section-4 contract checks.
- Website: first slice adds the `organiserP3` flag (`VITE_ENABLE_ORGANISER_P3`). Screens marked
  "Live" or "Web" in section 2 can start before any migration.

## Not verified
- The full bodies of `_cmd_series_upsert_p5`, `_cmd_series_end_run_p5`, `_cmd_series_restore_ended_p5` and
  `_cmd_series_set_lifecycle_p5` (only their raises and key lines were read). The owner allowlist for
  `video_urls` and the social keys is therefore unconfirmed.
- `organiser_home_v1` past its top-level shape.
- Whether `get_calendar_events_v2` applies session-override titles.
- The Stats view-count sources.
- The critique (#991), sim reports (#995-997) and test page (#1003) were not re-read. This slice worked
  from C3.md's fix-pass and open lists, which cite them.
- No browser walk, because there is no UI change.
