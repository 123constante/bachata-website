# Organiser dashboard: 2 options (admin #1544)

Brief: `docs/briefs/profile-dash-organiser-opts.md` (branch `brief/profile-dash-opts`, blob 11f92b4).
Docs/design only. No `src/` change, no DB write. The owner picks 1 of 2.

- **Base:** `docs/design/profile-dash/prototype.html.md` (HTML saved as .md; copied here from the brief
  branch unchanged). Kept: tokens (`--bg #f3f1ee`, `--fg #1d1f24`, `--muted #5d6068`, `--c-org #1f5c7a`
  ...), fonts (Bricolage Grotesque display, DM Sans body), the role-coloured identity strip, the
  top-right **Switch** button and its sheet, which holds the organiser, teacher, DJ and dancer pages in one list.
  Light theme only.
- **Files:** `organiser-option-a.html`, `organiser-option-b.html` (self-contained; the shape and seat
  switches sit above the 390x844 frame). Screenshots: `shots/organiser-option-{a,b}-<shape>.png` at
  390x844 (DPR 2). Checks: `tools/organiser-shots.mjs` -> `organiser-checks.json`.
- **Deep links:** `organiser-option-a.html#upcoming`. Shapes: `new, upcoming, selling, huge, zero,
  cancelled, loading, error`. Add `&shot` for a bare frame, `&sheet=switch`, `&sheet=share&of=page|0`,
  `&seat=owner|manager|contributor`.

## The two layout ideas

| | **A: one next step + list** | **B: night-first timeline** |
|---|---|---|
| Main card | **Hero = the single next step** (title, why, one button). Its content comes from the shape: first night / share the next night / nobody has found it / cancelled | **The next night itself**: Going, opens, link taps by type, Share this night |
| The 3 items | One list card: nights coming up (with a total Going) / profile completeness / Share my page | The next 2 nights as one-line rows on a date rail (tap to open), then the profile row |
| Per-night numbers | Below the fold, one card per night | On the first screen (the main card); other nights hold them one tap away |
| O1 (no events) | Hero "Put your first night on" + New event; Your nights row says what will appear | Dashed empty slot on the rail "Your first night goes here" + New event; then Share, Profile, Team |
| Best when | Most organisers have little data (prod today) | Organisers run many nights and the numbers move |

Both share ONE implementation of each fact (same function in each file): the night body (`nightBody`),
profile row, Share my page row and sheet, ratings card, team line, tickets tile, loading and error states.

## Journeys covered (every shape switchable in both files)

| Contract | How it shows | Shape |
|---|---|---|
| O1 no events / no team | Next action (A hero / B empty slot) + **Share my page**: Copy link, WhatsApp, Instagram caption (sheet with the caption text + Copy caption). "Only you so far" + Add a teammate. | `new` |
| O2 upcoming nights | Per night: **Going**, **opens**, link taps by type (**ticket taps, directions, shares, WhatsApp taps**). Only positive numbers are drawn. A zero number is left out. An all-zero night becomes a suggested action ("No one has found this night yet" + Share this night). A night with taps but nobody going gets a line saying sharing is the quickest fix. | `upcoming`, `zero` |
| O3 selling via us | **Tickets sold** tile + per-night "tickets sold". Shown ONLY in this shape (and `huge`); count only, so it is the same for every seat. | `selling`, `huge` |
| O4 profile | Completeness bar + "Next: ..." + a button for that step; 100% says "Profile complete". **Rating** and **Level rating** always drawn (empty: "No ratings yet" / "Not enough votes yet, N of 5"). **City average** only when the city has 5+ organisers; otherwise the card says why it is missing and how many organisers that city has now. | all |
| Huge | 4-line page name wraps (no ellipsis), 5-digit numbers, 222 dates -> "See all 222 dates" (only 3 nights drawn) | `huge` |
| All zero | Every night = suggested action; no "0" anywhere | `zero` |
| Cancelled | Red **Cancelled** tag (B also strikes the rail date), "not counted in any number here", action: Tell your group on WhatsApp | `cancelled` |
| Loading | Skeleton + disabled buttons with a visible reason ("wake up as soon as your nights load") | `loading` |
| Error | "We could not load your nights. Your page and events are still live" + Try again; Copy link still works | `error` |
| Whole team | Seat switch (Owner / Manager / Contributor) changes ONLY the strip label; the line "Everyone on your team (3 people) sees this same page" | `&seat=` |

Hard rules, held in both: one main card + 3 items on the first screen. No page-view tile, no chart, no
enquiries, no saves, no weekly summary, no source split. The bottom tabs drop Stats (Home / Events /
Tickets / Team). Other tabs show a "Prototype: only Home is drawn" toast.

## Mechanical checks (`node docs/design/profile-dash/tools/organiser-shots.mjs`)

24/24 option x state pass (8 shapes + switch sheet + night share sheet + page share sheet + contributor
seat, x 2 options): every visible tap target >= 44x44 CSS px, every text node contrast >= 4.5:1 (min
5.15, the loading label), no sideways scroll at 390px, no clipped text. Per-state numbers are in
`organiser-checks.json`. The tool is adapted from `docs/design/organiser-dashboard/tools/check-shots.mjs`.

## Real-data shapes (prod `stsdtacfauprzrdebmzg`, read-only SELECT counts, 2026-11-12)

