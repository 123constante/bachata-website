# Brief: claim-by-code-design-r1 (data design for the public claim code; docs only)

Lane: careful (it will become a migration). Model: Opus. Branch: claude/claim-code-design-r1. Docs only: NO migration file, NO feature code, NO prod write.

## Owner words (why)
Owner 2026-11-01 (relayed): an organiser must be able to claim their page from the public page WITHOUT an admin first entering their email. Chosen way: a one-time code sent to the page's public contact. Owner has NOT decided how the 14 of 15 unclaimed founding pages with no contact get one, so do NOT assume a contact exists; those pages stay ask-to-join (or hand-sent invite links, owner's answer 2026-11-01). Batch-1 text must not promise one-tap claim.

## INVENTORY FIRST
Write `docs/design/claim-code/INVENTORY.md` BEFORE the design: every claim path today (public page claim card `ClaimNotice`, `ownership.ts` hint kinds, ask-to-join request, organiser invite `/invite/<token>` and `redeem_organiser_invite_v1`, admin-entered `organiser_claim_emails`, `claim_organiser_v1`), with file:line and the live RPC bodies read from prod (read-only); and every data field involved (`claim_email`, `contact_email`, `claimed_by`, the attempts table). GAPs listed. End with a coverage count: N paths, N covered, none silently omitted. Counts only from prod: unclaimed pages by contact kind (email / other / none).

## Design (`docs/design/claim-code/PLAN.md`)
1. Which contact the code goes to (email only? phone/WhatsApp?), how it is read without leaking it (masked hint only), and what the public page says when a page has NO contact.
2. The code: length, expiry, single use, attempt limit per page and per signed-in user, where it is stored (hashed), who can request, abuse cases (enumeration of pages, spam to a contact, replay).
3. The RPC pair (request code, redeem code): names, args, return shapes, error reasons, grants (no auto-grants on new public tables: explicit GRANT/REVOKE incl. service_role), audit rows, RLS.
4. How it interacts with the existing instant claim (email matches) and with ask-to-join (still the path for no-contact pages), and the dancer-profile gate.
5. Test matrix (every path x every page shape) and the migration order with replay proof and an independent review.
No SQL files; pseudo-signatures in the doc only.

## Hard limits
Supabase read-only. Never merge or approve. Docs-only PR. Handover `docs/handover/claim-code-design-r1.md`.
