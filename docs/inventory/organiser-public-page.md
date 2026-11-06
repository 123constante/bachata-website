# Public organiser page: inventory, shape survey, defects

Date 2026-11-02. Docs only, read-only (no source or DB writes). Main at 61c9706.
Brief: `docs/briefs/organiser-public-inventory.md` (branch `brief/organiser-public-inventory`).
`OP` = `src/pages/OrganiserProfile.tsx` (1660 lines). `OPP` = `src/modules/profile/organiserPublicProfile.ts`.

Owner decision (recorded, NOT built here): hide the empty-upcoming box; show past events if any; if there are no events at all, one small line "No dates announced yet".

## 1. Inventory

Route: `/organisers/:slug` (rendered by `app/routes/organiser.tsx`, which owns SSR head and loader; `OP` is the component). Data: `fetchOrganiserEntity` (OPP:61, columns `ORGANISER_PUBLIC_COLS` in `src/lib/organiserPublicCols.ts:49`), RPCs `get_organiser_public_events_v1` (OPP:114), `get_organiser_calendar_events_v1` (future OPP:126, past OPP:138), `organiser_team_members` + `dancer_profiles` (OP:775-806), `get_organiser_public_contact_v1` (OP:732), `organiser_full_profile_v1` (OPP:158), claim hint/ownership (OP:717-731).

### 1a. Fields and sections shown (public)

| # | Item | Source | Rendered at | Editable in organiser area (EIP) | Admin editor |
|---|------|--------|-------------|------|------|
| 1 | Avatar (initials fallback) | avatar_url | OP:355 (AvatarCircle), hero OP:~1270/1300 | yes `avatar_url` | yes (Logo) |
| 2 | Name (h1) | name | OP:~1290/1305 | yes | yes |
| 3 | Meta line: category + city | organisation_category, cities.name | OP:1131 | yes (`organisation_category`, `city`) | yes (City); category: not found in OrganiserProfileTab |
| 4 | Verified badge | `is_verified` | OP:1278, OP:1314 | n/a | n/a (column does not exist, see E1) |
| 5 | "Full profile" mark | organiser_full_profile_v1 | OP:1279 (`FullProfileMark` OP:364) | n/a | n/a |
| 6 | Managed badge | ownership facts | OP:1281 | n/a | n/a |
| 7 | Hero tagline = first sentence of bio | bio | OP:1147 | via bio | yes |
| 8 | Stats: Upcoming dates / Past nights / third stat (Team members, else Yrs active, else "Since --") | derived | OP:1352-1354, OP:1138-1139 | n/a | n/a |
| 9 | Contact rows: WhatsApp, email (copy buttons) | get_organiser_public_contact_v1 | OP:1177-1190 | yes (`contact_phone`, `show_phone_publicly`, `show_email_publicly`; email not editable in EIP, FIELD_KEYS comment fieldRules.ts:28) | yes (OrganiserContactTab) |
| 10 | Online: Instagram, Facebook, Website | instagram / socials / website | OP:1179, 1081 | yes (`instagram`, `facebook`, `website`) | yes |
| 11 | Claim card "Is this you?" | claim hint | OP:~1380 (`PublicClaimCard`) | n/a | n/a |
| 12 | Empty state owner-blank / none / past-only | `organiserEmptyState` | OP:1112; renders ~1405 / 1434 / 1447 | n/a | n/a |
| 13 | Upcoming events (grouped series, "Show all N dates") | calendar RPC | OP:1461 | n/a (events editor) | events tab |
| 14 | About (bio, clamp 3 lines + More) | bio | ~OP:1498-1513 | yes | yes |
| 15 | Teachers & DJs circles | organiser_team_members | OP:1517 (`TeamCircle` OP:~417) | yes (TeamSheet) | yes (OrganiserTeamTab) |
| 16 | Past nights, by year accordion | calendar RPC `p_include_past` | OP:1533 | n/a | n/a |
| 17 | Founded year (only as "Yrs active" stat) | founded_year | OP:1136-1139 | yes | yes |
| 18 | "Report a problem" link | | OP:1596 | | |
| 19 | Legacy Edit dialog (name, avatar_url, bio, city, instagram, facebook, website, category, founded_year) | | OP:1599-1640 (opened by "Complete your profile") | | |

