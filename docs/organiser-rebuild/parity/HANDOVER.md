# R-PARITY handover (ticket dt_938bdec512ce, 2026-10-17)

Done: read-only parity audit. Output `docs/organiser-rebuild/PARITY-GAP.md` (66 rows: 24 MATCH, 15 PARTIAL incl. 2 BROKEN-ON-PROD, 9 MISSING-ALLOWED, 11 MISSING-ADMIN-ONLY, 7 DROPPED-BY-DECISION), appendices `parity/commands-roles.md` and `parity/prod-counts.md`. No source file changed in either repo; prod used for SELECT counts only.

Heads audited: website claude/org-r1-integrate e04dea0, website main c36fbaf, admin main a12a21a6, prod ledger last 20261122370000.

Left / next steps (for the orchestrator, not done here):
1. Read `_cmd_series_upsert_p5` to settle whether R1 Details "Time" is a silent no-op on programme-timed series (see PARITY-GAP (d)).
2. Check whether the 50 legacy `organiser_team_members` rows grant edit via `_assert_can_edit_series_p5`.
3. Hide R1 "Move to another day" and the wizard's Go live until A1 (D39 / owner lifecycle) lands on prod.
4. Owner call on the MISSING-ALLOWED list in PARITY-GAP (a)/(b); the parity matrix in (c) is an outline only.
