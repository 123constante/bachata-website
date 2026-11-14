# Brief: buyer sign-in returnTo for tickets

Lane: normal (no DB). Repo: bachata-website. Branch: claude/ticketing-returnto. Model: Sonnet. One PR, behind OFF publicTicketing. Auth touch: the lead runs ONE read-only review before merge.

## Problem (found by test PR #1670, merged)
(a) Nothing sets returnTo=/account/my-tickets on /auth, so a buyer who signs in by magic link from a ticket flow does not return to My tickets.
(b) With organiserSelfServe OFF, a sign-up drops returnTo (shouldHonorReturnTo in src/lib/auth-otp-routing.ts), so a new buyer lands on /.

## Build (smallest)
1. Buyer sign-in links in the ticket flows (ticket thanks/checkout sign-in prompts, My tickets signed-out state) pass returnTo=/account/my-tickets (encoded) to /auth. Find them with grep for '/auth' in src/modules and src/pages ticket files.
2. shouldHonorReturnTo (and any twin in src/pages/AuthCallback.tsx): honour a returnTo that is exactly /account/my-tickets or /app/tickets even when organiserSelfServe is OFF. Keep the existing allow-list/open-redirect safety; no other path is widened.
3. Update/add unit tests next to src/lib/__tests__/auth-otp-routing.test.ts; the #1670 tests must still pass (adjust only the assertions that encoded the old gap, say so in the PR).

## Not in scope
No flag flips, no migrations, no other auth behaviour. Do not merge.

## Done when
PR open (bot-authored), npm run test:unit green for touched tests, PR body lists Verified / Not verified.
