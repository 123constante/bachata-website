# Arc: Site structure (5 main pages, fewer useless pages)

Last verified: 2026-11-26 against Website origin/main 65eb3435f (`app/routes.ts`, `src/components/AnimatedRoutes.tsx`, `app/routes/sitemap.tsx`, `vercel.json`). Sources: owner click board https://claude.ai/artifact/3z3xFxr7e3mV4Roqp4X7Cf (43 of 44 rows picked 2026-11-26) and `~/.claude/plans/AUDIT-DATA-site-pages-2026-11-26.md` (GSC 90 days, impressions, signed-out fetch, Fable first-visit test, every owner decision). `W#` = bachata-website, `A#` = bachata-admin.

Goal: Google ranks the pages people search for ("bachata calendar", "bachata classes london", weekday nights), and a first-time visitor finds something THIS WEEK in one tap. Five main pages: **1 What's on** (home, city picker, one filter row Today/Weekend/Near me/Party/Class/Festival), **2 Festivals** (plain list), **3 People & places** (one directory with filter chips), **4 New here?** (Learn + Guide + FAQ, lives at `/learn-bachata-london`), **5 For organisers** (list an event, tickets, sign in, raffles).

Hard facts:
- Every old address that Google or a person may hold KEEPS working: it renders the new page pre-filtered (server-rendered, 200) or forwards with a 301. No address goes to a 404.
- Pages Google sees as an empty 25 KB shell today (no title, no h1): `/tonight /search /cities /choreography /dancers /djs /teachers /organisers /venues /videographers /vendors /all-profiles /practice-partners /discounts /privacy /terms`, `/raffles` (16 KB).
- Cloudflare blocked Googlebot until 2026-11-26 09:03, so GSC numbers before that day under-count `/classes`, `/parties` and the weekday pages.
- Person pages (`/dancers|djs|teachers|organisers|people/:id`) belong to the admin-window arc (bachata-admin `ONE-PERSON-PROFILES-PLAN.md`). This arc only LINKS to them.

