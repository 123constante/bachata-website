# Changelog archive (through 2026-06-27)

The hand-maintained changelog that used to sit in `CLAUDE.md`, kept here so the
entries are not lost. It is CLOSED &mdash; do not add to it. Use
`git log --oneline` for anything after 2026-06-27.

---

## Entries

- **2026-06-27 (latest)** Venue directory fix + durable visibility gate.
  `published` venues were hidden from `/venues` (stale `= 'dancer_ready'`
  literal in `get_public_venues_list_v3`). Added the canonical
  `venue_is_public(publish_state)` predicate (non-draft) and adopted it across
  the directory, detail (`get_public_venue_by_venues_id`, `get_venue_detail`),
  and search venue-section read paths; sitemap now gates on `!= draft`. New
  anon CI guard `scripts/check-venue-publish-gate.mjs` /
  `check_venue_publish_gate_contract_v1()` (#46). Admin migration
  `20260627120000_venue_is_public_predicate_and_gate_v1`.
- **2026-05-16** — Vendor team public display fixes (avatar, roles,
  broken link). About page stacked reveal layout (Approach D).
- **2026-05-14** — Raffle UI: Unicode mojibake fixed, tile layout fixes.
  Bento section titles moved outside cards.
- **2026-05-13** — Venue detail page redesign (Pulse venue). 6 bug fixes
  (breadcrumb z-order, heart/share, YouTube thumbnails, mojibake, recurring
  events). Vendor detail redesign.
- **2026-05-13** — db-contract-check.yml: migration-authority arc-closeout
  check added (check #18). `Website/supabase/migrations/` decommissioned.
- **2026-05-13** — epp.avatar_url drift contract check added (#15).
- **2026-05-13** — `event_view_p5` snapshot_compat shape: 3 callers of
  `get_event_page_snapshot_v2` migrated. Contract test extended (9/9 pass).
- **2026-05-07** — Phase C: occurrence-aware public schedule. `ScheduleBlock`
  uses `get_occurrence_program_v1` when `occurrenceId` in URL.
- **2026-04-30** — Source-integrity guardrail kit v3 (safe-write.py v2,
  PreToolUse hook, sha256 subprocess verify, session-lock advisory lock).

