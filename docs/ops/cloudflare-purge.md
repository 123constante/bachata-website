# Cloudflare cache purge (deploys and content writes)

Cloudflare sits in front of Vercel on `www.bachatacalendar.co.uk` (zone
`bachatacalendar.co.uk`, id `7f75e3fa3ea1ca8429ecdcac2468bf6d`, Free plan) and
caches HTML for 300 seconds (cache rule "HTML for humans (5 min, bots bypass)").
The owner decided to keep that cache and clear it when content changes.
Two mechanisms do this. Both do nothing until the owner adds the credentials
below. Background: `docs/ops/vercel-html-caching-2026-10-08.md` (PR #661).

## What is purged, and when

| When | Mechanism | What Cloudflare purges |
|---|---|---|
| A production deploy goes live (`deployment_status` = success, environment `Production`, posted by `vercel[bot]`) | `.github/workflows/cloudflare-purge-on-deploy.yml` | **Cache tag `html`** (every HTML document and `.data` twin, not `/assets/*` or `/_vercel/*`), twice: as soon as the deploy is live, and again 60s later. Falls back to **everything** in the cases listed below |
| Manual run (Actions > "Cloudflare purge on deploy" > Run workflow) | same workflow | `scope` = `html` (default): as a deploy. `scope` = `everything`: the whole zone, twice |
| A content write fires the DB webhook (`/api/revalidate`) | `app/routes/api.revalidate.tsx` > `app/cloudflarePurge.ts` | The affected public URLs, after Vercel's tag purge succeeds (table below) |

### Why the deploy purge clears the `html` tag, not everything

Until 2026-10-09 the deploy purge sent `purge_everything`, twice per deploy.
That also emptied the hashed `/assets/*` files, fonts and optimised
`/_vercel/image` responses, which never change for a given URL, so every
deploy made Cloudflare fetch them all again from Vercel. Measured 2026-10-09:
about 3.8K uncached JS and 3.6K uncached image requests per day, with 4+ deploys
per day, while the Vercel Hobby team was over its 1,000,000 CDN requests per
month cap.

The Free plan allows purge by URL, hostname, tag, prefix and everything
(Cloudflare docs, "Purge cache: availability and limits", read 2026-10-08).
Hostname, tag, prefix and purge-everything requests share a limit of 5 per
minute (bucket 25). HTML is served at every path (the catch-all serves any URL,
for example `/account/o`, where the blank page was measured), so a prefix list
would have to name every route and would silently miss the next one. A tag
does not have that problem:

- `vercel.json` sends `Cache-Tag: html` on every path except `/assets/*`,
  `/_vercel/*` and files ending in `.png .jpg .jpeg .ico .svg .webp .avif .gif
  .woff .woff2 .webmanifest` (the `public/` icons, `og-image.jpg`, map
  placeholders), and except `/api/og/*` (OG card images). The source
  pattern is a negative lookahead, so a new route is tagged without anyone
  remembering to add it. It is a `vercel.json` `headers` entry, not code in
  `app/documentCacheHeaders.ts`, because `vercel.json` headers apply to every
  matched response (prerendered HTML, SSR documents, `.data` and errors),
  while `entry.server.tsx` sees only live SSR documents. The site already
  relies on that for `X-Frame-Options` on SSR documents (`app/csp.ts`).
- The workflow purges `{"tags":["html"]}`. Static files keep their Cloudflare
  copies across deploys.

**When it falls back to `purge_everything`.** The workflow logs the path it
took (`Mode: ...`, `Path: tags` / `Path: everything (<reason>)`, and a
`::warning::` for a fallback). It purges everything when:

1. the tag purge API call fails (any non-success, after one retry on 5xx);
2. `vercel.json` changed between the previous successful Production
   deployment and this one (GitHub deployments + compare API; the tag's
   coverage may have changed, and copies cached before the change may carry no
   tag. This is also how the deploy that first added the header cleared the
   untagged HTML). Also when that range cannot be read, lists 300+ files
   (possibly truncated), or is not `ahead` (a rollback);
3. the probe sees a page survive a tag purge, or cannot tell. All probe GETs
   go to one pinned Cloudflare IP, so they hit the same edge location. Before
   pass 1 it sends one quick GET to `/faq` (prerendered) and `/festivals`
   (SSR), so pass 1 is not held back; a page that was already a `HIT` is
   checked 5s after pass 1. During the 60s wait it re-warms both pages until
   `HIT` and checks them 5s after pass 2. Anything other than `MISS` after a
   tag purge (`HIT`, `STALE`, `REVALIDATED`, `EXPIRED`...) means the object
   survived, for example because Vercel dropped the header. If no page ever
   reached `HIT` the probe cannot tell, and pass 2 falls back;
4. a manual run with `scope` = `everything`.

What this does and does not prove. A failed tag purge, a `vercel.json`
change and a header that is missing everywhere all end in `purge_everything`.
The probe checks two pages at one edge location: a route whose responses lose
the tag while `/faq` and `/festivals` keep it would not be caught (the
`vercel.json` pattern is a negative lookahead precisely so that a route cannot
be left out by accident). When the header is missing and the edge was cold
before pass 1, the fallback lands at pass 2, about 65s after the deploy went
live, where `purge_everything` used to land at once. Only a red run
(`purge_everything` itself failed) leaves stale HTML until the 300s TTL.

Whether Vercel passes `Cache-Tag` through unchanged was not measured before
merge (no route to production from the authoring container); the probe checks
it on every deploy.

### Why `deployment_status` success is the right moment

A push or merge trigger fires when the build *starts*. A purge at that moment
would let Cloudflare cache the old deployment's HTML again. Vercel posts the
GitHub deployment status `success` when the deployment is READY, and for
production that is after the production domains point at it. Measured for
#659: deployment `6930719521` was created and set to `success` in the same
second, 08:23:15Z, by `vercel[bot]`, with environment `Production`. The second
purge 60s later catches any request that raced the alias switch.

### URLs purged per content write

Each page is purged as `https://www.bachatacalendar.co.uk<path>` and as
`<path>.data`. `.data` is React Router's single-fetch twin, which client-side
navigation fetches.

| Tag (from `purgeTagsFor`) | Pages |
|---|---|
| `event-<id>` | `/event/<id>`, `/event/<slug>` |
| `festival-<id>` | `/festival/<id>`, `/festival/<slug>` |
| `dancer-<id>` / `dj-<id>` / `teacher-<id>` | `/dancers/...`, `/djs/...`, `/teachers/...` (uuid + slug) |
| `venue-<id>` | `/venue-entity/<id>`, `/venue-entity/<slug>` |
| `city-<slug>` | `/city/<slug>` |
| `home-feed` | `/city/<slug>` for every `cities.is_active` city (today: `london-gb`) |
| `festivals-list` | `/festivals` |
| `seo-landing` | the 9 landing pages (`/london-bachata-guide`, `/learn-bachata-london`, `/bachata-london-{monday...sunday}`) |
| `organiser-<id>`, and the collection tags `events`, `festivals`, `dancers`, `djs`, `teachers`, `venues`, `organisers` | none, with the reason written in `CF_URL_RULES` |

`app/cloudflarePurge.test.ts` enforces this table:

- Every tag that a route stamps or a write purges has a rule.
- No tag that a write purges maps to no URL.
- Every entity rule points at a real `/<base>/:id` route.
- The static page sets are derived again from the route modules that stamp them.

**Sequence for one webhook.** All of it runs in `waitUntil`, so the webhook's
200 does not wait for it:

1. **Pass 1**: purge the URLs, in requests of 30.
2. **Warm**: request the canonical pages once: the entity page, the city pages
   and `/festivals`.
3. **Wait** 10 seconds.
4. **Pass 2**: purge the URLs again, then send **one** prefix purge
   (`www.bachatacalendar.co.uk/event/<slug>`, ...). The prefix purge also
   clears the `?occurrenceId=` and `?fbclid=` variants of each page.

Two passes are needed because `invalidateByTag` is a *soft* invalidate.
Vercel's next request gets the stale copy while Vercel re-renders in the
background. With one purge, Cloudflare's next miss would fetch that stale copy
and cache it for another 300s. The warm request starts the re-render, and
pass 2 removes the stale copy Cloudflare picked up. The SEO landing pages and
the `.data` twins are not warmed. Each warm request is one SSR render on the
Hobby CPU budget.

Ids and slugs: the webhook sends a uuid. The slug comes from the same public
resolvers the routes use: `resolve_public_event_ref_v1` for events, and
`dancer_profiles` / `venues`.`slug` for the others. The body may also carry
`slug`, which is used before the lookup. When the public resolver returns null
for an event (archived, draft, pending_review: a takedown), the slug is read
from `event_series_p5` with the server-only `SUPABASE_SERVICE_ROLE_KEY`
(`hiddenEventSlug` in `app/lib/cloudflarePurgeResolver.ts`); without that key
only the uuid URL is purged.

**Hidden events on Vercel.** For an `event`/`festival` webhook the receiver
first asks `resolve_public_event_ref_v1` whether the page is still public. If it
is not (or the lookup fails), it calls `dangerouslyDeleteByTag` instead of
`invalidateByTag`: a soft invalidate would serve the stale page once more while
the background re-render 404s (2026-10-08: a taken-down series still showed its
title after `cf-cache-status: EXPIRED`).

## Owner setup (one time)

1. **Create the Cloudflare token.** Cloudflare dashboard > My Profile > API
   Tokens > Create Token > *Create Custom Token*.
   - Name: `bachata purge`.
   - Permissions: **Zone | Cache Purge | Purge**. Nothing else.
   - Zone Resources: **Include | Specific zone | bachatacalendar.co.uk**.
   - Client IP filtering: leave empty. GitHub runners and Vercel functions
     have no fixed IPs.
   - Create it and copy the token. It is shown once.

   Making two tokens with the same scope is recommended, one for GitHub and
   one for Vercel, so either can be revoked on its own.
2. **GitHub** (repo > Settings > Secrets and variables > Actions):
   - *Secrets* tab > New repository secret: `CLOUDFLARE_API_TOKEN` = the token.
   - *Variables* tab > New repository variable: `CLOUDFLARE_ZONE_ID` =
     `7f75e3fa3ea1ca8429ecdcac2468bf6d`. A secret with the same name also works.
3. **Vercel** (project `bachata-website` > Settings > Environment Variables),
   for the **Production** environment only:
   - `CLOUDFLARE_API_TOKEN` = the token (mark it Sensitive).
   - `CLOUDFLARE_ZONE_ID` = `7f75e3fa3ea1ca8429ecdcac2468bf6d`.

   Vercel reads env vars at deploy time, so the next production deploy turns
   the webhook purge on. Preview deployments skip the purge even if the vars
   are set there (`VERCEL_ENV` check).

## How to test

**Deploy purge (one click).** Actions > "Cloudflare purge on deploy" > Run
workflow > `main` (`scope` = `html`). A green run with `Mode: html`,
`Pass 1: tag purge [html] accepted`, `Probe after pass 2 ...: cf-cache-status
MISS` and `Done. Path taken: html.` means the token works and the tag
reaches Cloudflare. `Path taken: everything (fallback: ...)` names why it fell
back. A notice `Cloudflare purge SKIPPED` means the secret or variable is
missing.

**After a deploy: assets kept, HTML purged.** Once the deploy's workflow run
logs `Pass 2`, read both through one Cloudflare edge IP (`IP=$(dig +short
www.bachatacalendar.co.uk | head -1)`; `/assets/vendor-react-*.js` keeps its
hash across deploys that do not change React; take the current name from the
page source):

```bash
curl -s -o /dev/null -D - --resolve www.bachatacalendar.co.uk:443:$IP https://www.bachatacalendar.co.uk/assets/vendor-react-<hash>.js | grep -iE '^(cf-cache-status|age):'   # HIT, age older than the deploy
curl -s -o /dev/null -D - --resolve www.bachatacalendar.co.uk:443:$IP https://www.bachatacalendar.co.uk/festivals | grep -iE '^(cf-cache-status|age):'                     # MISS/EXPIRED, or HIT with age younger than Pass 2
```

An asset `MISS` on the first request only means that edge had not cached it
yet: request it twice before the next deploy and re-check after it.

To see it work from a terminal:

```bash
U=https://www.bachatacalendar.co.uk/festivals
curl -s -o /dev/null -D - "$U" | grep -iE '^(cf-cache-status|age):'   # twice: HIT, age rising
# run the workflow, wait for the "Pass 1" log line, then:
curl -s -o /dev/null -D - "$U" | grep -iE '^(cf-cache-status|age):'   # MISS (age 0 or absent), then HIT on the next request
```

After a real merge, open the workflow run that the deploy triggered. Its first
log line names the deployment URL and commit.

**Webhook purge.** In the admin, edit or cancel an occurrence of a test event.
In Vercel > Logs (production, filter `cf-purge`), expect:
`[cf-purge] done: N urls, M prefixes, K calls, 0 failed`. About 10s after the
save, `curl -sI https://www.bachatacalendar.co.uk/event/<slug>` shows
`cf-cache-status: MISS`, and the change. `[cf-purge] skipped: ...` means the
Vercel env vars are not set on this deployment.

## Failure modes

| Symptom | Cause | Effect / fix |
|---|---|---|
| Workflow: `SKIPPED` notice, green | Secret/variable missing | No purge. Add them (setup step 2) |
| Workflow red, HTTP 403 / code 10000 | Token lacks Cache Purge on this zone, or was revoked | No purge. Pages may be blank for up to 5 min after a deploy. Recreate the token |
| Workflow green, `Mode: everything (vercel.json changed in ...)` | Expected on a deploy that changes `vercel.json` | None |
| Workflow green, `::warning::` `FALLING BACK to purge_everything: tag purge [html] failed` | Tag purge refused (token scope, plan change, rate limit) | Behaves as before 2026-10-09: the whole zone is purged. Fix the token if the HTTP code says so |
| Workflow green, `FALLING BACK ...: /faq answered HIT (not MISS) 5s after the tag purge` | `Cache-Tag: html` is not reaching Cloudflare on that page (Vercel dropped it, or the `vercel.json` pattern no longer covers it) | Every deploy purges everything (assets refetched again). Check `vercel.json` and the header at the origin |
| Workflow green, `FALLING BACK ...: probe inconclusive` | Neither probe page reached `cf-cache-status: HIT` from the runner (cache rule changed, it treats the runner as a bot, or DNS gave no IP) | Same: purges everything. Check the cache rule; change `PROBES` in the workflow if needed |
| Workflow red, HTTP 429 | Over 5 tag/purge-everything requests per minute (many deploys in one minute) | That purge is lost. The next deploy or a manual run clears the cache |
| Workflow red, 5xx twice | Cloudflare API outage | Same. Re-run the workflow |
| Log `[cf-purge] ... HTTP 429` on `prefix purge` | Webhook bursts (bulk admin edits) beyond the prefix limit | URL purges still worked. Query-string variants stay cached up to 300s |
| Log `slug lookup failed` / only the uuid URL purged | Supabase blip, or the event is hidden and `SUPABASE_SERVICE_ROLE_KEY` is not set on the deployment | `/event/<slug>` can serve the old page for up to 300s. Set the key, or have the DB emit include `slug` (admin repo) |
| No `[cf-purge]` lines at all | Webhook not reaching `/api/revalidate`, or the Vercel purge failed (the purge then deliberately skips Cloudflare) | See `[revalidate]` errors |

## Known gaps (not closed by this change)

- **Pages with no content purge today** (from #661):
  - `/organisers/:id` has no `organiser` emit in the DB. Vercel holds it for 0s,
    but Cloudflare still holds it for 300s.
  - The catch-all pages (`/venues`, `/dancers`, ...) and the prerendered pages
    carry no data; the deploy purge covers them.
  - `/sitemap.xml` relies on its TTL only.
- **Writes that never call the webhook** (`admin_delete_series_p5_v1`, collapse,
  duplicate, `admin_merge_venues_v1`, self-heal, raffle and guest-list config,
  `organiser_profile_update_p5_v1`) and an event that ends because time passed:
  nothing purges any cache. Admin repo work.
- **URLs that were not warmed** (query-string variants, `.data`, SEO pages)
  can still pick up Vercel's stale copy once after pass 2, because the soft
  invalidate serves stale first. That copy lasts up to 300s, compared with up
  to ~600s before this change.
- A slug change leaves the old slug URL cached until it expires (300s).

## How to remove it

1. Delete `.github/workflows/cloudflare-purge-on-deploy.yml`, and its row in
   `docs/ci-guard-notes.md`. Remove the `Cache-Tag: html` entry from
   `vercel.json` (harmless if left). Re-derive `MEASURED` in
   `scripts/check-workflow-artifact-policy.mjs`; it will say so.
2. In `app/routes/api.revalidate.tsx`, remove `scheduleCloudflarePurge` and its
   call. Delete `app/cloudflarePurge.ts`, `app/cloudflarePurge.test.ts` and
   `app/lib/cloudflarePurgeResolver.ts`. In `app/routes/api.revalidate.test.ts`,
   drop the Cloudflare cases.
3. Revoke the token(s) in Cloudflare. Delete the GitHub secret and variable and
   the two Vercel env vars.

To switch it off without a code change, delete the credentials. Both halves
then log that they skipped and do nothing.
