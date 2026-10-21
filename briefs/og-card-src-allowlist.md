# Brief: /api/og/card image source allow-list (Website, SSRF hardening)

Repo `123constante/bachata-website`. Branch `claude/og-card-src-allowlist` off `main`. Model: Opus. Push ONCE at the end.
Open ONE bot-authored PR (`gh pr create`). Never merge or approve. Plan: author + (optional) continuation + review + one
fix pass; a continuation worker is normal. Handover doc: `docs/handover-og-card-src-allowlist.md` on your branch.

## Why (the finding, in the reviewer's words)
Review nit 2 on PR #921: `app/routes/api.og.card.tsx` `kind=image` takes `src` from the query string and
`fetchImageBytes(src)` (`app/lib/ogCardRender.ts` ~line 582) fetches ANY URL with no host check and follows redirects:
an open server-side fetch (SSRF) on a public, edge-cached endpoint. The missing check: a unit test that calls the
route with `src=http://169.254.169.254/...` (or any non-listed host) and asserts NO fetch happens.

## Prod data survey (orchestrator, read-only, 2026-10-21; every public image/photo/cover/avatar/logo/poster column)
| host | rows | where |
|---|---:|---|
| media.bachatacalendar.co.uk | 1,513 | all live covers/avatars/photos |
| stsdtacfauprzrdebmzg.supabase.co | 25 | organiser avatars, series/override covers, og_render.cover_source_url |
| images.unsplash.com | 10 | member/dancer avatars, series covers |
| example.com | 6 | member_profiles.avatar_url (test rows) |
| pub-07f606224cac4f2596903c44df723644.r2.dev | 140 | archive tables only (old host of the SAME bucket; a #904 rollback would bring it back) |
Relative paths become `https://www.bachatacalendar.co.uk/...` in `app/detailLoader.ts` `absoluteImageUrl`.

## Decisions (made by the orchestrator for the owner; do not reopen)
1. ONE shared allow-list module, e.g. `app/lib/ogImageSourceAllowlist.ts`, exporting `isAllowedOgImageSource(url): boolean`.
   Hosts: every hostname in `vercel.json` `images.remotePatterns` (read the file at build/import time or pin it with a
   test that fails if the two lists differ - one mapping, never two drifting copies), plus `stsdtacfauprzrdebmzg.supabase.co`
   (path must start `/storage/v1/object/public/`), `images.unsplash.com`, `www.bachatacalendar.co.uk`, `bachatacalendar.co.uk`.
   `example.com` is NOT allowed (test data; those fall back to the default card, which is correct).
2. `https:` only. No userinfo (`user@host`), no explicit port, no IP literals. Hostname compare is exact and lower-cased
   (no suffix match: `media.bachatacalendar.co.uk.evil.com` must fail).
3. Enforce it inside `fetchImageBytes` (so BOTH `kind=image` and the event/festival cover path are covered) and use
   `redirect: "error"` (or `manual` + refuse) so an allowed host cannot bounce the fetch elsewhere. A refused source returns
   null WITHOUT calling fetch.
4. `kind=image` with a refused `src`: redirect to the static card with a NEW fallback reason `image-source-disallowed`
   (add it to the `FallbackReason` union and wherever reasons are listed/tested, e.g. `tests/ogCardFallbackMarker.test.ts`).
   Event/festival covers on a refused host keep the existing `cover-unfetchable` reason (no new reason there).
5. Do not touch `vercel.json`, `app/csp.ts` or `api.og.bake.tsx` behaviour beyond calling the shared fetcher.

## Tests (red first: run them on UNFIXED main, record the failures, then fix)
Table-driven, in one file: allowed media URL -> fetch called; supabase public storage -> called; supabase non-public path ->
refused; r2.dev old host -> called; unsplash -> called; example.com, http://media..., 169.254.169.254, localhost, 127.0.0.1,
[::1], `https://media.bachatacalendar.co.uk.evil.com`, `https://user@media.bachatacalendar.co.uk`, `:8443` port,
`data:` and `file:` URLs -> refused with fetch NEVER called; a redirect response -> null. Route test: `kind=image&src=<refused>`
-> 302 to the static card with the `image-source-disallowed` marker. Also a test that the allow-list hosts equal
`vercel.json` remotePatterns hosts plus the named extras.

## Gates
- Read `.github/workflows/*.yml`; run every job step you can in the sandbox (unit tests, lint, typecheck, check:* scripts)
  and a PRODUCTION build (`npm run build`). Per-job table (command, exit code) in the PR body and handover.
- GitHub Actions may be refused for billing ("payments have failed / spending limit"): not a code failure.
- Real-data check: for 5 real prod URLs (2 media covers, 1 supabase storage, 1 unsplash, 1 example.com - take them with
  read-only SELECTs via the Supabase connector, URLs only, no personal fields) show `isAllowedOgImageSource` verdicts in the handover.
- PR body has a passing `## Verified on real data` section (Sizes checked / Walked / Not verified: no screen changes, say so).

## Rules
- Read and push with PLAIN git, never `gh api`. Shell commands WITHOUT variables, loops or `$(...)` where a plain command works.
- Never `--no-verify`. Supabase connector is READ-ONLY.
- Last push commit subject ends with `[worker-done <ticket>]` (or `PARTIAL [worker-done <ticket>]` at the context limit).
