# Brief: storage callers v2 (Phase F, Website repo 123constante/bachata-website)

Read first: CLAUDE.md and docs it points to; `docs/briefs/storage-callers-handover.md` on branch claude/storage-callers (your previous round); the edge contract in the admin repo: `gh api repos/123constante/bachata-admin/contents/docs/briefs/storage-lockdown-fix2-handover.md?ref=claude/storage-lockdown-fix2 -q .content | base64 -d` and the same path `storage-lockdown-followup-handover.md` on `claude/storage-lockdown-followup`. Never merge, never --no-verify. Push once at the end.

## Branch
Push ONLY to `claude/storage-callers` (PR #744, bot-authored, head 13923a8). You are the only worker on it.

## What changed on the admin side (final contract, admin PRs #793 + #795 + fix2, not yet deployed)
- Non-admin JSON presign to `storage-sign-upload` is REFUSED: 422 `presign_not_allowed`. Non-admins must use multipart PROXY mode: `FormData{bucket, contentType, file}` to the same function (organiser flows in the admin repo already do; read `lib/storage.ts` in bachata-admin via gh api for the exact request and response shape). Proxy caps: images 10 MB, videos 50 MB -> 413 `file_too_large`. Response gives the `publicUrl` to store.
- Non-admin deletes are own-folder only; 403 `not_owner` for anything else (non-fatal, never retry).
- The OG baker (`app/routes/api.og.bake.tsx` / `app/lib/ogUpload.ts`) is a server caller: send `Authorization: Bearer <SUPABASE_SERVICE_ROLE_KEY>` (and `apikey`), keep presign mode, and PUT with EXACTLY the Content-Type it requested at signing (R2 rejects a different one). Never log the key.
- Deploy order: the Website change must be live BEFORE the edge functions are deployed, and must also work against today's (old) functions: proxy mode is accepted by the old functions too (check that in the old handler on bachata-admin main).

## Task
1. `uploadToR2` (src/lib/uploadToR2.ts) and its callers (AvatarUpload, VendorPortal, VendorDashboardPage): switch to proxy mode with the exact contract above. Client-side: refuse files over the cap BEFORE uploading with a plain-English message that says the limit; images over 10 MB should be downscaled client-side if the repo already has a resize helper (look for one; do not add a dependency), otherwise just refuse with the message. Keep the plain-English 401/403/413/422 messages from round one.
2. OG baker: service-role bearer, exact Content-Type on the PUT, loud logs kept. If the service key env var is missing, log a loud error and return null (do not fall back to the anon key).
3. Tests (table-driven): (admin | dancer | vendor | anon) x (ok | 401 | 403 | 413 | 422 presign_not_allowed) x each caller, request shape asserted (multipart fields), size check before network, stored URL equals returned publicUrl; og baker: bearer is the service key, Content-Type on PUT equals the signed one, missing key -> null + loud log. Run red on the unfixed head first.
4. PR #744's body is currently an empty bot placeholder and two checks fail because of it (`phone-qa-section`, `real-data-verified`). Replace it (gh api REST PATCH on the PR) with the repo's required sections: exactly `## Verified on real data` followed by lines starting `- Shapes surveyed:`, `- Checks run:`, `- NOT verified:` (no extra words inside the labels), and the repo's Phone QA section in the format .github/workflows/phone-qa-section.yml expects (read it). Run `node scripts/check-pr-real-data-verified.mjs` locally with the body to prove it.
5. Run every CI job step locally. Known: ~15 unit tests in 4 files fail on main too (eventViewCompat.contract, integrityCouldNotRun, occurrenceProgram.contract, publicEventPageLineup.contract): compare against main and report, do not fix.

## Output
New head SHA, checks per job, handover docs/briefs/storage-callers-v2-handover.md, honest Verified / Not verified (real R2, deployed functions, real phone: NOT verified). Stop after the push.
