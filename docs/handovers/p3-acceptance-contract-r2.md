# Handover: P3 acceptance contract, round 2 (dt_93683599420d, 2026-10-30)

Branch `claude/p3-acceptance-contract-2`, built on `claude/p3-acceptance-contract` (round 1). Docs only: no `src/` change, no prod writes (Supabase SELECT only).

## Done
- `CONTRACT.md`: owner rules R1-R4 (series-edit preview, one account, old data accepted until edited, walk-first priority); extra-states matrix S-1..S-11; persons (e) J-e1..J-e8, (f) J-f1..J-f4, (g) J-g1..J-g6; cross-area J-x1 (old links/emails), J-x2 (public page matches); profiles J-p1..J-p6 and event editing J-v1..J-v9, severity rated. P1 marked: J-e8, J-x2, J-g1..J-g6, J-e4. Gaps G-16..G-27. Parked items (undo history, make a copy, bulk cancel/move) noted, not added.
- `INVENTORY.md`: E15-E18 (old bookmarks, claim/approval email, invite email, public event page). 65 rows.
- Coverage: **65 rows, 65 covered, 0 uncovered** (checked by script: every S/E id in INVENTORY appears in the Coverage table).
- `ACCOUNTS.md`: section 4 round-2 survey (counts only), section 5 seed specs for persons e, f, g.

## Key findings for the lead
- **G-19 (Critical, P1):** all 10 claimed prod pages have no completed onboarding row; every real organiser meets the gate.
- **G-16 (Critical):** owner rule R1 (preview with going people, this date / all dates) is not on main.
- **G-17:** auto-claim by email has 0 claim-email rows in prod and no `src/` reader.
- **G-18 (decision):** "two owners" is undefined; `claimed_by` is single.

## Not verified / left
- E15/E16 destinations and G-21 (admin-editor fields missing in P3) were not checked against code or the admin repo; they are marked unverified.
- J-g2 "manager edits page name/photo?" needs an owner decision.
- No accounts seeded, no browser walk; every Pass/Fail line is blank on purpose.

## Next steps
1. Owner: decide G-18 and the J-g2 manager row.
2. Lead: seed sections 2 and 5 of ACCOUNTS.md; rerun the survey on `[ACC]` pages.
3. Walker: P1 journeys first in R4 order, each under the S-1..S-11 states.
