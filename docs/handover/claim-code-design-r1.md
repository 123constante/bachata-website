# Handover: claim-code-design-r1

Brief: `brief/claim-by-code-design-r1:docs/briefs/claim-by-code-design-r1.md`. Docs only.

## Done
- `docs/design/claim-code/INVENTORY.md`: 9 claim paths with file:line and live RPC behaviour (read-only from prod), 9 data items, 6 gaps, prod counts. Coverage 9/9.
- `docs/design/claim-code/PLAN.md`: contact + mask + no-contact copy; code rules and caps; tables, three RPCs + one edge function with grants; interaction with every existing path; test matrix; migration order with replay proof and independent review.

## Key findings for the owner
- Unclaimed live pages: 38. Email evidence: 2. Phone only: 32. No contact: 4. Email-only codes help ~5% (fork F1: WhatsApp v2).
- The "14 of 15 founding" figure is not reproducible from prod (no founding marker) (F3).
- Website drops the live hint `email_matches_unproven` (`selfServeApi.ts:109`), G3.

## Not done / not verified
- Existing mail/WhatsApp edge functions' providers were not read (G4).
- `organiser_claim_emails` writer (admin repo) not inspected.
- No SQL, no feature code (by brief).

## Next
1. Owner answers F1-F3.
2. Admin repo: M1, M2 per PLAN section 5; independent review.
3. Website build PR behind a flag.
