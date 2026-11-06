# Organiser analytics W2: Stats screen reads organiser_analytics_v2 and shows the share link (NORMAL lane, new screen section)

Brief-version: 2
Branch: claude/organiser-stats-v2-share-card (from main). One push. Normal lane, context cap 50%. No `supabase/**`. Behind the existing `organiserP3` flag. Do not touch the going components.

## Decisions
Prod has `organiser_analytics_v2(p_series_id uuid, p_from date, p_to date)` returning jsonb `{has_own_code, totals{visitors, views, from_your_link, link_taps{zone}, link_taps_from_your_link, guest_list_signups, tickets_sold}, by_day[]}` (counts only; owner/manager only; window capped at 366 days) and `organiser_share_code_v1(p_organiser_id uuid)` for owners and managers. Headline numbers are visitors and "from your link"; guest-list and tickets show only when non-zero (guest list exists on 6 of 764 series; one organiser has ticket orders, 2 paid). The lead decides the look: reuse the existing `p3-card p3-stat` pattern and tokens, no new colours, tap targets in explicit px (html font-size is about 13.5px on phones). The share link is the event URL plus `?ref=<code>`; the code comes only from the RPC. Depends on W1 (claude/analytics-ref-capture) only for numbers to become non-zero; correct with zeros, so it can ship first.

## What main lacks
- A data module that calls organiser_analytics_v2 per series and sums the shared totals for the page -- grep: fetchOrganiserAnalyticsV2
- A Visitors stat and a "From your link" stat on the Stats screen -- grep: p3-stats-from-link
- A share-link card with a Copy link control and a disabled reason when the organiser has no usable code -- grep: p3-share-link-card
- extends: the "No views yet" empty state must keep telling the organiser what they can do, pointing at the on-screen Copy link control -- src/modules/organiser/p3/screens/StatsScreen.tsx

## Files
- src/modules/organiser/p3/data/analyticsV2.ts (new)
- src/modules/organiser/p3/data/stats.ts
- src/modules/organiser/p3/screens/StatsScreen.tsx
- src/modules/organiser/p3/screens/ShareLinkCard.tsx (new)
- src/modules/organiser/p3/screens/__tests__/screens.matrix.test.tsx
- src/modules/organiser/p3/data/__tests__/analyticsV2.test.ts (new)

## What to build
0. Write INVENTORY.md first: every field, state and option from the admin app, the current Website and the public page, each with file:line. Build only after it exists and report the coverage count (covered / total) at the end.
1. `analyticsV2.ts`: typed parse of the jsonb (never cast through; non-finite, negative or missing to 0), `fetchOrganiserAnalyticsV2(seriesId, from, to)`, and a sum over the series in the current page scope (same page-scope rule as `stats.ts`, F-26) that keeps `has_own_code`.
2. Stats screen: add Visitors and From your link using the existing today / 7-day switch; show guest-list sign-ups and tickets sold only when non-zero. Loading, error (with Try again) and no-page states stay. A refused call (42501) shows the error state, never zeros.
3. `ShareLinkCard`: reads `organiser_share_code_v1` for the page's organiser, shows the link for the next live event and a Copy link button (clipboard failure falls back to selecting the text). No code or a disabled code gives a disabled button with the reason "Your link is switched off. Ask the team."; no event gives "Add an event to get a link".
4. Copy: the help line says a person on 3 days counts 3 visitors; British English, full weekday names, HTML entities not raw Unicode.

## Tests
Table-driven, red first, one shared mapping for all numbers. Shapes: all zero; views only; own-code taps; guest-list 6 and tickets 2; huge (123456 visitors, 366 by_day rows); `has_own_code` false; admin-disabled code; no events; page scope with 2 series summed; refusal 42501; network failure retried once then error. Every state x every shape: no text names a control not on screen, every empty state names an action, disabled controls carry a reason, an untouched render sends only the read RPCs.

## Done when
Tests, lint chain, tsc and every applicable CI step green, per-job table in the PR body. Walked at 390x844 (loading, zero, populated, huge, error, disabled code) with screenshots; INVENTORY.md coverage count reported. Verified / Not verified block. Verified on the shapes above and the prod survey of 2026-11-05 (50 organisers; 16 with 25+ past dates, 12 with none). Not verified: a real organiser with tagged traffic.
