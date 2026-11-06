# Organiser public page &mdash; acceptance contract

The ONE whole-area contract for the rebuild of `/organisers/:slug` below the
hero. Owner rule: no build slice ships until this exists, and every slice PR
cites the rows it closes. Field-level inventory: [`INVENTORY.md`](INVENTORY.md).
Written 2026-11-05 against `main` `ba957d0`.

## 1. Decisions (owner, 2026-11-05 &mdash; not reopened here)

- **Hero unchanged.** Everything below it is reworked.
- **Order:** hero &rarr; stats strip &rarr; Get in touch &rarr; Team &rarr;
  About (only if written) &rarr; Next nights &rarr; Past nights. When nothing
  is upcoming, "Recently hosted" leads the nights area with one quiet line
  "No dates announced yet".
- **Get in touch:** stacked rows WhatsApp, Instagram, Website, Email. Each row
  tappable, each with its own Copy button. Empty rows hidden. No single main
  action.
- **Team:** one plain list, no role labels. Owners and managers automatically,
  plus anyone listed. Each person taps to their page. Hidden people never shown.
- **Stats:** the first 3 that qualify, in this order: next night; tickets sold
  (100+); dancers came; nights hosted (&ge;5); weekly rhythm (4+ dates and
  &ge;60% on one weekday in the last 12 months); running since. Never 0, `--`
  or a placeholder. No strip if none qualify.
- **Owner-only prompts** ("Not added", "Just getting started", create-event
  links) never show to visitors; they live in the edit layer.
- **PARKED** (stored, not shown; 0 of 50 organisers have data): photo gallery,
  address, map link.
- **Later slices:** share button with a tracked link; owner counts view
  (organiser analytics arc).

## 2. Slices this contract assumes

| Slice | Scope |
|---|---|
| **S1 Layout + stats** | Section order; stats rule (one pure function); hide strip when none qualify |
| **S2 Get in touch** | Four stacked rows with Copy; contact error state |
| **S3 Team** | Owners + managers + listed people, no roles, links, hidden people excluded; "hide a person" in the edit layer |
| **S4 Nights** | Next / Recently hosted / Past; feed window, city scope and cancelled handling |
| **S5 Page states** | Loading, entity error vs not found, per-section errors |
| **Later** | Share link (analytics arc), owner counts view, PARKED fields |

## 3. Real-data shapes (prod `stsdtacfauprzrdebmzg`, read-only counts, 2026-11-05)

Population: 50 public organisers (`is_active` not false, lifecycle not
archived/rejected; all 50 are `live`). Night counts are table-level
(`event_series_p5.organiser_ids` &times; `event_occurrence_p5`, scheduled only,
any city, any horizon); the calendar RPC timed out in bulk, so per-organiser RPC
counts are the brief&rsquo;s known figures, shown alongside.

| Dimension | Buckets (organisers) | Notes |
|---|---|---|
| Upcoming nights (table) | 0: **19** &middot; 1-5: **5** &middot; 6-100: **19** &middot; 100+: **7** | RPC view (brief): 0:23, 1:2, 2-3:2, 4-9:5, 10+:18. 7 organisers differ between the two (E4/E5) |
| Past nights | 0: **3** &middot; 1-4: **16** &middot; 5+: **31** | RPC view (brief): 0:12, 1:6, 2-3:2, 4-9:7, 10-24:7, 25+:16 |
| Nothing upcoming, has past | **17** | "Recently hosted" leads |
| No nights at all | **2** | "No dates announced yet" only |
| Has a cancelled occurrence | **23** | E7 |
| Occurrence beyond +365 d | **4** | E5 |
| Occurrence outside organiser&rsquo;s city | **6** | E4 |
| Bio written | **4** (brief: 3) | About shown for these only |
| Photo | **48** | hero |
| Links (Instagram / Website / Facebook) | 0: **1** &middot; 1: **15** &middot; 2: **16** &middot; 3: **18** | Facebook on 24 |
| Phone public / stored | **44** / 46 | WhatsApp row |
| Email public / stored | **1** / 5 | Email row |
| Public line-up size (active) | 0: **0** &middot; 1: **37** &middot; 2-3: **13** &middot; 4+: **0** | 55 inactive (hidden) line-up rows exist |
| Has any owner/manager (`entity_members`) | **49**; with an owner: **16** | Team auto-includes these |
| Claimed (`claimed_by` legacy) | **14** | brief: 14 claimed |
| Ticketing (orders) | **1** organiser, 8 orders total | tickets-sold stat qualifies for 0 today |
| Attendance rows (`event_attendance`) | **7** total | dancers-came stat qualifies for 0 today |
| Founded year | **8** | |
| Category | **48** | hero meta |
| Weekly rhythm qualifies | **19** (31 have 4+ dates in 12 months) | |
| Gallery / address / map link | **0 / 0 / 0** | PARKED |

### Stats strip prediction over those shapes

