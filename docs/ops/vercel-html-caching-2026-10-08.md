# Vercel HTML caching: why the hit rate is low (2026-10-08)

Analysis only. No behaviour change ships with this document.

**Trigger.** Vercel's dashboard: Fluid Active CPU 4h50m of the 4h Hobby
allowance, high Function invocations. Observability (prod, last 12h, CDN
requests and CDN cache hit rate per route): `/*` 1.3K at 10.7%,
`/event/:id` 472 at 7.2%, `/city/:slug` 237 at 63.3%, `/dancers/:id` 156 at
1.3%, `/venue-entity/:id` 136 at 6.6%, `/organisers/:id` 85 at 0%,
`/event/:id.data` 54 at 13%, `/_vercel/image` 312 at 98.7%, `/sitemap.xml`
28 at 22%. Bots are roughly 10% of requests.

**Verdict, short.** The HTML is **not** uncacheable. Every public SSR route
except `/organisers/:id` already sends `Vercel-CDN-Cache-Control: public,
s-maxage=3600, stale-while-revalidate=…` with a purge tag, and production
caches it: a repeat request to the same URL comes back as `x-vercel-cache: HIT`.
The per-request CSP nonce does **not** prevent caching. The low Vercel hit
rate has four causes outside the response headers (sections 3 and 4):

1. **Every production deploy empties Vercel's CDN cache**, and `main`
   shipped **17 deploy-triggering commits in the last 24h** (34 in 48h).
2. **Cloudflare now sits in front of Vercel** and caches HTML itself for about
   300s. Repeat visits inside that window never reach Vercel, so the requests
   Vercel does see are mostly first requests or post-expiry requests. This
   lowers the hit rate Vercel reports without increasing function work.
3. **Query strings split the cache key.** `?fbclid=…`/`?utm_…` (Instagram,
   Facebook and WhatsApp in-app browsers) make every shared-link click a
   unique URL, which misses in both Cloudflare and Vercel.
4. **Long-tail URLs.** About 80 event, 147 dancer, 51 venue and 46 organiser
   URLs share a few hundred requests in 12h. Most URLs see their first request
   after a deploy, and that first request is always a miss.

Plus one deliberate setting: `/organisers/:id` ships `s-maxage=0` because
nothing purges organiser pages (0% is by design; see the table).

**Freshness finding (new, important).** Cloudflare's HTML cache is **not
reached by the tag purge**. `invalidateByTag` purges Vercel only. A
cancellation can therefore be served stale for up to ~300s after the Vercel
purge. Cloudflare also cached a `Cache-Control: no-store` 404 (measured), so
it overrides the origin's `no-store`. This holds today, before any change.

---

## 1. How the cache headers are produced today (code read, `origin/main` 79d74d5)

