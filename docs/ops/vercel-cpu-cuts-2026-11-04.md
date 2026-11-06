# Vercel CPU cuts — 2026-11-04 (website)

Brief: `docs/briefs/vercel-cpu-cuts-web.md` (branch `brief/vercel-cpu-cuts-web`).
Branch: `claude/vercel-cpu-cuts-web`. Goal: fewer origin renders for the same
traffic, by caching, with byte-identical content for visitors.

## BEFORE

### Owner-supplied (Vercel Observability, 12 h, 2026-11-04)

| Route | Calls | Active CPU | Per call |
|---|---|---|---|
| `/api/og/card` | 133 | 26 s | 0.20 s |
| `/city/:slug` | 207 | 28 s | 0.14 s |
| `/event/:id` (out of scope) | 500 | 31 s | 0.06 s |
| `/*` catch-all | 772 | 19 s | 0.025 s |
| `/api/revalidate` (out of scope) | 70 | 7 s | 0.10 s |

Deploy count for normalising: `git log --first-parent origin/main --since=2026-11-03T22:00`
shows 42 first-parent commits on `main` in the 24 h before this branch; how many
passed `scripts/vercel-ignore-build.sh` (that is, actually deployed) is not
something the sandbox can see. Owner/orchestrator: read the deploy count from
Vercel → Deployments for the same window as the AFTER figures.

### Live GET survey (shape survey)

**Not taken by the worker.** The cloud sandbox cannot reach production: every
CONNECT to `www.bachatacalendar.co.uk` and `api.vercel.com` gets a 403 from the
egress proxy (Supabase is reachable, production is not). The BEFORE column
below is the orchestrator's live measurement from 2026-11-04 (brief, facts 1–2),
not re-measured here. **Owner/orchestrator: run the script in "Measurement
script" below before the deploy if you want a full BEFORE column.**

| Request | Status | Cache-Control (client) | x-vercel-cache GET1 / GET2 | cf-cache-status |
|---|---|---|---|---|
| `/api/og/card?kind=event&id=thursday-evening-bachata` | 200 | `public, max-age=86400` | MISS / HIT (Age rising, ETag) | DYNAMIC |
| same + `?v=abc` | 200 | `public, max-age=86400` | MISS / HIT (separate key) | DYNAMIC |
| `/city/london-gb` | 200 | `public, max-age=0, must-revalidate` | HIT (Age 47) | DYNAMIC |
| `/city/london-gb?x=<random>` | 200 | same | MISS / HIT (query is in the key) | DYNAMIC |
| `/zz-probe-<random>` (unknown path) | 404 | `no-store` | MISS / MISS | DYNAMIC |
| festival card, `kind=image`, unresolvable id, second city, `/city/no-such-city-xx`, `/venues`, `/city/london-gb/<listing>`, `/auth` | not measured | | | |

HEAD (`curl -I`) does not fill Vercel's cache; measure with GET only.

## Causes table (`/city/:slug`, 207 renders / 12 h)

The page is already edge-cached (`s-maxage=3600`, SWR bounded to the next
"on now" transition, tags `home-feed,city-<slug>`). Candidate causes, with the
evidence the sandbox could gather:

