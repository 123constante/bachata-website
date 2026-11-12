# Brief: Organiser dashboard 3 design options (admin #1538, normal lane, Opus, DOCS/DESIGN ONLY, no app code)
Branch: claude/profile-dash-organiser-designs. Parent #1531. Runs in parallel with #1537 (different folder).
Existing prototypes (HTML in fences, on this brief branch): docs/briefs/org-proto-area.md, org-proto-dashboard.md, org-proto-profile.md. Tile numbers are placeholders; page-view tiles are removed.
Contract journeys (ORGANISER light, spacious: 1 main card + 3 items on the first screen):
O1 no events/no team: Next action card + Share my page (copy, WhatsApp, Instagram caption); empty states say what to do.
O2 upcoming nights: per-night card: Going (event_attendance), opens (every open, everyone), link clicks by type (ticket/share/whatsapp/directions); positive-only; zero = suggested action; also a cancelled night.
O3 selling via us: Tickets sold tile only then.
O4 Profile completeness bar + next step; Rating and Level rating always shown; city average only when 5+ organisers in the city (hidden otherwise).
Visibility: whole team. NO page-view tiles, chart, enquiries, saves, weekly summary. No source split on opens in slice 1. Page opens line comes from profile_view_events.
Real shapes: opens 63,576 rows and link clicks 7,392 are real (huge counts such as 6,013 must fit 390px); Going is near-empty: explicit empty state, not a headline tile.
## INVENTORY first (before drawing anything)
Write docs/design/organiser-dashboard/INVENTORY.md BEFORE drawing: every field, state and option of the organiser area from the admin app, the current Website and the public organiser page, each cited file:line, GAPs listed. End with a coverage count (items covered / total, each uncovered one justified).
## Produce (docs/design/organiser-dashboard/ only)
3 mock options as HTML at 390x844, one adapted from the existing prototypes, each covering: no events, upcoming nights, selling via us, huge counts, all-zero, cancelled night. Design record docs/design/organiser-dashboard/options.md: tokens, per-option trade-offs, your recommendation. Checks with results: taps >=44px, contrast >=4.5, no clipping/sideways scroll. Screenshots per option under docs/design/organiser-dashboard/shots/. Handover with Verified / Not verified. The owner picks; no app code, no DB.
