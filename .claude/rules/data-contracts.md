---
paths:
  - "src/**"
  - "app/**"
  - "scripts/**"
---

# Data and telemetry contracts

*Scoped rule: loads only when work touches the paths above. Moved verbatim from
the root CLAUDE.md on 2026-10-02; still mandatory.*

## Calendar occurrence venue/city contract (mandatory)

`calendar_occurrences.venue_id`, `city_id`, and `city_slug` are NULL by default.
They may be set ONLY when `is_override = true`.

Read paths must use `COALESCE(co.venue_id, e.venue_id)`. All shipped public
RPCs already do this. Any new public read path touching venue MUST use the same
pattern.

Health check: none. `check_occurrence_venue_contract_v1()` and its CI step were retired with the legacy mirror (admin `20261107020000`).

## Profile view telemetry

Use `emitProfileView(profileId, type)` from `lib/profileViewEmit.ts` on
any surface that renders a clickable profile. This is the mandate, not
`PersonChip` (which is one packaging of the same call for schedule densities).

## Event view tracking

`lib/analytics.ts` → `record_event_view_v1` RPC. Session-deduped per UTC day.
Bot-UA filtered, admin sessions skipped.

## Day-rollover logic

`src/lib/programDayRollover.ts` — sessions starting 00:00–08:00 of the day
after event start belong to the prior day. This logic must mirror
`admin/lib/programDayRollover.ts` exactly. A CI check (#8) validates the
fixture parity between repos.
