# Brief: JSON-LD offers for live in-site ticket events (queue #1516, lane normal, Website)

Repo 123constante/bachata-website. Branch `feat/ticket-jsonld-offers` off origin/main. One PR, bot-authored.

## Problem (measured 2026-11-11, headless 390x844 walk, read-only prod)
Live in-site pages (e.g. /event/bachata-playground-1, types on sale, Stripe ready, no external link) emit Event JSON-LD with NO `offers`, in server HTML and after hydration. Search engines see no tickets. Closed (coco-loco) correctly has none.

## Cause to confirm first
`src/modules/event-page/bento/BentoPage.tsx` (~line 668) builds `offers` by mapping `snapshot.event.tickets` (the organiser's own external ticket rows). An in-site event has zero such rows, so the list is empty and `buildEventJsonLd` (src/lib/buildEventJsonLd.ts ~222) emits nothing. `ticketOfferUrl` (bento/utils/ticketOfferUrl.ts) only swaps the url on rows that already exist. Design record: docs/design/ticket-lead-in-site.md (read it; `ticketingLiveFor` = live flag + night from InSiteTicketProbe, starts false for hydration safety).

## Acceptance contract
Person: search engine / crawler x journey: read a live in-site event page x data shapes:
- A. Playground: types on sale, Stripe ready, no external link -> offers present, each offer url = our event page `${SITE_ORIGIN}/event/<slug>`; price/currency only if the probe/types data actually carries them (never invent a price).
- B. Live AND organiser external rows (Ritmo/Flow shape) -> our url wins while live (existing ticketOfferUrl rule), no duplicate offers.
- C. Coco Loco: sale window closed -> NO offers from us; organiser external link only if rows exist.
- D. Not live (sold out, not yet open, no types) -> external link as today, none if no rows.
- E. Lifecycle ended/paused -> unchanged (policy in src/lib/seo/eventPageSeoPolicy.ts still suppresses offers).
- Night switch: only trust a live answer about the night on screen (existing `ticketingLiveFor.night` check).
Server HTML: types are not in the snapshot, so first render cannot know live. Do NOT add a supabase/** change. If a server-side fetch is cheap and within src (no DB change), say so in the PR; otherwise keep client-flip and state plainly in the PR that non-JS crawlers still see none (Google renders JS). Do not ask the owner.

## Tests (red first)
Table-driven, shape x expected offers, rendering the real BentoPage (extend tests/client/ticketLeadPage.matrix.test.tsx), reading the emitted JSON-LD script. Include one test per A-E and the night-switch case. buildEventJsonLd stress test must stay green. Do not reinstate the struck self-referential-Offer claim for rows with NO live in-site ticketing (buildEventJsonLd comment ~226): our url is allowed ONLY when live.

## Gates
Run every CI job step locally relevant (tsc, lint, vitest targeted), PR checks green, per-job CI table in PR. No UI change, so no screenshots needed; paste the emitted JSON-LD for A and C in the PR. Verified / Not verified block in the PR. Push once. Handover note in PR body.
