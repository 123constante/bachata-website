# Public organiser page: independent verification of the inventory

Date 2026-11-02. Docs only. No source, test or DB writes. Supabase prod
`stsdtacfauprzrdebmzg` read with SELECT only (counts and function bodies, no
personal data). Base: main at `61c9706`.

Reviewed: `docs/inventory/organiser-public-page.md` on branch
`claude/organiser-public-inventory` (Sonnet worker). Brief:
`docs/briefs/organiser-public-verify.md` (branch `brief/organiser-public-verify`).

`OP` = `src/pages/OrganiserProfile.tsx` (1660 lines). `OPP` =
`src/modules/profile/organiserPublicProfile.ts`.

## 1. Verdicts on E2, E4, E5, E6, E7

| ID | Inventory said | Verdict | Evidence |
|---|---|---|---|
| E2 | Facebook saved by the organiser area or legacy dialog may not render | **REFUTED** (for users) | Both editors save through ONE function, `saveOrganiserProfile` (`src/lib/organiserProfileUpdate.ts:94`), called by the organiser area (`src/modules/organiser/edit-in-place/draftModel.ts:350`) and by the legacy dialog (OP `handleSave`). `buildOrganiserProfilePatch` writes Facebook ONLY as `socials.facebook` (`organiserProfileUpdate.ts:71,90`). The server `organiser_profile_update_p5_v1` allows `facebook` in `c_socials_allowed` and stores the whole `socials` object. `ORGANISER_PUBLIC_COLS` fetches `socials` (`src/lib/organiserPublicCols.ts:49`), and the page reads `ep.facebook \|\| socials?.facebook` (OP:1081). Prod: 24 of 50 public organisers have `socials.facebook` set. All 24 render. What remains is cleanup only: `organiser_profiles` has no `facebook` column, so `EntityProfile.facebook` (OP:128) and the `ep.facebook` reads (OP:923, 1081) are dead code. |
| E4 | Errors become `[]`, so the page shows a wrong empty state | **CONFIRMED** (code), and worse than stated | `fetchOrganiserEvents` OPP:115, `fetchOrganiserFutureOccEvents` OPP:127 and `fetchOrganiserPastOccEvents` OPP:147 all `return []` on error. The team query does too (OP:788). Because they never throw, React Query never retries and caches `[]` for 5 min (`staleTime` OP:751, 757, 771, 805). **Missed by the inventory:** the SSR loader prefetches the same three functions (`app/routes/organiser.tsx:107-126`) and its comment confirms "every queryFn below already swallows its own error to `[]`". So one RPC error during SSR puts "No nights listed yet" into the served HTML (for crawlers too), and that HTML is dehydrated and cache-tagged (`taggedData`). The CDN lifetime of that HTML was not measured. |
| E5 | Events filtered to the organiser's own city | **CONFIRMED, narrower than stated** | `get_organiser_calendar_events_v1` passes the organiser's city slug to `get_calendar_events_v2` (body read on prod). The v2 WHERE clause is `cf.target_slug IS NULL OR d.city_id = target OR c.slug = target OR type = 'festival'`. **Festivals are exempt**, so cross-city festivals DO show. Prod: 6 live series (5 public organisers) are in a city other than the organiser's. 5 are festivals (London to Barcelona, Madrid, Budapest x2; Paris to Gammarth): RPC rows equal the no-city-filter rows for each one (4/4, 4/4 past, 4/4, 3/3, 5/5 past). **1 is not a festival** (a Buenos Aires organiser with a London `class` series): the RPC returns 0 rows, but without the city filter 1 past occurrence exists. It is dropped, so that page shows the "none" box instead of "past-only". The inventory's example ("a London organiser's events in another city vanish") is wrong for festivals, which is the common case today. |
| E6 | No `p_to`, so dates past 365 days are hidden | **CONFIRMED** | The function's default is `p_to = now() + 365 days`, and OPP:126 passes no `p_to`. Prod: 10 of the 36 organisers with a live series have non-cancelled dates between 365 and 1500 days out: **51 dates** hidden in total, at most **17** for one organiser. These are also missing from the "Upcoming dates" stat and the "Show all N dates" count. (The past window, OPP:139-140, is explicitly 3650 days and is fine.) |
| E7 | `legacy_event_id` vs `public_event_id` mismatch drops occurrences | **REFUTED** | Prod: 69 live series (90 live+ended). Rows where `public_event_id IS DISTINCT FROM COALESCE(legacy_event_id, id)`: **0** live, **0** live+ended. 10 live series have no `legacy_event_id`, and for all 10 `public_event_id = id`, so the join on `eventById.get(occ.event_id)` (OP:832, 846) holds. Also checked: membership in the `organiser_ids` array (used by the calendar function) vs the `event_series_organiser_p5` join table (used by `get_organiser_public_events_v1`) differs in 0 rows either way. No occurrences are dropped today. Latent risk only: nothing enforces the equality. |