| Stat | Qualifies (of 50) | Source |
|---|---|---|
| Next night | 31 (table) / 27 (RPC) | upcoming &gt; 0 |
| Tickets sold 100+ | 0 | ticket_orders paid quantity |
| Dancers came | 0 (threshold: owner to set; proposed 20+) | event_attendance |
| Nights hosted &ge;5 | 31 (table) / 30 (RPC) | past non-cancelled |
| Weekly rhythm | 19 | last 12 months |
| Running since | 48 (founded year, else earliest past night) | |
| **No strip** | about 2 (no nights, no founded year) | |

## 4. Person types

| Code | Person | Sees edit layer |
|---|---|---|
| P1 | Anonymous visitor | no |
| P2 | Signed-in dancer (no role on this organiser) | no |
| P3 | Organiser owner (`entity_members.member_role = owner`) | yes |
| P4 | Organiser manager | yes |
| P5 | Listed team member, not owner/manager | no (page reads exactly as P2) |
| P6 | Admin (not a member) | no on this page (admin app edits) |

Verification keys: **U** = table-driven vitest matrix (person &times; shape);
**W** = browser walk at 390&times;844 on a prod-shaped organiser; **N** = not
verifiable yet (reason given).

## 5. Journeys &times; person &times; shape

### J1 &mdash; Find an organiser and see their next night

| Person | Shape | Expected | Verify |
|---|---|---|---|
| P1, P2, P5 | upcoming &ge;1 | Stats strip leads with "Next night &lt;day date&gt;"; Next nights shows grouped series, 3 visible + "Show all N dates" | U + W |
| P1, P2, P5 | upcoming 100+ | Same; count is the true total, list never renders more than the visible cap before tapping | U + W |
| P1, P2, P5 | upcoming 0, past &ge;1 | "Recently hosted" leads (latest past nights), one quiet line "No dates announced yet"; no "Next night" stat | U + W |
| P1, P2, P5 | no nights at all | Only "No dates announced yet"; no strip if no other stat qualifies; never a 0 | U + W |
| P1, P2, P5 | night in another city / beyond +365 d | Listed (E4, E5) | U |
| P3, P4 | any | As visitor, plus edit-layer "Create event" link next to the heading | U |
| P6 | any | As visitor | U |

### J2 &mdash; Contact them

| Person | Shape | Expected | Verify |
|---|---|---|---|
| P1, P2, P5 | phone public | WhatsApp row: tap opens wa.me; Copy copies the number, toast "WhatsApp number copied" | U + W |
| P1, P2, P5 | Instagram / Website set | Instagram row (handle) and Website row (domain), each tappable + Copy | U + W |
| P1, P2, P5 | email public (1 organiser) | Email row: mailto + Copy | U + W |
| P1, P2, P5 | Facebook only (no other link) | No Facebook row (decided list); section hidden if no row qualifies | U |
| P1, P2, P5 | 0 links, no public phone/email | Whole Get in touch section absent; no "Not added" | U + W |
| any | clipboard unavailable | Toast "Couldn&rsquo;t copy the &hellip;" (never a silent tap) | U |
| any | contact RPC fails | Rows from stored links still show; one line "Couldn&rsquo;t load WhatsApp and email. Try again" (E9) | U |
| P3, P4 | phone stored but hidden | Visitor rows as above; edit layer shows the Contact card with Public/Hidden tags and "Not added" | U + W |

### J3 &mdash; Learn who runs it

| Person | Shape | Expected | Verify |
|---|---|---|---|
| P1, P2, P5 | line-up 1 / 2-3 | Team list: owners + managers + active listed people, de-duplicated, no role labels, each taps to the person&rsquo;s page | U + W |
| P1, P2, P5 | owner with no dancer profile | Shown by public name, not a link (nothing to link to) | U |
| P1, P2, P5 | hidden person (inactive row) | Never shown, even when also a manager | U |
| P1, P2, P5 | bio written | About after Team, 3-line clamp + "More" over 180 chars | U + W |
| P1, P2, P5 | no bio | No About section, no placeholder | U |
| any | team read fails | "Couldn&rsquo;t load the team. Try again"; page otherwise intact | U |

### J4 &mdash; See past nights as proof

| Person | Shape | Expected | Verify |
|---|---|---|---|
| P1, P2, P5 | past 5+ | Stat "N nights hosted"; Past nights grouped by year, 3 years + "Show earlier years (N)", 8 rows per year + "Show all" | U + W |
| P1, P2, P5 | past 1-4 | Past nights list; no hosted stat (under 5) | U |
| P1, P2, P5 | past 0 | No Past nights section; no stat | U |
| any | past feed fails | "Couldn&rsquo;t load past dates. Try again"; hosted stat hidden, not 0 | U |

### J5 &mdash; Share the page later

| Person | Expected | Verify |
|---|---|---|
| all | Out of this rebuild. Page URL is stable (`/organisers/:slug`) and the SSR meta stays as today | N &mdash; share button is a later slice (organiser analytics arc) |

### J6 &mdash; Organiser edits their own page