| Fact | Count | Drives |
|---|---|---|
| Organiser pages (`organiser_profiles`, active) | 51, all `live`; 18 claimed | |
| Cities with 5+ organisers | **1** (max 47 in one city); 4 cities have fewer than 5 | city average hidden for most non-London pages (`new`, `zero` shapes) |
| Organisers with NO upcoming scheduled night | **19 / 51** | O1 is a main path, not an edge case |
| Max upcoming dates on one organiser | **222**; 7 organisers have > 100 (API cap) | `huge`, "See all N dates" |
| Organisers with a cancelled upcoming night | 4 (153 cancelled occurrences overall vs 3,192 scheduled) | `cancelled` |
| Going (`event_attendance` going) | 5 rows total; max **2** on one night | numbers are mostly zero -> `zero` shape, suggested actions |
| Link clicks by type (`event_link_clicks`) | ticket 4,094 / other 2,057 / share 977 / whatsapp 264; 111 of 766 series have any; max 676 on one series | the 4 pill types; `directions` is `other` today (see GAP-4) |
| Level votes (`event_series_level_rating_p5`) | 8 total; max 3 on one series | "Not enough votes yet" is the normal state |
| Profiles with no bio / no logo | 44 / 2 | next step "Add a bio" in the common shapes |
| Organisers who sold via us (`ticket_orders` paid) | 1 | O3 is rare; tile must stay hidden otherwise |

## What each option replaces (inventory)

Full 127-row inventory with GAPs: `docs/design/organiser-dashboard/INVENTORY.md` (merged in #1564). Lines
spot-checked on this branch (= origin/main 19b73f5).

| Today | Cited at | A | B |
|---|---|---|---|
| Next up hero (thumb, chips, when, name, Going) | src/modules/organiser/p3/screens/HomeScreen.tsx:97-113 | replaced by the hero next step + night cards below | replaced by the main night card on the rail |
| No next up: 6 advice cases | src/modules/organiser/p3/model/status.ts:54-73; HomeScreen.tsx:16-24 | folded into the hero | folded into the empty slot / main card |
| No events "No events here yet" + Add event | src/modules/organiser/p3/screens/HomeScreen.tsx:76-85 | hero "Put your first night on" | dashed empty slot |
| Needs you items photo / dates / draft | src/modules/organiser/p3/data/home.ts:194-243; HomeScreen.tsx:120-137 | the hero carries the ONE top item | not drawn on Home (stays on Events) |
| "Last 30 days" views tile | src/modules/organiser/p3/screens/HomeScreen.tsx:139-157 | removed (contract) | removed (contract) |
| Going total tile | src/modules/organiser/p3/screens/parts.tsx:93-99 | "N nights coming up" row (total Going) | removed; Going is per night |
| Night Going summary | src/modules/organiser/p3/screens/P3Going.tsx:31-62 | `nightBody` Going | `nightBody` Going |
| Tickets sold tile (only when > 0) | src/modules/organiser/p3/tickets/GetPaid.tsx:271-287 | tickets tile (count, every seat) | same |
| Share link card (event `?ref=`) | src/modules/organiser/p3/screens/ShareLinkCard.tsx:9-85 | Share my page row + sheet (page link, WhatsApp, IG caption) + Share this night | same |
| "All your events" first 4 + See all N | src/modules/organiser/p3/screens/HomeScreen.tsx:163-179 | 3 night cards + See all N dates | 3 rail rows + See all N dates |
| Stats screen tiles, chart, range | src/modules/organiser/p3/screens/StatsScreen.tsx:14-210 | removed from Home; Stats tab dropped | same |
| Link taps map | src/modules/organiser/p3/data/analyticsV2.ts:10-18; src/lib/eventLinkClicks.ts:25-31 | per-night pills | per-night pills |
| Profile progress | src/modules/organiser/shared/profileProgress.ts:12-20,61 | profile row (bar + next step) | same |
| Level rating summary | src/hooks/useSeriesLevelRating.ts:7-22 | ratings card | same |
| Page switch | src/modules/organiser/p3/screens/HomeScreen.tsx:71 | strip + Switch sheet (all roles) | same |

## GAPs (data the designs need that does not exist yet; both options are blocked equally)

- **Rating + city average:** no overall organiser rating field or RPC, and no per-city average. Only the
  per-series level vote exists. Both options draw the card. Until the data exists it shows "No ratings yet".
- **Per-night opens and per-type clicks:** opens are per series per day and clicks are series totals;
  `directions` is sent as `other` + `:directions`. A per-occurrence read is needed (admin repo).
- **Share my page link:** today the only link is an event URL with `?ref=`; an organiser-page link and
  the WhatsApp / caption share are new.
- **Cancelled nights:** the nights feeds drop cancelled server-side; a cancelled-aware read is needed.
- **Whole team sees it:** analytics are owner/manager only and Going is hidden from contributors today;
  the admin RPCs must open up before either option ships as drawn.

## Recommendation: **Option A**

Prod data is thin: 19 of 51 organisers have no upcoming night, the largest Going on any night is 2, and
655 of 766 series have no link taps. With that data B's main card (the numbers) would show its zero
state most of the time. A's main card always has one useful step: the first night, a share, or the
cancelled-night message. It covers O1, zero and cancelled with one pattern. B is the better screen for the
few big organisers (`huge`), and its rail is the strongest idea for a night list.

**Alternatives** (not drawn): (1) A + B hybrid: A's hero on top, B's date rail for the list below,
and probably the best long-term shape once data grows; (2) B with the hero switched in when every
upcoming night is all-zero; (3) keep a Stats tab for the per-night detail and keep Home to A's hero plus
the 3 rows.

## Handover

- **Done:** both options, 24 screenshots, checks 24/24, prod shape survey, inventory map, recommendation.
- **Left / next:** owner picks A or B (or the hybrid). Then admin-repo RPC work for the GAPs above
  before any build slice, then an implementation brief.
- **Not verified:** the designs are not on a real phone; the numbers are examples shaped by the survey,
  not live reads; no app code exists, so no browser walk of a running route.