| Cause | Evidence | Verdict |
|---|---|---|
| (a) first request per deploy epoch | Vercel empties its CDN cache on every production deploy; `main` had 42 first-parent commits in 24 h. Each deploy = one render per distinct key. | **Likely the main driver** — not fixable in code (owner: `ignoreCommand` tightening, already in section 6 of `vercel-html-caching-2026-10-08.md`). |
| (b) tracking query strings | Orchestrator measured `?x=<random>` → fresh MISS: the whole query is the key. In-app browsers add `fbclid` / `igshid` / `utm_*`. | **Plausible, unquantified** — needs the Vercel request log by query. Fix is a Cloudflare cache-key rule (owner step 2), never a redirect. |
| (c) the bound ends the entry at an on-now transition | Pinned in `app/routes/home.headers.test.ts`: bound 7200 s → `s-maxage=3600, swr=3595`; bound 600 s → `s-maxage=595`, no stale. On a night with many short-spaced starts the entry lives minutes. Real values at three times of day: **not printed** (no prod-data local build run; see Not verified). | Real but **by design**: a floor would serve "on now" for a finished event. No change. |
| (d) the `.data` twin | Client navigations to `/city/:slug` fetch `/city/london-gb.data`, a separate key with the same tag and policy. | Doubles the per-epoch first renders; by design. |
| (e) degraded 30 s window | Degraded shell = `no-store` + `s-maxage=30`, untagged (pinned). Only when the feed RPC fails transiently. | Small unless the DB is struggling. |
| request state (Cookie / Authorization) | `home.headers.test.ts` pins that a request carrying `Cookie`, `Authorization` or both gets headers IDENTICAL to an anonymous one, for 200 / 404 / 500 × skew on/off; no `Set-Cookie` on the cacheable 200. Existing `documentCacheHeaders.test.ts` scans that no SSR loader reads either header. | **No gap.** |

**Slice 2: no code change.** Nothing proven that a behaviour-neutral code fix would cut.

## What changed

| Slice | Change | Rollback knob |
|---|---|---|
| 1 `/api/og/card` | Healthy 200 now also sends `Vercel-CDN-Cache-Control: public, s-maxage=31536000, stale-while-revalidate=604800` (the lifetime `CACHE_OK` already asked of the shared cache). Browser stays `max-age=86400`. Degraded tiers, 302s, 304s, `render-error` (`no-store`) unchanged and carry no edge directive. Pinned per outcome in `app/routes/api.og.card.test.tsx`. | `EDGE_CACHE_OK` in `app/routes/api.og.card.tsx` |
| 2 `/city/:slug` | Tests only (`app/routes/home.headers.test.ts`). | — |
| 3 catch-all unknown 404 | `resolveCatchallOutcome` returns `{ status: 404, edge404: true }` only for the `unknown` verdict (pure function of path + build, no DB read); `entry.server.tsx` passes it to `finalizeDocumentCacheHeaders`, which keeps `Cache-Control: no-store` + `X-Robots-Tag: noindex` and sets `Vercel-CDN-Cache-Control: public, s-maxage=300`, no stale window, no tag. Being edge-cacheable it carries no skew cookie. Loader-thrown 404, city-subpath / legacy-city 404, 503, 5xx, a 500 after the gate: unchanged `no-store`, no edge. Pinned in `app/catchallGate.test.ts`. | `EDGE_404` in `app/documentCacheHeaders.ts` |

Window choice (300 s): the verdict is fixed for a build and a deploy empties
Vercel's cache, so a route added later is never shadowed past the next deploy;
300 s matches Cloudflare's 5-minute human HTML window so the two layers agree.

Honest size of slice 3: it collapses REPEATED hits on the SAME missing URL to
one render per 5 minutes. A scanner walking unique URLs misses every time and
is not helped. `/*` costs 0.025 s per call, so the ceiling is ~19 s / 12 h.

## Owner steps (dashboard only; the worker does not make them)

### Step 1 — Cloudflare cache rule for /api/og/card

Cloudflare is the only layer that can keep a healthy card across Vercel deploys.
Today `cf-cache-status: DYNAMIC` on every card (no rule; no file extension).

Cloudflare → Caching → Cache Rules → Create rule, name `OG cards`:

