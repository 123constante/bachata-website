# Brief: in-site ticket selling on festival pages, Ritmo first (queue #1517, careful lane, Website)

Repo 123constante/bachata-website. Branch `feat/ticket-festival-in-site` off origin/main. One PR, bot-authored. Opus.

## Owner words and context
"I want to influence people to use only my ticketing method." Ordinary event pages already sell in-site (src/modules/tickets, InSiteTicketProbe, EventStickyActionBar, docs/design/ticket-lead-in-site.md, docs/briefs/event-tickets-page/HANDOVER-6.md). Festival pages (src/pages/FestivalDetail.tsx) do NOT import modules/tickets: they show the organiser's `ticketUrl` ("Get Tickets", ~line 2992 and 3774) and a passes grid (~3740). Read docs/arcs/ticketing.md and docs/briefs/contract-ticket-tiers.md first.

## Acceptance contract
Person: dancer visitor x journey: opens the Ritmo festival page, picks any pass or night, buys in one checkout x data: festival with per-night ticket types, Stripe ready, organiser's Ticket Tailor link ALSO set.
- Live (our Buy buyable now): our Buy shown, the external link hidden (same `ticketingLive` rule as event pages: siteBarState == buy).
- Quiet states (sold out, closed, not yet open, no types): honest disabled bar with its reason, external link returns ("Tickets elsewhere"), exactly as event pages.
- Per-night types: festival nights resolve to the right series/occurrence for the probe and the buy block; the whole-festival pass shape must also work. Survey real festival rows read-only first (status x type x counts x empty x ended x huge) and put the table in the PR.
- Ended festival: no ticket CTA at all (existing behaviour kept).
- Festival with no types: unchanged (external link or "Tickets TBA").
- JSON-LD offers on the festival page = our tickets page url only while live, external link otherwise; none when ended or closed. If #1516 has merged (src/lib/buildEventJsonLd.ts / ticketOfferUrl), reuse its rule; do not fork it.
- Reuse the existing probe, query keys and buy block. No second ticket system. No supabase/** change, no money logic change (prices, fees, refunds untouched).

## Tests (red first)
Table-driven shape x screen on the real FestivalDetail: live / sold out / closed / not yet / no types / ended / link+types, asserting CTA, link visibility, disabled reason text, JSON-LD offers. No copy that points at a missing control; empty states say what to do; disabled controls say why.

## Gates (careful lane)
All CI jobs run and green with the per-job table in the PR. 390x844 walk on prod-shaped data: screenshots on the PR (Ritmo real data via the mock/walk harness or read-only prod), no sideways scroll, taps >= 44px, contrast >= 4.5. UI PR needs docs/design/<pr>.md (one chosen design, alternatives recorded). Stripe test-mode order is the lead's step after merge, not yours: say what is needed. Verified / Not verified block in the PR. Context: stop at 40% with a handover.
