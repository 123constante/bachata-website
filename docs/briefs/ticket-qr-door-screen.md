# BRIEF: QR door scanner screen (Website, normal lane, Opus)

Branch `claude/ticket-qr-door-screen`, repo bachata-website. One slice, one push at the end (plus an early checkpoint push).

## Goal
Door staff on a phone (390x844, dark room, one thumb) scan a buyer's ticket QR and see ONE clear answer, then the next guest. Layout C, picked by the owner.

## Owner decisions (binding)
- Layout **C** from `docs/design/qr-door-scanning/C.html` on branch `claude/ticket-qr-door-mockups` (fetch it; `gen.py` has the single `RESULTS` table). Scan tab + "Tonight's list" tab. NO SIGNAL auto-opens the list.
- ANYONE on the organiser team may scan (the database decides; the client never checks roles).
- The list shows first name + quantity + In / Not in. Nothing else about the buyer.
- Amber `#ffc061` approved: add it as a token to `src/modules/organiser/p3/theme/p3.css` (dark set, plus a light-set value with contrast >= 4.5 on its surface). Use p3 tokens for everything else.

## Database (LIVE on prod, do not change; Supabase read-only for you)
Migration `20270308040000_ticket_check_in_v1.sql` in admin repo (read it on `123constante/bachata-admin` main).
- `rpc('ticket_check_in_v1', {p_qr_token, p_event_series_id})` -> `{result, ticket_type_name, first_name, quantity, checked_in_at, checked_in_by_first_name, in_count, total_count}`. result: `ok | already_in | wrong_event | not_valid | unknown_code | not_allowed`. All keys always present (null when n/a). Raises 42501 when signed out.
- `rpc('ticket_door_list_v1', {p_event_series_id})` -> `{result: ok|not_allowed, rows:[{ticket_id, first_name, quantity_in_order, ticket_type_name, checked_in_at}], truncated, in_count, total_count}` (max 500 rows).
- Call as POST via the Supabase client. There is NO RPC to check someone in from the list by ticket id: the list's In / Not in is READ-ONLY status in v1; the manual path is typing the code printed on the ticket into the code box. Do not invent a new RPC. (If layout C draws an "In" button on list rows, render it as a status chip only, and say so in the handover.)
- Prove the data source first: read both function bodies and `tickets.qr_token` shape on prod (read-only) and state in the handover what the buyer's QR actually encodes (a bare token? a URL containing it?). Find where the buyer ticket QR/code is rendered (email edge function `ticket-email`, thank-you page) and parse accordingly; accept a bare token and a URL whose last path segment or `t`/`token` param is the token.

## Build
1. Route + mount: a "Scan tickets" entry on the P3 event page next to `TicketsEntry` (`src/modules/organiser/p3/screens/EventPage.tsx:221`, behind `flags.organiserTicketing`, P3 look only; old `src/modules/organiser/tickets/*` untouched). Screen takes the series id. Lazy chunk; ZERO bytes added to the dancer-app first load (`npm run check:bundle-budget` on main and branch; never edit perf-budgets.json or vite.config.ts).
2. Scan: `BarcodeDetector` (qr_code) where available, else a small JS decoder loaded lazily only on this screen (pick a small, maintained lib, justify size). Camera permission denied / no camera -> says so plainly and opens the list tab + code box. Debounce: the same code within 2.5 s does not re-fire. Stop the camera on tab hide / unmount.
3. Result mapping: ONE table-driven mapping (result -> band colour token, headline, detail line, vibration pattern, next action) for the 6 results + client-side `no_signal` (offline / fetch failure) + `not_allowed` ("You're not on this event's team"). Same words as C. `already_in` shows WHEN (London time, "21:42") and by whom (first name or nothing). The `ok` band says quantity ("2 tickets") because one order can hold several; confirm in the handover how quantity maps to tickets vs QR codes.
4. Counter "37 of 120 in" from `in_count/total_count`; empty state (0 sold) says what the person can do. Code box with visible label, >= 44 px taps (px sizes, not rem: the site's html font-size is about 13.5px on phones).
5. List tab: first name + quantity + In / Not in, search box, `truncated` note, loading / error / empty states each with an action.
6. Overlay geometry rules (sheets/toasts portalled; `focus({preventScroll:true})`; boxes inside 390x844), no sideways scroll, high contrast, vibration optional (feature-detected).
7. Tests: table-driven over every result x every screen state (mapping, copy, disabled reasons); a camera-mock unit for the debounce; e2e at 390x844 with a mocked RPC covering ok / already_in / wrong_event / not_valid / unknown_code / not_allowed / offline; add the e2e spec BY NAME to the `test:e2e` list. Red first where fixing.
8. Design record `docs/design/ticket-qr-door-screen.md` (stages 3 and 4 results: tokens added, contrast numbers, tap sizes). Stage 5 critique + stage 6 walk are the orchestrator's.

## Do not
Change the database, the admin repo, edge functions, `package.json` scripts other than the e2e list, calendar density-exempt files, or any flag default. No raw Unicode punctuation in JSX (use entities). Large files via `scripts/safe-edit.py` / `safe-write.py`.

## Hand-off
PR body: Verified / Not verified (real camera scan on a phone is NOT verified; say so), per-CI-job table, harness screenshots at 390x844 for all 8 states in `docs/handovers/ticket-qr-door-screen/`. Handover `docs/handovers/ticket-qr-door-screen.md`. Context cap 50%; write `PARTIAL` with what is left rather than run long.
