# Ticket-buyer onboarding rule (owner decisions, 2026-11-17)
Full Q&A: `~/.claude/plans/DECISIONS-ticket-buyer-onboarding-2026-11-17.md`. Mockups: https://claude.ai/artifact/MY1421avYaW5r3NZCjg8Gi

1. Ticket page after Get Tickets: white checkout flow, quiet text top, Stripe security text, per-class cost line. Free party ticket is its own row ("Free", max 20 per order), mixable with class tickets, one checkout.
2. Not signed in: email, 6-digit code on the same page, confirmed before Stripe or any free ticket. Signed in: no code. Known email: the code signs them in.
3. Free-only order skips Stripe. Ticket issued first, buyer lands on the dancer-dashboard teaser. Required onboarding: What are you?, Name, Photo, Lead/follow/both and city. Can leave and resume; ticket keeps working.
4. Unfinished onboarding: "Finish your profile" card on the dashboard. No reminder emails.
5. Door: QR only, no name. Free tickets are the buyer's own (no passing on). One-tap cancel.
6. No capacity limit on free tickets; rate limit per verified email per day (number set at build).
7. Organiser switch "Free party entry" creates the free row. Organiser list shows free buyers with onboarding state.
