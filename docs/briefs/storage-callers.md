# Brief: storage callers (Phase F, Website repo 123constante/bachata-website)

Read first: CLAUDE.md in this repo and the docs it points to (UI quality, phone QA, tests, deploy windows). You own only Website files. Never merge, never --no-verify. Bot-authored PR via gh with the repo's bot token. Stop after the push and the report.

## Why
Admin PR #793 (branch claude/storage-lockdown-erase-edge, bachata-admin repo) locks down the edge functions `storage-sign-upload` and `storage-delete-object`: before it, ANY signed-in account could overwrite any object or delete any R2 key. After it:
- The caller is resolved from the JWT. A token that resolves no account (the anon key) gets 401.
- Admin: unchanged.
- Non-admin upload: the client `path` is IGNORED. The server builds `<bucket>/u/<uid>/YYYY/MM/<uuid>.<ext>` and returns it. Only raster image / video types; SVG now 422. The returned `publicUrl` is the only valid URL to store.
- Non-admin delete: every key must be the caller's (own prefix, or referenced by a row they own and no one else's); otherwise the WHOLE batch is refused with 403 `{ok:false, reason:'not_owner', refused}`.
Edge functions deploy separately (supabase CLI, owner step), so this Website change must be merged and live BEFORE the functions are deployed, and must work against both the old and the new function behaviour.

## Task
1. grep src/ and app/ for every caller of `uploadToR2`, `storage-sign-upload`, `storage-delete-object`. Known: src/lib/uploadToR2.ts, src/components/profile/AvatarUpload.tsx (bucket avatars), src/pages/VendorPortal.tsx and VendorDashboardPage.tsx (bucket images), app/routes/api.og.bake.tsx. Produce a table of every caller in the PR: who calls, which bucket, what is stored afterwards.
2. Every caller must store the RETURNED `publicUrl`, never a URL it computed from the path it sent. Fix any that derive the URL from `path`. Callers that overwrite a fixed path (e.g. avatar `<uid>.jpg`) must still work when the server picks a new key; after saving the new URL, a failed delete of the old object must be non-fatal.
3. Any delete via storage-delete-object: treat 403 not_owner as NON-FATAL (log, continue, the person's save still succeeds; the old file is just orphaned). Do not retry in a loop.
4. SVG: non-admin uploads of SVG now 422. Make the upload UIs reject SVG up front with a plain message (accept only jpeg/png/webp/gif/avif where it applies) rather than showing a generic failure.
5. 401/403/422 from sign-upload must show a plain-English message with what the person can do (sign in again / choose a JPG or PNG), never a raw error.
6. `app/routes/api.og.bake.tsx` calls storage-sign-upload SERVER-SIDE with the ANON key (lines ~64-67): after #793 that gets 401 and OG baking silently returns null (uploadJpeg returns null on !sign.ok). Do NOT guess a fix: the edge side must first accept a service-role bearer (or another server credential). Add a table-driven test that pins the present behaviour, make `uploadJpeg` log a loud, specific error (reason + status) when signing fails instead of silently returning null, and write the exact needed edge-side change in the handover doc under "Needs admin #793 change". Do not switch the key to the service role in this PR unless #793 already accepts it (check `git show origin/claude/storage-lockdown-erase-edge:supabase/functions/_shared/access.ts` in the admin repo via gh api).

## Gates
Table-driven tests: (admin | dancer | vendor | organiser member | anon) x (upload ok | 401 | 403 not_owner on delete | 422 svg | server returns a different path than sent) x each caller; stored URL always equals the returned publicUrl; delete 403 never blocks a save. Run them against the unfixed code first to show they can fail. Run every CI job step locally. Phone QA at 390x844 as the repo requires. PR body must have a heading exactly `## Verified on real data` (CI check real-data-verified rejects any suffix such as "(required)") with Shapes surveyed / Checks run / NOT verified (be honest: real R2, deployed functions are NOT verified). Push once at the end.

## Output
Branch claude/storage-callers, bot PR, handover docs/briefs/storage-callers-handover.md (caller table, "Needs admin #793 change"), head SHA, PR number, checks, Verified / Not verified.
