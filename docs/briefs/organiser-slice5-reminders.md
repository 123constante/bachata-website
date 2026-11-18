# Organiser slice 5: automatic day-before Reminders (careful lane, two repos, two PRs)

Owner picks (2026-11-17, all clicks). Do not re-ask. No writing/messaging by organisers.
- Picked design: option A "One row on the night" (artifact https://claude.ai/artifact/M8YpzioKkeTV6FjvzThkKh; registry row "Organiser Reminders (slice 5)"). Switch row inside the One night screen: label "Reminder to buyers", send time, buyer count, "sent once".
- Default ON for every night. Organiser can switch it OFF (and back ON) per night.
- Sends 18:00 Europe/London the day before the night's date. DST handled in London time.
- Recipients: every buyer with a valid ticket (paid and free); not refunded, not cancelled. One email per buyer per night (dedupe across several tickets).
- Late buyers (purchase after 18:00 the day before) get nothing.
- Switch is read AT SEND TIME: off = nothing sent. Switching on after 18:00 the day before sends nothing (window passed).
- Email content, fixed, no organiser note: night name, date and time, venue, "Open my ticket" link. Plain, British English, `&mdash;` style entities not needed in email text but never mojibake.
- The separate onboarding "finish profile" 24h email (website-8e) is a different template; do not touch it.

## PR 1: admin repo (bachata-admin-11april), careful lane
Branch feat/organiser-slice5-reminders-admin. Run `node ~/.claude/bin/preflight.mjs admin` first.
1. Migration (assign real version via scripts/assign-migration-versions.mjs): per-night flag `reminder_enabled boolean not null default true` (find the right table: the per-night/occurrence row the One night screen reads; discover by reading the existing v3 functions the One night screen calls). A sent-log table (night id, order/ticket id, buyer email hash or id, sent_at, unique on night+buyer) so a re-run never double-sends. Explicit GRANT/REVOKE (no auto grants). RLS: organiser can read/set the flag only for own nights; log is service-role only.
2. RPCs (v3 style, SECURITY DEFINER, search_path set, explicit ACL): `organiser_night_reminder_get_v1(night)` returns {enabled, send_at, buyer_count, sent_at|null}; `organiser_night_reminder_set_v1(night, enabled)`. buyer_count = distinct valid-ticket buyers not refunded/cancelled.
3. Sender: edge function `ticket-send-reminders` (name starts ticket- so AUTHORITY edge_deploy_ticketing applies). Copy the Resend + x-cron-secret + vault pattern from supabase/functions/send-organiser-edit-digest (and its migration 20261109660000 for the pg_cron/pg_net job). Cron every 15 min; per night find those whose London send time (18:00 the day before) fell in the last 15 min and not yet sent; claim via the sent-log unique key BEFORE sending (idempotent); skip when flag off; skip tickets bought after the send time. Failure: record nothing, next firing retries within the same hour only. Graceful when Resend key missing: log, send nothing, never crash.
4. Tests: SQL replay proof (`check:replay` / prove job with run-ci label read AT HEAD), table-driven vitest/Deno for: default on, off, refunded, cancelled, free ticket, two tickets same buyer, late buyer, DST day (last Sunday of March and October), double firing.
5. Review: independent hard-tier reviewer `## Hard-tier: PASS` at head (dispatch-worker --review-of), then merge per AUTHORITY merge_admin. Apply to prod per migration_apply (MCP, read back, one log line). Deploy edge fn per edge_deploy_ticketing; RESEND key already exists, do not touch secrets. Real-data check: read-only counts of nights with tickets by status to prove buyer_count shape. Do NOT send a real email to real buyers during testing: test with the owner's own address only, or `?dry=1` mode that returns who WOULD get it.

## PR 2: Website repo (this repo), normal lane, after PR 1 migration is applied
Branch feat/organiser-slice5-reminders-ui. Run `node ~/.claude/bin/preflight.mjs website` first. Read `.claude/rules/design-density.md`.
- Row inside the One night screen (V2 organiser, flags organiserShellV2 + organiserP3 + organiserDash; off on live), per option A. Reads `organiser_night_reminder_get_v1`, writes `organiser_night_reminder_set_v1`. States: on / off / already sent ("Sent to N buyers at 18:00 on <weekday>") / window passed / no buyers yet ("Will send to everyone who has a ticket by 18:00 the day before"). Disabled control states always say why. Use full weekday names. 44px tap target, explicit px sizes. `&mdash;` entities in JSX.
- Saving untouched sends no command. Optimistic toggle with rollback on error.
- Consistency matrix vitest: every state x night shapes (past, today, tomorrow, far future, no tickets, sold out, cancelled night).
- 390x844 walk on prod-shaped data; "Verified on real data" block in PR body incl. honest Not verified.

Stop rule: PR 1 reaches reviewed + applied + deployed; PR 2 green. Partial = push with the PARTIAL marker and say what is left.