| Piece | What it does |
|---|---|
| `app/entry.server.tsx` | Per-request `randomBytes(16)` nonce. It goes to `<ServerRouter>`, React bootstrap, `<Scripts>`, the `Content-Security-Policy` **header** and an injected `<meta http-equiv>` copy. Bots (`isbot`) get `onAllReady` and humans get `onShellReady`. That changes streaming only, never headers. Then calls `finalizeDocumentCacheHeaders`. |
| `app/documentCacheHeaders.ts` (#600, 2026-10-06) | Status >= 400: deletes `Vercel-CDN-Cache-Control`/`Vercel-Cache-Tag` and sets `Cache-Control: no-store`. The skew-protection `Set-Cookie: __vdpl=…` is added **only** when the document is not edge-cacheable. Before #600 that cookie disabled the edge cache on every document. |
| `app/detailLoader.ts` `cacheHeaders()` | Route `headers()` for loader routes. With a loader tag: `Cache-Control: public, max-age=0, must-revalidate` (browser) + `Vercel-CDN-Cache-Control: edgeCacheControl(bound)` + `Vercel-Cache-Tag`. Without a tag: browser header only (no edge cache). |
| `app/detailLoader.ts` `staticShellCacheHeaders()` | Catch-all (`/*`) shell, which has no loader: `Vercel-CDN-Cache-Control` default, no tag (purged by the deploy). |
| `app/edgeCacheControl.ts` | Default `public, s-maxage=3600, stale-while-revalidate=86400`. Bounded routes (`/city/:slug`, `/festival/:id`, SEO landing pages) cap s-maxage + SWR at the next content-time boundary. A bound of `0` means `s-maxage=0, must-revalidate`. |
| `app/cacheTags.ts` | Tag taxonomy, stamp side and purge side (`purgeTagsFor`), with a conformance test. |
| `app/routes/api.revalidate.tsx` | `POST /api/revalidate`, `Bearer REVALIDATE_SECRET`, calls `invalidateByTag(tags)` (**soft** invalidate: the first request after the purge is served stale while it revalidates). Purges **Vercel's** cache only. |
| `middleware.ts` (Edge) | Matcher `/teachers/:path*`, `/city/:path*`. For bot UAs (googlebot, bingbot, facebookexternalhit, whatsapp, twitterbot, linkedinbot, slackbot, telegrambot, discordbot) it returns a hand-built OG-card HTML. Bare `/city/:slug` for search bots goes to `next()`. Humans always `next()`. |
| `vercel.json` | `/` → `/city/london-gb` redirect (no function). `/assets/*` immutable. Security headers on `/(.*)`. No HTML cache headers, no rewrites. `ignoreCommand` builds when `src app middleware.ts package*.json vite.config.ts vercel.json .vercelignore bin/install-hooks.cjs` changed vs `HEAD~1`. |
| `react-router.config.ts` | Prerendered (static, no function): `/parties /classes /faq /bachata-parties-london` + the two style pages. |
| `api/embed/_template.ts` | Template only. The live endpoints are RR resource routes (`api.*.tsx`) with their own `Cache-Control`. |

Set-Cookie, Vary: no SSR loader reads `Cookie`/`Authorization`. The only
document `Set-Cookie` is the skew cookie above. `Vary` is `accept-encoding`
only (prod).

### The DB side of the purge (read-only, `pg_proc` / `vault` / `net`)

- `_emit_cache_revalidation_v1(entity_type, entity_id, extra)`: `net.http_post`
  to Vault secret `revalidate_url` with `Bearer revalidate_secret`. Errors are
  swallowed (best-effort). `revalidate_url`'s host is
  **`www.bachatacalendar.co.uk`, so the purge travels through Cloudflare.** An
  unauthenticated probe POST got the app's own JSON 401 back
  (`cf-cache-status: DYNAMIC`), so Cloudflare passes it through and does not
  challenge it. `net._http_response` (6h retention) held no revalidate
  responses at the time of reading, so a real purge's status was **not**
  observed.
- `_emit_occurrence_venue_cache_v1(series_id)` emits `event` (+ `festival`).
- **Functions that emit:** `apply_aggregate_write_p5` (all `_cmd_*` series and
  occurrence commands run under it), `_cmd_occurrence_cancel_p5`,
  `_cmd_series_upsert_p5`, `admin_bulk_occurrence_command_p5`,
  `admin_set_series_lifecycle_v1`, `organiser_set_occurrence_programme_v1`,
  `admin_save_person_v1` (dancer/dj/teacher), `admin_save_venue_v2`, and two
  venue-room triggers.
- **Write paths that do NOT emit** (they write series/occurrence tables
  directly, granted to `authenticated` and therefore admin-gated inside):
  `admin_delete_series_p5_v1`, `admin_collapse_series_to_one_off_p5`,
  `admin_duplicate_event_p5`, `admin_merge_venues_v1`,
  `self_heal_occurrence_integrity_v1`, `admin_set_series_promotion_touches_v1`,
  `admin_assign_raffle_preset_v1` / `admin_bulk_assign_raffle_preset_v1`,
  `admin_save_event_guest_list_config_v1`. Also `organiser_profile_update_p5_v1`
  (organiser pages; no `organiser` entity type exists).
- **Time is not a write.** An occurrence passing its end, or a series rolling
  over to "ended", purges nothing. `/city/:slug`, `/festival/:id` and the SEO
  pages bound their TTL for this reason. **`/event/:id` does not**, so an event
  page holds the 3600 + 86400 policy.

### Bot / UA handling, and how much of the gap it explains

- `entry.server` `isbot` only switches `onAllReady` vs `onShellReady`. The
  bytes differ in streaming order (~670 bytes shorter for Googlebot); the
  cache headers are identical. Vercel does not key on UA, so a bot and a human
  share one cache entry. That is safe: same content, same nonce in header and
  body.
- `middleware.ts` answers social bots on `/city/*` and `/teachers/*` with an
  OG-card stub. It exists because WhatsApp/Facebook previews need `og:*` tags
  and JPEG og:images, and `/teachers` is still flag-gated. It runs on the Edge
  (not the SSR function) but does a Supabase fetch per bot hit. Measured:
  Cloudflare did **not** cache the stub (`cf-cache-status: DYNAMIC` for a
  WhatsApp UA), and a human request for the same URL afterwards got the real
  31 KB page. No cross-UA poisoning was observed.
- Bots are roughly 10% of requests, so the UA bypass explains at most about a
  tenth of the gap. Crawlers walking unique URLs (dancers: 147 URLs, 1.3%)
  are the long-tail effect of cause 4, not a header problem.

---

## 2. Measured: built server (local, real data via the public anon key)

`npm ci --ignore-scripts`. The production build was made twice: once with the
`e2e-smoke.yml` placeholder env (loaders fail, so 500 + `no-store` + skew
cookie, as designed), and once with the **public** anon key and
`VITE_ENABLE_VENUE_DETAIL=true VITE_ENABLE_ORGANISER_DETAIL=true` (the prod
flags) so loaders render real rows. SSR loaders only read (`app/` has no write
RPC on a document path). The server was a minimal Node adapter around
`createRequestHandler` with `VERCEL_SKEW_PROTECTION_ENABLED=1`. Each URL was
requested twice per UA: iPhone Safari and Googlebot.

| URL | Status | Cache-Control | Vercel-CDN-Cache-Control | Vercel-Cache-Tag | Set-Cookie | Bytes (iPhone / Googlebot) | Two responses |
|---|---|---|---|---|---|---|---|
| `/` | 307 → `/city/london-gb` | – | – | – | – | 0 | identical |
| `/city/london-gb` | 200 | `public, max-age=0, must-revalidate` | `public, s-maxage=3600, stale-while-revalidate=30533` (bounded) | `home-feed,city-london-gb` | none | 259,685 / 259,017 | differ: nonce + React Query `dataUpdatedAt` timestamps |
| `/event/bachateame-saturdays` | 200 | same | `public, s-maxage=3600, stale-while-revalidate=86400` | `event-<uuid>,events` | none | 93,923 / 93,239 | differ: nonce + timestamps |
| `/event/bachateame-saturdays.data` | 200 | same | same | same | none | 30,421 | differ: timestamps |
| `/dancers/unclaimed-77d8c5e6` | 200 | same | `… s-maxage=3600, stale-while-revalidate=86400` | `dancer-<uuid>,dancers` | none | 53,775 / 53,093 | differ |
| `/organisers/ritmo-latino` | 200 | same | **`public, s-maxage=0, must-revalidate`** | `organiser-<uuid>,organisers` | **`__vdpl=…; HttpOnly`** | 181,852 / 181,168 | differ |
| `/venues` (catch-all) | 200 | same | `… s-maxage=3600, stale-while-revalidate=86400` | – | none | 27,633 / 26,965 | differ by **nonce only** |
| `/venue-entity/temple-pier` | 200 | same | same | `venue-<uuid>,venues` | none | 51,894 / 51,226 | differ |
| `/festivals` | 200 | same | same | `festivals-list` | none | 74,540 / 73,872 | differ |
| `/sitemap.xml` | 200 | – | `… s-maxage=3600, stale-while-revalidate=86400` | – | none | 66,066 | identical |

`Vary` was absent on every local response (Vercel adds `accept-encoding`).
`CDN-Cache-Control` is set nowhere.

**Nonce vs caching.** Each fresh render differs byte-for-byte (nonce, and on
loader routes also query timestamps), but nothing marks the response private.
A shared cache stores one render with its header and body together, so the
nonce in the cached `Content-Security-Policy` header matches the nonce in the
cached scripts, and hydration works from a HIT (prod serves HITs today). The
cost: every viewer of one cached copy sees the same nonce for that copy's
lifetime (<= 1h fresh). That is the trade-off the repo already accepts for
prerendered pages (build-time nonce in the meta). The nonce is **not** the
cause of the low hit rate, and **no CSP change is needed** to cache HTML.

---

## 3. Measured: production (`www.bachatacalendar.co.uk`, 2026-10-08 07:53–08:06 UTC, from a US egress; Vercel region `iad1`)

- DNS: `www.bachatacalendar.co.uk` → `104.21.5.178`, `172.67.133.176`
  (Cloudflare), NS `*.ns.cloudflare.com`. Responses carry `server: cloudflare`,
  `cf-cache-status`, `cf-ray`. `src/App.tsx` still says the domain "cannot …
  until the domain is proxied through Cloudflare", so the proxy is newer than
  the repo's notes.
- **Vercel's cache works.** Direct to `bachata-website.vercel.app` (no
  Cloudflare): `/faq`, `/city/london-gb`, `/festivals` went `MISS` then `HIT`
  on the next request. `/venues` was already `HIT`.
