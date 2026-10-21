# Walk of PR #913 (ended-event door prefetch) on real data

Measure only. PR build = `c31bbea5`. "main" = `origin/main` at `5955daf` (a later main than the PR's base, so it includes
unrelated newer commits). Built with prod's public URL and anon key (read-only). Headless Chromium via Playwright,
4x CPU throttle (CDP), 7 s settle, touch/mobile emulation, device scale 2. Events: `the-camden-tuesdays`,
`bachata-pasos-libres`, and `mojito-club` (picked from prod by read-only SELECT: ended, not a festival, organiser has
many other live events).

## Result: before / after

CLS = layout-shift entries without recent input. "Door in SSR" = the organiser door text is in the server HTML.
"Grid move" = how far the first bento tile moved (px) between first seen and settled.

| Slug | Viewport | main CLS | PR CLS | main door in SSR | PR door in SSR | main grid move | PR grid move | door visible after load (main / PR) |
|---|---|---|---|---|---|---|---|---|
| the-camden-tuesdays | 390x844 | 0.1122 | 0.0001 | no | yes | 177 px | 0 px | yes / yes |
| the-camden-tuesdays | 360x640 | 0.1073 | 0.0002 | no | yes | 176 px | 0 px | yes / yes |
| bachata-pasos-libres | 390x844 | 0.0826 | 0.0001 | no | yes | 120 px | 0 px | yes / yes |
| bachata-pasos-libres | 360x640 | 0.0837 | 0.0002 | no | yes | 119 px | 0 px | yes / yes |
| mojito-club | 390x844 | 0.0894 | 0.0001 | no | yes | 119 px | 0 px | yes / yes |
| mojito-club | 360x640 | 0.0960 | 0.0002 | no | yes | 119 px | 0 px | yes / yes |

On main the page jumps 119-177 px when the door fills in and CLS is 0.08-0.11 (over the 0.1 "good" line on
camden). On the PR the door is already in the server HTML, nothing moves, CLS is about zero.

## Fault case (PR build): `get_organiser_event_counts` fails

My first attempt routed a 500 in the browser only; it never fired (0 hits) because the server already filled the door,
so it proved nothing. Redone properly: a local proxy in front of prod Supabase, PR rebuilt to point at it
(`VITE_SUPABASE_URL` / `SUPABASE_URL`), `bachata-pasos-libres` at 390x844, 4x throttle. The browser run used
Playwright `bypassCSP` only because the site CSP blocks `localhost`; test harness only.

| Case | Door in SSR HTML | Door after hydration |
|---|---|---|
| Server-side call fails (500), browser call works | no | **yes, appears about 1 s after load and stays** |
| Server and browser calls both fail | no | no (nothing to show; page otherwise fine) |

So a failed server fetch is no longer dehydrated as "empty": the browser refetches and the door appears. As expected.

(For reference, on main with the browser call failing, the door never appears: 1 fault hit, door not visible.)

## Screenshots (390x844 after settle)

`docs/reviews/walk-ended-event-cls/`: `main-` and `pr-` each for `the-camden-tuesdays`, `bachata-pasos-libres`,
`mojito-club`. Raw numbers: `main.json`, `pr.json` (same folder; the `fault:true` row in `pr.json` is the invalid
browser-only attempt described above, ignore it).

## Commands

```
git fetch origin claude/ended-event-cls; git checkout --detach c31bbea5; npm ci
# VITE_SUPABASE_URL / VITE_SUPABASE_PUBLISHABLE_KEY / VITE_SUPABASE_ANON_KEY / SUPABASE_URL = prod public URL + anon key (not committed)
NODE_OPTIONS=--max-old-space-size=6000 npm run build
node scripts/_serve-build.mjs --port 4173          # PR; main built the same way in a worktree on port 4174
node walk.cjs <port> <pr|main> docs/reviews/walk-ended-event-cls   # Playwright, 390x844 + 360x640, CDP CPU rate 4, 7 s
```
Fault: PR rebuilt with the Supabase URL set to a local forwarding proxy that returns 500 for
`get_organiser_event_counts` (server calls only, or both), served on port 4175.
The walk scripts live in the session scratchpad, not in the repo.

## Verified / Not verified

Verified: production build of both heads, real prod data, SSR HTML contents, CLS and grid movement at two phone
sizes under 4x CPU throttle, server-side failure recovery.
Not verified: a real phone, a real mobile network (localhost, no latency, so the late-door jump on main is if anything
understated), Vercel edge caching of the HTML, 1.5 s prefetch budget being hit under real prod latency (every prefetch
here finished inside it), other browsers than Chromium. One run per cell (no repeats).
