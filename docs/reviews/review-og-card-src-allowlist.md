# Review: PR #938 &mdash; /api/og/card image source allow-list (SSRF)

Reviewer worker, ticket dt_49bac921960a, 2026-10-21. Reviewed head
`e56d18628b017ec912f0d6b4e5323d18186e691d` (`claude/og-card-src-allowlist`) against `origin/main` `3bbea89`.
Brief: `brief/og-card-src-allowlist:briefs/og-card-src-allowlist-review.md`.

## Verdict: **SHIP**

No blockers. Every bypass shape in the brief is refused before `fetch` is called, `redirect: "error"` really
rejects redirects in Node's undici fetch, every server-side fetch of an attacker- or DB-supplied image URL goes
through `fetchImageBytes`, all live prod image URLs on the surveyed hosts stay allowed, and the tests go red under
every meaningful mutation. Two nits below; neither blocks the merge.

## Owner decisions (brief) &mdash; followed?

| # | Decision | Followed | Where |
|---|---|---|---|
| 1 | One shared module; hosts = vercel.json remotePatterns + 4 extras; one mapping | yes (a pinned copy, with a test that fails if it differs from vercel.json) | `app/lib/ogImageSourceAllowlist.ts:10-20`, `tests/ogImageSourceAllowlist.test.ts` "one mapping" |
| 2 | https only, no userinfo, no port, no IP literals, exact lower-cased host | yes | `ogImageSourceAllowlist.ts:38-44` |
| 3 | Enforced inside `fetchImageBytes`, `redirect: "error"`, refusal never calls fetch | yes | `app/lib/ogCardRender.ts:589,593` |
| 4 | `kind=image` refusal &rarr; new reason `image-source-disallowed`; covers keep `cover-unfetchable` | yes | `app/routes/api.og.card.tsx:76,164`; cover path at `:219` unchanged |
| 5 | No behaviour change to `vercel.json`, `app/csp.ts`, `api.og.bake.tsx` | yes (none of the three is in the diff) | `git diff --stat` |

## Findings

### Blockers

None.

### Nits

**N1 &mdash; the site's own `/api/` paths are allowed sources, so the card endpoint can fetch itself.**
`app/lib/ogImageSourceAllowlist.ts:18-19,46`. Failing input:
`/api/og/card?kind=image&src=https%3A%2F%2Fwww.bachatacalendar.co.uk%2Fapi%2Fog%2Fcard%3Fkind%3Dimage%26src%3D...`
&mdash; `isAllowedOgImageSource` returns `true` for the inner URL (probe case "own /api/og/card endpoint"), so one
request fans out into a chain of function invocations, one per nesting level, each with a unique cache key. It is
bounded (URL length caps the depth, `redirect: "error"` stops any redirecting route, and every hop still only
reaches our own origin), so it is an invocation-amplification nit, not an SSRF. Exact fix, inside the settled
decision (the hosts stay; only their path is narrowed):

```ts
// ogImageSourceAllowlist.ts, after the PATH_PREFIX check
const SITE_HOSTS = new Set(["www.bachatacalendar.co.uk", "bachatacalendar.co.uk"]);
if (SITE_HOSTS.has(host) && u.pathname.startsWith("/api/")) return false;
```

plus a refused row `['own api endpoint', 'https://www.bachatacalendar.co.uk/api/og/card?kind=image&src=x']` in
`tests/ogImageSourceAllowlist.test.ts`. No live row is a relative or own-origin URL (real-data survey below), so it
refuses nothing real.

**N2 &mdash; the IP-literal check is an equivalent mutant.** `ogImageSourceAllowlist.ts:43`. Deleting it leaves all
tests green (M9 below) because an IP can never equal a listed hostname, so `HOSTS.has` already refuses it. The
comment on lines 41-42 says exactly this, so it is intentional defence in depth; no fix needed. Recorded only so a
future reader does not take the green M9 as a missing test.

## 1. Bypass probes (run against the PR code)

Probe file on this branch: `docs/reviews/og-card-src-allowlist-bypass.probe.ts` (outside the vitest globs because
it imports a module that only exists on the PR branch; the header says how to run it). Result against `e56d1862`:
**27/27 pass**.

