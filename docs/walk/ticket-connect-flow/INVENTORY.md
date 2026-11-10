# Inventory: ticket setup to Stripe-connected path

Base: origin/main at 502dddf. Read-only audit. Every row cites file:line on that commit.
Admin app: not cloned and not in this sandbox. Its side is quoted ONLY as what the Website calls (RPC / table / edge-function names). Anything about admin internals is not claimed.

## A. Admin-side surfaces the Website reads or calls (names only)

| # | Item | Website call site |
|---|------|-------------------|
| A1 | table `organiser_stripe_accounts` (`charges_enabled, payouts_enabled, details_submitted`) | src/modules/organiser/tickets/ticketsApi.ts:47-54 |
| A2 | edge function `stripe-connect-onboard` (`organiser_id, return_url, refresh_url` -> `{url}`) | ticketsApi.ts:244 |
| A3 | RPC `ticket_type_upsert_v1` | ticketsApi.ts:191 |
| A4 | RPC `ticket_type_set_status_v1` | ticketsApi.ts:197 |
| A5 | RPC `ticket_sales_summary_v1` | ticketsApi.ts:93 |
| A6 | tables `ticket_types`, `ticket_orders` | ticketsApi.ts:119, 152 |
| A7 | RPC `ticket_types_public_v1` (public buy block) | src/modules/tickets/ticketCheckoutApi.ts:41-42 |
| A8 | column `event_series_p5.default_ticket_url` (external link) | src/modules/organiser/shared/seriesModel.ts:31, 100; seriesCommands.ts:37, 183 |
| A9 | column `event_series_p5.payment_methods` code `ticket_link` | src/modules/organiser/shared/seriesModel.ts:37; events/paymentModel.ts:16-17 |
| A10 | server refusal: `on_sale` needs series live | ticketModel.ts:213, 223 |
| A11 | onboarding gate refusal on new ticket / on sale | p3/tickets/TypeSheet.tsx:77, 149, 152; gateCopy.ts:1-8 |

## B. Website, organiser side

### B1. Stripe state (one mapping)
| # | Item | file:line |
|---|------|-----------|
| B1.1 | states: `none`, `started`, `connected` only | ticketModel.ts:62 |
| B1.2 | `connected` iff `charges_enabled === true`; any other row = `started`; no row = `none` | ticketModel.ts:68-69 |
| B1.3 | `details_submitted` / `payouts_enabled` are fetched but never read by the mapping | ticketsApi.ts:49 vs ticketModel.ts:63-69 |
| B1.4 | copy per state (tag, title, body, action) | ticketModel.ts:71-93 |
| B1.5 | switched-off copy | ticketModel.ts:96 |
| B1.6 | role copy | ticketModel.ts:58 |

### B2. Add a ticket sheet (TypeSheet, merged #1481)
| # | Item | file:line |
|---|------|-----------|
| B2.1 | title "Add a ticket" | p3/tickets/TypeSheet.tsx:254 |
| B2.2 | step 1 Name, Price, help "Leave empty or 0 for a free ticket.", Buyer pays box | TypeSheet.tsx:279-307 (help at 295) |
| B2.3 | step 2 Places, Sales open, Sales close | TypeSheet.tsx:310-345 |
| B2.4 | step 3 Review, note "Save as draft keeps it hidden..." | TypeSheet.tsx:347-379 (note at 360) |
| B2.5 | Connect block condition: new ticket, not locked, series live, form valid, `connectBlock` non-null | TypeSheet.tsx:116 |
| B2.6 | `connectBlock` returns null for: free, non-manager, stripe unknown, connected, switched off | ticketModel.ts:255-256 |
| B2.7 | Connect block UI: line "Connect payments to put this on sale" + button "Connect payments" / "Carry on with Stripe" | TypeSheet.tsx:215-229; ticketModel.ts:232-234, 257 |
| B2.8 | tap: `submit(false, true)` saves a draft, toast "Ticket saved as a draft. Connecting payments...", calls `onboard.go()` | TypeSheet.tsx:118, 140-143 |
| B2.9 | no Connect block: "Put on sale" (disabled with `sellBlock`) + "Save as draft" | TypeSheet.tsx:231-246 |
| B2.10 | `sellBlock` reasons incl. `PAYMENTS_WHERE` "Connect payments in You > Get paid before selling paid tickets." | TypeSheet.tsx:113; ticketModel.ts:218, 221-228 |
| B2.11 | free ticket path: Put on sale -> upsert then `setTicketStatus(on_sale)` | TypeSheet.tsx:134-150 |
| B2.12 | `onboard.note` (start error) is not rendered in the sheet | TypeSheet.tsx:215-229 (no reference) |

