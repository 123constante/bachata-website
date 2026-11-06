# Organiser public page &mdash; inventory

Every field, state and option the admin data, the current Website code and the
public page support for an organiser. Rebuilt 2026-11-05 from source on `main`
(the old `~/.claude/plans/INVENTORY-organiser-public-page.md` was not readable
from this worker). Line numbers re-derived on `main` at `ba957d0`.

Abbreviations: **OP** = `src/pages/OrganiserProfile.tsx`; **OPP** =
`src/modules/profile/organiserPublicProfile.ts`; **COLS** =
`src/lib/organiserPublicCols.ts`; **EIP** = `src/modules/organiser/edit-in-place/`;
**OWN** = `src/modules/organiser/shared/ownership.ts`; **ROUTE** =
`app/routes/organiser.tsx`.

"Shown" = what a visitor sees today. "Rebuild" = what the contract
(`ACCEPTANCE.md`) decides. Prod counts are over the 50 public organisers
(`is_active` not false, `lifecycle_status` not archived/rejected; all 50 are
`live`), read-only, 2026-11-05.

## A. Stored fields (`organiser_profiles`)

| # | Field | Read by Website | Where | Shown today | Prod (of 50) | Rebuild |
|---|---|---|---|---|---|---|
| A1 | `id` | yes | COLS:46 | no (URL) | 50 | unchanged |
| A2 | `name` | yes | COLS:46; OP:1321 hero h1 | hero | 50 | hero, unchanged |
| A3 | `slug` | ROUTE only | ROUTE:63 | URL | 50 | unchanged |
| A4 | `avatar_url` | yes | COLS:46; OP:744 hero colour | hero photo + hero colour | 48 | hero, unchanged |
| A5 | `bio` | yes | OP:1180 hero tagline, OP:1536-1550 About (3-line clamp > 180 chars, OP:1183) | hero tagline + About | 4 | hero tagline unchanged; About only if written |
| A6 | `socials` (jsonb: instagram / website / facebook) | yes | COLS:46; OP:1101-1104 | Online pills | ig/web/fb mixed, fb 24 | Get in touch rows |
| A7 | `instagram` (column) | yes | OP:1102, OP:1114-1120 | Online pill | see links | Instagram row |
| A8 | `website` (column) | yes | OP:1103, OP:1121 | Online pill | see links | Website row |
| A9 | `facebook` | **no column exists**; read as `ep.facebook` (always undefined) then `socials.facebook` | OP:128 type, OP:1104 | Online pill via socials | 24 | not in the decided row list (WhatsApp, Instagram, Website, Email) &rarr; **intentionally not shown**, see E2 |
| A10 | `city_id` (+ `cities.name`) | yes, name lookup with 3 s timeout | OPP:110-121; OP:1160 | hero meta line | 50 (none null) | hero, unchanged |
| A11 | `organisation_category` | yes | OP:1107, OP:1161 | hero meta line | 48 | hero, unchanged |
| A12 | `founded_year` | yes | OP:1162 | 3rd stat ("Yrs active") only when team is empty | 8 | "Running since" stat |
| A13 | `contact_phone` | via `get_organiser_public_contact_v1` only | OP:749-754, OP:1105 | WhatsApp row | stored 46, public 44 | WhatsApp row |
| A14 | `contact_email` | via the same RPC | OP:1106 | Email row | stored 5, public 1 | Email row |
| A15 | `show_phone_publicly` | edit layer | EIP/contactModel.ts:21 | gates A13 | &mdash; | gates WhatsApp row |
| A16 | `show_email_publicly` | edit layer | EIP/contactModel.ts:21 | gates A14 | &mdash; | gates Email row |
| A17 | `show_contact_publicly` (legacy, sets both) | read as fallback | EIP/contactModel.ts:43-44 | indirectly | &mdash; | never written by Website |
| A18 | `is_active` | filter | OPP:104 (NOT_DEACTIVATED) | 404 when false | all 50 pass | unchanged |
| A19 | `lifecycle_status` | filter | OPP:63-64 | 404 when archived/rejected | 50 live | unchanged |
| A20 | `claimed_by` | **never** (privacy) | COLS:30-33 | no | 14 | intentionally not read: ownership comes from `entity_members` |
| A21 | `created_by` | never | COLS:24-27 | no | &mdash; | intentionally not read (auth UUID) |
| A22 | `gallery_urls` | no | &mdash; | no | 0 | **PARKED** (owner, 0 of 50 have data) |
| A23 | `address` | no | &mdash; | no | 0 | **PARKED** |
| A24 | `google_maps_url` | no | &mdash; | no | 0 | **PARKED** |
| A25 | `trusted_at` / `trusted_by` | no | &mdash; | no | 48 | intentionally not shown: admin trust flag, not a visitor fact |
| A26 | `profile_source`, `created_at`, `updated_at` | no | &mdash; | no | &mdash; | intentionally not shown: bookkeeping |
| A27 | `is_verified` | **no column exists**; typed at OP:125 | OP:1311, OP:1347 | never (always undefined) | 0 | delete dead badge, see E1 |

