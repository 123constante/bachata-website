# Handover: media domain `media.bachatacalendar.co.uk` on the Website

Brief: `docs/briefs/media-domain-web.md` (branch `arc/briefs-portrait-video`). Ticket dt_a2c5659e941f.
Class: BUILD-non-visual. Status: DONE. One PR, one push.

## What changed (added the new host BESIDE the old one, removed nothing)
- `app/csp.ts`: `https://media.bachatacalendar.co.uk` added to `img-src` and `media-src` (header and meta forms). `https://*.r2.dev` and the pinned r2.dev hosts stay.
  - `connect-src`: unchanged ON PURPOSE. No client code fetches media by URL: uploads go to presigned `*.r2.cloudflarestorage.com` (already allowed); the only `fetch(url)` of a cover is `app/lib/ogCardRender.ts`, which runs on the server, where CSP does not apply.
- `vercel.json` `images.remotePatterns`: added `{ "protocol": "https", "hostname": "media.bachatacalendar.co.uk" }`; both r2.dev entries kept. No CSP copy lives in vercel.json (CSP is set per request in `entry.server`).
- `src/lib/imageCdn.ts`: host added to `OPTIMIZABLE_HOSTS`; the top comment rewritten so it stays true (the name used to be a dangling Vercel record; since 2026-10-20 it is the custom address on the R2 bucket, listed beside r2.dev, never instead).
- `index.html`: preconnect for the new host next to the r2.dev one. (`app/root.tsx` has no r2.dev preconnect, so nothing added there.)
- `scripts/check-og-images.mjs`: the inline "is this a baked R2 image" regex (`/\.r2\.dev\//`) is now an exported pure `isOnBakeHost()` that also accepts `https://media.bachatacalendar.co.uk/` (whole-host anchored, so a look-alike is rejected); 4 new `--self-test` cases.
- `scripts/check-doc-weight.mjs`: no edit needed; it reads `vercel.json` remotePatterns, so it now also guards the new host.
- `isOwnFlyerUrl` (`src/modules/organiser/shared/flyerModel.ts`): NOT host-based on R2. It recognises Supabase Storage paths `/storage/v1/object/public/<flyer bucket>/<series>/<token>.<ext>`, and its existing test pins that an r2.dev URL is NOT an own flyer. The new host is the same category as r2.dev there, so no change.
- New test `tests/mediaDomain.test.ts` (39 cases, table-driven).

## RED first (on `main`, before the change)
`npx vitest run tests/mediaDomain.test.ts` -> `Tests 18 failed | 21 passed (39)`: CSP header+meta img-src/media-src did not permit or name the new host (12), vercel.json lacked the hostname (1), imageCdn left `https://media.bachatacalendar.co.uk/events/a.jpg` un-optimised (1), `isOnBakeHost is not a function` (4). The reject cases and old-host cases passed already. After the change: 39/39.

## Gates (command -> exit)
- `npm run test:unit` -> 1: `15 failed | 9477 passed | 27 skipped`, in 4 files, the known set identical on main: `tests/eventViewCompat.contract.test.ts` (5), `tests/integrityCouldNotRun.test.ts` (5), `tests/publicEventPageLineup.contract.test.ts` (3), `tests/occurrenceProgram.contract.test.ts` (2).
- `npm run typecheck` -> 2: 97 `error TS`, identical count (97) on main with my changes stashed; none in touched files. `typecheck.yml` gates message-scoped (wall-clock brand) only.
- `bash bin/check-integrity.sh` -> 0.
- `npm run lint` -> 1: only link `check:integrity` exits 126 (the script lacks the exec bit in this checkout; the same script passes via `bash`, above). Every other link PASS.
- `npm run build` -> 0. `npm run check:bundle-budget` -> 0. `AUDIT_STRICT=1 npm run check:images` -> 0.
- `node scripts/check-og-images.mjs --self-test` -> 0 (48 cases).

## Phone QA
- Sizes checked: N/A: no UI change (config, CSP and an allowlist only; no layout touched). 390x844 not walked.
- Walked: local production build served with `scripts/_serve-build.mjs`; `curl -D -` of `/event/femme-style` returned a CSP header whose img-src and media-src list `https://media.bachatacalendar.co.uk` beside `https://*.r2.dev`.
- Not verified: no headless-browser walk; video playback not verified in a browser: the orchestrator re-walks.

## Verified on real data
- Shapes surveyed (read-only SELECT, counts, prod `stsdtacfauprzrdebmzg`): series covers 127 r2.dev / 1 supabase.co / 1 unsplash / 612 none; series videos 7 r2.dev / 10 YouTube; venue videos 0 r2.dev (YouTube 4, TikTok 1, other 1); dancer avatars 110 r2.dev / 2 unsplash / 66 none; organiser avatars 45 r2.dev / 3 none. 0 rows on `media.bachatacalendar.co.uk` yet. Series slug `femme-style` exists (1).
- Checks run: the table-driven matrix above (accept new + old host, reject unrelated + look-alike) on every artefact that knows the host; all gate steps listed.
- NOT verified: the local server answered 404 for `/event/femme-style` and `/city/london-gb` (the SSR loader did not reach data in this sandbox), so the page body / old r2.dev video playback was not exercised; the CSP header on that response was. The new host does not serve media yet (owner attaches it in Cloudflare); Vercel image optimisation of a new-host URL is unproven until it does.

## Next steps (not this PR)
1. Owner attaches the domain in Cloudflare. 2. This PR merges and deploys. 3. Flip `R2_PUBLIC_DOMAIN`. Then walk one new upload on a phone.