| Person | Expected | Verify |
|---|---|---|
| P3, P4 | Pencils on hero fields, Contact card, Team card, prompted-fields card, create-event links &mdash; all from the edit layer; visitor sections render beneath unchanged | U + W (needs a signed-in owner account on a prod-shaped organiser) |
| P1, P2, P5, P6 | No pencil, no prompt, no "Not added" | U |
| P3, P4, empty profile | "Just getting started" lives in the edit layer only | U |

### J7 &mdash; Organiser hides a person

| Person | Expected | Verify |
|---|---|---|
| P3 (P6 via admin) | Team sheet offers Hide on each person; hidden person disappears from the public Team list at once; can be unhidden | N &mdash; no hide control exists yet (`EIP/TeamSheet.tsx` adds only); built in S3 |
| P4 | Same rule as `teamPickerAccess` (owner or admin only today) | U once built |
| P1, P2, P5 | Hidden person never appears | U |

### J8 &mdash; Unclaimed page with claim card

| Person | Shape | Expected | Verify |
|---|---|---|---|
| P1 | no owner (34 organisers) | Flag `organiserSelfServe` on (prod today: ON in the production build since 2026-10-05, owner decision 2026-11-05 to keep it on; seen on prod: header "Sign in" and the card "Is this you? Sign in to claim"): claim card invites sign-in; off: nothing | U |
| P2 | no owner | "Is this you?" card (`PublicClaimCard`); claim refreshes ownership | U; N for a real claim (would write) |
| P2 | owned | No claim card | U |
| P3, P4 | owned | No claim card; edit layer instead | U |

## 6. Page states

| State | Expected | Verify |
|---|---|---|
| Loading | Skeleton with the hero shape; no section headings, no 0s | U |
| Organiser not found (null row) | "Organiser not found" + Back to organisers; SSR 404 + noindex | U (exists) |
| **Entity read error** (network/DB) | "Couldn&rsquo;t load this organiser" + Try again; **not** "not found", no noindex on a transient error (E8) | U |
| Feed error, one section | That section&rsquo;s error line with Try again; other sections and the hero render; no empty-state copy and no stat derived from the failed feed | U (exists for lists; stats added) |
| Every feed fails | Hero + Get in touch + Team + per-section error lines; never "No dates announced yet" | U |
| Empty profile, visitor | Hero, then only what exists; one quiet line "No dates announced yet"; nothing that points at an owner control | U + W |

## 7. Defects this rebuild must close

Reconstructed from the old inventory&rsquo;s list (the file was not readable from
this worker; numbering kept to the seven the brief names first) and re-checked
on `main` + prod.

| # | Defect (evidence) | Disposition |
|---|---|---|
| E1 | Verified badge can never show: `is_verified` is not a column (OP:125, OP:1311, OP:1347; `information_schema`) | S1: delete the dead badge (hero otherwise unchanged); trust is `trusted_at`, admin-only |
| E2 | Facebook not in the select: no `facebook` column; only `socials.facebook` reaches the page (OP:1104) | S2: closed by decision &mdash; Facebook is not in the Get in touch rows; value stays stored and editable |
| E3 | Fake empty state on RPC error | Already fixed for feeds (OPP:139-147, OP:1145); S5 extends to the entity read (E8) and stats |
| E4 | Events filtered to organiser city: RPC passes the organiser&rsquo;s city slug to `get_calendar_events_v2`; 6 organisers have nights elsewhere | DECIDED (owner, 2026-11-05): show ALL the organiser&rsquo;s nights whatever the city, the city named on each night. Built later by the Website switch to admin `get_organiser_nights_v2` (brief on admin branch brief/organiser-nights-feed) |
| E5 | 365-day window: RPC default `p_to` = +365 d; 4 organisers have later dates | DECIDED (owner, 2026-11-05): show the NEXT 20 upcoming nights whenever they are. Built later by the same switch to `get_organiser_nights_v2` |
| E6 | Hardcoded "elsewhere in London" (OP:1474, OP:1487) | S4: empty copy names the organiser&rsquo;s city or no city |
| E7 | Cancelled nights hidden (OP:851, OP:864); 23 organisers have one | DECIDED (owner, 2026-11-05): cancelled nights stay HIDDEN everywhere, as main does today (no change); never counted in stats |
| E8 | Entity read error renders "Organiser not found" + noindex (OP:1076, OP:719) | S5 |
| E9 | Public contact RPC error silently hides WhatsApp/Email (OP:748) | S2 |
| E10 | Stats strip shows 0 and `--` (OP:1171, OP:1388-1390) | S1 |
| E11 | Team shows role tags/titles and only `organiser_team_members`; owners/managers missing (OP:434-470, OP:794) | S3 |
| E12 | Past window: server default 730 d vs client 3650 d (two truths) | S4: one window constant, client passes it explicitly (already does; pin in U) |
| E13 | Contact split into rows + "Online" pills; Instagram/Website have no Copy (OP:1208-1246) | S2 |

## 8. Done for each slice

A slice is done only when: its rows above pass in U (run against the unfixed
code first for E-rows), the W rows are walked at 390&times;844 on a prod-shaped
organiser (one each of: weekly with 100+ upcoming; past-only; no nights;
2-3 team), every applicable CI job is green, and the PR body carries the
Verified / Not verified block.