## B. Related data the page reads

| # | Source | Where | Shown today | Prod | Rebuild |
|---|---|---|---|---|---|
| B1 | `get_organiser_public_events_v1` (series list) | OPP:126-133; OP:766 | join source for both lists | &mdash; | unchanged join source |
| B2 | `get_organiser_calendar_events_v1` future (default window today..+365 d, **organiser city only**) | OPP:152-156; OP:773 | Upcoming events | see shapes | Next nights; window + city fixed (E4, E5) |
| B3 | same RPC, past, `p_from` = today-3650 d | OPP:165-176; OP:787 | Past nights, grouped by year | see shapes | Past nights |
| B4 | `organiser_team_members` where `is_active` (public line-up), names via `withPublicNames` | OP:794-830 | "Teachers &amp; DJs" | active 1:37, 2-3:13, 0 or 4+:0; 55 inactive rows | Team: plain list, see E11 |
| B5 | `entity_members` (owner / manager) via `organiser_ownership_v1` | OP:734-739; OWN:72-81 | edit access, Managed badge (flagged) | 49 with any member, 16 with an owner | Team auto-includes owners + managers |
| B6 | `get_organiser_public_contact_v1` | OP:749-754 | WhatsApp + Email rows | see A13/A14 | unchanged source, error state fixed (E9) |
| B7 | `organiser_full_profile_v1` | OPP:~185; OP:721 | FullProfileMark in hero | &mdash; | hero, unchanged |
| B8 | claim hint (signed in, flag `organiserSelfServe`) | OP:741-746 | PublicClaimCard OP:1419 | flag off in prod | unchanged |
| B9 | `usePeopleBadges` (role tags per team member) | OP:833 | role tags under each face | &mdash; | **removed**: no role labels |
| B10 | `ticket_orders` | not read | no | 8 orders, 1 organiser | "Tickets sold" stat (100+) |
| B11 | `event_attendance` | not read | no | 7 rows total | "Dancers came" stat |

## C. Page states and computed values

