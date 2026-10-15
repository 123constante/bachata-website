# Brief: Dancer Rebuild W2d-fix (old-photo delete request shape) -- PR B1a sub-branch

Repo `123constante/bachata-website` (PUBLIC). Model Sonnet 5.5. Read `briefs/dancer-rebuild-COMMON.md` (note the
"Context limit" section) and `briefs/dancer-rebuild-w2d-photo.md` on `arc/briefs-dancer-rebuild` first
(`git fetch origin arc/briefs-dancer-rebuild` then `git show FETCH_HEAD:<path>`). Never run `gh api`.

BRANCH: `arc/dancer-app-w2d` ALREADY EXISTS (head `2c105112`, W2d COMPLETE). Continue on it; push only it; no PR.
Read `docs/handover/dancer-rebuild-w2d.md` first (its point 2 is this job).

## The failure (orchestrator verified against the function source)
`deleteOwnPhoto` in `src/modules/dancer-app/screens/photo/photoFlow.ts` sends
`{ bucket: 'avatars', publicUrl }` to `storage-delete-object`. The function (admin repo
`supabase/functions/storage-delete-object/handler.ts` on `main`) accepts ONLY `{ keys: string[] }` (400
"keys must be an array" otherwise), validates each key, and lets a non-admin delete only keys under its own
upload prefix `<bucket>/u/<uid>/...`; one foreign key refuses the whole batch. Keys are what
`storage-sign-upload` returns: `key = <bucket>/<path>`, `publicUrl = https://<publicDomain>/<key>`. So every
old-photo delete today would be refused and the old object would never be removed.

## Fix
1. One pure helper `keyFromPublicUrl(url, uid)` -> the key (URL pathname without the leading `/`) only when it
   starts with `avatars/u/<uid>/`; otherwise `null` (admin-uploaded or foreign photos: skip the delete, log once,
   never send it, because a foreign key refuses the batch).
2. `deleteOwnPhoto` sends `{ keys: [key] }` only when the helper returns a key; still runs AFTER a successful save;
   failure is still logged and swallowed.
3. Prefer the `key` that the sign-upload answer already returns for the NEW photo where the flow keeps it (so a
   later replace in the same session does not re-derive it).
4. Table-driven red-first test: run it against the unfixed code first and quote the failure. Rows: own-prefix
   URL -> `{keys:[...]}` sent; admin/legacy URL (no `/u/<uid>/`) -> nothing sent; another user's prefix -> nothing
   sent; malformed URL -> nothing sent; first photo (no old URL) -> nothing sent. Update the fake/mocks to assert
   the exact body.
5. Gates: the photo folder tests, `npm run build`, `npx tsc -p tsconfig.app.json --noEmit` filtered to touched files.
   Do NOT re-run the whole suite (the known base reds are being handled at the branch merge).

Update the handover (point 2 resolved, red-first quote). Commit, push ONCE with the last subject ending
`[worker-done <ticket>]` (or `PARTIAL [worker-done <ticket>]` at the 30% context limit). Stop after the push.
