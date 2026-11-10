# Brief: revise the ticketing price-steps design for review r1 (row 310 fix round 1). Lane: careful (money), DOCS ONLY.
Inputs on origin: docs/review/ticketing-organisers-r1.md (branch claude/review-ticketing-organisers) and docs/briefs/design-ticketing-organisers.md + docs/briefs/contract-ticket-tiers.md (branch brief/review-ticketing-organisers).
INVENTORY.md first: list every design/contract section that names a reserve function, price read, preview, public list, price_changed rule, ACL line or time rule, file:line, GAPs listed; end with a coverage count (every F1-F8 row mapped to a section edited).
Edit both docs (write the revised copies to docs/briefs/design-ticketing-organisers.md and docs/briefs/contract-ticket-tiers.md on your branch) so that:
- F1: every reserve version (v1-v4) and every caller path prices through ONE seam, or v1-v3 are refused/retired with an explicit step; state how the edge version in use is verified (G-1) as a T2 pre-condition.
- F2: promo preview v1/v2 and every public price list read the seam; add the matrix rows.
- F3: price_changed fails CLOSED when the expected-price key is missing; define the edge and client contract.
- F5 DECIDED (owner-delegated): steps are ABSOLUTE date/time per ticket type; editor copy says "applies to every night"; relative-to-night is parked.
- F6: upsert refuses price 0 while steps exist; step writer refuses a free base (not_paid_ticket) and same_price.
- F7: write the exact GRANT/REVOKE/RLS/search_path list and the post-apply privilege assertions.
- F8: London-time editor, non-existent DST time refused (isoToLondonInput(londonInputToIso(v)) !== v), ambiguous time stated; "rises on <date>" built on the client in Europe/London; boundary test at effective_from - 1us and = effective_from via an `_at` wrapper.
- F4, F9-F11 (MEDIUM/LOW): address each, or say why not, one line each.
Do not touch code. Output also docs/review/ticketing-design-fixes-r1.md: a table F1..F11 -> section changed -> test/mutant that would catch it, with a Verified / Not verified block. Push to your branch only.