- **Expression:** `(http.host eq "www.bachatacalendar.co.uk" and starts_with(http.request.uri.path, "/api/og/card") and http.request.method in {"GET" "HEAD"})`
- **Cache eligibility:** Eligible for cache.
- **Edge TTL:** "Use cache-control header if present, bypass cache if not", PLUS a **status-code TTL override: `200` → 1 day (`86400`) or less. HARD PRECONDITION, not a recommendation: do not create this rule without the cap (see the precondition below).** Origin sends `s-maxage=31536000` on a healthy card, `max-age=300/3600` on degraded cards, `max-age=300` on a 302, `no-store` on render-error; the other tiers are honoured as-is, and the 200 override caps the healthy card at 1 day instead of the year its `s-maxage` asks for. The degraded cards are ALSO 200s, so the override must not raise them: if the plan cannot express "cap, not floor", **do not create the rule at all** until the follow-up below lands (a year at Cloudflare is the stale-card bug, and nothing purges `/api/og/card*` on a facts edit).
- **Browser TTL:** respect origin (`max-age=86400`).
- **Cache key:** Query string = **include all** (`kind`, `id`, `occ`, `v`, `src` are all identity; `v=` is what busts a changed cover). Do not ignore the query string on this rule.
- **Status codes:** let origin headers decide (302 is `max-age=300`; render-error 302 is `no-store` and will bypass).
- Place it ABOVE "HTML for humans (5 min, bots bypass)"; it must apply to bots too (WhatsApp / Facebook / LinkedIn crawlers are the main callers).

**HARD PRECONDITION (review 1362-r1 finding 2): Edge TTL for `/api/og/card` is
capped at 1 day (`86400`) or less** until the card URL carries the facts hash
(follow-up F1 below). The Cloudflare cache key is the URL, and `v=` is the cover
version only: a cover change busts via `v=` at once, but a title / date / venue
edit with an unchanged cover keeps the SAME URL, so a shared cache serves the old
card for the whole Edge TTL (risk 1; proof in F1). Vercel's copy is bounded by
the next deploy; Cloudflare's is bounded ONLY by its Edge TTL, so the TTL is the
staleness window. Raise the cap only after F1 has shipped.

### Queued follow-up F1 — facts hash in the card URL (removes the stale-card class)

Build the card URL as `v=<cover>.<ogFactsTag>` instead of `v=<cover>`, in BOTH
places that build it: the page loader (`app/detailLoader.ts`, the `coverToken`
block, ~line 328) and the bake (`app/lib/ogBakePolicy.ts`). Then a facts edit
changes the URL, every cache misses, and the 1-day cap can be lifted.

Stale-card proof (review 1362-r1 appendix; scratch test, not committed): with the
mocks of `app/routes/api.og.card.test.tsx`, call the real `loader` twice for the
same URL `kind=event&id=e1&v=cover.jpg`, `title: "Old title"` then
`title: "New title, new date"`. Result: bodies differ, ETag identical,
`Vercel-CDN-Cache-Control` identical and containing `s-maxage=31536000` -> 1 passed.
Same URL + same validators + a year of shared lifetime = the old card wins. Not
new in this PR (`CACHE_OK` already asked for a year); it matters once owner step 1
puts Cloudflare in front.

### Step 2 (optional, owner decision) — tracking parameters out of the HTML key

A separate rule for `/city/*` that drops `fbclid`, `gclid`, `igshid`, `utm_*`,
`mc_*` from the cache key ("Query string: exclude"). Only after reading the
Vercel request log share for those parameters; listed in section 6 of
`vercel-html-caching-2026-10-08.md`.

## Risks found

1. **Stale card.** `v=` is `coverVersionToken(coverUrl)` (`app/detailLoader.ts`): the cover file name only. Title, date and venue do NOT feed it; `ogFactsTag` only enters the ETag when `OG_BRANDED_CARD_ENABLED`. `vercel.json` excludes `api/og/` from `Cache-Tag: html`, so no purge reaches a card. A facts edit with an unchanged cover is stale until the next deploy in Vercel (unchanged by this PR, the lifetime was already a year) and, once step 1 exists, up to its Edge TTL in Cloudflare → **hard cap 1 day** (owner step 1 precondition) until follow-up F1 puts the facts hash in `v=`. The steady-state baked R2 card (`app/lib/ogBakePolicy.ts`) is re-baked on cover change, same caveat.
2. **Cloudflare ignoring `no-store`.** The 2026-10-08 doc measured Cloudflare caching a `no-store` 404 for humans (5-min rule); bots bypass that rule. Slice 3 sets the same 5 minutes at Vercel, so the layers agree; no conflict. Bot UA not measured live (no route to production).
3. **HEAD does not fill Vercel's cache.** `scripts/check-og-images.mjs` probes cards with GET (good). Its page probe comment (line ~329) mentions HEAD + 1-byte range GET for images; the synthetic monitor is outside this repo — check its method in its own config.
4. **Skew cookie on an edge-cached 404.** Cannot happen: `isEdgeCacheable` sees `s-maxage=300` and withholds `__vdpl` (pinned, skew on and off).
5. **Other observations, not changed:** the 308 legacy-city redirect is edge-cached with the shell policy (`s-maxage=3600`) although it depends on a city lookup; a city that is deactivated keeps redirecting for up to the window. Also `/profile` and `/onboarding` named in the brief are not app paths — they are unknown 404s (now edge-cached 5 min).