### 1b. States

| State | Handling | Where |
|---|---|---|
| Loading | skeleton hero | OP:1037 |
| Error / not found / archived / rejected | "Organiser not found" (a transient error shows the same page, see E4) | OP:1060, filter OPP:59 |
| Unclaimed | claim card; no badge | OP:~1380 |
| Claimed | Managed badge (flag-gated `facts.showBadge`) | OP:1281 |
| No photo | initials | OP:360 |
| No cover | the page has no cover image at all (hero is a gradient; sampled colour never works, comment OP:~1250) | n/a |
| No bio | About section hidden (unless owner) | OP:~1496 |
| No links | contact row hidden | OP:1180 |
| Team empty | section hidden | OP:1517 |
| Events upcoming / past / none | upcoming section, empty-state box, past section | OP:1461 / 1112 / 1533 |
| Cancelled | cancelled occurrences are skipped in both lists (OP:832, OP:845); not shown as "Cancelled" | |
| >100 upcoming rows | all rows computed; 3 shown, "Show all N dates" | OP:1002, 1490 |

### 1c. Gaps

| # | Gap | Evidence |
|---|-----|----------|
| G1 | DB has `gallery_urls`, `address`, `google_maps_url`: stored but never fetched or shown (not in `ORGANISER_PUBLIC_COLS`). Admin repo does not appear to edit them either (grep of OrganiserProfileTab/ContactTab) | organiserPublicCols.ts:49, prod columns |
| G2 | Contact email is shown publicly but not editable in the organiser area | fieldRules.ts:28 |
| G3 | Cancelled nights are hidden, not shown | OP:832 |
| G4 | The page shows no cover/banner; admin has Logo only, so none expected (no gap, noted) | |
| G5 | `organisation_category` is shown and editable in EIP but not in the admin profile tab (not found by grep) | admin OrganiserProfileTab.tsx |

Coverage: 19 inventory rows + 5 gaps. 19 shown or intentionally non-public as stated, none silently omitted; the unshown DB fields are listed in G1.

## 2. Shape survey (prod stsdtacfauprzrdebmzg, counts only)

Public-visible organisers (not deactivated, not archived/rejected): **50**. 13 claimed, 37 unclaimed. Bio present: **3 of 50** (!). Photo: 48. Any link: 47. Team members: 50 have >=1 active member. City set: 50. No linked live/ended series: 10. Fully blank (no bio, photo, links, series): 1.

