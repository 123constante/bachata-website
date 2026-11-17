# Brief: organiser Tickets screen, option A "One big number" + exit link (BUILD, behind a flag)

Owner CONFIRMED design 2026-11-17 (registry row 12). Design is decided: no product questions. Smallest working version, ONE branch, ONE PR off origin/main, everything behind NEW flag `organiserTicketsA` (`VITE_ENABLE_ORGANISER_TICKETS_A`, off by default, needs organiserTicketing + organiserP3 + organiserShellV2). OFF = every screen exactly as today.

## Scope
1. Tickets screen A1 (before), A2 (door night), A3 (after): ONE no-scroll 390x844 screen that changes with the clock for the chosen night. Sheets A4 Money, A5 Who bought, A6 Batches, A7 Sell at the door.
2. Exit link: always-visible top-left "Back to bachatacalendar.co.uk" (44px white bar above 48px header, 12px 500 #464646, chevron) on every organiser screen under the flag. Today `src/modules/organiser/p3/v2/V2Shell.tsx` has `BACK_WORD = 'Back to Bachata Calendar'`; under the flag use the new wording and link to the public site root.
3. Reuse what exists (src/modules/organiser/p3/tickets/*, door/*, RPCs `ticket_sales_summary_v2`, `ticket_orders_for_organiser_v1`, `ticket_door_list_v2`, `ticket_check_in_*`, `ticket_type_upsert_v1`, `ticket_price_step_set_v1`, edge fn `ticket-refund`). Zero migrations in this repo (schema authority = bachata-admin-11april). No new RPC.
4. Not built yet (no RPC): message buyers, reminders, sell at the door, did-not-come list, payout amount/date, auto-open next batch. Keep these STUBBED behind the flag: draw the control, wire where an existing RPC covers it, otherwise a plain "Coming soon" row; never fake data as real. Do NOT add prod writes. List each stub in the PR body.
5. Kept details: A7 = Last tickets price, "N left", optional Name field, cash only, buyer auto marked as in, button "Took cash" (stub if no RPC). A6 = 3 batches with state badges, "opens by itself" sentence + Open now, "Change a price", "A new price only counts for tickets sold from now on". A5 = search a name, 3 latest buyers, "See all N", buyer row opens order and refund (existing RefundSheet).
6. Placeholders in boards (names, numbers, payout date "Wed 25 Nov") are NOT facts: use real data; money only in the Money sheet; managers see counts, owner sees money (existing rule).

## Rules
- Plain words. Banned words in UI copy: tier, inventory, SKU, conversion, check-in rate, attendee, RSVP, payout schedule, Stripe, QR code reader, CSV. Say "batch", "people", "came", "did not come".
- Tap targets >= 44px explicit px (phone html font ~13.5px). Orange #C2410C is the only accent. HTML entities in JSX (`&mdash;` etc), no raw Unicode punctuation.
- Source files over 2 KB: `scripts/safe-edit.py` / `scripts/safe-write.py` (raw Edit/Write refused by hook). See CLAUDE.md.
- Tests: unit tests for the clock-state model (before/door/after) and flag-off parity. `npm run test:unit`, `npm run lint`, `npm run pre-ship`.
- Check: walk at 390x844 on prod-shaped data (project `stsdtacfauprzrdebmzg`, read-only counts, no personal data, never a write); "Verified on real data" block in the PR. Screenshots in the PR.
- PR body: what it does, flag name, stubs list, Not verified. No review pack.

## Look (binding)
## Look (Round 4c: MEASURED from the Supabase dashboard kit, light theme, our orange replaces their green. Source: supabase-measured.md beside this file. Do not deviate.)
- Root: exactly 390x844, page background #FDFDFD, cards #FFFFFF, text #030303, Inter. Body 15px/1.5. Most UI text is 13px; small text 12px. Secondary text #464646, tertiary and placeholder #696969. Border default #E9E9E9, strong/input #D9D9D9.
- Weights: 400 body, 500 for buttons, row titles, headings. 600 only for the page title and stat numbers. NEVER 700.
- Type: page title 22px 600 letter-spacing -0.025em; section title 18px 500; row title 15px 500; row second line 13px #696969. Meta label (replaces the old grey uppercase label): "Source Code Pro", monospace, 12px, 500, uppercase, letter-spacing 0.05em, #696969. Add Source Code Pro (500) to the Google Fonts link.
- Spacing (4px unit): page side padding 16px; card padding 16px; gap between blocks in a section 24px; between sections 48px where the board fits, never under 24px; label to field 8px; form rows 24px; icon to label 8px; stacked buttons 8px.
- Buttons, visual size as measured: main action = "large": 42px high, padding 0 16px, 15px 500, radius 10px, full width. Other buttons = "small": 34px high, padding 0 12px, 13px 500, radius 9px. Tiny (26px, padding 0 10px, 12px, radius 8px) only for inline chips inside a row. Icon in button 18px (20px in large).
  - Primary: background #C2410C, text #FFFAF7, no border, box-shadow 0 1px 3px rgba(0,0,0,0.04). At most one per board.
  - Default (secondary): background #FFFFFF, text #030303, NO border; edge is box-shadow inset 0 0 0 1px rgba(0,0,0,0.10), 0 1px 3px rgba(0,0,0,0.04).
  - Outline: transparent, 1px #D9D9D9. Text/ghost: transparent, no edge. Link: text #C2410C.
  - Danger: background #AB413E, text #FFF9F8. Red only for refund, cancel a night, remove a person. Disabled (any variant): same colours at opacity 0.5.
  - Tap target: keep the visual height above, and give every button at least 44px of tappable height by leaving free space around it (a 34px button sits in a row or wrapper at least 44px high; never stack two 34px buttons closer than 10px).
- Inputs: real <label> + <input>. Field 42px high, padding 0 12px, radius 8px, 1px #D9D9D9 border, background #FAFAFA, text 16px (phones zoom on smaller text; the one deviation from the measured 13px). Label 13px 400 #464646, 8px above the field. Helper 13px #696969, 8px below. Checkbox 16x16 radius 5px. Switch 44x24, thumb 18px, on = #C2410C.
- Cards: #FFFFFF, 1px #E9E9E9, radius 11px, box-shadow 0 1px 2px rgba(0,0,0,0.05), padding 16px. A card with parts is split by 1px #E9E9E9 dividers, each part padded 16px. Card title = meta label. No gradients, no coloured side stripes, no emoji, no fake phone status bar.
- Stat tiles 2-up (gap 12px): meta label above a 24px 600 number.
- Lists: full-width rows inside one card, rows split by 1px #E9E9E9, each row padding 16px (min 52px): row title + optional second line, then badge and chevron (16px, #696969).
- Badges (replace the old pills): fully round, 1px border, padding 3px 7px, 11px, 500, uppercase, letter-spacing 0.07em, line-height 1 (about 20px high). Live / On sale / Open / Paid / In = success: background rgba(22,182,116,0.10), text #097C4F, border #16B674. Draft / Paused / Past / Closed / Waiting / Cancelled / Refunded = default: background #FFFFFF, text #464646, border #D9D9D9 (never red). Sold out = text #FDFDFD on #030303, border #030303. To-do count badge: orange #C2410C fill, #FFFAF7 text.
- Orange #C2410C ONLY for the one main action, links, switch on, and the active state (active tab, selected chip, to-do badge).
- Icons: inline stroke SVG only (24 viewBox, stroke-width 2, round caps), same style as the exemplar. `aria-hidden="true"` on decorative ones, `aria-label` on icon-only buttons.
- Header: organiser tab screens (Home, Events, Tickets, Team) use the exemplar header unchanged (page name + chevron on the left = Switch page, "To do" + orange count badge on the right) and the exemplar tab bar with the right tab active (orange, 500, `aria-current="page"`). Screens one level down use a 56px header with a back chevron button (44px, aria-label "Back") + the screen title (15px, 500), and keep the tab bar with the parent tab active.
- Bottom sheets: draw the parent screen dimmed behind (a simple version of it is enough), scrim `rgba(0,0,0,0.5)` over the whole 390x844, sheet pinned to the bottom, white, radius 16px on the top corners only, padding 16px, a 100x8 fully round #D9D9D9 handle 16px from the top, title 15px 600, buttons stacked with 8px gap, a close button (44px, aria-label "Close"). No tab bar visible above the sheet.
- Door staff screens: NO organiser header and NO tab bar. Their own header: night name + "Door" and a two-part switch "Scan | Search" (selected part: orange text, 2px orange underline).

## Format rules (each fails silently if broken)
- Keep `<script src="./support.js"></script>` exactly. Close every non-void element, quote every attribute.
- All styling inline `style="..."` except the helmet block copied from the exemplar. Layout with flex or grid plus gap.
- Copy is literal text in the markup, not props. Keep the closing `<script type="text/x-dc" data-dc-script ...>` block exactly as in the exemplar.
- Real `<button>`, `<a href>`, `<input>` + `<label>`; never onClick on a div. Links between boards: `<a href="R4Name.dc.html">` using the names in "All board names" below. Style the `<a>` itself; never put a button inside a link.
- No lorem ipsum. No text below 12px except badges (11px). Everything must FIT inside 844px height with the tab bar (64px) not covering content: budget the heights; cut rows rather than overflow. Long lists may end with a "Show all 62" row.
- Each file has its own short `<title>`. Target 5-8 KB per file; do not pad.


## Boards (design source; static HTML mockups, placeholders only)

### TxA1Before
```html
<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<title>Tickets before the night</title>
<script src="./support.js"></script>
</head>
<body>
<x-dc>
<helmet>
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600&family=Source+Code+Pro:wght@500&display=swap">
<style>
body{margin:0}
button{font:inherit;color:inherit;cursor:pointer}
a{color:#C2410C}a:hover{color:#9A3412}
::selection{background:#FED7AA}
:focus-visible{outline:2px solid #C2410C;outline-offset:2px}
</style>
</helmet>
<div style="width:390px;height:844px;position:relative;overflow:hidden;box-sizing:border-box;background:#FDFDFD;color:#030303;font-family:Inter,system-ui,sans-serif;font-size:15px;line-height:1.5;font-variant-numeric:tabular-nums">
<div style="height:44px;box-sizing:border-box;padding:0 8px;display:flex;align-items:center;background:#FFFFFF">
<a href="https://bachatacalendar.co.uk" style="height:44px;padding:0 8px;display:flex;align-items:center;gap:4px;font-size:12px;font-weight:500;color:#464646;text-decoration:none">
<svg aria-hidden="true" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m15 6-6 6 6 6"/></svg>Back to bachatacalendar.co.uk</a>
</div>

<header style="height:48px;box-sizing:border-box;padding:0 8px 0 16px;display:flex;align-items:center;justify-content:space-between;border-bottom:1px solid #E9E9E9;background:#FFFFFF">
<button style="display:flex;align-items:center;gap:8px;height:44px;padding:0;border:0;background:none;font-size:15px;font-weight:500" aria-label="Switch page, now showing Ritmo London">Ritmo London
<svg aria-hidden="true" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#696969" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m6 9 6 6 6-6"/></svg>
</button>
<button style="display:flex;align-items:center;gap:8px;height:44px;padding:0 8px;border:0;background:none;font-size:13px;font-weight:500;color:#464646">To do
<span style="min-width:20px;height:20px;box-sizing:border-box;padding:0 6px;border-radius:10px;background:#C2410C;color:#FFFAF7;font-size:11px;font-weight:500;line-height:1;display:flex;align-items:center;justify-content:center">2</span>
</button>
</header>

<main style="padding:24px 16px 0;display:flex;flex-direction:column;gap:32px">

<div style="display:flex;flex-direction:column;gap:4px">
<div style="display:flex;align-items:center;justify-content:space-between;gap:12px">
<h1 style="margin:0;font-size:22px;line-height:1.2;font-weight:600;letter-spacing:-0.025em">Friday Social</h1>
<span style="flex:none;padding:3px 7px;border-radius:999px;border:1px solid #16B674;background:rgba(22,182,116,0.10);color:#097C4F;font-size:11px;font-weight:500;line-height:1;letter-spacing:0.07em;text-transform:uppercase">In 3 days</span>
</div>
<p style="margin:0;font-size:13px;color:#464646">Fri 20 Nov, 21:00 at Soho Dance Studio</p>
</div>

<div style="display:flex;flex-direction:column;gap:12px">
<div style="font-size:48px;line-height:1.1;font-weight:600;letter-spacing:-0.03em">41 <span style="font-size:18px;font-weight:500;letter-spacing:0;color:#464646">of 80 sold</span></div>
<div role="img" aria-label="41 of 80 tickets sold" style="height:6px;border-radius:3px;background:#E9E9E9;overflow:hidden">
<div style="width:51.25%;height:6px;border-radius:3px;background:#030303"></div>
</div>
<p style="margin:0;color:#464646">9 sold in the last 2 days. On track to sell out by Friday.</p>
</div>

<div style="min-height:44px;display:flex;align-items:center">
<button style="height:42px;width:100%;padding:0 16px;border:0;border-radius:10px;background:#C2410C;color:#FFFAF7;box-shadow:0 1px 3px rgba(0,0,0,0.04);font-size:15px;font-weight:500;display:flex;align-items:center;justify-content:center;gap:8px">
<svg aria-hidden="true" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="5" width="18" height="14" rx="2"/><path d="m3 8 9 6 9-6"/></svg>
Message everyone who bought
</button>
</div>

<div style="background:#FFFFFF;border:1px solid #E9E9E9;border-radius:11px;box-shadow:0 1px 2px rgba(0,0,0,0.05);display:flex;flex-direction:column">
<div style="display:flex;flex-direction:column">
<a href="TxA6Batches.dc.html" style="height:48px;box-sizing:border-box;padding:0 16px;display:flex;align-items:center;gap:8px;font-size:15px;color:#030303;text-decoration:none">
<span style="flex:1;font-weight:500">Price and batches</span>
<svg aria-hidden="true" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#696969" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m9 6 6 6-6 6"/></svg>
</a>
<div style="min-height:44px;padding:0 16px 12px;display:flex;align-items:center;gap:12px">
<p style="flex:1;min-width:0;margin:0;font-size:13px;color:#696969">Last tickets open by themselves when Standard sells out.</p>
<button style="flex:none;height:34px;padding:0 12px;border:0;border-radius:9px;background:#FFFFFF;color:#030303;box-shadow:inset 0 0 0 1px rgba(0,0,0,0.10),0 1px 3px rgba(0,0,0,0.04);font-size:13px;font-weight:500">Open now</button>
</div>
</div>
<a href="TxA5WhoBought.dc.html" style="min-height:52px;box-sizing:border-box;padding:0 16px;border-top:1px solid #E9E9E9;display:flex;align-items:center;gap:8px;font-size:15px;color:#030303;text-decoration:none">
<span style="flex:1;font-weight:500">Who bought</span>
<span style="font-size:13px;color:#464646">41 people</span>
<svg aria-hidden="true" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#696969" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m9 6 6 6-6 6"/></svg>
</a>
<button style="width:100%;box-sizing:border-box;padding:16px;border:0;border-top:1px solid #E9E9E9;background:none;display:flex;align-items:center;gap:8px;text-align:left;font-size:15px">
<span style="flex:1;min-width:0;display:flex;flex-direction:column">
<span style="font-weight:500">Reminders</span>
<span style="font-size:13px;color:#696969">We email everyone the day before.</span>
</span>
<svg aria-hidden="true" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#696969" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m9 6 6 6-6 6"/></svg>
</button>
<a href="TxA4Money.dc.html" style="min-height:52px;box-sizing:border-box;padding:0 16px;display:flex;align-items:center;gap:8px;color:#030303;text-decoration:none;border-top:1px solid #E9E9E9">
<span style="flex:1;font-weight:500">Money and payouts</span>
<span style="font-size:13px;color:#464646">£402 so far</span>
<svg aria-hidden="true" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#696969" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m9 6 6 6-6 6"/></svg>
</a>
</div>

</main>

<nav aria-label="Main" style="position:absolute;left:0;right:0;bottom:0;height:64px;border-top:1px solid #E9E9E9;background:#FFFFFF;display:grid;grid-template-columns:repeat(4,minmax(0,1fr))">
<a href="R4HomeBefore.dc.html" style="display:flex;flex-direction:column;align-items:center;justify-content:center;gap:4px;font-size:12px;font-weight:400;color:#464646;text-decoration:none">
<svg aria-hidden="true" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 11 12 3l9 8"/><path d="M5 10v10h14V10"/><path d="M10 20v-6h4v6"/></svg>Home</a>
<a href="R4Events.dc.html" style="display:flex;flex-direction:column;align-items:center;justify-content:center;gap:4px;font-size:12px;font-weight:400;color:#464646;text-decoration:none">
<svg aria-hidden="true" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="5" width="18" height="16" rx="2"/><path d="M3 10h18"/><path d="M8 3v4"/><path d="M16 3v4"/></svg>Events</a>
<a href="TxA1Before.dc.html" aria-current="page" style="display:flex;flex-direction:column;align-items:center;justify-content:center;gap:4px;font-size:12px;font-weight:500;color:#C2410C;text-decoration:none">
<svg aria-hidden="true" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 9V6a1 1 0 0 1 1-1h16a1 1 0 0 1 1 1v3a3 3 0 0 0 0 6v3a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1v-3a3 3 0 0 0 0-6Z"/><path d="M14 5v14" stroke-dasharray="2 3"/></svg>Tickets</a>
<a href="R4Team.dc.html" style="display:flex;flex-direction:column;align-items:center;justify-content:center;gap:4px;font-size:12px;font-weight:400;color:#464646;text-decoration:none">
<svg aria-hidden="true" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="9" cy="8" r="3.5"/><path d="M2.5 20a6.5 6.5 0 0 1 13 0"/><path d="M16 4.6a3.5 3.5 0 0 1 0 6.8"/><path d="M18 14.3a6.5 6.5 0 0 1 3.5 5.7"/></svg>Team</a>
</nav>

</div>
</x-dc>
<script type="text/x-dc" data-dc-script data-props='{"$preview":{"width":390,"height":844}}'>
class Component extends DCLogic {
renderVals() { return {}; }
}
</script>
</body>
</html>

```

### TxA2Door
```html
<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<title>Tickets on door night</title>
<script src="./support.js"></script>
</head>
<body>
<x-dc>
<helmet>
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600&family=Source+Code+Pro:wght@500&display=swap">
<style>
body{margin:0}
button{font:inherit;color:inherit;cursor:pointer}
a{color:#C2410C}a:hover{color:#9A3412}
::selection{background:#FED7AA}
:focus-visible{outline:2px solid #C2410C;outline-offset:2px}
</style>
</helmet>
<div style="width:390px;height:844px;position:relative;overflow:hidden;box-sizing:border-box;background:#FDFDFD;color:#030303;font-family:Inter,system-ui,sans-serif;font-size:15px;line-height:1.5;font-variant-numeric:tabular-nums">
<div style="height:44px;box-sizing:border-box;padding:0 8px;display:flex;align-items:center;background:#FFFFFF">
<a href="https://bachatacalendar.co.uk" style="height:44px;padding:0 8px;display:flex;align-items:center;gap:4px;font-size:12px;font-weight:500;color:#464646;text-decoration:none">
<svg aria-hidden="true" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m15 6-6 6 6 6"/></svg>Back to bachatacalendar.co.uk</a>
</div>

<header style="height:48px;box-sizing:border-box;padding:0 8px 0 16px;display:flex;align-items:center;justify-content:space-between;border-bottom:1px solid #E9E9E9;background:#FFFFFF">
<button style="display:flex;align-items:center;gap:8px;height:44px;padding:0;border:0;background:none;font-size:15px;font-weight:500" aria-label="Switch page, now showing Ritmo London">Ritmo London
<svg aria-hidden="true" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#696969" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m6 9 6 6 6-6"/></svg>
</button>
<button style="display:flex;align-items:center;gap:8px;height:44px;padding:0 8px;border:0;background:none;font-size:13px;font-weight:500;color:#464646">To do
<span style="min-width:20px;height:20px;box-sizing:border-box;padding:0 6px;border-radius:10px;background:#C2410C;color:#FFFAF7;font-size:11px;font-weight:500;line-height:1;display:flex;align-items:center;justify-content:center">2</span>
</button>
</header>

<main style="padding:24px 16px 0;display:flex;flex-direction:column;gap:40px">

<div style="display:flex;flex-direction:column;gap:4px">
<div style="display:flex;align-items:center;justify-content:space-between;gap:12px">
<h1 style="margin:0;font-size:22px;line-height:1.2;font-weight:600;letter-spacing:-0.025em">Friday Social</h1>
<span style="flex:none;padding:3px 7px;border-radius:999px;border:1px solid #16B674;background:rgba(22,182,116,0.10);color:#097C4F;font-size:11px;font-weight:500;line-height:1;letter-spacing:0.07em;text-transform:uppercase">Tonight</span>
</div>
<p style="margin:0;font-size:13px;color:#464646">Fri 20 Nov, 21:00 at Soho Dance Studio</p>
</div>

<div style="display:flex;flex-direction:column;gap:8px">
<div style="font-size:48px;line-height:1.1;font-weight:600;letter-spacing:-0.03em">41 <span style="font-size:18px;font-weight:500;letter-spacing:0;color:#464646">in</span></div>
<p style="margin:0;color:#464646">35 still to arrive, 76 expected</p>
</div>

<div style="min-height:44px;display:flex;align-items:center">
<a href="R4DoorScan.dc.html" style="height:42px;width:100%;box-sizing:border-box;padding:0 16px;border-radius:10px;background:#C2410C;color:#FFFAF7;box-shadow:0 1px 3px rgba(0,0,0,0.04);font-size:15px;font-weight:500;text-decoration:none;display:flex;align-items:center;justify-content:center;gap:8px">
<svg aria-hidden="true" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 8V5a1 1 0 0 1 1-1h3"/><path d="M16 4h3a1 1 0 0 1 1 1v3"/><path d="M20 16v3a1 1 0 0 1-1 1h-3"/><path d="M8 20H5a1 1 0 0 1-1-1v-3"/><path d="M8 12h8"/></svg>
Scan a ticket
</a>
</div>

<div style="background:#FFFFFF;border:1px solid #E9E9E9;border-radius:11px;box-shadow:0 1px 2px rgba(0,0,0,0.05);display:flex;flex-direction:column">
<a href="R4DoorSearch.dc.html" style="min-height:52px;box-sizing:border-box;padding:0 16px;display:flex;align-items:center;gap:8px;color:#030303;text-decoration:none">
<span style="flex:1;font-weight:500">Search a name</span>
<svg aria-hidden="true" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#696969" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m9 6 6 6-6 6"/></svg>
</a>
<a href="TxA7SellDoor.dc.html" style="box-sizing:border-box;padding:16px;border-top:1px solid #E9E9E9;display:flex;align-items:center;gap:8px;font-size:15px;color:#030303;text-decoration:none">
<span style="flex:1;min-width:0;display:flex;flex-direction:column">
<span style="font-weight:500">Sell at the door</span>
<span style="font-size:13px;color:#696969">Last tickets £15, 12 of 20 sold</span>
</span>
<svg aria-hidden="true" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#696969" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m9 6 6 6-6 6"/></svg>
</a>
<button style="width:100%;box-sizing:border-box;padding:16px;border:0;border-top:1px solid #E9E9E9;background:none;display:flex;align-items:center;gap:8px;text-align:left;font-size:15px">
<span style="flex:1;min-width:0;display:flex;flex-direction:column">
<span style="font-weight:500">Last in: Maya Okafor</span>
<span style="font-size:13px;color:#696969">2 tickets, 21:38</span>
</span>
<svg aria-hidden="true" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#696969" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m9 6 6 6-6 6"/></svg>
</button>
</div>

</main>

<nav aria-label="Main" style="position:absolute;left:0;right:0;bottom:0;height:64px;border-top:1px solid #E9E9E9;background:#FFFFFF;display:grid;grid-template-columns:repeat(4,minmax(0,1fr))">
<a href="R4HomeBefore.dc.html" style="display:flex;flex-direction:column;align-items:center;justify-content:center;gap:4px;font-size:12px;font-weight:400;color:#464646;text-decoration:none">
<svg aria-hidden="true" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 11 12 3l9 8"/><path d="M5 10v10h14V10"/><path d="M10 20v-6h4v6"/></svg>Home</a>
<a href="R4Events.dc.html" style="display:flex;flex-direction:column;align-items:center;justify-content:center;gap:4px;font-size:12px;font-weight:400;color:#464646;text-decoration:none">
<svg aria-hidden="true" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="5" width="18" height="16" rx="2"/><path d="M3 10h18"/><path d="M8 3v4"/><path d="M16 3v4"/></svg>Events</a>
<a href="TxA2Door.dc.html" aria-current="page" style="display:flex;flex-direction:column;align-items:center;justify-content:center;gap:4px;font-size:12px;font-weight:500;color:#C2410C;text-decoration:none">
<svg aria-hidden="true" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 9V6a1 1 0 0 1 1-1h16a1 1 0 0 1 1 1v3a3 3 0 0 0 0 6v3a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1v-3a3 3 0 0 0 0-6Z"/><path d="M14 5v14" stroke-dasharray="2 3"/></svg>Tickets</a>
<a href="R4Team.dc.html" style="display:flex;flex-direction:column;align-items:center;justify-content:center;gap:4px;font-size:12px;font-weight:400;color:#464646;text-decoration:none">
<svg aria-hidden="true" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="9" cy="8" r="3.5"/><path d="M2.5 20a6.5 6.5 0 0 1 13 0"/><path d="M16 4.6a3.5 3.5 0 0 1 0 6.8"/><path d="M18 14.3a6.5 6.5 0 0 1 3.5 5.7"/></svg>Team</a>
</nav>

</div>
</x-dc>
<script type="text/x-dc" data-dc-script data-props='{"$preview":{"width":390,"height":844}}'>
class Component extends DCLogic {
renderVals() { return {}; }
}
</script>
</body>
</html>

```

### TxA3After
```html
<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<title>Tickets after the night</title>
<script src="./support.js"></script>
</head>
<body>
<x-dc>
<helmet>
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600&family=Source+Code+Pro:wght@500&display=swap">
<style>
body{margin:0}
button{font:inherit;color:inherit;cursor:pointer}
a{color:#C2410C}a:hover{color:#9A3412}
::selection{background:#FED7AA}
:focus-visible{outline:2px solid #C2410C;outline-offset:2px}
</style>
</helmet>
<div style="width:390px;height:844px;position:relative;overflow:hidden;box-sizing:border-box;background:#FDFDFD;color:#030303;font-family:Inter,system-ui,sans-serif;font-size:15px;line-height:1.5;font-variant-numeric:tabular-nums">
<div style="height:44px;box-sizing:border-box;padding:0 8px;display:flex;align-items:center;background:#FFFFFF">
<a href="https://bachatacalendar.co.uk" style="height:44px;padding:0 8px;display:flex;align-items:center;gap:4px;font-size:12px;font-weight:500;color:#464646;text-decoration:none">
<svg aria-hidden="true" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m15 6-6 6 6 6"/></svg>Back to bachatacalendar.co.uk</a>
</div>

<header style="height:48px;box-sizing:border-box;padding:0 8px 0 16px;display:flex;align-items:center;justify-content:space-between;border-bottom:1px solid #E9E9E9;background:#FFFFFF">
<button style="display:flex;align-items:center;gap:8px;height:44px;padding:0;border:0;background:none;font-size:15px;font-weight:500" aria-label="Switch page, now showing Ritmo London">Ritmo London
<svg aria-hidden="true" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#696969" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m6 9 6 6 6-6"/></svg>
</button>
<button style="display:flex;align-items:center;gap:8px;height:44px;padding:0 8px;border:0;background:none;font-size:13px;font-weight:500;color:#464646">To do
<span style="min-width:20px;height:20px;box-sizing:border-box;padding:0 6px;border-radius:10px;background:#C2410C;color:#FFFAF7;font-size:11px;font-weight:500;line-height:1;display:flex;align-items:center;justify-content:center">2</span>
</button>
</header>

<main style="padding:24px 16px 0;display:flex;flex-direction:column;gap:40px">

<div style="display:flex;flex-direction:column;gap:4px">
<div style="display:flex;align-items:center;justify-content:space-between;gap:12px">
<h1 style="margin:0;font-size:22px;line-height:1.2;font-weight:600;letter-spacing:-0.025em">Friday Social</h1>
<span style="flex:none;padding:3px 7px;border-radius:999px;border:1px solid #D9D9D9;background:#FFFFFF;color:#464646;font-size:11px;font-weight:500;line-height:1;letter-spacing:0.07em;text-transform:uppercase">Yesterday</span>
</div>
<p style="margin:0;font-size:13px;color:#464646">Fri 20 Nov, 21:00 at Soho Dance Studio</p>
</div>

<div style="display:flex;flex-direction:column;gap:8px">
<div style="font-size:48px;line-height:1.1;font-weight:600;letter-spacing:-0.03em">69 <span style="font-size:18px;font-weight:500;letter-spacing:0;color:#464646">came</span></div>
<p style="margin:0;color:#464646">11 did not come</p>
</div>

<div style="min-height:44px;display:flex;align-items:center">
<button style="height:42px;width:100%;padding:0 16px;border:0;border-radius:10px;background:#C2410C;color:#FFFAF7;box-shadow:0 1px 3px rgba(0,0,0,0.04);font-size:15px;font-weight:500;display:flex;align-items:center;justify-content:center;gap:8px">
<svg aria-hidden="true" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="5" width="18" height="14" rx="2"/><path d="m3 8 9 6 9-6"/></svg>
Message everyone who came
</button>
</div>

<div style="background:#FFFFFF;border:1px solid #E9E9E9;border-radius:11px;box-shadow:0 1px 2px rgba(0,0,0,0.05);display:flex;flex-direction:column">
<button style="min-height:52px;width:100%;box-sizing:border-box;padding:0 16px;border:0;background:none;display:flex;align-items:center;gap:8px;text-align:left;font-size:15px">
<span style="flex:1;font-weight:500">Who came</span>
<span style="font-size:13px;color:#464646">69</span>
<svg aria-hidden="true" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#696969" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m9 6 6 6-6 6"/></svg>
</button>
<button style="width:100%;box-sizing:border-box;padding:16px;border:0;border-top:1px solid #E9E9E9;background:none;display:flex;align-items:center;gap:8px;text-align:left;font-size:15px">
<span style="flex:1;min-width:0;display:flex;flex-direction:column">
<span style="font-weight:500">Who did not come</span>
<span style="font-size:13px;color:#696969">Tom Reed, Aisha Bello, Luca Moretti and 8 more</span>
</span>
<span style="font-size:13px;color:#464646">11</span>
<svg aria-hidden="true" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#696969" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m9 6 6 6-6 6"/></svg>
</button>
<a href="TxA4Money.dc.html" style="min-height:52px;box-sizing:border-box;padding:0 16px;display:flex;align-items:center;gap:8px;color:#030303;text-decoration:none;border-top:1px solid #E9E9E9">
<span style="flex:1;font-weight:500">Money and payouts</span>
<span style="font-size:13px;color:#464646">£828 on its way</span>
<svg aria-hidden="true" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#696969" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m9 6 6 6-6 6"/></svg>
</a>
</div>

</main>

<nav aria-label="Main" style="position:absolute;left:0;right:0;bottom:0;height:64px;border-top:1px solid #E9E9E9;background:#FFFFFF;display:grid;grid-template-columns:repeat(4,minmax(0,1fr))">
<a href="R4HomeBefore.dc.html" style="display:flex;flex-direction:column;align-items:center;justify-content:center;gap:4px;font-size:12px;font-weight:400;color:#464646;text-decoration:none">
<svg aria-hidden="true" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 11 12 3l9 8"/><path d="M5 10v10h14V10"/><path d="M10 20v-6h4v6"/></svg>Home</a>
<a href="R4Events.dc.html" style="display:flex;flex-direction:column;align-items:center;justify-content:center;gap:4px;font-size:12px;font-weight:400;color:#464646;text-decoration:none">
<svg aria-hidden="true" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="5" width="18" height="16" rx="2"/><path d="M3 10h18"/><path d="M8 3v4"/><path d="M16 3v4"/></svg>Events</a>
<a href="TxA3After.dc.html" aria-current="page" style="display:flex;flex-direction:column;align-items:center;justify-content:center;gap:4px;font-size:12px;font-weight:500;color:#C2410C;text-decoration:none">
<svg aria-hidden="true" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 9V6a1 1 0 0 1 1-1h16a1 1 0 0 1 1 1v3a3 3 0 0 0 0 6v3a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1v-3a3 3 0 0 0 0-6Z"/><path d="M14 5v14" stroke-dasharray="2 3"/></svg>Tickets</a>
<a href="R4Team.dc.html" style="display:flex;flex-direction:column;align-items:center;justify-content:center;gap:4px;font-size:12px;font-weight:400;color:#464646;text-decoration:none">
<svg aria-hidden="true" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="9" cy="8" r="3.5"/><path d="M2.5 20a6.5 6.5 0 0 1 13 0"/><path d="M16 4.6a3.5 3.5 0 0 1 0 6.8"/><path d="M18 14.3a6.5 6.5 0 0 1 3.5 5.7"/></svg>Team</a>
</nav>

</div>
</x-dc>
<script type="text/x-dc" data-dc-script data-props='{"$preview":{"width":390,"height":844}}'>
class Component extends DCLogic {
renderVals() { return {}; }
}
</script>
</body>
</html>

```

### TxA4Money
```html
<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<title>Money and payouts</title>
<script src="./support.js"></script>
</head>
<body>
<x-dc>
<helmet>
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600&family=Source+Code+Pro:wght@500&display=swap">
<style>
body{margin:0}
button{font:inherit;color:inherit;cursor:pointer}
a{color:#C2410C}a:hover{color:#9A3412}
::selection{background:#FED7AA}
:focus-visible{outline:2px solid #C2410C;outline-offset:2px}
</style>
</helmet>
<div style="width:390px;height:844px;position:relative;overflow:hidden;box-sizing:border-box;background:#FDFDFD;color:#030303;font-family:Inter,system-ui,sans-serif;font-size:15px;line-height:1.5;font-variant-numeric:tabular-nums">

<div aria-hidden="true">
<div style="height:44px;box-sizing:border-box;padding:0 16px;display:flex;align-items:center;gap:4px;background:#FFFFFF;font-size:12px;font-weight:500;color:#464646">
<svg aria-hidden="true" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m15 6-6 6 6 6"/></svg>Back to bachatacalendar.co.uk
</div>
<div style="height:48px;box-sizing:border-box;padding:0 16px;display:flex;align-items:center;justify-content:space-between;border-bottom:1px solid #E9E9E9;background:#FFFFFF">
<span style="font-size:15px;font-weight:500">Ritmo London</span>
<span style="font-size:13px;font-weight:500;color:#464646">To do</span>
</div>
<div style="padding:24px 16px 0;display:flex;flex-direction:column;gap:40px">
<div style="display:flex;flex-direction:column;gap:4px">
<div style="display:flex;align-items:center;justify-content:space-between;gap:12px">
<div style="font-size:22px;line-height:1.2;font-weight:600;letter-spacing:-0.025em">Friday Social</div>
<span style="flex:none;padding:3px 7px;border-radius:999px;border:1px solid #D9D9D9;background:#FFFFFF;color:#464646;font-size:11px;font-weight:500;line-height:1;letter-spacing:0.07em;text-transform:uppercase">Yesterday</span>
</div>
<div style="font-size:13px;color:#464646">Fri 20 Nov, 21:00 at Soho Dance Studio</div>
</div>
<div style="display:flex;flex-direction:column;gap:8px">
<div style="font-size:48px;line-height:1.1;font-weight:600;letter-spacing:-0.03em">69 <span style="font-size:18px;font-weight:500;letter-spacing:0;color:#464646">came</span></div>
<div style="color:#464646">11 did not come</div>
</div>
<div style="height:42px;border-radius:10px;background:#C2410C;color:#FFFAF7;font-size:15px;font-weight:500;display:flex;align-items:center;justify-content:center">Message everyone who came</div>
</div>
</div>

<div style="position:absolute;left:0;top:0;width:390px;height:844px;background:rgba(0,0,0,0.5)"></div>

<section role="dialog" aria-modal="true" aria-labelledby="money-title" style="position:absolute;left:0;right:0;bottom:0;box-sizing:border-box;padding:16px;background:#FFFFFF;border-radius:16px 16px 0 0;display:flex;flex-direction:column;gap:16px">
<div style="display:flex;flex-direction:column;gap:8px">
<div style="width:100px;height:8px;border-radius:999px;background:#D9D9D9;align-self:center"></div>
<div style="display:flex;align-items:center;justify-content:space-between">
<h1 id="money-title" style="margin:0;font-size:15px;line-height:1.5;font-weight:600">Money and payouts</h1>
<a href="TxA3After.dc.html" aria-label="Close" style="width:44px;height:44px;margin-right:-12px;display:flex;align-items:center;justify-content:center;color:#464646">
<svg aria-hidden="true" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M6 6l12 12"/><path d="M18 6 6 18"/></svg>
</a>
</div>
</div>

<div style="display:flex;flex-direction:column;gap:4px">
<div style="font-family:'Source Code Pro',monospace;font-size:12px;font-weight:500;letter-spacing:0.05em;text-transform:uppercase;color:#696969">On its way to your bank</div>
<div style="font-size:24px;line-height:1.2;font-weight:600">£828</div>
<p style="margin:0;font-size:13px;color:#464646">Arrives by Wed 25 Nov. You do not need to do anything.</p>
</div>

<div style="border:1px solid #E9E9E9;border-radius:11px;box-shadow:0 1px 2px rgba(0,0,0,0.05);display:flex;flex-direction:column">
<div style="padding:16px;display:flex;flex-direction:column;gap:8px">
<div style="display:flex;justify-content:space-between;gap:12px;font-weight:500"><span>Sold online</span><span>£840</span></div>
<div style="display:flex;flex-direction:column;gap:4px;font-size:13px;color:#696969">
<div style="display:flex;justify-content:space-between;gap:12px"><span>Early bird, 30 x £9</span><span>£270</span></div>
<div style="display:flex;justify-content:space-between;gap:12px"><span>Standard, 30 x £12</span><span>£360</span></div>
<div style="display:flex;justify-content:space-between;gap:12px"><span>Last tickets, 14 x £15</span><span>£210</span></div>
</div>
</div>
<div style="padding:16px;display:flex;justify-content:space-between;gap:12px;border-top:1px solid #E9E9E9">
<div>
<div style="font-weight:500">Refunds</div>
<div style="font-size:13px;color:#696969">1 ticket given back, taken off the total.</div>
</div>
<span style="font-weight:500">£12</span>
</div>
<div style="padding:16px;display:flex;justify-content:space-between;gap:12px;border-top:1px solid #E9E9E9">
<div>
<div style="font-weight:500">Sold at the door, cash</div>
<div style="font-size:13px;color:#696969">You already have this.</div>
</div>
<span style="font-weight:500">£90</span>
</div>
</div>

<a href="#buyers" style="min-height:44px;display:flex;align-items:center;justify-content:center;gap:8px;font-size:13px;font-weight:500;color:#C2410C;text-decoration:none">
<svg aria-hidden="true" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 3v12"/><path d="m7 10 5 5 5-5"/><path d="M5 21h14"/></svg>
Download the list of buyers
</a>
</section>

</div>
</x-dc>
<script type="text/x-dc" data-dc-script data-props='{"$preview":{"width":390,"height":844}}'>
class Component extends DCLogic {
renderVals() { return {}; }
}
</script>
</body>
</html>

```

### TxA5WhoBought
```html
<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<title>Who bought</title>
<script src="./support.js"></script>
</head>
<body>
<x-dc>
<helmet>
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600&family=Source+Code+Pro:wght@500&display=swap">
<style>
body{margin:0}
button{font:inherit;color:inherit;cursor:pointer}
a{color:#C2410C}a:hover{color:#9A3412}
::selection{background:#FED7AA}
:focus-visible{outline:2px solid #C2410C;outline-offset:2px}
</style>
</helmet>
<div style="width:390px;height:844px;position:relative;overflow:hidden;box-sizing:border-box;background:#FDFDFD;color:#030303;font-family:Inter,system-ui,sans-serif;font-size:15px;line-height:1.5;font-variant-numeric:tabular-nums">

<div aria-hidden="true">
<div style="height:44px;box-sizing:border-box;padding:0 16px;display:flex;align-items:center;gap:4px;background:#FFFFFF;font-size:12px;font-weight:500;color:#464646">
<svg aria-hidden="true" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m15 6-6 6 6 6"/></svg>Back to bachatacalendar.co.uk
</div>
<div style="height:48px;box-sizing:border-box;padding:0 16px;display:flex;align-items:center;justify-content:space-between;border-bottom:1px solid #E9E9E9;background:#FFFFFF">
<span style="font-size:15px;font-weight:500">Ritmo London</span>
<span style="font-size:13px;font-weight:500;color:#464646">To do</span>
</div>
<div style="padding:24px 16px 0;display:flex;flex-direction:column;gap:32px">
<div style="display:flex;flex-direction:column;gap:4px">
<div style="display:flex;align-items:center;justify-content:space-between;gap:12px">
<div style="font-size:22px;line-height:1.2;font-weight:600;letter-spacing:-0.025em">Friday Social</div>
<span style="flex:none;padding:3px 7px;border-radius:999px;border:1px solid #16B674;background:rgba(22,182,116,0.10);color:#097C4F;font-size:11px;font-weight:500;line-height:1;letter-spacing:0.07em;text-transform:uppercase">In 3 days</span>
</div>
<div style="font-size:13px;color:#464646">Fri 20 Nov, 21:00 at Soho Dance Studio</div>
</div>
<div style="display:flex;flex-direction:column;gap:12px">
<div style="font-size:48px;line-height:1.1;font-weight:600;letter-spacing:-0.03em">41 <span style="font-size:18px;font-weight:500;letter-spacing:0;color:#464646">of 80 sold</span></div>
<div style="height:6px;border-radius:3px;background:#E9E9E9;overflow:hidden"><div style="width:51.25%;height:6px;border-radius:3px;background:#030303"></div></div>
<div style="color:#464646">9 sold in the last 2 days. On track to sell out by Friday.</div>
</div>
<div style="height:42px;border-radius:10px;background:#C2410C;color:#FFFAF7;font-size:15px;font-weight:500;display:flex;align-items:center;justify-content:center">Message everyone who bought</div>
</div>
</div>

<div style="position:absolute;left:0;top:0;width:390px;height:844px;background:rgba(0,0,0,0.5)"></div>

<section role="dialog" aria-modal="true" aria-labelledby="who-title" style="position:absolute;left:0;right:0;bottom:0;box-sizing:border-box;padding:16px;background:#FFFFFF;border-radius:16px 16px 0 0;display:flex;flex-direction:column;gap:16px">
<div style="display:flex;flex-direction:column;gap:8px">
<div style="width:100px;height:8px;border-radius:999px;background:#D9D9D9;align-self:center"></div>
<div style="display:flex;align-items:center;justify-content:space-between">
<h1 id="who-title" style="margin:0;font-size:15px;line-height:1.5;font-weight:600">Who bought</h1>
<a href="TxA1Before.dc.html" aria-label="Close" style="width:44px;height:44px;margin-right:-12px;display:flex;align-items:center;justify-content:center;color:#464646">
<svg aria-hidden="true" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M6 6l12 12"/><path d="M18 6 6 18"/></svg>
</a>
</div>
</div>

<div style="display:flex;flex-direction:column;gap:8px">
<label for="who-search" style="font-size:13px;color:#464646">Search a name</label>
<input id="who-search" type="search" placeholder="Type a name" style="height:42px;width:100%;box-sizing:border-box;padding:0 12px;border:1px solid #D9D9D9;border-radius:8px;background:#FAFAFA;color:#030303;font:inherit;font-size:16px">
</div>

<div style="display:flex;flex-direction:column;gap:8px">
<div style="font-family:'Source Code Pro',monospace;font-size:12px;font-weight:500;letter-spacing:0.05em;text-transform:uppercase;color:#696969">Latest</div>
<div style="border:1px solid #E9E9E9;border-radius:11px;box-shadow:0 1px 2px rgba(0,0,0,0.05);display:flex;flex-direction:column">
<a href="R4Refund.dc.html" style="min-height:52px;box-sizing:border-box;padding:12px 16px;display:flex;align-items:center;gap:8px;color:#030303;text-decoration:none">
<span style="flex:1;min-width:0;display:flex;flex-direction:column">
<span style="font-weight:500">Maya Okafor</span>
<span style="font-size:13px;color:#696969">2 tickets, Standard</span>
</span>
<svg aria-hidden="true" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#696969" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m9 6 6 6-6 6"/></svg>
</a>
<a href="R4Refund.dc.html" style="min-height:52px;box-sizing:border-box;padding:12px 16px;display:flex;align-items:center;gap:8px;color:#030303;text-decoration:none;border-top:1px solid #E9E9E9">
<span style="flex:1;min-width:0;display:flex;flex-direction:column">
<span style="font-weight:500">Daniel Reyes</span>
<span style="font-size:13px;color:#696969">1 ticket, Standard</span>
</span>
<svg aria-hidden="true" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#696969" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m9 6 6 6-6 6"/></svg>
</a>
<a href="R4Refund.dc.html" style="min-height:52px;box-sizing:border-box;padding:12px 16px;display:flex;align-items:center;gap:8px;color:#030303;text-decoration:none;border-top:1px solid #E9E9E9">
<span style="flex:1;min-width:0;display:flex;flex-direction:column">
<span style="font-weight:500">Priya Shah</span>
<span style="font-size:13px;color:#696969">1 ticket, Early bird</span>
</span>
<svg aria-hidden="true" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#696969" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m9 6 6 6-6 6"/></svg>
</a>
<a href="#all" style="min-height:52px;box-sizing:border-box;padding:0 16px;display:flex;align-items:center;gap:8px;color:#030303;text-decoration:none;border-top:1px solid #E9E9E9">
<span style="flex:1;font-weight:500">See all 41</span>
<svg aria-hidden="true" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#696969" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m9 6 6 6-6 6"/></svg>
</a>
</div>
</div>

<p style="margin:0;font-size:13px;color:#696969">Tap a person to see their order.</p>
</section>

</div>
</x-dc>
<script type="text/x-dc" data-dc-script data-props='{"$preview":{"width":390,"height":844}}'>
class Component extends DCLogic {
renderVals() { return {}; }
}
</script>
</body>
</html>

```

### TxA6Batches
```html
<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<title>Price and batches</title>
<script src="./support.js"></script>
</head>
<body>
<x-dc>
<helmet>
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600&family=Source+Code+Pro:wght@500&display=swap">
<style>
body{margin:0}
button{font:inherit;color:inherit;cursor:pointer}
a{color:#C2410C}a:hover{color:#9A3412}
::selection{background:#FED7AA}
:focus-visible{outline:2px solid #C2410C;outline-offset:2px}
</style>
</helmet>
<div style="width:390px;height:844px;position:relative;overflow:hidden;box-sizing:border-box;background:#FDFDFD;color:#030303;font-family:Inter,system-ui,sans-serif;font-size:15px;line-height:1.5;font-variant-numeric:tabular-nums">

<div aria-hidden="true">
<div style="height:44px;box-sizing:border-box;padding:0 16px;display:flex;align-items:center;gap:4px;background:#FFFFFF;font-size:12px;font-weight:500;color:#464646">
<svg aria-hidden="true" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m15 6-6 6 6 6"/></svg>Back to bachatacalendar.co.uk
</div>
<div style="height:48px;box-sizing:border-box;padding:0 16px;display:flex;align-items:center;justify-content:space-between;border-bottom:1px solid #E9E9E9;background:#FFFFFF">
<span style="font-size:15px;font-weight:500">Ritmo London</span>
<span style="font-size:13px;font-weight:500;color:#464646">To do</span>
</div>
<div style="padding:24px 16px 0;display:flex;flex-direction:column;gap:32px">
<div style="display:flex;flex-direction:column;gap:4px">
<div style="display:flex;align-items:center;justify-content:space-between;gap:12px">
<div style="font-size:22px;line-height:1.2;font-weight:600;letter-spacing:-0.025em">Friday Social</div>
<span style="flex:none;padding:3px 7px;border-radius:999px;border:1px solid #16B674;background:rgba(22,182,116,0.10);color:#097C4F;font-size:11px;font-weight:500;line-height:1;letter-spacing:0.07em;text-transform:uppercase">In 3 days</span>
</div>
<div style="font-size:13px;color:#464646">Fri 20 Nov, 21:00 at Soho Dance Studio</div>
</div>
<div style="display:flex;flex-direction:column;gap:12px">
<div style="font-size:48px;line-height:1.1;font-weight:600;letter-spacing:-0.03em">41 <span style="font-size:18px;font-weight:500;letter-spacing:0;color:#464646">of 80 sold</span></div>
<div style="height:6px;border-radius:3px;background:#E9E9E9;overflow:hidden"><div style="width:51.25%;height:6px;border-radius:3px;background:#030303"></div></div>
<div style="color:#464646">9 sold in the last 2 days. On track to sell out by Friday.</div>
</div>
<div style="height:42px;border-radius:10px;background:#C2410C;color:#FFFAF7;font-size:15px;font-weight:500;display:flex;align-items:center;justify-content:center">Message everyone who bought</div>
</div>
</div>

<div style="position:absolute;left:0;top:0;width:390px;height:844px;background:rgba(0,0,0,0.5)"></div>

<section role="dialog" aria-modal="true" aria-labelledby="batch-title" style="position:absolute;left:0;right:0;bottom:0;box-sizing:border-box;padding:16px;background:#FFFFFF;border-radius:16px 16px 0 0;display:flex;flex-direction:column;gap:16px">
<div style="display:flex;flex-direction:column;gap:8px">
<div style="width:100px;height:8px;border-radius:999px;background:#D9D9D9;align-self:center"></div>
<div style="display:flex;align-items:center;justify-content:space-between">
<h1 id="batch-title" style="margin:0;font-size:15px;line-height:1.5;font-weight:600">Price and batches</h1>
<a href="TxA1Before.dc.html" aria-label="Close" style="width:44px;height:44px;margin-right:-12px;display:flex;align-items:center;justify-content:center;color:#464646">
<svg aria-hidden="true" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M6 6l12 12"/><path d="M18 6 6 18"/></svg>
</a>
</div>
</div>

<div style="border:1px solid #E9E9E9;border-radius:11px;box-shadow:0 1px 2px rgba(0,0,0,0.05);display:flex;flex-direction:column">
<div style="min-height:52px;box-sizing:border-box;padding:12px 16px;display:flex;align-items:center;gap:12px">
<div style="flex:1;min-width:0">
<div style="font-weight:500">Early bird, £9</div>
<div style="font-size:13px;color:#696969">30 of 30 sold</div>
</div>
<span style="flex:none;padding:3px 7px;border-radius:999px;border:1px solid #030303;background:#030303;color:#FDFDFD;font-size:11px;font-weight:500;line-height:1;letter-spacing:0.07em;text-transform:uppercase">Sold out</span>
</div>
<div style="min-height:52px;box-sizing:border-box;padding:12px 16px;display:flex;align-items:center;gap:12px;border-top:1px solid #E9E9E9">
<div style="flex:1;min-width:0">
<div style="font-weight:500">Standard, £12</div>
<div style="font-size:13px;color:#696969">11 of 30 sold</div>
</div>
<span style="flex:none;padding:3px 7px;border-radius:999px;border:1px solid #16B674;background:rgba(22,182,116,0.10);color:#097C4F;font-size:11px;font-weight:500;line-height:1;letter-spacing:0.07em;text-transform:uppercase">On sale</span>
</div>
<div style="min-height:52px;box-sizing:border-box;padding:12px 16px;display:flex;align-items:center;gap:12px;border-top:1px solid #E9E9E9">
<div style="flex:1;min-width:0">
<div style="font-weight:500">Last tickets, £15</div>
<div style="font-size:13px;color:#696969">20 tickets</div>
</div>
<span style="flex:none;padding:3px 7px;border-radius:999px;border:1px solid #D9D9D9;background:#FFFFFF;color:#464646;font-size:11px;font-weight:500;line-height:1;letter-spacing:0.07em;text-transform:uppercase">Not open</span>
</div>
</div>

<div style="min-height:44px;display:flex;align-items:center;gap:12px">
<p style="flex:1;min-width:0;margin:0;font-size:13px;color:#464646">Last tickets open by themselves when Standard sells out.</p>
<button style="flex:none;height:34px;padding:0 12px;border:0;border-radius:9px;background:#FFFFFF;color:#030303;box-shadow:inset 0 0 0 1px rgba(0,0,0,0.10),0 1px 3px rgba(0,0,0,0.04);font-size:13px;font-weight:500">Open now</button>
</div>

<div style="min-height:44px;display:flex;align-items:center">
<button style="height:42px;width:100%;padding:0 16px;border:0;border-radius:10px;background:#FFFFFF;color:#030303;box-shadow:inset 0 0 0 1px rgba(0,0,0,0.10),0 1px 3px rgba(0,0,0,0.04);font-size:15px;font-weight:500">Change a price</button>
</div>

<p style="margin:0;font-size:13px;color:#696969">A new price only counts for tickets sold from now on.</p>
</section>

</div>
</x-dc>
<script type="text/x-dc" data-dc-script data-props='{"$preview":{"width":390,"height":844}}'>
class Component extends DCLogic {
renderVals() { return {}; }
}
</script>
</body>
</html>

```

### TxA7SellDoor
```html
<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<title>Sell at the door</title>
<script src="./support.js"></script>
</head>
<body>
<x-dc>
<helmet>
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600&family=Source+Code+Pro:wght@500&display=swap">
<style>
body{margin:0}
button{font:inherit;color:inherit;cursor:pointer}
a{color:#C2410C}a:hover{color:#9A3412}
::selection{background:#FED7AA}
:focus-visible{outline:2px solid #C2410C;outline-offset:2px}
</style>
</helmet>
<div style="width:390px;height:844px;position:relative;overflow:hidden;box-sizing:border-box;background:#FDFDFD;color:#030303;font-family:Inter,system-ui,sans-serif;font-size:15px;line-height:1.5;font-variant-numeric:tabular-nums">

<div aria-hidden="true">
<div style="height:44px;box-sizing:border-box;padding:0 16px;display:flex;align-items:center;gap:4px;background:#FFFFFF;font-size:12px;font-weight:500;color:#464646">
<svg aria-hidden="true" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m15 6-6 6 6 6"/></svg>Back to bachatacalendar.co.uk
</div>
<div style="height:48px;box-sizing:border-box;padding:0 16px;display:flex;align-items:center;justify-content:space-between;border-bottom:1px solid #E9E9E9;background:#FFFFFF">
<span style="font-size:15px;font-weight:500">Ritmo London</span>
<span style="font-size:13px;font-weight:500;color:#464646">To do</span>
</div>
<div style="padding:24px 16px 0;display:flex;flex-direction:column;gap:32px">
<div style="display:flex;flex-direction:column;gap:4px">
<div style="display:flex;align-items:center;justify-content:space-between;gap:12px">
<div style="font-size:22px;line-height:1.2;font-weight:600;letter-spacing:-0.025em">Friday Social</div>
<span style="flex:none;padding:3px 7px;border-radius:999px;border:1px solid #16B674;background:rgba(22,182,116,0.10);color:#097C4F;font-size:11px;font-weight:500;line-height:1;letter-spacing:0.07em;text-transform:uppercase">Tonight</span>
</div>
<div style="font-size:13px;color:#464646">Fri 20 Nov, 21:00 at Soho Dance Studio</div>
</div>
<div style="display:flex;flex-direction:column;gap:12px">
<div style="font-size:48px;line-height:1.1;font-weight:600;letter-spacing:-0.03em">41 <span style="font-size:18px;font-weight:500;letter-spacing:0;color:#464646">in</span></div>
<div style="color:#464646">35 still to arrive, 76 expected</div>
</div>
<div style="height:42px;border-radius:10px;background:#C2410C;color:#FFFAF7;font-size:15px;font-weight:500;display:flex;align-items:center;justify-content:center">Scan a ticket</div>
</div>
</div>

<div style="position:absolute;left:0;top:0;width:390px;height:844px;background:rgba(0,0,0,0.5)"></div>

<section role="dialog" aria-modal="true" aria-labelledby="sell-title" style="position:absolute;left:0;right:0;bottom:0;box-sizing:border-box;padding:16px;background:#FFFFFF;border-radius:16px 16px 0 0;display:flex;flex-direction:column;gap:16px">
<div style="display:flex;flex-direction:column;gap:8px">
<div style="width:100px;height:8px;border-radius:999px;background:#D9D9D9;align-self:center"></div>
<div style="display:flex;align-items:center;justify-content:space-between">
<h1 id="sell-title" style="margin:0;font-size:15px;line-height:1.5;font-weight:600">Sell at the door</h1>
<a href="TxA2Door.dc.html" aria-label="Close" style="width:44px;height:44px;margin-right:-12px;display:flex;align-items:center;justify-content:center;color:#464646">
<svg aria-hidden="true" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M6 6l12 12"/><path d="M18 6 6 18"/></svg>
</a>
</div>
</div>

<div style="border:1px solid #E9E9E9;border-radius:11px;box-shadow:0 1px 2px rgba(0,0,0,0.05);display:flex;flex-direction:column">
<div style="padding:12px 16px;display:flex;align-items:center;gap:12px">
<div style="flex:1;min-width:0">
<div style="font-weight:500">Last tickets, £15</div>
<div style="font-size:13px;color:#696969">8 left</div>
</div>
<span style="flex:none;padding:3px 7px;border-radius:999px;border:1px solid #16B674;background:rgba(22,182,116,0.10);color:#097C4F;font-size:11px;font-weight:500;line-height:1;letter-spacing:0.07em;text-transform:uppercase">On sale</span>
</div>
<div style="padding:12px 16px;display:flex;align-items:center;gap:12px;border-top:1px solid #E9E9E9">
<div style="flex:1;font-weight:500">How many</div>
<button aria-label="One less" style="width:44px;height:44px;padding:0;border:0;border-radius:9px;background:#FFFFFF;color:#030303;box-shadow:inset 0 0 0 1px rgba(0,0,0,0.10),0 1px 3px rgba(0,0,0,0.04);display:flex;align-items:center;justify-content:center"><svg aria-hidden="true" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M5 12h14"/></svg></button>
<div aria-live="polite" style="min-width:24px;text-align:center;font-size:18px;font-weight:600">1</div>
<button aria-label="One more" style="width:44px;height:44px;padding:0;border:0;border-radius:9px;background:#FFFFFF;color:#030303;box-shadow:inset 0 0 0 1px rgba(0,0,0,0.10),0 1px 3px rgba(0,0,0,0.04);display:flex;align-items:center;justify-content:center"><svg aria-hidden="true" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 5v14"/><path d="M5 12h14"/></svg></button>
</div>
</div>

<div style="display:flex;flex-direction:column;gap:8px">
<label for="sell-name" style="font-size:13px;color:#464646">Name</label>
<input id="sell-name" type="text" placeholder="Type a name" style="height:42px;width:100%;box-sizing:border-box;padding:0 12px;border:1px solid #D9D9D9;border-radius:8px;background:#FAFAFA;color:#030303;font:inherit;font-size:16px">
<div style="font-size:13px;color:#696969">You can leave this empty.</div>
</div>

<div style="display:flex;align-items:baseline;justify-content:space-between;gap:12px">
<span style="font-family:'Source Code Pro',monospace;font-size:12px;font-weight:500;letter-spacing:0.05em;text-transform:uppercase;color:#696969">To take</span>
<span style="font-size:24px;line-height:1.2;font-weight:600">£15</span>
</div>

<div style="display:flex;flex-direction:column;gap:8px">
<button style="height:42px;width:100%;padding:0 16px;border:0;border-radius:10px;background:#C2410C;color:#FFFAF7;box-shadow:0 1px 3px rgba(0,0,0,0.04);font-size:15px;font-weight:500">Took cash</button>
<p style="margin:0;font-size:13px;color:#696969;text-align:center">Cash only. They are marked as in straight away.</p>
</div>
</section>

</div>
</x-dc>
<script type="text/x-dc" data-dc-script data-props='{"$preview":{"width":390,"height":844}}'>
class Component extends DCLogic {
renderVals() { return {}; }
}
</script>
</body>
</html>

```
