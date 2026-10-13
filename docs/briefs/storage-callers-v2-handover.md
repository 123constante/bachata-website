# Handover: storage callers v2 (Phase F)

Branch `claude/storage-callers` (PR #744). Brief: `docs/briefs/storage-callers-v2.md` on `arc/briefs-account-lifecycle` (sha fb6abe4). Contract: admin PRs #793 + #795 + fix2 (not yet deployed).

## Changes
- `src/lib/uploadToR2.ts`: multipart PROXY mode, `FormData{bucket, contentType, file}` (no `path`; the server picks the key, so the `path` argument is now ignored and kept only so callers compile). Returns the server `publicUrl`. Accepted by the old handler too (it already had a multipart branch, `path` optional).
  - Size check BEFORE any network call: images 10 MB, videos 50 MB. An oversized non-GIF image is downscaled with the existing `reencodeFlyer` (limits: edge 2400, target 4 MB); if that fails or is still over the cap, or for GIF/video, refused with a message that states the limit.
  - Messages: 401 sign in again, 403 no permission, 413 limit message, 422 `presign_not_allowed` "reload the page" (stale cached client), other 422 file type.
- Callers (AvatarUpload, VendorPortal, VendorDashboardPage) are unchanged: they already store the returned URL. No caller deletes objects, so 403 `not_owner` has no call site.
- `app/lib/ogUpload.ts` + `api.og.bake.tsx`: `Authorization: Bearer` and `apikey` are the service-role key; presign mode kept; PUT uses exactly the signed Content-Type (`image/jpeg`); missing key logs a loud error and returns null (no anon fallback); the unused anon constant is removed.

## Deploy order
Website first, then `supabase functions deploy storage-sign-upload storage-delete-object account-erase`. Website env must hold `SUPABASE_SERVICE_ROLE_KEY` byte-identical to the functions' (a `sb_secret_` key vs legacy JWT would still 401: check with one bake after deploy).

## Verified
- Tests: `uploadToR2.test.ts` (caller x role x outcome tables, multipart field assertion, size before network, downscale, stored URL = publicUrl) and `ogUpload.test.ts` (bearer, PUT Content-Type = signed, missing key, key never logged): 92/92 green. RED on the unfixed source: 80 of 92 failed.
- `npm run test:unit`: 15 failures in the same 4 files the brief lists (eventViewCompat.contract, integrityCouldNotRun, occurrenceProgram.contract, publicEventPageLineup.contract); the contract ones fail on "Invalid API key" (no live DB here). Not fixed. I did not run main separately: the file/count match the brief's known set.
- Locally green: check:rpc-typing, check:wallclock-brand, lint:architecture, check:legacy-tables, check:legacy-program-rpcs, check:integrity (via bash; the exec bit is missing in this checkout), check:mojibake, check:images (AUDIT_STRICT=1), `npm run lint` chain (all links but that one).
- `tsc` shows 111 errors repo-wide, pre-existing patterns (missing route typegen, Json casts); not compared file by file against main.

## Not verified
Real R2, deployed functions, real phone at 390x844, browser walk, prod data shape survey, whether the Website's service key matches the edge function's, CI on GitHub for this push.

## OG test fix (follow-up push)
`tests/ogFactsTagFlagOn.test.ts` "a real bake POST with the flag on" returned 500 in CI because the baker now needs `SUPABASE_SERVICE_ROLE_KEY` (read at import) and CI has none; it passed locally only because this sandbox exports one. The test was wrong, the code is not: the test now sets and restores the key, and asserts the sign bearer is the service key, the signed contentType is `image/jpeg`, and the R2 PUT carries `image/jpeg`. No assertion weakened. Reproduced red with `env -u SUPABASE_SERVICE_ROLE_KEY`, green with and without it.
Unit job (TZ=Europe/London, key unset, `test:unit:offline` + `test:unit:timing`): only `integrityCouldNotRun.test.ts` (5) fails, in the brief's known on-main set (not compared against main directly). Live contract suites not run (no DB). Not verified: CI on GitHub for this push.