Upcoming (non-cancelled future occurrences, via the page's own RPC):

| claimed | upcoming | has series | past | organisers | page state today |
|---|---|---|---|---|---|
| no | >100 (max 221) | yes | n/a | 4 | list, 3 shown |
| no | 6-100 | yes | n/a | 14 | list |
| no | 1-5 | yes | n/a | 1 | list |
| no | 0 | no | none | 7 (+/-; see below) | empty box "No nights listed yet" |
| no | 0 | yes | some 10 / none 8 (across both rows) | 11 | past-only box, or "none" box |
| yes | >100 (max 156) | yes | n/a | 2 | list |
| yes | 6-100 | yes | n/a | 4 | list |
| yes | 0 | no | none | 3 | "none" box (owner-blank for owner if no bio/links/team) |
| yes | 0 | yes | some 4 | 4 | past-only box |

**25 of 50 organisers (50%) show an empty-upcoming box today**: unclaimed 18 (10 past-only, 8 none), claimed 7 (4 past-only, 3 none). Past was counted only for the 25 with zero upcoming. Cancelled: not surveyed (full-organiser past/cancelled query timed out at 60s on prod; ran the cheaper split above). Not surveyed: exact past counts for organisers with upcoming events.

## 3. Defects (not fixed)

| ID | Sev | Status | Where | Defect and failing shape |
|---|---|---|---|---|
| E1 | medium | CONFIRMED | OP:1278, 1314, 125, `organiserPublicCols.ts:49` | Verified badge can never show: `organiser_profiles` has no `is_verified` column (prod column list) and the public select does not fetch it. Dead UI and `EntityProfile.is_verified` is a type that lies. |
| E2 | medium | CONFIRMED | OP:1081 | `ep.facebook`: no `facebook` column on the table or in the select. Facebook only works from `socials.facebook`. Facebook saved via EIP/legacy dialog: check where it is stored (OP save path) or it will not render. PLAUSIBLE for save path. |
| E3 | medium | CONFIRMED | OP:1112, 1461, 1352 | 25/50 organisers show a box saying nothing is on; stats strip shows "Upcoming dates 0" too. This is the owner's complaint; decision recorded above. |
| E4 | high | CONFIRMED (code) | OPP:115, 127, 147; OP:788 | Every events/team fetch returns `[]` on error. A transient RPC failure renders "No nights listed yet / hasn't listed any nights" for an organiser with 200 events, and the result is cached 5 min (staleTime OP:805). Wrong empty state; no error state exists. |
| E5 | medium | PLAUSIBLE | `get_organiser_calendar_events_v1` body (passes organiser city slug to `get_calendar_events_v2`) | Events are filtered to the organiser's own city slug: a London organiser's events in another city likely vanish. Needs a prod check with a cross-city series. |
| E6 | low | CONFIRMED | RPC default window | Upcoming query has no `p_to`, so the RPC default is now+365 days: dates beyond a year are not shown, count under-reports. |
| E7 | medium | PLAUSIBLE | OP:862-864, RPC joins on `public_event_id` vs `legacy_event_id` | `allEvents.id = COALESCE(legacy_event_id, s.id)` but occurrences carry `event_id = public_event_id`. If they differ for any series, occurrences are dropped by `eventById.get` (OP:833, 845). Not checked on prod: compare the two ids. |
| E8 | low | CONFIRMED | OP:1147, 1496-1513 | Only 3 of 50 organisers have a bio, so About is hidden for 47; where a bio exists the hero tagline repeats its first sentence, and a long bio with no ". " puts the whole text in the hero tagline (unclamped, mobile 13px). |
| E9 | low | CONFIRMED | OP:1438, 1451 | Copy hardcodes "elsewhere in London" although organisers have a city; wrong outside London. |
| E10 | low | CONFIRMED | OP:355 | Avatar `alt={name}` duplicates the visible h1 right beside it (screen readers read the name twice); decorative alt="" would do. |
| E11 | low | CONFIRMED | OP:198-203 | Occurrence with no usable start date shows "--" / "TBA" tile. |
| E12 | low | CONFIRMED | OP:1138-1139 | Third stat falls back to "Since --" when no team, founded year or events: a stat card with a dash and no meaning. |
| E13 | low | CONFIRMED | OP:832, 845 | Cancelled nights silently disappear (no "Cancelled" row), so a visitor with an old link sees nothing. |

Not walked: 390x844 browser layout (no browser walk was done in this docs-only task), so layout defects at phone width are NOT verified.

## 4. Questions only the owner can decide

1. "No dates announced yet": show it for past-only organisers too, or only when there are no events at all (as recorded)?
2. Should the stats strip drop "Upcoming dates 0" when nothing is upcoming?
3. Verified badge: build a real verified column/source, or delete the badge?
4. Should cancelled nights show as "Cancelled" rows, or stay hidden?
5. Show only organiser-city events (current RPC behaviour, if E5 is real) or all of an organiser's events?
6. 47 of 50 pages have no bio: is About worth a prompt, or hide for good? Should the hero tagline stay?
7. Do you want gallery / address / map (stored, never shown) on the page?
8. Is email meant to be owner-editable in the organiser area?
