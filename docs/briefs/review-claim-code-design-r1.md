# Brief: review-claim-code-design-r1 (WEBSITE, READ-ONLY REVIEW, Fable; builder was Opus). Branch claude/review-claim-code-design-r1 -> docs/review/claim-code-design-r1.md only.

Context line: stay under 35% of your context; push + handover by 50%. Never merge/approve/--no-verify. Plain git only. Supabase READ-ONLY (SELECT only). Docs only.

Review branch claude/claim-code-design-r1 (docs/design/claim-code/INVENTORY.md and PLAN.md). Brief: git show origin/brief/claim-by-code-design-r1:docs/briefs/claim-by-code-design-r1.md. This will become a migration (careful lane), so review it as a security design.
Check against live prod RPC bodies (read-only pg_get_functiondef) and the repo:
1. Abuse cases: enumeration of pages, spam to a contact (rate limits per page, per user, per contact), replay, code guessing (length, expiry, attempt limits, lockout), timing, a code sent to a contact an attacker can influence, masked hint leaking the contact.
2. Storage: hashed code, tables, RLS, explicit GRANT/REVOKE incl. service_role (no auto-grants since 2026-10-30), SECURITY DEFINER search_path, audit rows.
3. Interaction with the instant claim (email matches), ask-to-join, the dancer-profile gate, organiser_claim_emails, and the live redeem_organiser_invite_v1: any bypass or second ownership route.
4. The prod numbers (38 unclaimed live pages: 2 email, 32 phone only, 4 none): re-check them read-only and say if wrong. Is the F1 recommendation (phone/WhatsApp code) sound and what new abuse does a phone route add?
5. Test matrix and migration order complete?
Deliverable: verdict PASS / PASS WITH NITS / BLOCK, findings ranked with a concrete attack or failing scenario each, honest Verified / Not verified. Commit subject ends [worker-done <ticket>].
