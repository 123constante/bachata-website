# Brief: independent design review, ticketing price steps (row 310). Lane: careful (money), docs only, read-only.
Review, do NOT build. Inputs (read all): docs/briefs/design-ticketing-organisers.md, docs/briefs/contract-ticket-tiers.md (authored by another session; you are the different model).
INVENTORY (first step): write INVENTORY.md listing every field, state and option from the admin app, the current Website and the public page that touches price/tiers/steps, file:line cited, GAPs listed, BEFORE judging; end the review with a coverage count.
Check against origin/main (git ls-tree / git grep; read-only prod SELECT on stsdtacfauprzrdebmzg for function defs and counts only, no personal data, never a write):
1. price steps table + effective-price function: can a buyer ever pay a price the page did not show? price_changed refusal exact conditions; rounding; time zone of step boundaries; interaction with night-aware tickets (#1523 merged) and courses.
2. ACL: who can create/edit steps, GRANT/REVOKE list, RLS, SECURITY DEFINER search_path.
3. Reserve v1/v2 signature change: backward compatibility for callers on prod; webhook/refund paths using unit_price_pence.
4. Each finding: severity, file/function, concrete failing scenario, and a mutant or test that would catch it.
Output: docs/review/ticketing-organisers-r1.md, verdict PASS or HOLD, plus a Verified / Not verified block. Push to your branch only.
