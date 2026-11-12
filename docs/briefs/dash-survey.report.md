# Dashboards slice 0: stats data survey (admin #1532, parent #1531)

Run 2026-11-12, prod project `stsdtacfauprzrdebmzg`, read-only SELECTs via Supabase MCP. Counts only, no personal data. Brief sha dc6d47f. No contract doc for the dashboards exists in `docs/`, so the brief's list was used: organiser light dashboard (next action, share page, per-night Going/opens/clicks, positive-only) and dancer dark dashboard (finish profile, nights attended).

Query labels (Qn) refer to the table at the end.

## Verdict

| Tile | Real data? | Rows | Caveat | Empty state needed |
|---|---|---|---|---|
| Going (event_attendance) | NO, effectively none | 7 total: 5 going, 2 interested (Q3, Q9) | 6 distinct occurrences, 5 users. All 5 going rows are on PAST nights; 0 rows on upcoming nights (Q19, Q19b, Q19c). Feature just launched or barely used. | YES, mandatory. Per-night Going is 0 for every upcoming night. Positive-only rule means the tile is hidden for virtually every organiser. |
| Opens (event_views) | YES | 63,576, 2026-04-22 to 2026-11-12, 17,564 distinct sessions (Q1) | Source: public_event_page 60,040, public_festival_page 3,536 (Q7). `ref_code` is NULL on all rows (Q1), so the by-ref split is empty. 132 events have views, max 6,013 per event, median 195, p95 1,787 (Q15). 14-day daily range 1 to 416 (Q18). Server dedupe is per event + session + UTC day + occurrence (function `record_event_view_v1`); bots/admin are refused. 301 groups of same session+event+UTC day exist (Q17), most likely older rows from before the dedupe. | Only for brand-new organisers/events with 0 views (2 of 49 linked organisers have 0 views, Q24). Positive-only hides it. |
| Link clicks (event_link_clicks) | YES | 7,392, 2026-05-25 to 2026-11-11, 2,405 sessions (Q2) | link_type: ticket 4,094, other 2,057, share 977, whatsapp 264 (Q8). `other` is the directions button (source split Q8b). 111 events have clicks, max 676, median 29 (Q16). No `ref_code` data. | Yes for organisers with 0 clicks (6 of 49, Q25). |
| Organiser page opens | PARTIAL, two tables, neither is a clean per-organiser total | `profile_view_events` profile_type=organiser: 1,271 rows (1,121 from event-page organiser card, 150 from the organisers listing) (Q10), 42 distinct organiser ids, 41 match an organiser_profiles id (Q28, Q28b). `organiser_card_clicks`: 1,163 rows since 2026-09-18, 33 organisers (Q4, Q11, Q27) | A card TAP (profile 279, instagram 562, website 322) is a click, not a page open. `organiser_analytics_daily_totals` exists but has 0 rows (Q6), so the rollup has never run. profile_view_events has no date-dedupe note in this survey. Not verified whether the profile_view write is deduped. | Yes. Organisers with no profile views, and the whole tile if the rollup is the intended source. |
| City organiser counts (5+ rule) | Barely | 51 organiser rows in 5 cities (Q22d). 1 city has 5+ (47 organisers), 4 cities have 1 (Q22d, Q23). Only 5 organisers are is_active (Q14); 1 city still meets 5+ under every definition tried (Q22, Q22b, Q22c) | Only 1 of 319 cities passes. cities.is_active is true for 1 city only (Q21), so the 5+ rule hides the count nearly everywhere. | YES. Almost every organiser will see the empty/hidden state. |
| Nights attended (dancer) | NO, effectively none | Derived from event_attendance status=going on past nights: 5 rows (Q19b) | Only 1 attendance row belongs to a user linked to a dancer profile via claimed_by (Q19d). The tile would show a number for at most 1 dancer. Whether "attended" should also require `interested`, or a check-in, is undefined. | YES. Zero is the normal case. |

## Organiser shapes (careful lane)

| Shape | Organisers | Query |
|---|---|---|
| Active organisers (is_active) by upcoming nights: 0 nights ever | 0 | Q12 |
| Active, past-only | 1 | Q12 |
| Active, 1-5 upcoming | 1 | Q12 |
| Active, 6+ upcoming | 3 | Q12 |
| Linked to a series (49 organisers): 0 upcoming | 17 | Q26 |
| Linked, 1-5 upcoming | 8 | Q26 |
| Linked, 6+ upcoming | 24 | Q26 |
| Linked, views 0 / 1-49 / 50-499 / 500+ | 2 / 3 / 17 / 27 | Q24 |
| Linked, clicks 0 / 1-9 / 10-99 / 100+ | 6 / 5 / 17 / 21 | Q25 |

Note the gap: 49 organisers are linked to series, but only 5 have is_active true and lifecycle `live` (Q20). Check which population the dashboard actually serves before sizing empty states. "Huge" is the 6,013 views on one series (Q15) and 676 clicks (Q16), so every per-night list must handle 4-digit numbers on a phone. Occurrence lifecycle: scheduled 3,192, cancelled 153 (Q13), so per-night lists need a cancelled-night rule.

## Findings to act on

1. Opens and link clicks are the only tiles with real data. Build them first.
2. Going and Nights attended are near-empty. Ship them with explicit empty states, not as headline tiles.
3. Organiser page opens has no single source. The rollup table is empty, and the two raw tables measure different things. Needs a decision from the owner.
4. The 5+ city rule passes in 1 city of 319.
5. `ref_code` is NULL on every view and click, so any by-ref split will be empty.

## Handover

Verified: all numbers below, each from a read-only SELECT on prod on 2026-11-12, labelled with its Q number.

Not verified:
- The rest of the `record_event_view_v1` body (it was read up to the insert), and whether `record_event_click` has any dedupe.
- Whether profile_view_events writes are deduped per session and day.
- Whether the 301 duplicate view groups pre-date the dedupe.
- Whether `organiser_series_stats_v1` (the P3 stats RPC) returns the same totals as the raw tables (not run).
- The identity of the organisers/series matched. No personal data was read.
- The "Nights attended" definition (going on a past night is an assumption).
- No contract doc for the dashboards was found in `docs/`.
- tsc, lint and browser checks: not applicable, docs-only change.

## Queries

- Q1-Q6: row count, min/max date, distinct sessions, non-null `event_id_p5`/`occurrence_id_p5`/`ref_code` for event_views, event_link_clicks, event_attendance, organiser_card_clicks, profile_view_events, organiser_analytics_daily_totals.
- Q7-Q11: group-by counts of event_views.source, event_link_clicks.link_type and source, event_attendance.status, profile_view_events (profile_type, source_context), organiser_card_clicks (zone, source).
- Q12-Q14b: organisers by upcoming/past nights via event_series_organiser_p5 joined to event_occurrence_p5 (upcoming = occurrence_date >= current_date, not cancelled/draft), occurrence lifecycle split, organiser counts.
- Q15-Q19d: per-event percentile counts of views and clicks, same-day duplicate groups, null sessions, 14-day daily range, attendance spread (past vs upcoming, linked dancer profile).
- Q20-Q23: organiser is_active x lifecycle, cities is_active, cities with 5+ organisers under three definitions, distribution, max per city.
- Q24-Q28b: linked organisers bucketed by views, clicks and upcoming nights, organisers with card clicks and profile views.