| Shape | Input | Verdict |
|---|---|---|
| encoded dot segments | `.../object/public/%2e%2e/%2e%2e/%2e%2e/rest/v1/x` (also `%2E%2E`, `.%2e`) | refused (WHATWG resolves them; path leaves `public/`) |
| backslash traversal | `.../object/public\..\..\..\rest\v1\x` | refused (`\` is `/` in https URLs) |
| prefix without slash | `.../object/publicX/a.jpg` | refused |
| encoded slash | `.../object/public/a%2F..%2F..%2Fx.jpg` | allowed &mdash; one segment inside `public/`; still the storage API, never REST |
| trailing-dot host | `https://media.bachatacalendar.co.uk./a.jpg` | refused (safe false-negative; 0 live rows use it) |
| IDN homoglyph / punycode | `m&#x435;dia...` (Cyrillic e), `xn--mdia-8cd...` | refused |
| full-width dots | `media&#xff0e;bachatacalendar&#xff0e;co&#xff0e;uk.evil.com` | refused |
| IPv4 forms | `0x7f.1`, `2130706433`, `0177.0.0.1`, `2852039166` (169.254.169.254) | refused |
| IPv6-mapped IPv4 | `[::ffff:127.0.0.1]`, `[::ffff:169.254.169.254]` | refused |
| userinfo tricks | `media...:443@evil.com`, `evil.com#@media...` | refused |
| control chars | `media...\t.evil.com` | refused |
| scheme tricks | `//media...`, `HTTP://media...`, `javascript:`, `blob:` | refused |
| explicit `:443` | `https://media.bachatacalendar.co.uk:443/a.jpg` | allowed (parser drops the default port; same request) |
| own endpoint | `https://www.bachatacalendar.co.uk/api/og/card?...` | **allowed &mdash; N1** |

Every refused case also asserts the stubbed global `fetch` was never called.

## 2. `redirect: "error"` in the runtime

The routes run on Vercel's Node runtime (`vercelPreset()`, and `ogCardRender.ts` uses `node:fs`/`tmpdir`), whose
global `fetch` is undici. The probe's last case uses the REAL fetch (Node 22.22.0, no stub) against two local
servers: a 302 bouncer and a target. With `redirect: "error"` the call rejects with `TypeError` and the target is
hit **0** times; the control call without the option follows and hits it once. `fetchImageBytes` catches the
rejection and returns `null`.

## 3. Every server-side image fetch goes through `fetchImageBytes`

`grep -rn "fetch(" app api` on the PR head:

| Call | Image URL from outside? | Through the guard? |
|---|---|---|
| `app/lib/ogCardRender.ts:593` `fetchImageBytes` | yes | is the guard |
| `app/routes/api.og.card.tsx:165` (kind=image `src`) | yes | yes |
| `app/routes/api.og.card.tsx:219` (event/festival cover) | yes (DB) | yes |
| `app/routes/api.og.bake.tsx:101` (cover) | yes (DB) | yes |
| `app/lib/ogCardRender.ts:55` font fetch | no &mdash; bundled font asset URL on `SITE_URL` | n/a |
| `app/routes/api.og.bake.tsx:66` | no &mdash; Supabase RPC | n/a |
| `app/routes/api.io-health.tsx:101`, `api.revalidate.tsx:84`, `app/cloudflarePurge.ts:331,396` | no &mdash; fixed service URLs | n/a |
| `api/embed/_template.ts` | no fetch | n/a |

No missed path.

## 4. Real-data regression (Supabase, read-only SELECT, URL columns only)

Shape survey across `venues.photo_url[]`, `event_series_p5.default_cover_image_url`,
`event_occurrence_override_p5.cover_image_url`, `organiser_profiles.avatar_url`, `teacher_profiles.photo_url`,
`dancer_profiles.avatar_url`, `og_render.cover_source_url` (958 non-empty URLs): **0** non-https, **0** with port or
userinfo, **0** with whitespace or upper-case host, **0** Supabase URLs outside `/storage/v1/object/public/`.
Hosts: media 1,068 / supabase 24 / example.com 6 / unsplash 6 (no relative paths, no other host).

| # | Live URL | Column | Allowed |
|---|---|---|---|
| 1 | `https://media.bachatacalendar.co.uk/venues/covers/2026/04/1776415810990-rp9vw9ib2a.png` | venue cover | true |
| 2 | `https://media.bachatacalendar.co.uk/avatars/0965f44d-...-0.7202242499843012.png` | dancer avatar | true |
| 3 | `https://media.bachatacalendar.co.uk/images/2026/04/1777382447700-w3jznuh8p9.webp` | occurrence cover | true |
| 4 | `https://media.bachatacalendar.co.uk/images/2026/04/1776834792664-85sc4p3fa1.jpg` | og_render source | true |
| 5 | `https://media.bachatacalendar.co.uk/images/2026/04/1776264386082-3nbfyhh0bi5.png` | organiser avatar | true |
| 6 | `https://media.bachatacalendar.co.uk/images/1775649665279-lz3pjgyqnlj.png` | venue photo | true |
| 7 | `https://stsdtacfauprzrdebmzg.supabase.co/storage/v1/object/public/organiser-photos/35d336c7-.../74f0...61cb.webp` | supabase storage | true |
| 8 | `https://stsdtacfauprzrdebmzg.supabase.co/storage/v1/object/public/images/2026/04/1776261212726-2qby7w3pmna.jpg` | supabase storage | true |
| 9 | `https://images.unsplash.com/photo-1516450360452-9312f5e86fc7` | series cover | true |
| 10 | `https://images.unsplash.com/photo-1488426862026-3ee34a7d66df?auto=format&fit=crop&w=320&q=80` | dancer avatar | true |
| ctrl | `https://example.com/proof-avatar-1776689945229.jpg` | member avatar (test row) | false (expected) |

Verdicts are from `isAllowedOgImageSource` on the PR head, not by eye. No live URL is newly refused except
example.com.

## 5. Mutation results (PR's own tests only: `ogImageSourceAllowlist.test.ts` + `ogCardFallbackMarker.test.ts`, 60 tests)

| # | Mutant | Result |
|---|---|---|
| M0 | none (baseline) | 60 pass |
| M1 | drop `if (!HOSTS.has(host)) return false` | **red** (7 fail) |
| M2 | drop `redirect: "error"` | **red** (7 fail) |
| M3 | drop the Supabase path-prefix check | **red** (3 fail) |
| M4 | drop the guard in `fetchImageBytes` | **red** (21 fail) |
| M5 | drop the route's `image-source-disallowed` check | **red** (2 fail) |
| M6 | drop the https check | **red** (1 fail) |
| M7 | drop the userinfo check | **red** (2 fail) |
| M8 | drop the port check | **red** (1 fail) |
| M9 | drop the IP-literal check | green &mdash; equivalent mutant (N2) |
| M10 | exact host &rarr; `endsWith` suffix match | **red** (1 fail) |

All mutants reverted (`git checkout -- app`); the worktree was clean afterwards.

## PR #938 checks (snapshot 2026-10-21 ~20:42 UTC, head e56d1862)

Success: decide, real-data-verified, phone-qa-section (latest run), contract-check, bom-check, masking-check,
notification-check, integrity, build-smoke, dancer-area-isolation, unit (Australia/Sydney), unit
(America/New_York), no-preview-reason. In progress: unit (Europe/London, full), phone-qa. Skipped by design:
og-check/og-preview, seo-check/seo-preview, synthetic*, lighthouse, doc-weight, enable. Two earlier
phone-qa-section runs failed and were superseded by the later green run on the same head (PR-body edits).

## Verified / Not verified

- **Verified:** bypass probes and the real-fetch redirect probe run against the PR code (27/27); the two PR test
  files pass (60/60); 10 mutants run and reverted; 10 live URLs plus 1 control checked through the real function;
  shape survey of 958 live URLs; fetch-site grep of `app/` and `api/`.
- **Not verified:** behaviour on a deployed Vercel preview (no request was sent to a deployment; the redirect probe
  ran on local Node 22.22.0, which is the same undici fetch the Node runtime uses, but not on Vercel itself); the
  full unit suite and `npm run build` on the PR head were not re-run by this reviewer (CI build-smoke and two unit
  jobs are green; the full unit job was still running at snapshot time). No screen changes, so no browser walk.
