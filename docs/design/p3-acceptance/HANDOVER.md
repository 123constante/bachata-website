# Handover: P3 acceptance contract (dt_77c2ccd7180f, 2026-10-30)

Branch `claude/p3-acceptance-contract`. Docs only: no `src/` change, and no prod writes.

## Done
- `INVENTORY.md`: 47 screen/route/sheet rows (S01-S47) and 14 entry points (E01-E14), with guard, entries, RPC reads and writes, states, and file:line. Gathered by reading the code at main 472ecde.
- `CONTRACT.md`: 10 universal rules, 25 journeys across people a, b, c and d (J-a1..5, J-b1..3, J-c1..7, J-d1..13), each with blank Pass/Fail lines. 15 gaps, each with a severity. Coverage: 61/61 rows, checked by a script that compares the Coverage table ids to the full S/E list.
- `ACCOUNTS.md`: prod shape survey (counts only) and the seed spec for 16 test accounts, plus the A-org-big series matrix.

## Not done / left
- Accounts are **not seeded**. The lead creates them (no prod writes allowed for workers).
- No browser walk. Every Pass/Fail line is blank on purpose.
- Copy in "quotes" was lifted from the source. Steps written in [brackets] have no fixed copy yet. Settle it when the gap or screen is fixed.
- Two sub-agents built the inventory by code reading. The file:line cites were spot-checked, not every one was verified.

## Next steps
1. Lead decides G-01 (Critical: organisers with a page cannot reach P3 from any UI path), then G-02, G-03 and G-10.
2. Seed the ACCOUNTS.md accounts. Rerun the survey query on the `[ACC]` pages and paste the counts.
3. A walker runs CONTRACT.md at 390x844 and fills in the Pass/Fail lines.


## Round 3 (2026-10-30)

People already in the system coming to join: [PEOPLE-INVENTORY.md](PEOPLE-INVENTORY.md), CONTRACT.md J-i1..J-i18, G-28..G-41, ACCOUNTS.md section 6. Handover: `docs/handovers/p3-acceptance-contract-r3.md`.