## 2. Coverage check

**Shape table totals.** Unclaimed rows 4+14+1+7+11 = 37; claimed 2+4+3+4 = 13;
total **50**. Prod re-check: 50 public organisers (`is_active IS DISTINCT FROM
false`, lifecycle not archived/rejected, the same filter as OPP:89), 3 with a bio.
Both match. The "25 of 50 show an empty-upcoming box" split (18+7) is
consistent with the table. It was not re-derived per organiser here.

**Missed by the inventory (present in OP / route):**

| # | Missed item | Where |
|---|---|---|
| M1 | SSR loader + head: the route prefetches entity and all three event feeds, `meta()` builds the description from the bio, and the `organiserDetail` flag puts the page behind `ComingSoonGate` (a locked state) | `app/routes/organiser.tsx:57-59, 107-130, 221` |
| M2 | Not-found page sets noindex | OP:702 (`useNoindexMeta`) |
| M3 | Series dates sheet (tapping a series row opens all its dates) | OP:673, 1009-1012, 1650-1655 (`SeriesDatesSheet`) |
| M4 | Stats are tappable and scroll to `#upcoming` / `#past` | OP:1352-1353, `scrollToId` |
| M5 | Past list states: open/closed year accordion, "Show all N nights in YEAR", "Show earlier years (N)", only 3 years mounted; a row with no date reads "TBA", a year with no date reads "Unknown" | OP:1023, 1030-1034, 1536-1586 |
| M6 | Owner edit-in-place layer: draft overlay shown in place (`eip.overlay`), slots `photo`, `meta`, `name`, `contact`, `links`, `team`, `about`, `about-empty`, `create-event`, `create-first-event`, `create-another-event`. The About section renders for an owner with no bio (`ep.bio \|\| eip`), showing `AboutEmpty` | OP:1075, 1268-1290, 1378-1380, 1499; `src/modules/organiser/edit-in-place/EditInPlaceLayer.tsx:369-380`; `parts.tsx:194-198` |
| M7 | Meta line hidden while the edit layer is active (`metaLine && !eip`) | OP:1276, 1309 |
| M8 | Hero colour sampling + EQ motif. The inventory says "sampled colour never works". It does fail, but because the R2 CDN sends no CORS headers (comment OP:520, 568-574), and the hero falls back to the default gradient. Not a defect, but the reason was missing | OP:560-607 |
| M9 | Upcoming list shows 3 rows then "Show all N dates" / "Show fewer", with scroll-back | OP:1002, 1488-1492 |
| M10 | Impression telemetry on event rows, `emitProfileView` on team circles | OP:650, 1474-1478, 454 |
| M11 | Legacy base-date fallback for events with no occurrence row (the comment says unreachable on live data) | OP:857-879 |
| M12 | Facebook / Instagram links are rendered only when the host really matches (`hostMatchesDomain`); a non-matching full URL renders nothing | OP:1092-1107 |

Line references in the inventory are within about 1 line of the real ones (e.g.
upcoming at OP:1460, not 1461). Its claim "19 shown, none silently omitted"
does not hold: M1, M3, M5 and M6 are user-visible.

## 3. Owner decisions: exact code to change

