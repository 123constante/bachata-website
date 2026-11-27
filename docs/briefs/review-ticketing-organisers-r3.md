# Brief: independent design review r3 (NARROW), ticketing price steps. Lane: careful (money), docs only, read-only. Opus.
Review, do NOT build. Different reviewer from r1/r2 if possible. Stopping rule: this is the last review round; judge only what is below.
Inputs (git fetch origin claude/revise-ticketing-design; head c22434908): docs/briefs/design-ticketing-organisers.md DRAFT 3, docs/briefs/contract-ticket-tiers.md DRAFT 5 s.0c, docs/review/ticketing-design-fixes-r2.md (closure table). Prior: claude/review-ticketing-organisers-r2 docs/review/ticketing-organisers-r2.md (+INVENTORY).
INVENTORY (first step): INVENTORY.md of the items you judge, file:line / prod function names, GAPs, then a coverage count at the end.
Judge:
1. N1 rollout (design s.3a phase table T1 -> T2 -> T4 -> T2b): walk EVERY phase boundary and prove no live call path (Website single body -> edge -> reserve v3; basket -> v4; v5) hits a revoked function or an edge refusal before its replacement is deployed. Check the new reserve_version marker design (ticket_orders column written 5 by v5 only): backfill, nullability, ACL on the column, does adding it touch a hot path.
2. N2 two checkpoints (s.3b): confirm against the live v4 body (prod pg_proc, SELECT only) that unit check after the seam and total check after the fee are reachable in v5 and still before capacity writes; refusal-row behaviour.
3. N3 ACL lists (s.5 T1, T2, T2b) complete vs prod default ACL; assertions and mutants real.
4. F10 decision (summaries v1/v2 PATCHED in T1 via CREATE OR REPLACE): is patching a function the Website calls inside inert T1 safe (same return shape, no price change while no steps exist)?
5. Spot-check that each r2 row in the closure table points at text that actually says what the table claims (quote 3).
Prod is read-only SELECT on stsdtacfauprzrdebmzg (function defs/ACL/counts; no personal data; never a write). Sandbox has only the Website repo; use the Supabase connector for edge source (get_edge_function) and DB.
Output: docs/review/ticketing-organisers-r3.md on your branch, verdict PASS or HOLD (with each remaining item marked BLOCKING or NOTE; BLOCKING only if it can lose money or stop sales), plus Verified / Not verified. Push to your branch only.