## Slices
| Slice | Status | Scope | Measure before next slice |
|---|---|---|---|
| S1 fixes + removals | DONE 2026-11-26 (#2279, #2281, cleanup #2282; Istanbul + Sueño data fixed in prod) | `/choreography` and `/practice-partners` 301 to `/` (bare) or `/city/:slug` (city forms); out of sitemap, breadcrumbs IA, SEO table, catchall client list, Dancers page link. Wrong-city festival data (Sueño Winter Weekender shown in London, is Nottingham; Istanbul congress shown in "Turku"). Beginner list must not include a monthly party. | prod-smoke with `forbid_text`; GSC 1 week |
| S2 What's on | NEXT | One filter row on home (drop the second row, "All" once). `/classes /parties /tonight` + 7 weekday pages + style pages + `/bachata-parties-london` render What's on with a preset filter, list server-rendered. `/city/<slug>` server-rendered per city. `/city/<slug>/map` = city page with Map on (List/Map toggle). `/city/<slug>/calendar`, `/cities` merge into the city picker. Visible phone menu: city switch + sign in. | GSC clicks on `/classes`, weekday pages; home "seen in lists" |
| S3 New here? + For organisers | NEARLY DONE (S3a #2334, S3b #2343, S3b-2 #2349, S3c-1 #2360, S3c-2 #2359 live; S3c-3a/3b menu, header, footer, sitemap in flight #2357/#2358; S3b-3 route-file deletes parked as cleanup) | `/learn-bachata-london` absorbs Guide + FAQ (one copy of each question); `/london-bachata-guide` and `/faq` 301 to it. For organisers page: list an event, tickets, sign in, raffles; `/start-organiser` (404 today) forwards to it. Raffles leaves the top menu. `/festivals` drops the Hub tiles. | GSC on `/learn-bachata-london` |
| S4 People & places | NOT STARTED, waits for bd person-page URL shape | ONE directory page, chips All/Dancers/DJs/Teachers/Organisers/Venues/Vendors/Video. `/dancers /djs /teachers /organisers /venues /vendors /videographers /all-profiles` + city forms open it pre-filtered, server-rendered. Every person row links to the bd person page. Venue/vendor detail pages and organiser subdomains server-render. Footer: ~45 organiser links leave the footer. | profile views from shared links, distinct sharers |

Every slice ships behind a flag in `src/lib/featureFlags` (one flag per slice, `siteStructureS1`..`S4`), server routes read the same flag.

## Contract (every public address)
"After" = state when the arc is done. `smoke` = `prod-smoke.yml extra_paths`; `forbid` = its `forbid_text`; `unit` = vitest in this repo.

### What's on (S2 unless marked)
| Address | After | Sitemap | Checked by |
|---|---|---|---|
| `/` | 307 to `/city/<slug>` (unchanged) | out | smoke |
| `/city/:slug` | 200, server-rendered list, title + h1 name the city, canonical self | in (per active city) | smoke, unit (loader shape) |
| `/city/:slug/map` | 200, city page with Map on, canonical `/city/:slug` | out | smoke |
| `/city/:slug/calendar` | 301 `/city/:slug` | out | smoke (status) |
| `/cities` | 301 `/city/london-gb` (picker lives in the header) | out | smoke |
| `/classes`, `/city/:slug/classes` | 200, What's on preset Class, list server-rendered, own title/h1 "Bachata classes in <city>" | in (London form) | smoke, unit |
| `/parties`, `/city/:slug/parties` | 200, preset Party, own title/h1 | in | smoke, unit |
| `/bachata-parties-london` | 301 `/parties` (duplicate) | out | smoke |
| `/bachata-london-sensual-parties`, `/bachata-london-dominican-parties` | 301 `/parties` (style merge, owner click) | out | smoke |
| `/tonight`, `/city/:slug/tonight` | 200, preset Today, server-rendered | in | smoke |
| `/bachata-london-{monday..sunday}` | 200, preset that weekday, list server-rendered, own title/h1 | in | smoke, unit |
| `/discounts`, `/city/:slug/discounts` | 200, server-rendered title + h1 | in | smoke |
| `/search`, `/city/:slug/search` | 200, `noindex` | out | unit |
| `/event/:id`, `/:night`, event subdomains | unchanged | in (events) | existing |

### Festivals (S1 data, S3 page)
| Address | After | Sitemap | Checked by |
|---|---|---|---|
| `/festivals` | 200, plain list, no Hub tiles, every row in its true city | in | smoke + forbid "Roommates" (S3) |
| `/festival/:id` | 200, correct city (S1) | in | real-data count: festivals whose list city differs from venue city = 0 |

### People & places (S4)
| Address | After | Sitemap | Checked by |
|---|---|---|---|
| `/dancers /djs /teachers /organisers /venues /vendors /videographers /all-profiles` (+ `/city/:slug/` forms in `vercel.json`) | 200, one directory, chip pre-selected, server-rendered title/h1 | in (bare forms) | smoke, unit (chip per address) |
| `/venue-entity/:id`, `/vendors/:id` | 200 server-rendered | in | smoke |
| organiser subdomains | 200 server-rendered | in | smoke |
| `/dancers|djs|teachers|organisers|people/:id` | owned by bd arc | bd arc | bd arc |

### New here? + For organisers (S3)
| Address | After | Sitemap | Checked by |
|---|---|---|---|
| `/learn-bachata-london` | 200, Learn + Guide + FAQ, each question once, FAQ JSON-LD | in | smoke, unit (no duplicate question) |
| `/london-bachata-guide`, `/faq` | 301 `/learn-bachata-london` | out | smoke |
| `/for-organisers` (picked in S3) | 200 server-rendered | in | smoke |
| `/start-organiser` | NOT forwarded: it is the onboarding arc's organiser self-signup (DB flag organiser_onboarding_v2), decision 2026-11-26 | in | n/a |
| `/raffles` | 200, server-rendered title, reached from For organisers, not top menu | in | smoke |

### Removed (S1)
| Address | After | Sitemap | Checked by |
|---|---|---|---|
| `/choreography`, `/practice-partners` | 301 `/` (then the visitor's city) | out | smoke status + sitemap forbid "choreography\|practice-partners" |
| `/city/:slug/practice-partners`, `/:slug/choreography`, `/:slug/practice-partners` | 301 `/city/:slug` | out | smoke |

### Unchanged
`/privacy`, `/terms` (gain server title, S2), `/account/*`, `/auth*`, `/door/*`, `/raffle/*`, `/invite*`, `/claim/*`, `/join/*`, `/erase/*`, `/export/*`, `/api/*`, `/sitemap.xml`: out of scope.

## Rules for this arc
- Branch family `claude/site-structure-*`. One PR per slice; S2 and S4 may split by page if over 5 files / 400 lines.
- Before any removal: search origin/main of BOTH repos + DB for the visible words; the PR lists every hit.
- After each merge: prod-smoke with the changed paths; removals add `forbid_text`.
- GSC baseline taken 2026-11-26 (AUDIT-DATA file); compare 1 week after each slice.

## Not verified here
- Whether the Cloudflare Web Analytics beacon now appears in prod HTML (enabled 2026-11-26 ~13:30).
- Root cause of the wrong-city festivals (data row vs list query) — S1 finds it.
