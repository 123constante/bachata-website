# Handover &mdash; organiser page contract (dt_648e1a8ee97a)

Brief: `brief/organiser-page-contract:docs/briefs/organiser-page-contract.md`.
Branch: `claude/organiser-page-contract`. Docs only.

## Done
- `docs/organiser-page/INVENTORY.md` &mdash; 62 rows (stored fields, related reads, page states, edit layer), file:line on `main` `ba957d0`, coverage count, none silently omitted.
- `docs/organiser-page/ACCEPTANCE.md` &mdash; decisions, slices S1-S5, prod shape table, 6 person types &times; 8 journeys, page states, E1-E13 with dispositions.

## Findings worth knowing before building
- `organiser_profiles` has **no `facebook` and no `is_verified` column**: the Verified badge is dead code; Facebook only arrives through `socials`.
- `get_organiser_calendar_events_v1` scopes to the organiser&rsquo;s city slug and defaults to +365 d (seen in its definition): E4/E5 need an admin-repo RPC change.
- The calendar RPC is too slow to call for all 50 organisers in one SQL statement (timed out at 60 s); shape counts used the tables directly and are labelled as such.
- No hide-a-person control exists yet (Team sheet only adds); 55 inactive line-up rows already exist.

## Left / next steps
- Owner to confirm two proposals marked in ACCEPTANCE: E7 (show upcoming cancelled dates marked "Cancelled") and the "dancers came" threshold (proposed 20+).
- The old E1-E13 list could not be read (`~/.claude/plans` absent in the cloud worker); E8-E13 were re-derived from source. Compare with the owner&rsquo;s copy.
- Open an admin-repo ticket for E4/E5.

## Not verified
- No browser walk (docs only, no code). Per-organiser RPC counts not recomputed (timeout); brief figures quoted.
