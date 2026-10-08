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
| A production deploy goes live (`deployment_status` = success, environment `Production`, posted by `vercel[bot]`) | `.github/workflows/cloudflare-purge-on-deploy.yml` | **Everything in the zone**, twice: as soon as the deploy is live, and again 60s later |
| Manual run (Actions > "Cloudflare purge on deploy" > Run workflow) | same workflow | Everything, twice |
| A content write fires the DB webhook (`/api/revalidate`) | `app/routes/api.revalidate.tsx` > `app/cloudflarePurge.ts` | The affected public URLs, after Vercel's tag purge succeeds (table below) |

### Why the deploy purge clears everything

The Free plan allows purge by URL, hostname, tag, prefix and everything
(Cloudflare docs, "Purge cache: availability and limits", read 2026-10-08).
Hostname, tag, prefix and purge-everything requests share a limit of 5 per
minute (bucket 25). URL purges allow 800 URLs per second and 100 URLs per
request. None of these can express "all HTML except `/assets/*` and
`/_vercel/image`":

- HTML is served at every path. The catch-all route serves any URL, for
  example `/account/o`, where the blank page was measured. A prefix list would
  have to name every route, and a missing route would bring back the blank
  page with no error.
- A tag purge would need every HTML response to carry a Cloudflare `Cache-Tag`
  header. That is an origin header change, and nobody has checked that Vercel
  passes the header through unchanged.

The cost of purging everything: Cloudflare fetches the hashed `/assets/*` files
and the optimised `/_vercel/image` responses again from Vercel's CDN. The first
visitor per Cloudflare location pays that, once per deploy. Assets are static
files on Vercel, so no function runs. Images come from Vercel's image cache;
whether a refetch can count as a new image transformation was not checked.

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
`slug`, which is used before the lookup.

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
workflow > `main`. A green run with `Pass 1: purge_everything accepted` and
`Pass 2: ...` means the token works. A notice `Cloudflare purge SKIPPED` means
the secret or variable is missing.

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
| Workflow red, HTTP 429 | Over 5 purge-everything requests per minute (many deploys in one minute) | That purge is lost. The next deploy or a manual run clears the cache |
| Workflow red, 5xx twice | Cloudflare API outage | Same. Re-run the workflow |
| Log `[cf-purge] ... HTTP 429` on `prefix purge` | Webhook bursts (bulk admin edits) beyond the prefix limit | URL purges still worked. Query-string variants stay cached up to 300s |
| Log `slug lookup failed` / only the uuid URL purged | Supabase blip, or the event is now hidden/archived (the public resolver hides it) | `/event/<slug>` can serve the old page for up to 300s. Fix: have the DB emit include `slug` (admin repo) |
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
   `docs/ci-guard-notes.md`. Re-derive `MEASURED` in
   `scripts/check-workflow-artifact-policy.mjs`; it will say so.
2. In `app/routes/api.revalidate.tsx`, remove `scheduleCloudflarePurge` and its
   call. Delete `app/cloudflarePurge.ts`, `app/cloudflarePurge.test.ts` and
   `app/lib/cloudflarePurgeResolver.ts`. In `app/routes/api.revalidate.test.ts`,
   drop the Cloudflare cases.
3. Revoke the token(s) in Cloudflare. Delete the GitHub secret and variable and
   the two Vercel env vars.

To switch it off without a code change, delete the credentials. Both halves
then log that they skipped and do nothing.
