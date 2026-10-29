# Weekly socials walk results, 2026-10-29

Follow-up to `docs/audits/weekly-socials-2026-10-29.md` (branch `claude/weekly-socials-audit`). Run by a Sonnet cloud session started from claude.ai/code (ticket dt_1c8b05733c74, session_01WoGkiDvfwe55njWRJyUwEr). Its own push was blocked by the repo pre-push unit gate, so the orchestrator copied its report here unchanged in substance. Read-only on prod `stsdtacfauprzrdebmzg`; counts and ids only; no code or data changed.

## A. Where each event-page field comes from
`event_view_p5(p_target, p_viewer)` is a thin dispatcher. The page calls it with `shape:'snapshot_compat'` (`useEventPageQuery.ts:372`), which returns `_event_view_snapshot_compat_v1`. Native p5, no legacy table.

| Page field | Source |
|---|---|
| Series resolve | `event_series_p5` where `legacy_event_id = id` (or `id = id`), lifecycle live/paused/ended; anything else returns NULL (page "not found"). Paused with no past public date also NULL. |
| Headline date | Pinned occurrence if given; ended = latest scheduled date <= `ended_on`; paused = latest PAST date; else `_public_featured_occurrence_p5_v1` = first non-archived date with `materialised_start_utc >= London now` (cancelled dates included), otherwise the EARLIEST date (past-only). |
| Dates list | `event_occurrence_p5` (not archived), max 52 rows, upcoming first; starts/ends = materialised utc (local-as-Z); cancelled flag and reason from the occurrence/override. Paused hides future dates. |
| Title, description, cover, gallery, music, level, ticket url | `event_occurrence_override_p5` if set, else `event_series_p5` defaults. |
| Venue, city, timezone | Override, else series default venue/city; tz = series, else city, else Europe/London. |
| Key times | `event_series_program_item_p5`, series-wide HH24:MI (not per date). |
| Lineup | `event_series_program_people_p5` via `resolve_epp_person_v1`, same on every date. |
| Going count | `event_attendance` for the headline date. |

Calendar (`get_calendar_events_v2`, now read in full) differs: start = date + override-or-default local start when one exists (else materialised); end rule differs; key times per date via `_effective_series_item_p5`; excludes cancelled one-offs and non-live series. The page keeps cancelled dates visible.

## B. Walk table (page column = RPC snapshot payload, NOT rendered HTML)
| Shape | Series | Calendar says | Page says (headline) | Agree? |
|---|---|---|---|---|
| Live weekly, cancelled future date | 1e0a984c | 52 rows, first Sat 2026-10-31 19:00 | 2026-10-31 19:00, not cancelled, 52 dates | Yes |
| Live weekly, 132 dates, off-weekday dates (rule Fri) | 131c7d97 | 53 rows; first Fri 2026-10-30 20:00 CANCELLED; first live 2026-11-06 | Headline 2026-10-30 20:00 cancelled, 52 dates (window cap) | Yes on date/time; page headlines a cancelled night; 53 vs 52 = window cap |
| Weekly paused | 33bbce45 | 0 rows | Headline 2026-10-28 19:30 (latest PAST, by design), 28 dates | Yes |
| Weekly draft | b9a36466 | 0 rows | NULL (not found) | Yes |
| Live, no rule, past-only | bc832f76 | 0 rows (4 dates, latest 2026-10-23) | Headline 2026-07-10 (EARLIEST of the 4) | Agree on "nothing upcoming"; headline stale |
| Live, no rule, only future dates cancelled | 02f6a4fe | 4 rows all CANCELLED, first 2026-10-30 | Headline 2026-10-30 19:00 cancelled, 20 dates | Yes |

Wrong weekday or time: none found. 131c7d97 (rule Fri): 2026-10-30 and 2026-11-06 are Fridays at 20:00. 1e0a984c (rule Sat): 2026-10-31 is a Saturday at 19:00. No BST/GMT shift in any headline.

## C. FIX FIRST additions (both DB side, admin repo)
1. **A cancelled night can be the page headline while a later live date exists.** `_public_featured_occurrence_p5_v1` picks the first date >= now regardless of lifecycle status. 131c7d97 headlines cancelled 2026-10-30 while 2026-11-06 is live; 02f6a4fe headlines a cancelled date. Header, add-to-calendar, JSON-LD and going count then point at a cancelled night. Fix: prefer the first non-cancelled upcoming date, fall back to the cancelled one. Whether the bento shows "cancelled" well is a UI question, not verified.
2. **A past-only live series headlines the earliest date, not the latest.** bc832f76 shows 2026-07-10 though its latest date is 2026-10-23. Paused and ended branches already order descending; fix past-only the same way.

## D. FIX LATER additions
- Page key times are series-wide, the calendar's are per date: a date with a moved session shows different times. Not exercised on real data.
- The page lists at most 52 dates; 131c7d97 has 132. Confirm this is intended.
- Audit findings 2 and 3 (off-weekday dates, start-time drift) still need the admin writer to settle drift vs deliberate moves. Headline starts checked matched the series default.

## E. Not verified
- The rendered public pages were NOT fetched: the cloud session's network blocked `www.bachatacalendar.co.uk` (proxy 403, DNS). Page values come from the RPC payload the page parses, not HTML. The frontend's own handling (`buildEventPageModel`, which date it picks, how cancelled shows) was not read or run. Needs: allow that host for the cloud environment, or walk it locally.
- No phone browser, no 390x844 walk. SSR/ISR cache (s-maxage 3600) may show a stale snapshot; not checked.
- `_public_series_byline_v1`, `_effective_series_item_p5`, `_p5_series_is_multiday_v1`, `_compute_effective_occurrence_p5` bodies not read.
- One series per shape only; the other 27 live weeklies were not walked.
- Calendar comparison ran as the connector role, not anon; anon grants not tested.
- The session's push failed on the pre-push unit gate for a docs-only commit; failing test names were not captured and it was not checked whether main fails the same way.