### B3. Tickets sheet on the event page (TicketsEntry)
| # | Item | file:line |
|---|------|-----------|
| B3.1 | Tickets row, chip and detail ("None yet", "Add a ticket", etc.) | p3/tickets/TicketsEntry.tsx:398-405; model.ts:169-189 |
| B3.2 | empty state "No tickets yet" | TicketsEntry.tsx:349-356 |
| B3.3 | footer "Add a ticket", disabled reasons | TicketsEntry.tsx:386-394; model.ts:162-163 |
| B3.4 | per-row Connect block for a paid draft | TicketsEntry.tsx:571, 607-615 |
| B3.5 | per-row switch Selling / Not selling, reason line | TicketsEntry.tsx:584-606 |
| B3.6 | Stripe-return banner: kinds `checking`, `ready_drafts`, `ready_none`, `needs_more` | ticketModel.ts:261-305; render TicketsEntry.tsx:421-439 |
| B3.7 | banner actions: Put on sale, Put all on sale, Carry on with Stripe | ticketModel.ts:294, 300, 304; TicketsEntry.tsx:424-437 |
| B3.8 | return handling: `tickets=1` opens sheet; `stripe=return` sets banner and 30 s poll; `stripe=refresh` does nothing visible | TicketsEntry.tsx:85-87, 158-159, 164-199 |
| B3.9 | return URL for the inline press | TicketsEntry.tsx:152; paths.ts:289-290 |

### B4. Get paid screens
| # | Item | file:line |
|---|------|-----------|
| B4.1 | You > Get paid card (tag, title, body, button, "You leave Bachata Calendar...") | p3/tickets/GetPaid.tsx:147-168 (body 125) |
| B4.2 | return/refresh note `BACK_NOTE` (manual reload advice) | GetPaid.tsx:29-32, 146 |
| B4.3 | single refetch on arrival, no poll | GetPaid.tsx:78-80 |
| B4.4 | setup checklist (non-interactive rows) | GetPaid.tsx:169-181 (card at 170); ticketModel.ts:696-704 |
| B4.5 | Home prompt "Get paid", Connect, "More about getting paid" | GetPaid.tsx:213-236 (`Prompt` 221); model.ts:135-142, 212-213 |
| B4.6 | You row "Get paid" + tag | GetPaid.tsx:194-210; model.ts:216-217 |
| B4.7 | single start screen (WhatsApp link): heading, asks list, Connect / Carry on / Check again / Add a ticket | GetPaid.tsx:285-299 (`startView`), 336-378 (`StartBody`) |
| B4.8 | start screen poll 3 s for 60 s | GetPaid.tsx:321-334 (`useReturnPolling`; constants 264-265) |
| B4.9 | "Add a ticket" target: the single live event page, else Events; no `tickets=1` | GetPaid.tsx:304-307 (`addTicketPath`) vs paths.ts:290 |
| B4.10 | return destinations differ by press site: inline -> event `?tickets=1`; start screen -> `/account/p3/get-paid`; Home prompt and Get paid card -> `you/get-paid` | data.ts:77-89; paths.ts:285-288; TicketsEntry.tsx:152; GetPaid.tsx:128, 222, 338 |
| B4.11 | `nextStep` / `paymentsLink` helpers: no importer outside tests (ticketModel.ts only) | ticketModel.ts:715-745 |

### B5. External ticket link, organiser side
| # | Item | file:line |
|---|------|-----------|
| B5.1 | P3 event editor field "Ticket link", `https://` placeholder, no help text | p3/screens/DetailsScreen.tsx:155-158 |
| B5.2 | label | p3/model/labels.ts:78 |
| B5.3 | saved to `default_ticket_url` | p3/data/details.ts:172 |
| B5.4 | shown in event page About row as a link | p3/screens/EventPage.tsx:227; data/eventPage.ts:188 |
| B5.5 | create flow: "Ticket link" is a peer "How do dancers pay?" chip; sheet comment "Stripe tickets come later" | p3/new/sheets.tsx:132, 157-162; new/model.ts:347 |
| B5.6 | older events editor sheet "Ticket link", "Where dancers book or buy tickets." | events/EditorSheet.tsx:299-307 |
| B5.7 | go-live key "Add a ticket link" | shared/goLiveKeys.ts:41 |
| B5.8 | festival: ticket link is the only payment method | events/paymentModel.ts:13, 16-17 |
| B5.9 | nothing ties the link to Stripe state, and nothing offers it near Connect | (absence: TypeSheet.tsx:215-229, GetPaid.tsx:147-168) |

## C. Public event page

| # | Item | file:line |
|---|------|-----------|
| C1 | external link read, junk filtered | event-page/useEventPageQuery.ts:270-275 |
| C2 | sticky bar "Get Tickets" is the primary action whenever a link exists | event-page/bento/EventStickyActionBar.tsx:96-98, 148-160 |
| C3 | link hidden when over / cancelled / paused | event-page/bento/BentoPage.tsx:841-845 |
| C4 | in-site buy block (Stripe checkout), behind `publicTicketing`, same suppression | BentoPage.tsx:760-770; lib/featureFlags.ts:78 |
| C5 | buy block renders nothing until a type is on sale | modules/tickets/TicketsBlock.tsx:159 |
| C6 | structured data offers reuse the external URL | BentoPage.tsx:632-635 |

Total rows: 11 (A) + 6 (B1) + 12 (B2) + 9 (B3) + 11 (B4) + 9 (B5) + 6 (C) = 64.
Coverage (covered / total): 64 / 64 traced in RESULTS.md; the 11 A rows are covered at Website call-site level only (admin internals not read).