| Decision | Code that changes | Data the RPC does not return |
|---|---|---|
| D1 Delete Verified badge | Remove `VerifiedBadge` (OP:373-397), both renders (OP:1278 `sm`, OP:1314 `md`) and `is_verified` on `EntityProfile` (OP:125). The `FullProfileMark` docblock at OP:363 mentions "Verified" and can stay. Other `is_verified` hits (`src/types/profiles.ts:18`, generated `src/types/supabase.ts`) belong to other tables: do not touch. | none |
| D2 Hide stats with no real number | Stats array OP:1351-1355: drop an entry whose value is 0 (`totalUpcomingDateCount`, `pastEvents.length`) or `'--'` (the third stat's fallback, OP:1138-1139: `thirdStatLabel 'Since'` becomes no entry). Hide the strip wrapper (OP:1350, which has a bottom border) when no entries remain. | none. Note: E6 makes "Upcoming dates" under-count until it is fixed. |
| D3 Cancelled nights shown as "Cancelled" | OP:831 and OP:844 `if (occ.is_cancelled) continue;` become "keep with a flag". Add `isCancelled` to `OrgEvent` (OP:94), pass it through `buildEventRowProps` (OP:485-513), and render it in `EventRowCard` (`src/components/events/EventRow.tsx`, which has NO cancelled prop today: a shared component, so check its other importers) and in the past row (OP:1544-1575). Decide whether cancelled dates count in the "N dates" / "N hosted" totals (OP:1007, 1537) and in `organiserEmptyState` (a series whose only future date is cancelled). | **None needed.** Prod: the calendar function returns cancelled rows with `is_cancelled` (4 of 1457 future rows, 88 of 901 past-window rows for organiser series). `cancellation_reason_label` is returned by v2 but is null on all 4 future cancelled rows and is not in `OrgOccRow` (OPP:32-45). Show a plain "Cancelled". |
| D4 Hide the empty-upcoming box; show past if any, else one line "No dates announced yet" | `organiserEmptyState` (`src/modules/profile/organiserEmptyState.ts:20-31`): 'past-only' becomes null (render nothing), and 'none' becomes the one-line kind. OP:1446-1458 (past-only section) removed; OP:1433-1445 ('none' section) replaced by one line. Keep the owner slots `create-first-event` / `create-another-event` somewhere for owners. `owner-blank` (OP:1418-1432) is untouched. Update the pinned matrix `src/pages/__tests__/OrganiserProfileEmpty.matrix.test.tsx`. Removing both boxes also removes E9's "elsewhere in London" copy (OP:1438, 1451). | none. **E4 must ship first or together**: with the box gone, a swallowed RPC error turns a 200-date organiser into "No dates announced yet". |
| D5 No bio: About hidden for visitors; claimed organiser sees "Add a short bio" | Visitors: already true (OP:1499 `(ep.bio \|\| eip)`). Owner: the copy in `AboutEmpty` (`src/modules/organiser/edit-in-place/parts.tsx:194-198`, "Not added yet. Optional: ...") changes to "Add a short bio". Its test id `eip-about-empty` is asserted in `EditInPlaceLayer.test.tsx`, so check that test. The new page module also uses this slot (`src/modules/organiser/page/index.tsx:110`), so the copy changes there too. "Claimed organiser" here means `facts.canEdit` (the layer only mounts at OP:1589-1593), which includes managers. Hero tagline (OP:1145-1147) is not covered by the decision. | none |

## 4. Proposed slices

Each is small and has no database change unless stated.

| # | Slice | Files | DB change |
|---|---|---|---|
| S1 | Error state, not empty state (E4): fetchers throw (so React Query retries) and the page shows a quiet "Couldn't load dates, retry". The SSR loader must not dehydrate a failed feed into cached HTML. Prerequisite for S4. | OPP:110-148, OP:781-790, `app/routes/organiser.tsx:107-130`, new matrix test | no |
| S2 | Delete Verified badge + dead `facebook` field (D1, E2 cleanup) | OP:125, 128, 373-397, 923, 1081, 1278, 1314 | no |
| S3 | Hide stats with no real number (D2) | OP:1138-1142, 1349-1368 + test | no |
| S4 | Empty-upcoming box to one line (D4) | `organiserEmptyState.ts`, OP:1418-1458, matrix test | no |
| S5 | Owner "Add a short bio" (D5) | `edit-in-place/parts.tsx:194-198`, `EditInPlaceLayer.test.tsx` | no |
| S6 | Cancelled nights shown (D3) | OP:94, 485-513, 831, 844, 1544-1575; `components/events/EventRow.tsx` (only importers: OP and `SeriesDatesSheet`); `SeriesDatesSheet` | no |
| S7 | Dates beyond a year (E6): pass an explicit far `p_to` (e.g. +1500 days) from `fetchOrganiserFutureOccEvents`. The cost of v2 over a longer window on the >100-date organisers was not measured: measure before choosing. | OPP:125-128 | no (client arg); optional admin-side default change |
| S8 | Non-festival cross-city series (E5): drop the city slug argument (pass NULL) inside `get_organiser_calendar_events_v1`. The organiser filter already limits rows to the organiser's own series. Affects 1 organiser today. | admin repo migration | **yes (admin repo)** |
| S9 | (optional) Guard for E7: a contract check that `public_event_id = COALESCE(legacy_event_id, id)` for live series (0 violations today) | `scripts/check-*.mjs`, `db-contract-check.yml` | no (read-only check) |

## Verified / Not verified

Verified (prod, read-only):
- Function bodies of `get_organiser_calendar_events_v1`, `get_organiser_public_events_v1`, the `get_calendar_events_v2` filter clause, and the `organiser_profile_update_p5_v1` socials handling.
- E5 per-series row counts; E6 and E7 counts.
- `socials.facebook` count; the 50 / 3-bio totals; cancelled-row counts.

Not verified:
- No browser walk at 390x844.
- Nothing was built or run: no unit tests, no CI jobs (docs-only PR).
- CDN lifetime of an SSR page that cached an error-as-empty response (E4).
- Performance of a longer `p_to` window (S7).
- The admin-side organiser editor (admin repo not opened) and where it writes Facebook.
- The inventory's per-row state split (25 empty boxes) was checked only for arithmetic, not re-queried.