- **Cloudflare caches HTML for ~300s regardless of `max-age=0`.** A sampler
  ran every ~21s for 9 minutes on 6 URLs (102 samples). `cf-cache-status: HIT`
  with `age` rising to 306–309, then `EXPIRED` and one origin fetch, then `HIT`
  again. On those refetches Vercel answered `x-vercel-cache: HIT` (`/venues`,
  `/festivals`, `/city/london-gb`, `/event/bachateame-saturdays`,
  `/venue-entity/temple-pier`, `/dancers/unclaimed-77d8c5e6`). So in steady
  state each URL costs Vercel at most about one request per 5 minutes per
  Cloudflare location, and **the function runs only when Vercel's own copy is
  missing** (after a deploy, or first request).
- **Query strings:** `/city/london-gb` → Vercel `HIT`. `/city/london-gb?fbclid=zz1`
  → `MISS` at both layers. `?utm_source=ig` → `MISS`. Each distinct value is a
  new cache entry.
- **Cloudflare stores no-store documents:** `/event/does-not-exist-<probe>`
  (404, `Cache-Control: no-store`) was `cf-cache-status: MISS`, then `HIT`.
- Cloudflare's `EXPIRED`/`REVALIDATED` states and the copied-through
  `x-vercel-cache` header mean a `cf HIT` response shows the
  `x-vercel-cache` value from when Cloudflare filled the entry. Read
  `cf-cache-status` first.