| # | State / value | Where | Shown today | Rebuild |
|---|---|---|---|---|
| C1 | Loading skeleton | OP:1060 | skeleton | skeleton (unchanged) |
| C2 | Entity error **or** miss &rarr; "Organiser not found" + noindex | OP:1076-1097; OP:719 | same screen for both | split: miss = not found; error = "Couldn&rsquo;t load" + retry (E8) |
| C3 | SSR 404 / nameless soft-404 / noindex | ROUTE:63, 140, 158-216 | server | unchanged |
| C4 | Stats strip: Upcoming dates / Past nights / Team members or Yrs active or "Since" with `--` | OP:1382-1404, OP:1171-1175 | always 3 tiles, can show 0 and `--` | new stats rule (E10) |
| C5 | `sinceYear` inferred from earliest event, shown with `~` | OP:906-916, OP:1166-1168 | 3rd stat | "Running since" uses `founded_year`, else earliest past night |
| C6 | Empty `owner-blank` "Just getting started" | OP:1454-1466; `organiserEmptyState.ts` | owner/manager only | moves into the edit layer |
| C7 | Empty `none` "No nights listed yet" + "elsewhere in London" | OP:1469-1480 | visitors | "No dates announced yet", city-correct link (E6) |
| C8 | Empty `past-only` "No upcoming nights" | OP:1482-1494 | visitors | "Recently hosted" leads + one quiet line |
| C9 | Feed error lines (upcoming / past / team) with Try again | OP:412-420, OP:1497, 1554, 1570 | yes | kept, one per failed section |
| C10 | Upcoming grouped by series, 3 visible + "Show all N dates" | OP:1010-1030, OP:478, OP:1498-1533 | yes | Next nights, same grouping |
| C11 | Past by year, 3 years + 8 rows per year | OP:476-479, OP:1042, OP:1571-1625 | yes | unchanged mechanics |
| C12 | Cancelled occurrences dropped from both lists | OP:851, OP:864 | hidden | E7 |
| C13 | Copy button on WhatsApp/Email rows; failure toast | OP:1196-1200 | WA + email only | every contact row |
| C14 | "Online" pills (Instagram, Facebook, Website) | OP:1212-1246 | below contact rows | folded into stacked rows |
| C15 | Hero badges: Verified (dead), FullProfileMark, ManagedBadge | OP:1311-1313, OP:1347-1349 | FullProfile + Managed | hero unchanged except dead Verified (E1) |

## D. Owner edit layer (EIP) and legacy dialog

| # | Option | Where | Who | Rebuild |
|---|---|---|---|---|
| D1 | Editable keys: name, city, avatar_url, founded_year, instagram, bio, website, facebook, organisation_category, contact_phone, show_phone_publicly, show_email_publicly | EIP/fieldRules.ts:18-47 | owner, manager | unchanged |
| D2 | Prompted fields card (photo, year started, Instagram) | EIP/fieldRules.ts:77-81 | owner, manager | edit layer only |
| D3 | Contact card with "Not added", Public/Hidden tags, masked values | EIP/contactModel.ts:48-80; EIP/ContactCard.tsx | owner, manager | edit layer only, never visitors |
| D4 | contact_email not editable by owner (admin only) | EIP/fieldRules.ts:28-29 | admin | unchanged |
| D5 | Team card + Team sheet (add person, role pick) | EIP/TeamCard.tsx; EIP/TeamSheet.tsx:2, 43 | owner or admin only | add "hide a person" (not built yet) |
| D6 | Create event links (3 variants) | EIP/EditInPlaceLayer.tsx:379-381 | owner, manager | edit layer only |
| D7 | Slots rendered on page: photo, name, meta, about, about-empty, links, contact, team | EIP/EditInPlaceLayer.tsx:356-378; OP:1412-1414 | owner, manager | unchanged |
| D8 | Legacy "Edit profile" dialog (name, category, year, avatar URL, city, bio, instagram, facebook, website) | OP:1638-1684; `src/lib/organiserProfileUpdate.ts:51-90` | owner, manager (opened from owner-blank) | not shown to visitors; retirement out of scope |
| D9 | Edit access rule: signed in AND `my_role` owner/manager | OWN:74 | &mdash; | unchanged |

## Coverage

- **Rows: 62** (A 27, B 11, C 15, D 9; A26 groups 3 bookkeeping fields).
- **Shown to visitors (or used to decide what they see) after the rebuild: 41** &mdash; A1-A8, A10-A16, A18, A19 (17); B1-B8, B10, B11 (10); C1-C5, C7-C15 (14; C12 changes per E7, C14 folds into the contact rows).
- **Intentionally not shown, with reason: 21** &mdash; A9 facebook (not in the decided row list), A17 legacy flag, A20/A21 auth UUIDs (privacy), A22-A24 PARKED (0 of 50 have data), A25 admin trust flag, A26 bookkeeping, A27 no such column, B9 role labels (owner decision), C6 owner-only prompt, D1-D9 edit layer only.
- 41 + 21 = 62. **Silently omitted: none.** Every column of `organiser_profiles` (28 columns, read from `information_schema` 2026-11-05) appears in section A.
