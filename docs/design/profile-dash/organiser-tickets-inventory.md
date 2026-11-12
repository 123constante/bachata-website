# Organiser TICKETS: inventory as the Website code supports it (HEAD + PR #1541 @ 59e0809)

Paths: `TM`=src/modules/organiser/tickets/ticketModel.ts, `API`=.../tickets/ticketsApi.ts, under src/modules/organiser/p3/tickets/: `TE`=TicketsEntry.tsx, `TS`=TypeSheet.tsx, `RS`=RefundSheet.tsx, `GP`=GetPaid.tsx, `SS`=StackSheet.tsx, `SR`=SalesReport.tsx, `SRM`=salesReportModel.ts, `M`=model.ts, `D`=data.ts, `CR`=connectReturn.ts, `P`=paths.ts, `GC`=gateCopy.ts, `PS`=promo/PromoSection.tsx, `PM`=promo/promoModel.ts, `PA`=promo/promoApi.ts. Public: `TB`=src/modules/tickets/TicketsBlock.tsx, `TCM`=src/modules/tickets/ticketCheckoutModel.ts, `TCA`=src/modules/tickets/ticketCheckoutApi.ts. `@59e`=line in `git show 59e0809:<path>`.
Roles: O=owner, Mg=manager, C=contributor (legacy row), D=door. `mv`=money_visible (PR #1541 only; HEAD has no such flag). Entry: TE mounts from screens/EventPage.tsx:326 behind `flags.organiserTicketing`; TE returns null if the page is not in home_v1 (owner/manager pages only) TE:89-90.

| # | Area | Item | Who sees it | Cited at | Notes |
|---|---|---|---|---|---|
| 1 | Types | name | O, Mg, C (read-only) | TE:603; TS:322-325; TM:503-504 | 1-200 chars; help "Early bird, Standard or Door" |
| 2 | Types | price (pence, GBP) | all roles (price is not "money") | TE:605; TM:251 priceLabel; TM:254-260 penceOf | "Free" at 0; cap 1,000,000p; empty/0 = free TM:793 |
| 3 | Types | currency | none (implicit GBP) | TM:239 "GBP only, Q10"; TM:244 | No currency field anywhere organiser-side |
| 4 | Types | capacity ("Places") | all | TS:354-357; TM:509-511 | 1-100,000; not below reserved |
| 5 | Types | reserved (held incl. pending) | implicit | API:111; TM:798 leftOf | Not shown as its own number |
| 6 | Types | sold | all (count) | TE:605 countsLine; TM:800 | From summary; null summary -> only "N left" (never fake 0) |
| 7 | Types | remaining ("left") | all | TM:798 leftOf; TM:835-841 eventLeftLine | Row: "12 sold · 8 left" |
| 8 | Types | sales window open | all (edit O/Mg) | TS:358-369; TM:427-443 | Chips Now / Pick a time; London wall clock |
| 9 | Types | sales window close | all (edit O/Mg) | TS:370-384; TM:958-959 | Chips Event start (one-off only) / When I stop selling / Pick |
| 10 | Types | default close on multi-date series | O/Mg on new | TM:473-477 defaultCloseFor; M:140-149 newDraft | Next date's start |
| 11 | Types | "every date" scope note | O/Mg on new | TS:385; TM:463-466 | Type carries no date: shared across all dates |
| 12 | Types | occurrence (per-date) scoping | NOT editable | TM:189, TM:546; API:107 | occurrenceId only round-tripped; new = null. Public side DOES have per-night types TCM:32-33 |
| 13 | Types | description | not supported | TM:186-198 (no field) | No description on organiser or public row |
| 14 | Types | visibility/hidden | only via status | TS:402 | "Save as draft keeps it hidden from buyers" |
| 15 | Types | sort order | not editable | API:129-130 | created_at asc, id; no reorder control |
| 16 | Types | status draft | all | TM:13,17 "Not on sale yet"; TM:806 switch "Not on sale" | Tone draft TM:25 |
| 17 | Types | status on_sale | all | TM:18; TM:807 "Selling" | Tone live |
| 18 | Types | status paused | all | TM:19; TE:631 PAUSED_NOTE TM:571 | "People who already bought keep their tickets." |
| 19 | Types | status sold_out | all | TM:20; TM:46 "Mark sold out" | manual_sold_out parsed API:115, never shown; no UI to mark sold out (switch only toggles on_sale/paused TM:813) |
| 20 | Types | status closed | all | TM:21; TE:628 tag | Terminal; NEXT_STATUS TM:33-39 |
| 21 | Types | Selling switch | O/Mg act; C sees disabled | TE:609-626; TM:813 switchMove | Per-row busy/error TE:143-144 |
| 22 | Types | switch block reasons | O/Mg | TM:317-325 moveBlock | event not live; at capacity; stripe unknown; waiting; not connected (O: PAYMENTS_WHERE, Mg: PAYOUTS_ASK_OWNER) |
| 23 | Types | Close sales for good | O/Mg, not closed | TS:403-418; TS:191-204 | Confirm copy TS:407 "Cannot be undone." |
| 24 | Types | Add a ticket | O/Mg; disabled reason | TE:403-411; M:66-67 addWhy | "Put this event live before adding tickets." |
| 25 | Types | editor 3 steps | O/Mg | TS:63; TM:939-946 | Name+price / Places+dates / Review |
| 26 | Types | Buyer pays box | O/Mg | TS:338-348; TM:772-784 | Fee is 0 since 2026-10-29 TM:241 -> "The ticket price, nothing added" |
| 27 | Types | Stripe hint at price | O/Mg new paid | TS:336; TM:308 | |
| 28 | Types | review rows | O/Mg | TS:389-401; TM:962-972 | Price, Places, On sale, Closes, Buyer pays |
| 29 | Types | price lock after orders | O/Mg | TS:331,337; TM:567-574; M:159-164 hasOrdersOf | Any order row (incl pending/expired) freezes price |
| 30 | Types | edit lock (role / closed) | C; closed type | TM:577-581; TS:240,318 | |
| 31 | Types | untouched save sends nothing | O/Mg | TM:537-561; TS:159-161 | "Nothing changed, so nothing was saved." |
| 32 | Types | save outcomes copy | O/Mg | TS:170-181; GC:5 SELL_HELD; GC:8 GATE_LATE | "Ticket added and on sale." / "saved as a draft..." |
| 33 | Types | form validation copy | O/Mg | TM:500-518; TS:130-131 | name, price, capacity, dates, close>open |
| 34 | Types | loading/error/empty | all | TE:352-372; TE:82-87 row loading; TE:226 "Could not load" | Empty copy differs if why/external link TE:367-369 |
| 35 | Row | Tickets row chip+detail | all | TE:415-422; M:73-93 ticketsRowOf; TM:825-830 | No tickets / Selling / Sold out / Not selling |
| 36 | Row | event rules line | all | TE:434-436; TM:787-790; M:167-171 | "Buyers pay the ticket price, up to 20 tickets an order." |
| 37 | Row | role note | C (non O/Mg) | TE:437; TM:56 NOT_MANAGER | |
| 38 | Ext/Going | external ticket link line | all (no money) | TE:438; TM:121-124; D:118-124 | Only when no types; host only |
| 39 | Ext/Going | "Selling elsewhere? Add a ticket link" | O (connect block) | TS:55-61; TM:310 | Opens event Details |
| 40 | Ext/Going | Going count | all, free events only | TE:439; TM:99-106; D:109-112 | Hidden if any paid type or 0 going |
| 41 | Stripe | state none | all | TM:139-149 | tag "Not connected" |
| 42 | Stripe | state started | all | TM:150-156 | tag "Not finished"; "Finish connecting" |
| 43 | Stripe | state waiting | all | TM:157-163; TM:178 | tag "Stripe is checking"; "Check again" + "Open Stripe" |
| 44 | Stripe | state connected | all | TM:164-170 | tag "Paid out via Stripe"; = charges_enabled only |
| 45 | Stripe | restricted / payouts_enabled | NOT modelled | API:50 reads payouts_enabled; TM:139-140 ignores it | No restricted / payouts-paused / requirements-due state |
| 46 | Stripe | payouts list/schedule/balance | NOT present | (no code) | |
| 47 | Stripe | switched off (not_configured) | O | D:99; GP:155; TM:182 NOT_SWITCHED_ON | 404/503 non-strict = off API:223-234 |
| 48 | Stripe | connect start error | O | D:100 reasonMessage; TE:458,644; GP:173 | testid tix-connect-error TM:314 |
| 49 | Stripe | inline Connect block on paid draft | O only | TE:596,633-646; TM:351-362 | Mg sees PAYOUTS_ASK_OWNER instead TM:323 |
| 50 | Stripe | return banner (6 kinds) | O/Mg (refresh O only) | TE:440-461; TM:365-422 | refresh/checking/ready_drafts/ready_none/needs_more/waiting |
| 51 | Stripe | return poll 3s x 30s | O | CR:12-13, CR:20-34 | |
| 52 | Stripe | stripe=refresh note | O | TM:312; GP:33; GP:335 | |
| 53 | GetPaid | You > Get paid screen | O full; Mg/C state + ask owner | GP:117-199 | |
| 54 | GetPaid | loading/error/no page | all | GP:88-112; GP:132-140 | |
| 55 | GetPaid | Connect button | O, not connected | GP:157-169 | "Opening Stripe…" |
| 56 | GetPaid | ask-owner note | Mg/C | GP:156; TM:61 | `aria-describedby` keys off `!manager` GP:163 (dead for owner) |
| 57 | GetPaid | Add a ticket next | O/Mg when connected | GP:174, GP:230-238; CR:43-48 | Multi-live/none-live/no-event whys |
| 58 | GetPaid | setup bar 3 steps | O, live event | GP:177-189; TM:849-857 | Payments / First ticket / On sale |
| 59 | Money | Money so far: Sold + Sales | O (HEAD); O && mv!==false (PR) | GP:45-71, GP:196; @59e GP:196 | "Ticket money before Stripe's fees" + pending/promo/refunded/disputed |
| 60 | Money | sales load error / refused | O | GP:190-195 | "We could not load your sales." |
| 61 | Money | Home sold tile | count all; £ O (PR: O && mv!==false) | GP:272-288; @59e GP:277-278 | Hidden until >0 sold |
| 62 | Money | Home Get paid prompt | O only (canSetUpPayouts) | GP:221-227, 249-269; M:116-117 | Comment says "owner / manager" GP:220 (stale) |
| 63 | Money | You row tag | all | GP:202-218; M:120-121 | |
| 64 | Money | summary pence stripped for non-owner | Mg/C | API:69-73; D:54-60 | PR: also when server mv=false @59e API:77-81 |
| 65 | Money | SummaryResult.moneyVisible | n/a | @59e API:63-66,85 | true/false/null; null on refusal/old server |
| 66 | Orders | which orders show | per role | M:99-100 shownOrders; TM:222 | paid/refunded/disputed; pending/expired never; newest first |
| 67 | Orders | title HEAD | all | TE:294; TM:609-613 | "Ana · 3F2A9C1E" (first name + code) |
| 68 | Orders | title PR | O&&mv: name+code; else "Order CODE" | @59e TM:619-620; @59e TE:296 | |
| 69 | Orders | line (money) | O (PR: showMoney) | TM:918-923, 931-935; @59e TE:298 | "2 × £10.50 · today" |
| 70 | Orders | line (counts) | Mg/C | TM:926-929 | "2 tickets · today" |
| 71 | Orders | type name suffix | all, 2+ types | TE:297 | |
| 72 | Orders | tag paid | all | TM:710 | |
| 73 | Orders | tag refunded | all | TM:711 | |
| 74 | Orders | tag disputed | all | TM:712 | |
| 75 | Orders | partially refunded | NO tag | TM:709-714; TM:583 | Stays "Paid"; only visible via Refund sheet "left" |
| 76 | Orders | pending / expired / cancelled | never listed | TM:220-222; SRM:37 | Report counts "N not paid, left out" SR:99-103; no "cancelled" status exists |
| 77 | Orders | preview 2 + See all | all | M:97,101; TE:343-346 | Orders view has Back TE:428 |
| 78 | Orders | loading / error / empty | all | TE:327-337; M:103-108 | 3 empty variants |
| 79 | Orders | counts-only note | non-owner | TE:342; TM:76 | PR: still `!owner`, not `!showMoney` @59e TE:344 |
| 80 | Orders | ask-owner per row | Mg only | TE:304-306; TM:74; TM:595 | Status-gated (no pence) |
| 81 | Orders | ask-owner once per list | C (non-manager) | TE:341; TM:59 | |
| 82 | Orders | wire select HEAD | O: money cols; else counts | API:153-154, 160-176 | counts select still has buyer_name |
| 83 | Orders | wire select PR | counts drop buyer_name | @59e API:163, 175 | |
| 84 | Orders | showMoney gate | PR | @59e TE:164-166 | `moneyVisible !== false` is TRUE while summary is pending |
| 85 | Orders | 100-row paging | n/a | API:37, 123-136, 163-175 | |
| 86 | Refund | Refund button | O only, refundable | TE:308-319; TM:588-590 | "Refunding…" while in flight |
| 87 | Refund | RefundSheet mount | O only | TE:514-532 | |
| 88 | Refund | full ("Refund all remaining") | O | RS:151; TM:615-625 | "Their ticket stops working… Cannot be undone." |
| 89 | Refund | partial ("Refund part of it") | O | RS:152-174; TM:632-651 | Tickets stay valid, order stays paid (Q5) |
| 90 | Refund | amount errors | O | TM:632-640 | empty/not pounds/0/over max |
| 91 | Refund | order summary card | O | RS:175-181 | Uses orderLine (money) |
| 92 | Refund | idempotency key per press | O | TM:669-672; RS:89-95; TE:110-122 | |
| 93 | Refund | maybe-sent note | O | RS:183; TM:698-699 | |
| 94 | Refund | definite reasons set | n/a | TM:680-692 | incl. not_allowed, method_not_allowed |
| 95 | Refund | done toasts | O | RS:111,118-119; TM:658-663 | "Refund started." / "Refunded £X. …" |
| 96 | Refund | pending-refund overlay | O | TM:705-707; TE:125-132 | refunded_pence lags webhook |
| 97 | Refund | reasons | none | (no field) | No refund reason captured or sent API:283-285 |
| 98 | Refund | not_configured | O | RS:121; TM:182 | strict mode API:229-231 |
| 99 | Refund err | not_authorised -> NOT_OWNER_REFUND | O | TM:752-753 | refundReasonMessage |
| 100 | Refund err | not_allowed | O | TM:721 | = "Ask the owner to refund this order." |
| 101 | Refund err | not_found | O | TM:722 | "…Reload the page." |
| 102 | Refund err | invalid_amount | O | TM:739 | |
| 103 | Refund err | request_id_required | O | TM:740 | |
| 104 | Refund err | request_id_reused | O | TM:741 | |
| 105 | Refund err | not_refundable | O | TM:742 | |
| 106 | Refund err | refund_exceeds_balance | O | TM:743 | |
| 107 | Refund err | method_not_allowed / invalid_request / not_signed_in / stripe_error / internal_error | O | TM:680-692; TM:746-747 | NO copy: fall to "That did not work. Try again in a moment." |
| 108 | Type err | not_authorised | O/Mg | TM:719 | NOT_MANAGER |
| 109 | Type err | invalid_payload/name/price/capacity/sales_window | O/Mg | TM:723-727 | invalid_price copy "0 to 10,000 pounds" |
| 110 | Type err | series_not_live(_or_not_organisers) | O/Mg | TM:728-729 | |
| 111 | Type err | occurrence_not_in_series / immutable_field / closed | O/Mg | TM:730-732 | |
| 112 | Type err | has_orders / capacity_below_reserved / bad_transition / at_capacity | O/Mg | TM:733-736 | |
| 113 | Type err | organiser_not_onboarded | O/Mg | TM:737 | PAYMENTS_WHERE (owner-worded, shown to Mg too) |
| 114 | Type err | onboarding gate (F-11) | O/Mg | TE:268; TS:180-185; GC:5-8 | shared gate sheet |
| 115 | Report | per-type sold/refunded/left of cap | all | SR:62-81; SRM:39-89 | Orders view only, lazy |
| 116 | Report | Taken/Refunded/Net per type+total | O (PR: showMoney) | SR:69-73, 89-93 | |
| 117 | Report | disputed line | count all; £ O | SR:74-78, 87; SRM:65-68 | |
| 118 | Report | source note | all | SR:60; SRM:106-107 | Differs from Money so far by design |
| 119 | Report | empty | all | SR:56-57; SRM:96-99 | |
| 120 | Report | checked-in "X of Y" | all if door list loads | SR:29-39, 104-108 | Silent on failure (retry 0) |
| 121 | CSV | Download guest list | O only (PR: showMoney) | SR:109-114; SRM:92-93 why | |
| 122 | CSV | columns | O | SRM:109 | Order, Buyer name, Ticket type, Quantity, Status, Paid at, Refunded (pence) |
| 123 | CSV | buyer name = FULL name | O | SRM:129 | Contradicts "full name never shown" TM:607 |
| 124 | CSV | formula-injection guard / filename | O | SRM:112-116; SRM:146 | guests-<slug>-<date>.csv |
| 125 | Promo | list fields | all roles (incl. £ discount) | PS:194-201; PM:15-28,54-62 | code, discount, uses, end, paid orders |
| 126 | Promo | states on/off/expired/used_up | all | PM:30-44; PM:47-52 | Tags On/Turned off/Ended/Used up |
| 127 | Promo | on/off switch | anyone; server decides | PS:84-101, 205-215 | No client role gate PM:9-10 |
| 128 | Promo | create/edit sheet | anyone; server decides | PS:335-373; PA:59-77 | Code immutable; kind %/£; max uses; end |
| 129 | Promo | lock after use | all | PM:91-99; PS:366 | |
| 130 | Promo | delete | NOT supported | PA (list/create/update only) | Off only |
| 131 | Promo | loading/error/refused/empty | all | PS:106-122 | |
| 132 | Promo | error copy map | all | PM:118-133; PM:113-115 | not_authorised, code_taken, locked_after_use… |
| 133 | Promo | validation | all | PM:181-200 | |
| 134 | Door | door/check-in link | O/Mg | screens/EventPage.tsx:328 | Not in Tickets sheet; only "checked in" count in report |
| 135 | Stack | StackSheet | n/a | SS:3-8, 21-44 | Layered modal sheets; top hears Esc; focus returns |
| 136 | Toasts | status vs alert queue | all | TE:146-154, 539-567 | Status 8s TE:558; alerts until Dismiss |
| 137 | Gates | canManage | O/Mg | TM:55 | |
| 138 | Gates | isOwner/canRefund/canSetUpPayouts/seesMoney | O | TM:66-72 | All = role==='owner'; ignore mv |
| 139 | Gates | contributor | effectively unreachable | TE:89; TM:54,58 | home_v1 lists O/Mg pages only; C copy kept for legacy rows |
| 140 | Gates | door role | not modelled | TM:54 | |
| 141 | Paths | getPaid / stripeBack / eventTickets / start / sign-in link | n/a | P:5-20 | |
| 142 | Public | type fields shown | public | TB:296-300; TCM:30-52 | name, availability label, course line, price; glyph |
| 143 | Public | availability labels | public | TCM:139-149 | Sold out / Choose a night / On sale <date> / Sales closed / "N left" (<=20) / On sale |
| 144 | Public | per-night & course types, currency drop | public | TCM:32-33, 45-51, 57-65 | non-GBP rows dropped |
| 145 | Public | totals, fee, promo line | public | TB:409-428 | |
| 146 | Public | sticky bar Buy / quiet | public | event-page/bento/EventStickyActionBar.tsx:142,250-279; TCA:137-158 | |
| 147 | Public | checkout error copy | public | TCM:303-321 | 17 reasons incl organiser_not_onboarded |

## GAPs

1. **Payouts are invisible.** `payouts_enabled` is read (API:50) but `stripeStateOf` (TM:139-140) maps only charges_enabled/details_submitted, so "connected" can hide payouts disabled, restricted or requirements due. There is no payout list, balance or schedule anywhere.
2. **PR #1541's "fail-closed" opens while the summary loads.** `showMoney = canRefund && summary.data?.moneyVisible !== false` (@59e TE:165) is true while the summary is pending or came from an old server (null). The owner's orders read then fetches pence and buyer_name before the server's answer arrives. GetPaid (@59e GP:196, 278) behaves the same way.
3. **The owner with mv=false gets no explanation.** In PR #1541 the counts-only note is still `!owner` (@59e TE:344) and the ask-owner note is `manager && !owner` (@59e TE:306). The Refund button vanishes because pence parse to 0. The `canRefund`/`isOwner` gates (TM:66-72) never read mv.
4. **No owner-approval step.** Managers can create types, set prices and capacity, and put paid tickets on sale (TM:55, TM:317-325). There is no audit trail and no owner sign-off. Promo codes have no client role gate (PM:9-10); managers see the £ discount amounts (PS:197) while the rest of the money is hidden from them.
5. **Partial refund has no visible state.** A partially refunded order stays tagged "Paid" (TM:709-714). There is no "Partly refunded £X" on the row, and no refund reason is captured (API:283-285).
6. **Refund error copy is incomplete.** `method_not_allowed`, `invalid_request`, `not_signed_in`, `stripe_error` and `internal_error` have no copy in REASON (TM:718-744) and fall back to the generic "That did not work…" (TM:747). A signed-out user is not told to sign in again.
7. **Per-date scoping is missing organiser-side.** The public side sells per-night and course types (TCM:32-51) but the organiser editor cannot set an occurrence, kind or validity (TM:546 keeps null). It only explains the shared numbers (TM:465-466).
8. **Missing type fields.** There is no description, sort order, hidden-while-on-sale, per-order max (fixed at 20, TM:243), currency, or manual sold-out control (`manual_sold_out` is parsed at API:115 and never shown; MOVE_LABEL "Mark sold out" TM:46 is unused by the switch TM:813).
9. **The CSV exports full buyer names** (SRM:129), which contradicts "a full name is never shown to organisers" (TM:607).
10. **Contributor and door roles are not designed.** Contributor copy exists (TM:58-59, TE:341) but home_v1 excludes those pages (TE:89), so it is unreachable. Door staff have no Tickets view, and the report's check-in count fails silently (SR:34).
11. **Stale or inconsistent comments and copy.** The GetPaidPrompt comment says "owner / manager" (GP:220) but the code is owner-only (M:116-117). RefundSheet's doc says "owner / manager only" (RS:27) and API:279 says the same, but refunds are owner-only. GP:163 `aria-describedby={!manager…}` points at an element that is only drawn for non-owners. invalid_price copy says "0 to 10,000 pounds" (TM:725), which matches the cap but is not reused by validateForm.
12. **Promo codes cannot be deleted** (PA:53-77, list/create/update only), and the "Used up" next-step copy says "remove it" (PM:51) although no remove control exists.
13. **Money so far and the Sales report disagree by design** (SRM:101-107). Two totals for one event risk confusion. Pending orders show only as "N waiting for payment" (GP:48) and "not paid, left out" (SR:99-103).
14. **There is no "cancelled" order status.** OrderStatus is pending/expired/paid/refunded/disputed (TM:220). Event cancellation has no bulk refund path.

Coverage: **147 rows total.**

## Admin app side (Step 0 source note)

The admin repo (`bachata-admin-11april`) is not reachable from this session (add_repo: no access), so the
admin column of this inventory is the **database it writes**, read with read-only `information_schema` /
`pg_proc` SELECTs on prod `stsdtacfauprzrdebmzg` (2026-11-12). GAP: admin screens themselves not cited.

| # | Admin / DB item | Where | In the Website today | In the designs |
|---|---|---|---|---|
| A1 | `ticket_types.status` on_sale / paused (+ `kind` night) | ticket_types | yes (rows 1-34) | drawn: On sale / Paused / Sold out / Waiting for Stripe |
| A2 | `ticket_types.manual_sold_out` | ticket_types | parsed, no control (GAP 8) | not drawn (no control proposed; 0 rows true in prod) |
| A3 | `ticket_types.occurrence_id`, `valid_from/valid_to` (per-night, course) | ticket_types | public only (GAP 7) | not drawn: stays as today |
| A4 | `ticket_price_steps` (price from a date) + `ticket_price_step_set_v1/remove_v1` | DB | none | drawn: "Set a new price from a date" + owner approval |
| A5 | `ticket_orders.refunded_pence`, `dispute_status` | ticket_orders | refunded/disputed tags; no partial tag | drawn: Part refunded tag, Disputed tag + line |
| A6 | `organiser_stripe_accounts.payouts_enabled` | DB | read, ignored (GAP 1) | drawn: Payouts sheet (owner) |
| A7 | `ticket_promo_codes` (`ticket_promo_create/list/update_v1`) | DB | PromoSection | not drawn: stays as today's PromoSection (Careful lane 6) |
| A8 | `ticket_door_seat_*_v1`, `ticket_check_in_*` | DB | Door screen | guest list sheet shows checked-in per ticket; door seats not drawn |
| A9 | `ticket_sales_summary_v1/v2` `money_visible` | DB | parsed by PR #1541 | **0 of 2 functions emit it in prod today** (Careful lane 1) |
| A10 | `ticket_type_upsert_v1`, `ticket_price_step_set_v1` role check | DB | managers may change price | source has no `'owner'` test: approval must be server-side (Careful lane 2) |

## Coverage in the designs

**147 website rows + 10 admin/DB rows = 157 rows.** Every area is either drawn (fully or partly) or listed
here as "not drawn, stays as today" with the reason; none is silently omitted.

| Area | Rows | In the designs |
|---|---|---|
| Types | 34 | partly: name, price, how many, sold / left bar, sales window, paused, sold out, price lock, Waiting for Stripe. Not drawn (stay as today's TypeSheet): per-order max, per-night, type error copy |
| Row, Ext/Going | 6 | partly: own ticket link offered in the empty state; Going count not drawn (free events, unchanged) |
| Stripe, GetPaid | 18 | partly: none, waiting, connected, payouts. Return banners and poll stay as today |
| Money | 7 | drawn: summary tile, counts-only reason for every role x money_visible |
| Orders | 20 | drawn: title rule (orderTitleFor), lines, all tags incl. new Part refunded, see all; paging unchanged |
| Refund, Refund err | 22 | drawn: full / part, approval step, not_allowed refusal. Other error copy stays as today (GAP 6 is a build fix) |
| Report, CSV | 10 | partly: guest list sheet + download; full sales report stays as today |
| Gates | 4 | drawn: owner / manager / contributor / owner with money off |
| Type err, Promo, Door, Stack, Toasts, Paths, Public | 26 | **not drawn**: unchanged by this tab design (promo: careful lane 6; public page: reads the same types) |
| Admin / DB | 10 | see table above: 6 drawn, 4 not drawn with reason |

Shown in the designs: **127 of 157** rows sit in an area that is drawn (fully or partly: 121 website + 6 admin/DB);
**30** are listed above as not drawn, with the reason (26 website + 4 admin/DB).