## Code review (one round, stopping rule: a finding proved by mutation = revert that part and queue it; no second round)

Seven findings, none proved by a mutation as a defect of this diff; all queued
or accepted, nothing reverted:

1. **Client may now see the full `CACHE_OK`.** If Vercel passes `Cache-Control` through untouched once `Vercel-CDN-Cache-Control` is present, the client/Cloudflare see `s-maxage=31536000, stale-while-revalidate=604800` instead of today's `public, max-age=86400`. Not provable from the sandbox. **AFTER check:** the healthy card's client `Cache-Control`. Mitigated by step 1's 1-day cap; if it matters, revert slice 1 (one commit).
2. `edge404` is a caller flag, not a property of the response: only the gate passes it (pinned). Accepted.
3. A stream error after the shell is ready changes the status to 500 too late; an unknown-path 404 broken mid-stream would be stored 5 min. Same exposure the edge-cached 200 shell already has; the catchall renders `null` on the server. Accepted.
4. A shared cached 404 shares one CSP nonce for 5 min. Same as every edge-cached document today (the 200 shell, `/city/:slug`). Queued as a site-wide CSP question, not this PR.
5. No tag on EDGE_404, so it cannot be purged. By design (deploy empties it); a client page missing from `CATCHALL_CLIENT_PATHS` was already a 404 status; the cached bytes are the same shell.
6. `gateCatchallDocument` kept as a status-only wrapper so `tests/seoSoft404Matrix.test.ts` (not in this brief's file list) stays unedited. Queue: move the matrix to `gateCatchallOutcome` and drop the wrapper.
7. Safety of the cached 404 assumes `app/root.tsx` stays loader-free (it is today). Queue a guard.

## Measurement script (GET, browser UA, never `-I`)

```bash
UA='Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1'
B=https://www.bachatacalendar.co.uk
for p in "/api/og/card?kind=event&id=thursday-evening-bachata" "/city/london-gb" "/zz-probe-$RANDOM" "/venues" "/auth"; do
  for n in 1 2; do echo "== $p GET$n"; curl -s -A "$UA" -D - -o /dev/null "$B$p" | grep -iE '^(HTTP|cache-control|vercel-cdn|x-vercel-cache|age|cf-cache-status|x-og-fallback|x-vercel-id|set-cookie)'; sleep 5; done
done
```

## AFTER (orchestrator or owner, 24 h after the production deploy)

Vercel Observability → project → Functions / Fluid, 12 h window, same weekday
hours as BEFORE: invocations + Active CPU for `/api/og/card`, `/city/:slug`,
`/*`; CDN hit rate per route; and the script above.

Expected:
- Second GET of the SAME missing URL: `x-vercel-cache: HIT`, client still sees `Cache-Control: no-store`. **Can move without the owner.**
- `/*` invocations fall by the share of repeated missing URLs (unknown until the logs give the share).
- `/api/og/card` first GET MISS then HIT as before; invocations only fall once **owner step 1** is live (Cloudflare absorbs repeats across deploys). Slice 1 alone is a guard, not a cut.
- `/city/:slug` unchanged (it was already cached; slice 2 made no code change).
- Normalise by deploy count: a route's compute ≈ unique keys × deploy epochs.

Rollback: each slice is one commit (`git revert`); the two knobs are
`EDGE_CACHE_OK` and `EDGE_404`.
