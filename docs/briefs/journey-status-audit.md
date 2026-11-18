# Audit: buyer journey Get tickets to QR (normal lane, read-only)

Repo: bachata-website. You audit, you do not change code. Write ONLY docs/review/journey-status-2026-11-18.md on your branch claude/journey-status and push it (plain git).

Owner question: "status of the journeys from Get tickets on the event page to the QR code". Answer from code on origin/main, git log, and read-only prod counts (project stsdtacfauprzrdebmzg, no personal data, no writes).

Read first: ~/.claude/plans/DESIGN-REGISTRY.md rows "Ticket picker page", "Post-pay screen", "Buyer onboarding B+C", "Buyer order confirmation email"; DECISIONS-ticket-buyer-onboarding-2026-11-17.md (if not reachable, say so).

For each step report: BUILT-ON / BUILT-FLAG-OFF / NOT BUILT / UNKNOWN, with PR numbers, file path, and the exact flag name plus its prod value (Vercel env, edge secret, or app_feature_flags row):
1. Event page Get tickets button
2. Picker B1 (stepper, promo box, total bar, trust line) vs registry spec; list every deviation
3. Email card, Continue to Stripe
4. Stripe return / checkout lands on Home
5. Order confirmation email ("Simple and warm": subject, one button, no QR text) - built or not
6. Post-pay teaser (lock look C, Home card B), ticket small card + full QR top of Nights
7. Buyer onboarding (What are you, finish card), 24h reminder email (ticket first, QR)
8. Refund and night-cancelled emails
9. Prod counts: orders and tickets by status last 7 days; any paid order with no QR/ticket row

Finish with a short "gaps" list ranked by what blocks a buyer reaching the QR. Headings plain. Push, then stop.
