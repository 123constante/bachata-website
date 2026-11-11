# Brief: our ticketing leads when an organiser has it live (Website, normal lane, no DB change)

Repo 123constante/bachata-website, branch `claude/ticket-lead-in-site`, from fresh origin/main. One slice = one branch = one push.

## Why (owner words, 2026-11-11)
Ritmo de Bachata Festival's organiser set up Stripe but also kept an external ticket link (Ticket Tailor). Owner: "I want to influence people to use only my ticketing method." Decisions: hide her link per night ONLY while our Buy is buyable; her link stays on nights not yet open and comes back when a night is sold out or closed; silent to the organiser; no fee or discount change (money is owner-only, do not touch).

## Prod facts (read-only, 2026-11-11)
Series c530d694-6e43-40aa-b4c4-d9b7462b2ce1: 12 night ticket types, all status on_sale. Open now: Full Pass (null open, closes 2026-11-30), five passes opened 2026-11-01. Not yet open: Full Pass 2nd Release (opens 11-30), six more open 2026-12-31. The series' only link is a Ticket Tailor URL (`default_ticket_url`). Her sale dates are hers; do not change data.

## Task
1. One shared helper "ticketing live for this night" built on `siteBarState` / `sellsInSite` in `src/modules/tickets/ticketCheckoutApi.ts` (~128-175). Live = state is `buy` (buyable now). `quiet` (sold out / closed / not yet open) and `none` = NOT live, so her link shows.
2. Apply it, per night, to: `src/modules/event-page/bento/EventStickyActionBar.tsx` (~187-201 "Tickets elsewhere"), `src/modules/event-page/sections/EventHeroMetaBlock.tsx` (~206, 243 TicketsPill; point at our tickets when live), `src/modules/event-page/bento/StickyTicketButton.tsx` (~120-132; gate, or prove unused), `src/modules/event-page/bento/BentoPage.tsx` (~658 JSON-LD offer URL = our tickets page when live, external only when not).
3. Festival pages (`src/pages/FestivalDetail.tsx` ~2540, 3736-3772): first check on main whether festivals sell in-site. If yes, same helper. If no, change NOTHING there and say so in the PR.
4. Update tests `ticketLead.matrix.test.tsx` and `siteBarState.matrix.test.tsx` as screen x shape tables, RED FIRST. Shapes: buyable now; sold out; closed; not yet open; mixed nights (some open, some not); types but Stripe not ready; no types + link; link only; no link; past event.
5. Docs: `docs/arcs/organiser.md:43` row I8, HANDOVER-6 note (this reverses "Tickets elsewhere kept when quiet"), `docs/design/<pr>.md` (UI PR rule: one design chosen, alternatives recorded).

## Acceptance contract (person x journey x data)
A Dancer, event page, types on sale + Stripe ready + external link set: exactly one buy action (ours), no external link in sticky bar, hero pill, body or JSON-LD.
C Dancer, sold out / closed / not yet open: disabled state says why ("Sold out", "Opens <date>"); her link IS shown (owner click).
D No in-site tickets: unchanged (external "Get Tickets" primary, or nothing).
F Stripe ready but zero types: unchanged, link stays.
G JSON-LD: our tickets URL when live, external only when not.
Mixed nights: each night decided on its own.

## Gates
Table-driven tests, every CI job run and green, 390x844 walk on prod-shaped data (Ritmo's page; screenshots in the PR), contrast >= 4.5, taps >= 44px. PR body: per-job CI table and a Verified / Not verified block. No migration, no supabase/**, no workflow edits. Do not touch organiser/tickets files (live worker #1541, claude/ticket-money-visible).
