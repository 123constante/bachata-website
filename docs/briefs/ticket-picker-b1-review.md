# Review: PR #1747 ticket picker B1 (money path, read-only review)
Review branch feat/ticket-picker-b1 (PR 1747) against origin/main. Do NOT change code; write your verdict as a PR comment-style doc `docs/review/pr-1747-review.md` with PASS / PASS WITH NITS / FAIL and `Hard-tier PASS` line only if justified.
Check (money + auth class):
1. Request body to `ticket-checkout` matches the edge function contract in repo bachata-admin (supabase/functions/ticket-checkout): multi `lines[]` accepted? `expected_unit_price_pence` / `expected_total_pence` correct, fee handling, quantity caps, no client-trusted price.
2. Auth OTP: `signInWithOtp shouldCreateUser:true` + `verifyOtp type:'email'`: any account-creation or enumeration risk, rate-limit handling, wrong/expired code paths, no session leak between emails (Change email).
3. Cancel return keeps basket in sessionStorage: no stale prices charged (server revalidates), no PII stored.
4. Flag OFF = classic page byte-for-byte unchanged behaviour. Promo stub never reaches the wire.
5. Tests in src/modules/tickets/__tests__/ticketPickerB1.test.tsx: do they assert the wire body? Mutate one price/qty and confirm a test fails.
Report findings with file:line. ONE round.
