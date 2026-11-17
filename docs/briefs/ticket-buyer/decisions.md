# Ticket-buyer onboarding rule (owner Q&A, 2026-11-17)
Status: ALL 20 ANSWERED (Q20 asked where to keep it: here, Website docs, design registry, memory). Source for the ticket picker redesign and free-ticket work. Related: DECISIONS-thank-you-page-2026-11-10.md.
Mockups: https://claude.ai/artifact/MY1421avYaW5r3NZCjg8Gi (owner likes option A; trust text A1/A2/A3 and which earlier-version bits to bring back still to pick).

## The rule in one block
1. Ticket page (after Get Tickets): white checkout flow, option A quiet text top, Stripe security text, per-class cost line. Free party ticket is its own row, price shown as "Free", max 20 per order, may be mixed with a class ticket (no warning), one checkout for mixed orders, the page summary shows everything.
2. Buying: guest checkout by email. Not signed in = type email, get a 6-digit code on the same page, confirm BEFORE Stripe (and before any free ticket). Signed in = no code. Email already has an account = the code signs them in and the order attaches to it.
3. Free-only order: no Stripe. Ticket issued first, buyer lands on the dancer-dashboard teaser (ticket in Tickets section). Then full onboarding, required steps: What are you? + Name + Photo + Lead/follow/both and city. Buyer may leave and resume; progress kept; ticket keeps working.
4. Unfinished onboarding: "Finish your profile" card on the dashboard every visit. No reminder emails.
5. Tickets: door shows QR only, no name. Every free ticket is the buyer's own (one QR each, no passing to friends). Buyer can cancel a free ticket in one tap.
6. Free tickets have no capacity limit. Brake: rate limit on free orders per verified email per day (number to set at build). Per order cap 20.
7. Scope: organiser switch "Free party entry" on the event creates the free row.
8. Organiser sees free buyers in the sales/door list, with a flag for onboarding state.

## Answers by question
- Q1 guest checkout with email, account after; email confirmed before tickets given. Q2 email code. Q3 all four steps. Q4 QR only.
- Q5 owner "you decide": 6-digit code on the page. Q6 confirm before Stripe. Q7 dashboard teaser after free ticket. Q8 leave and resume.
- Q9 dashboard card only. Q10 signed-in needs no code (owner correction). Q11 all the buyer's. Q12 cap 20 per order.
- Q13 code signs in known email. Q14 one-tap cancel. Q15 no limit on free. Q16 organiser switch.
- Q17 rate limit per email. Q18 list with onboarding state. Q19 summary on page only (Stripe shows just the total; read together with rule 1). Q20 keep in decisions file, Website docs, registry row, memory.

## Open for build time (not asked, do not guess)
- Rate-limit number. Whether a paid-only order also requires full onboarding (owner said "write a rule", answers above only cover free; paid keeps today's teaser flow with optional onboarding unless told otherwise).
- Which earlier-version bits (chips, savings line, best-value tag) return in the new picker.

## Checkout flow after Continue (owner Q&A 2026-11-17, B1 mockup)
Email card -> same card asks 6-digit code (auto-checks on 6th digit; wrong = red text, boxes shake, buzz, retry; expired = send new code; resend + Change email links under the boxes) -> full white screen "Opening secure payment" -> Stripe. Verified code CREATES the account (or signs in a known email). No profile text on this step (silent). Only email + code before Stripe. Cancel/back from Stripe = picker, basket kept, note "Payment cancelled. You weren't charged." Success = My tickets with a "Finish your profile" card ABOVE the tickets (first tap "What are you?"; skippable, resumable). Paid orders: tickets first; free-only orders keep required onboarding (rule 3).
