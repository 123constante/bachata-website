# Walk of PR #913 (ended-event CLS) -- BLOCKED, no measurements taken

Status: needs owner: prod anon key in the cloud env.

## What was found
- The cloud env's `VITE_SUPABASE_URL` points at project `srrpvuxldthwumzrngla`, not production (`stsdtacfauprzrdebmzg`).
- That env's anon key is rejected by the production project (HTTP 401), and the env project does not serve the `events` table the site reads (HTTP 404).
- The brief says not to fake data, so no build, walk, CLS, screenshots or fault case were run.

## Not verified
Everything: CLS, door in SSR HTML, grid move, screenshots, main-vs-PR comparison, fault case, real phone, real network.

## To unblock
Put the production URL and anon key in the cloud env as `VITE_SUPABASE_URL` / `VITE_SUPABASE_ANON_KEY`, then re-dispatch the brief (head c31bbea5).

## Commands run
- `git fetch origin brief/ended-event-cls`; `git show FETCH_HEAD:briefs/ended-event-cls-walk.md`
- `curl` of `/rest/v1/` on the env project and on the prod project with the env anon key (status codes only).