### Deploy frequency (cause 1)

The `ignoreCommand` paths changed on `main` (first-parent) in 17 of 19 commits
in the last 24h, 34 of 47 in 48h, and 3 of 5 in the last 12h. Vercel scopes
its CDN cache per deployment and purges it on every new production deploy
([Vercel CDN cache](https://vercel.com/docs/caching/cdn-cache),
[purge docs](https://vercel.com/docs/caching/cdn-cache/purge)). Those commits
include dev-only dependency bumps (`package*.json`) and test-only edits under
`src/`. A rough model: about 8 cache epochs per 12h and about 6
requests per event URL per 12h. Most URLs then get <= 1 request per epoch, so
their hit rate tends to 0. `/city/london-gb` (237 requests, one URL) reaches
63%. The model matches the observed spread: per-URL volume, not headers,
separates 63% from 7%.

---

## 4. Per-route table

| Route (12h reqs / hit) | Today's edge headers | What would be needed to cache more | Freshness risk: what changes it | Purge hook that covers it |
|---|---|---|---|---|
| `/*` catch-all, e.g. `/venues`, `/dancers`, `/auth`, unknown paths (1.3K / 10.7%) | `s-maxage=3600, swr=86400`, untagged; shell with no data | Fewer deploys; drop tracking query strings from the cache key; unique-URL scanners and 404s will always miss | None: the HTML contains no data (client fetches after hydration) | Deploy (new cache scope). None needed |
| `/city/:slug` (237 / 63%) | `s-maxage=3600`, SWR bounded to the next "on now" transition; `home-feed,city-<slug>`; degraded shell `s-maxage=30` | Fewer deploys; query strings | Cancellations, edits, new/removed occurrences, time (on-now/ended), handled by the bound | `event`/`festival` emit → `city-<slug>` (or `home-feed`), plus Cloudflare ~300s not purged |
| `/event/:id` (472 / 7.2%) and `.data` (54 / 13%) | `s-maxage=3600, swr=86400`, `event-<uuid>,events`; **no time bound** | Fewer deploys; query strings; long tail (about 80 URLs) | Cancel, edit, lifecycle (paused/ended/archived), lineup, venue change, **time passing**, deletes | `event` emit via `apply_aggregate_write_p5` (cancel, edit, lifecycle, bulk, programme). **Not covered:** `admin_delete_series_p5_v1`, collapse, duplicate, merge venues, self-heal, raffle/guest-list config, time-based ending, and person/venue renames shown on the event page (those purge only the person/venue tag) |
| `/dancers/:id` (156 / 1.3%) | `s-maxage=3600, swr=86400`, `dancer-<uuid>` | Long tail (147 URLs, crawler-heavy); fewer deploys | Profile edits, archive/delete | `admin_save_person_v1` → `dancer-<uuid>` |
| `/venue-entity/:id` (136 / 6.6%) | same, `venue-<uuid>` | same (51 URLs) | Venue edits; merge | `admin_save_venue_v2` → `venue-<uuid>`; `admin_merge_venues_v1` does **not** emit |
| `/organisers/:id` (85 / 0%) | **`s-maxage=0, must-revalidate`** + skew cookie (deliberate) | An `organiser` entity type in `_emit_cache_revalidation_v1`, emitted by `organiser_profile_update_p5_v1` and the admin save, then raise the bound (admin repo; out of scope here) | Organiser self-edits (client-side), claims, event list changes | **None today**. That is why the TTL is 0 |
| `/festivals` | `s-maxage=3600, swr=86400`, `festivals-list` | Fewer deploys | Festival edits/cancels | `festival` emit → `festivals-list` |
| `/sitemap.xml` (28 / 22%) | `s-maxage=3600, swr=86400`, untagged; no `Cache-Control` | Cloudflare already caches it; low volume | New/removed public URLs (≤ 25h late) | None (TTL only). SEO-tolerable |
| `/` | Edge redirect (vercel.json) | n/a | n/a | n/a |
| Prerendered (`/faq`, `/parties`, …) | Static files | n/a | Build only | Deploy |

---

## 5. Why no code PR

The task allowed a code change only if it is clear and safe. None qualifies:

- **Headers are not the bottleneck.** Every candidate route already has an
  edge TTL. Raising s-maxage does nothing while a deploy wipes the cache every
  ~1.4h. Adding edge caching to `/organisers/:id` needs a purge emit that does
  not exist (admin repo: out of scope).
- **No CSP change is required**, so the "STOP if CSP must change" rule never
  triggers.
- The levers that would move the numbers are configuration and process
  choices outside this repo's code, and each trades something the owner must
  decide (section 6).
- `/event/:id` already has a known freshness gap (time-based ending, delete,
  and rename paths that do not purge). Widening its caching is unsafe until
  that is closed.

## 6. Decisions for the owner

1. **Deploy frequency (largest lever, no freshness cost).** Stop production
   deploys for changes that cannot affect the runtime. Options, either or
   combined:
   - (a) Batch merges, or merge bots/dependabot to `main` less often.
   - (b) Tighten `ignoreCommand` to skip `**/*.test.*`, `tests/**`, and
     `devDependencies`-only `package*.json` diffs.

   Both reduce how often the Vercel cache is emptied. (b) is a `vercel.json`
   change that can wrongly skip a deploy if the path filter is wrong, so it
   needs your call and a test plan.
2. **Cloudflare HTML caching (freshness, already live).** Cloudflare caches
   HTML for ~300s, overrides `no-store`, and is not purged by
   `/api/revalidate`. Pick one:
   - (a) Accept "purge latency + up to 5 min" as the freshness contract and
     write it down.
   - (b) Add a Cloudflare purge-by-URL to `/api/revalidate` (needs a
     Cloudflare API token secret, plus a URL list per tag).
   - (c) Set Cloudflare to bypass HTML (keeps Vercel as the only HTML cache;
     more Vercel requests, but they are mostly HITs).
   - (d) Make the Cloudflare rule respect origin headers: honour `no-store`,
     and do not cache 4xx/5xx.

   Also confirm the Cloudflare rule leaves `/api/*` uncached. `/api/revalidate`
   came back `DYNAMIC`.
3. **Tracking query strings.** In Cloudflare, exclude `fbclid`, `gclid`,
   `utm_*`, `igshid` and `mc_*` from the cache key (Cache Rules → cache key →
   query string). Cloudflare then serves social clicks from one entry, and
   Vercel sees the path once per expiry. No code needed; the client still sees
   the params. Check in Vercel Observability what share of `/*` and
   `/event/:id` requests carry a query string before choosing.
4. **Organiser purge (admin repo).** Add an `organiser` entity type to
   `_emit_cache_revalidation_v1` and emit it from
   `organiser_profile_update_p5_v1` and the admin save. Then delete the `0`
   bound in `app/routes/organiser.tsx` and the two `STAMP_ONLY_KINDS` entries
   in the same change.
5. **Event-page freshness gaps (before any event caching is widened).**
   - Emit from `admin_delete_series_p5_v1`, collapse, duplicate,
     `admin_merge_venues_v1` and `self_heal_occurrence_integrity_v1`.
   - Decide whether person/venue renames should also purge the event pages
     that show them.
   - Bound `/event/:id`'s edge TTL by its next occurrence's end, the same way
     `/city/:slug` does.
6. **Housekeeping noticed:** the live sitemap lists
   `/organisers/zz-test-delete-me` (test data in production).
7. **Token identity:** the environment's `GH_BOT_TOKEN` authenticates as
   `123constante`, not `kiki-claude-bot`. Commits are authored as
   `kiki-claude-bot`, but the push and PR show the owner account.

## 7. Not verified

- Vercel Observability split by query string, region and deployment (no
  dashboard access). Cause 3's share is inferred, not measured.
- Production behaviour from a UK vantage point. All probes went through
  Cloudflare `IAD` → Vercel `iad1`; UK users likely hit `LHR` → `lhr1`.
- The exact Cloudflare Cache Rule (~300s inferred from `age` rollover; no
  dashboard access), whether it is applied by path or to all content types,
  and whether it caches 5xx responses.
- That a real DB-triggered purge reaches `/api/revalidate` through Cloudflare
  and returns 200. No revalidate response was in `net._http_response`'s 6h
  window.
- When Cloudflare proxying was enabled relative to the 12h Observability
  window.
