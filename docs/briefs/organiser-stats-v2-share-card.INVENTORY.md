# INVENTORY: organiser Stats v2 + share link card

Sources: Website (this repo, read at main b07bca9), prod function definitions read with
pg_get_functiondef on 2026-11-06 (SELECT only). The admin app repo is not attached to this
session, so its screens are listed as "not read" and are NOT counted as covered.

| # | Item | Where | Covered |
|---|------|-------|---------|
| 1 | Range switch Today / 7 days / 30 days | src/modules/organiser/p3/screens/StatsScreen.tsx:11,43 | yes, reused |
| 2 | Views total stat (`p3-stats-total`) | StatsScreen.tsx:75 | yes, kept |
| 3 | Going tile | StatsScreen.tsx:80 | yes, kept |
| 4 | Loading / error + Try again / no-page states | StatsScreen.tsx:53-70 | yes, kept |
| 5 | "No views yet" empty state | StatsScreen.tsx:92 | yes, copy points at Copy link |
| 6 | Chart, table toggle, by-event list | StatsScreen.tsx:100-140 | yes, untouched |
| 7 | organiser_analytics_v2 arg p_series_id | prod def, `uuid` | yes |
| 8 | args p_from / p_to (cap 365 days back, 22023 if from > to) | prod def | yes |
| 9 | has_own_code | prod def `has_own_code` | yes |
| 10 | totals.visitors | prod def | yes |
| 11 | totals.views | prod def | yes (parsed, not shown) |
| 12 | totals.from_your_link | prod def | yes |
| 13 | totals.link_taps{ticket,directions,share,group_chat,instagram,organiser_link,other} | prod def v_zones | yes (parsed, summed, not shown) |
| 14 | totals.link_taps_from_your_link | prod def | yes (parsed) |
| 15 | totals.guest_list_signups (shown only when non-zero) | prod def | yes |
| 16 | totals.tickets_sold (shown only when non-zero) | prod def | yes |
| 17 | by_day[] day, visitors, views, from_your_link, tickets... | prod def | yes (parsed) |
| 18 | window_capped | prod def | parsed, not shown |
| 19 | refusal 42501 not_signed_in / not_allowed | prod def | yes: error state, never zeros |
| 20 | refusal 22023 bad_request | prod def | yes: error state |
| 21 | organiser_share_code_v1 arg (organiser profile id) | prod def | yes |
| 22 | share_code (text, may be null) | prod def | yes |
| 23 | disabled (boolean) | prod def | yes: disabled button + reason |
| 24 | refusal 42501 on share code | prod def | yes: card shows its own error + Try again |
| 25 | Link target: next live event `/event/<series id>?ref=<code>` | src/modules/organiser/p3/data/home.ts:136 nextUpOf; src/modules/event-page/useEventPageQuery.ts:374 | yes |
| 26 | Copy link, clipboard failure fallback to selected text | new | yes |
| 27 | No event reason | brief | yes |
| 28 | Admin app screens for the same data | bachata-admin-11april | NOT read |
| 29 | Public page `?ref=` capture | W1 branch | NOT in scope (W1) |

Coverage: 27 of 29 covered (items 28 and 29 not read / out of scope).
