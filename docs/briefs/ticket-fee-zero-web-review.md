# Brief: independent review of PR #1135 (remove the 50p booking fee, Website half)

You are the independent reviewer (different model from the builder). Money change: be thorough, read-only.
Review branch `claude/ticket-fee-zero-web` (head 17e84653) against `main`. You change NOTHING in src. Push ONE
docs file `docs/review/ticket-fee-zero-web-r1.md` on your own branch `claude/review-ticket-fee-zero-web`.

## Context
Owner order 2026-10-29: remove the 50p ticket booking fee. Server (`ticket-checkout` edge function, v7) reads env
`TICKET_BOOKING_FEE_PENCE`, falling back to the admin default (now 0, admin #1121 merged). Deployed env is unset, so
it still charges 50p until the orchestrator sets the secret to 0 right after merge. At 0 the server sends no
`application_fee_amount`. The orchestrator sets the secret; you do not touch Supabase (read-only anyway).

## Check, with evidence (file:line)
1. Every place a fee can still be SHOWN or COMPUTED on the Website: grep `BOOKING_FEE`, `feePence`, `booking fee`,
   `application_fee`, `50p`, "fee" in `src/modules/tickets/**`, `src/modules/organiser/tickets/**`, emails/thanks page,
   order status, refund copy, docs. List any that still assume a fee at 0.
2. The buyer total at 0 equals the ticket price for every price x quantity (incl. free, mixed, capped at 20, sold out).
3. Terms of sale (`legalCopy.ts`): the fee sentence and the refund fee clause are gone only while the constant is 0;
   confirm the 50p-era wording is still reachable when non-zero. Quote before/after wording exactly.
4. Refund wording on the organiser side for orders that DID carry a fee (3 prod orders): is "booking fee included" shown
   only for those? Any case where a fee-bearing order is described as fee-free, or the reverse?
5. Tests: do the new `feeZero.matrix.test.tsx` cases fail on the old code and pass now? Any assertion that passes
   either way (vacuous)? Run `npx vitest run src/modules/tickets src/modules/organiser/tickets` and quote the counts.
6. Merge-ordering risk: between merge and the secret flip a buyer sees Total = price but Stripe adds 50p. State exactly
   what a buyer would see and be charged in that window, and whether any PR-side change shrinks it.
7. Anything out of scope in the diff (files not about the fee).

## Output
One file: verdict PASS / PASS with should-fix / FIX FIRST; each finding: severity (block / should-fix / nit), file:line,
what is wrong, concrete failure scenario, suggested fix. Then "Verified" and "Not verified". Be brief; no praise.
Context cap 30%: push before then. Last commit subject ends with the worker-done marker from the dispatch prompt.
