# Brief: Website route for the "Stop advertising" confirm page

Repo: bachata-website. Lane: careful (public route, no DB change). Model: Opus. Branch: `claude/advertising-stop-page`, one PR, bot-authored.

## Why
The admin repo PR #1781 (branch `claude/event-advertising-digest`) adds a Supabase edge function `advertising-stop` that renders a small HTML confirm page ("Stop advertising X?" with one POST button). Supabase serves `text/html` from edge functions on `*.supabase.co` as `text/plain`, so the page shows as raw code. The owner taps this link from a daily email on a phone, so it must render as a real page.

## What to build
A Website route `/advertising-stop` (Remix-style file in `app/routes/`, follow `api.og.card.tsx` / `api.embed.calendar.tsx` for resource-route style) that is a thin same-origin PROXY to the edge function:
- GET `/advertising-stop?t=<token>`: server-side fetch of `https://stsdtacfauprzrdebmzg.supabase.co/functions/v1/advertising-stop?t=<token>` (fixed URL; forward ONLY the `t` query param, nothing else from the request). Return the upstream body and status with these headers: `Content-Type: text/html; charset=utf-8`, `Cache-Control: no-store`, `X-Robots-Tag: noindex, nofollow`, `Referrer-Policy: no-referrer`, and the same CSP the edge handler sets (`default-src 'none'; style-src 'unsafe-inline'; form-action 'self'; frame-ancestors 'none'`).
- POST `/advertising-stop` (form, `application/x-www-form-urlencoded`, field `t`): forward as a POST to the same fixed edge URL with only `t`, same response headers. The page's form posts to its own URL (`<form method="post">`), so it lands here.
- Any other method = 405. A missing/oversized `t` (over 1 KB) = a plain friendly "link not valid, nothing was changed" page, no upstream call. Upstream failure or timeout (5 s) = a plain friendly "something went wrong, nothing was changed" page with status 502.
- The route must not be in the sitemap, must not be indexed, must not be cached by Vercel, and must not be linked from anywhere.

Read the contract in the admin repo: `git fetch` the admin repo is not available to you; the handler summary is: GET with valid token renders the confirm page and NEVER changes state; POST with valid token stops the event; invalid/expired token renders a friendly page and changes nothing.

## Checks
- Check the Website CSP / security headers config: the proxied page uses an inline `<style>` and no scripts or inline handlers (known trap: Website CSP blocks inline handlers). Confirm the page still shows styled; if the Website CSP blocks inline style, say so in the PR and use the narrowest fix.
- Unit tests: GET forwards only `t`; POST forwards only `t`; wrong method = 405; oversized token = no upstream call; upstream throws = 502 friendly page; headers present on every response.
- Real-data check: the edge function is NOT deployed yet, so test against a stubbed fetch. Say so under Not verified.
- Run the Website's normal pre-ship gate. Walk the rendered page at 390x844 with a stubbed upstream and put a screenshot in the PR.

## Hard limits
Plain git, bot token, never merge or approve, no secrets. Do not edit anything else in the Website. No new dependency.
