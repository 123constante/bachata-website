# Handover: organiser-stats-v2-share-card, continuation 2 (PR #1428)

Ticket dt_8e667b021ce6. Brief: `brief/organiser-stats-v2-share-card-cont2` (sha 4cf4187b).
Fixes the two must-fix findings of the independent review at head 1923600d. The review
pack built at 1923600d is superseded and must be rebuilt after this lands.

## INVENTORY (written before building)

Paths are under `src/modules/organiser/p3/`. Tests: SS = `screens/__tests__/statsShare.matrix.test.tsx`,
SM = `screens/__tests__/screens.matrix.test.tsx`, AV = `data/__tests__/analyticsV2.test.ts`,
PR = `data/__tests__/publicEventRef.test.ts`.

| # | State | Where | Covered by |
|---|-------|-------|-----------|
| 1 | Loading (views / home only; analytics no longer holds it) | screens/StatsScreen.tsx:57 | SM "analytics loading does not hold up the views"; SS "analytics still loading" |
| 2 | Error (views or home) + Try again | StatsScreen.tsx:66 | SS "views error still shows the error card" |
| 3 | No page | StatsScreen.tsx:79 | SM page-scope cases (existing) |
| 4 | Empty, no live event | StatsScreen.tsx:155 | SS matrix "empty views + no event" |
| 5 | Empty, range has none but 30 days has | StatsScreen.tsx:150 | SM existing range cases |
| 6 | Ended-only | StatsScreen.tsx:155 + ShareLinkCard reason | SS "ended-only + 0 views", "views + no live event" |
| 7 | Live, link ready (link = slug) | ShareLinkCard.tsx:28-29 | SS "the link is the slug", SM "live code and a next event" |
| 8 | Link switched off | ShareLinkCard.tsx reason / StatsScreen.tsx:162 | SS "link switched off" |
| 9 | No code yet | shareState.ts noCode | SS "no code yet" |
| 10 | Live row with no safe public ref: state 'noRef', no link, Copy disabled, "no public address yet. Ask the team." | ShareLinkCard.tsx shareLinkStateOf | SS "a live row with no public ref" |
| 11 | Analytics refused (any coded error, any series, even mixed with a dropped one) = analyticsHidden: tiles hidden, page share card kept | data/analyticsV2.ts fetchPageAnalytics, StatsScreen.tsx | AV refusal matrix + mixed refused/dropped; SS "refused, with views/no views"; SM "a refused read hides the tiles" |
| 12 | Analytics network error: views stay, tiles offer Try again | StatsScreen.tsx:114 | SS + SM "network" cases |
| 13 | Share code refused (coded): card hidden, no Try again | ShareLinkCard.tsx:36 | SM "a refused code read (42501)"; SS "refused analytics and refused share code" |
| 14 | Share code network error: card error + Try again | ShareLinkCard.tsx:35-44 | SM "a network failure on the code read" |
| 15 | Two pages: card uses the chosen page's event and code | ShareLinkCard.tsx | SS "page B" |
| 16 | "Link copied." cleared on state change | ShareLinkCard.tsx:32 | SM "Link copied. clears" |
| 17 | Disabled Copy contrast >= 4.5 | ShareLinkCard.tsx:66 | NOT a test: computed by hand (below) |

Coverage: 16 of 17 states covered by a test (17 is a computed check, not a test).

## Done

- `P3Row.publicEventRef`, built once in `data/home.ts` `publicEventRefOf`: series slug when
  non-blank; else `legacy_event_id ?? id` only if the payload carries the legacy key; else ''
  (no link). organiser_home_v1 (prod def read 2026-11-07) sends the series slug at
  `organisers[].series[].slug` (the other `'slug'` key is the organiser's, `organisers[].slug`)
  and no `legacy_event_id`, so today the slug is the path. `shareLinkOf(origin, publicEventRef, code)`.
- `fetchPageAnalytics` returns `{ hidden: true, data: null }` on any coded refusal (one refused
  series hides the whole page: never a partial sum); only code-less errors throw (one retry).
- StatsScreen renders views first; tiles render only with data; analyticsHidden = no tiles,
  no Retry. The share card is NOT hidden by an analytics refusal (organiser_share_code_v1 is
  page owner / manager, a different gate); it hides itself only when the share code read is
  itself refused (coded), and then the empty copy is neutral.
- Review (CLAUDE.md, two rounds, user-facing). Round 1 (medium) fixed: share card over-hidden
  on analytics refusal; refused + dropped series showed a dead Retry (now allSettled); the
  no-public-ref reason said "try again shortly" (now its own 'noRef' reason); a raw U+2019.
  Not taken: "only 42501 should hide" (the brief says any coded error; a coded timeout 57014
  would hide for 5 min -- owner call); trimming the slug (the resolver matches the stored slug
  exactly; 0 of 70 prod slugs have spaces); reuse of src/lib/seo/eventHref.ts (outside the
  brief's files; follow-up). Round 2 (low): no new defect. Note clearing moved from an effect
  to a render-time key reset (eslint react-hooks/set-state-in-effect).
- Contrast: `.p3-btn-line:disabled` has `opacity: 0.8`, which put `--mut` at 4.499 (light) and
  4.31 (dark) on `--card`. The share card sets `opacity: 1` inline (7.53 / 5.84). p3.css is
  outside this brief's file list, so the CSS line itself is unchanged: **next step** drop
  `opacity: 0.8` from `theme/p3.css:124` and remove the inline style.

## Prod proof (read-only, 2026-11-07, re-run by this worker, counts only)

event_series_p5 lifecycle_status='live': 70 series. Unbridged 12: by id 12, by slug 12. Bridged
58: by id 0, by slug 58, by COALESCE(legacy_event_id,id) 58. All 70 have a slug, 0 slugs
outside [a-z0-9-].

## Not verified

- Browser walk at 390x844 (no prod-shaped signed-in session in this cloud worker).
- A real non-manager account hitting the refusal on prod.
