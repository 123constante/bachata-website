# Brief: allow the new media address `media.bachatacalendar.co.uk` on the Website, ONE push, NEW PR

Repo: 123constante/bachata-website. Work branch: `claude/media-domain-web` off current `main`. Open ONE new bot-authored PR. Push ONCE. Final commit subject ends with `[worker-done <your ticket>]`. A continuation worker is normal if you hit the context limit (PARTIAL rule).

## Why (owner decision 2026-10-20, click answers)
Pictures and videos are served from the Cloudflare R2 development address `pub-07f606224cac4f2596903c44df723644.r2.dev`, which is rate limited and not meant for production. The owner's DNS is now on Cloudflare, so the owner is attaching the custom address `https://media.bachatacalendar.co.uk` to the same R2 bucket (`bachata-media`). After that, NEW uploads will return URLs on the new address (a Supabase secret `R2_PUBLIC_DOMAIN` is flipped by the owner/orchestrator later; not your job). Existing saved links keep the old r2.dev address and MUST keep working: the old address stays allowed everywhere. This PR only makes the site ACCEPT the new address so the later flip cannot break anything. Order of the whole job: (1) owner attaches the domain in Cloudflare, (2) THIS PR merges and deploys, (3) the secret is flipped.

## Change (add the new host next to the old one, remove nothing)
Find every place the old host appears and add `media.bachatacalendar.co.uk` beside it. Known places (grep the repo for `r2.dev` and `pub-07f606224cac4f2596903c44df723644` to be sure, including `scripts/`, `api/`, `public/`, workflows, tests):
- `app/csp.ts` (img-src and media-src; keep `https://*.r2.dev`; also check connect-src if direct uploads or fetches of media exist, and say what you found)
- `vercel.json` (`images.remotePatterns`: add `{ "protocol": "https", "hostname": "media.bachatacalendar.co.uk" }`; keep the two r2.dev entries; check any CSP or header copy in this file too)
- `src/lib/imageCdn.ts` (the allowlist of hosts routed through the image optimiser; add the new host; read the comment at the top first and keep its explanation accurate)
- `index.html` (preconnect/dns-prefetch or similar, if it names the old host: add the new one)
- `scripts/check-og-images.mjs` and any other script or check that recognises "our own media" by host
- any helper that decides "is this URL ours" (for example `isOwnFlyerUrl` in the organiser module): it must treat the new host as ours too.
Do not touch the Supabase secret, edge functions, migrations or database rows. Do not change any stored URL.

## Tests (RED FIRST on current main, keep the failing output for the PR body)
Table-driven: for each helper/config that knows the old host (csp builder, imageCdn gate, own-URL helpers), assert the new host `https://media.bachatacalendar.co.uk/events/a.jpg` and `https://media.bachatacalendar.co.uk/venue-videos/x.mp4` are accepted AND the old r2.dev host still is, AND an unrelated host (`https://evil.example/a.jpg`, and a look-alike `https://media.bachatacalendar.co.uk.evil.example/a.jpg`) is NOT. A config-level test that `vercel.json` contains both remotePatterns hostnames and that the CSP string contains the new host in img-src and media-src. All existing tests stay green.

## Verify
Production build (`npm run build`), serve it locally, and with a headless browser confirm the response header Content-Security-Policy of `/event/femme-style` lists the new host in img-src and media-src and that the old r2.dev video still plays (a local production build against prod data; if you cannot run a browser, say "not verified in a browser: the orchestrator re-walks").

## Gates (run every CI job step you can, with command and exit code, in the PR body)
`npm run test:unit` (a known set of failures identical on `main`: 15 failures in 4 `tests/` files for live-database contract and environment; confirm and name them), typecheck, lint chain (run `bash bin/check-integrity.sh` rather than executing it directly), `npm run build`, bundle-budget, `npm run check:images`. Fill the PR body with the sections the checks require: a `## Phone QA` section (Sizes checked with a WxH, Walked, Not verified) and a `## Verified on real data` section (Shapes surveyed, Checks run, NOT verified lines); the PR body is edited at the end by `git`-free means only if you can; if you cannot edit the PR description, write both sections in `docs/handover-media-domain-web.md` and say so, the orchestrator pastes them.

## Boundaries
Plain git only (`git fetch`, `git show`, `git push`); NEVER `gh api`; shell commands without variables, loops or `$(...)` where a plain command works. Never merge or approve, never `--no-verify`; PR is bot-authored. Do not touch the admin repo, Supabase or any DNS. One push (Vercel deploy cap). Leave `docs/handover-media-domain-web.md`. Context: at 25% start nothing new; by 30% push and handover with a last commit subject ending `PARTIAL [worker-done <ticket>]`. Stop after the push; report head SHA, PR number, per-job results, Verified / Not verified.
