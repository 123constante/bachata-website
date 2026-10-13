# Handover: storage callers (Phase F)

Branch `claude/storage-callers`. Brief: `docs/briefs/storage-callers.md` (on `arc/briefs-account-lifecycle`).

## Caller table

| Caller | Function | Bucket | Stored afterwards | Delete of old object |
|---|---|---|---|---|
| `src/components/profile/AvatarUpload.tsx` | `uploadToR2` -> storage-sign-upload | avatars | returned `publicUrl` via `onChange` | none (old avatar just orphaned) |
| `src/pages/VendorPortal.tsx` (~317) | `uploadToR2` | images | returned `publicUrl` pushed to the vendor's image list | none |
| `src/pages/VendorDashboardPage.tsx` (~641) | `uploadToR2` | images | returned `publicUrl` | none |
| `app/routes/api.og.bake.tsx` | `uploadJpeg` (now `app/lib/ogUpload.ts`), server-side, ANON key | events | returned `publicUrl` -> `set_og_image_v1` | none |
| `src/lib/uploadToR2.ts` | the shared helper | any | returns the server `publicUrl` | n/a |

Findings: no caller derives a URL from the `path` it sent (all use the return value), and nothing in `src/` or `app/` calls `storage-delete-object`, so brief items 2 (delete part) and 3 have no call sites to change today. If a delete caller is added, 403 `not_owner` must be non-fatal and not retried.

## Changes
- `uploadToR2`: 401/403/422 from sign-upload become plain-English errors (sign in again / no permission / choose JPG, PNG or WebP). `path` documented as a hint only.
- `validateImageFile`: SVG rejected up front with a plain message; AVIF allowed. File inputs now `accept` jpeg/png/webp/gif/avif only.
- `uploadJpeg` moved to `app/lib/ogUpload.ts` (injectable fetch, testable) and logs `status` + `reason` loudly when signing is refused.
- Works against old and new function behaviour: it only reads `publicUrl` from the response.

## Needs admin #793 change
I could NOT read the admin repo from this session (no access), so whether #793 accepts a service-role bearer is unchecked. Required edge-side change: in `storage-sign-upload`, treat a request whose bearer token equals `SUPABASE_SERVICE_ROLE_KEY` (constant-time compare) as a trusted server caller, restricted to bucket `events` and `image/jpeg`, with the path under a fixed prefix (e.g. `events/og/`). Once deployed, switch `anonKey` to the service key in `app/routes/api.og.bake.tsx` (the `SUPABASE_SERVICE_KEY` constant already exists). Until then, after #793 deploys OG baking fails with 401, now logged as `[og-bake] storage-sign-upload refused: status=401 ...`.

## Verified / Not verified
Verified: unit tests (role x outcome tables) pass; 15 of 20 fail on the unfixed code.
Not verified: real R2, deployed functions, #793 behaviour, phone QA at 390x844, prod data shape survey, the full CI job list.
