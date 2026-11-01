# Handover: acceptance-contract-r1 (docs only)

Branch `claude/acceptance-contract-r1`. Brief: `docs/briefs/acceptance-contract-r1.md` on `brief/acceptance-contract-r1`.

## Done
- `docs/acceptance/INVENTORY.md`: 8 person types, 34 journeys, 18 data shapes (60 rows), prod counts, 6 inventory GAPs.
- `docs/acceptance/CONTRACT.md`: 54 contract rows (invite path first), 12 carrying a GAP, 1 OWNER-PHONE, GAPs ranked by prod counts, the 8-row screen quality bar.

## Verified
- Live function bodies read (SELECT on pg_proc): `_assert_can_edit_series_p5`, `_assert_can_edit_occurrence_p5`, `redeem_organiser_invite_v1`.
- Prod counts by read-only SELECT (counts only): series by lifecycle x format, empty organiser_ids, 100+ dates, cancelled, no cover, multi-organiser; page members and roles; invite states.
- Every test/spec file named in CONTRACT.md exists (checked by a find, not by reading each).

## Not verified
- No test was run. "COVERED" means a named test exists, not that it asserts the Expected cell; the reviewer must open five.
- No browser walk at 390x844.
- Prod flag values (`organiserP3`, `organiserSelfServe`, `organiserTicketing`) unknown, so which UI a real person sees is unknown.
- Some file:line cites are file-level only. Organiser page shapes (no photo / no contact) not surveyed.
- Whether invites are admin-issued by design (C17) and whether owner-on-redeem is intended (C12) are owner decisions.

## Next
1. Owner decides C12 (role on invite) and C17 (organiser-side invite send).
2. Independent reviewer checks CONTRACT 1a first.
3. Survey page shapes; confirm flags; build tests for GAP rows in rank order.
