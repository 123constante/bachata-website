# Session handover: organiser edit-in-place (2026-10-11)

Branch: `feat/organiser-edit-in-place` (off `origin/main` d00d9b8). **No PR opened yet.**
Stopped at the owner's 30% context gate, after the code and its tests and
before the full CI-step run and the PR.

## Done

**Code** (new folder `src/modules/organiser/edit-in-place/`):

- `fieldRules.ts`: pure rules for each field (year, Instagram, website, Facebook, About, category picker, photo URL), with refusal and hint copy. "We will save" is read back from `buildOrganiserProfilePatch`, so there is no second format.
- `draftModel.ts`: the single save, built as `formFromEntity(stored)` plus the drafts and passed through `buildOrganiserProfilePatch`, sent with `saveOrganiserProfile`. It never builds a partial patch and never sends contact_email, contact_phone or show_contact_publicly. Also here: the card model, the localStorage draft (every access in try/catch), the mapping from server errors to the field they name, the check that the RPC's returned profile matches what was sent, and all the copy.
- `organiserPhotoModel.ts` / `organiserPhotoUploadApi.ts`: reuse the flyer checks, sniff and re-encode. Photo limits: long edge 1200px, aim about 400 KB, never over 2 MB. Bucket `organiser-photos`, path `<organiser_id>/<32hex>.<ext>`, uploaded with upsert false.
- `bridge.ts` (types only), `parts.tsx` (pencils, unsaved tag, Complete card, meta chips, link rows), `FieldSheet.tsx` (bottom sheet positioned against visualViewport, 16px inputs, focus trap, Escape and overlay close it), `EditInPlaceLayer.tsx` (drafts, the sticky bar, one Save with a double-tap guard, restore notice, beforeunload, the useBlocker leave dialog with 4 choices).
- `src/lib/organiserLinkLabels.ts`: `extractIgHandle`, `extractFbHandle` and `extractDomain` moved out of the page, plus `'share'` and other non-page Facebook paths, plus `PUBLIC_LINK_REL`.
- `flyerModel.ts`: `reencodeFlyer` takes an optional `limits` argument. Its defaults are the flyer's own values, so flyer behaviour and the flyer tests are unchanged.
- `src/pages/OrganiserProfile.tsx` (+41 / -61 lines): adds the lazy import, the `eip` bridge state, the drafted-value overlay on `ep`, the slots (card, photo, meta, about, links), the mount point (only when `facts.canEdit`), and `rel="noopener nofollow ugc"` on the 3 social pills. The helpers moved out.
- Files on the do-not-touch list: none touched (ownership.ts, claimHint.ts, PublicClaimCard.tsx, publicClaim.ts, authRouting.ts, and all the #714 files).

**Tests** (`edit-in-place/__tests__/`, 274 pass together with flyerModel.test.ts):

- `fieldRules.test.ts` (90 tests)
- `draftModel.test.ts` (102 tests). It covers no partial socials over 11 shapes and all 27 card combinations. Red evidence: against a naive partial-patch `buildSavePatch`, the 13 "no partial socials" tests fail. Captured; rerun the same way if needed.
- `organiserPhoto.test.ts` (19 tests)
- `EditInPlaceLayer.test.tsx` (30 tests). It includes a double-tap test across both Save buttons, which kills the mutant that drops the `savingRef` guard.
- `visibility.matrix.test.tsx` (7 tests). It renders the real page for signed out, visitor, contributor, unknown, manager and owner. Red evidence: against main's page, 6 of 7 fail (the manager and owner layers are missing, and every row has the wrong `rel`).

**Prod survey** (read-only, counts only, 2026-10-11). These do NOT match the brief:

- 45 organisers, all with lifecycle_status `live`. `is_active` is true on only 3 and null on 42.
- Missing values: About 45, Year 41, Facebook 22, Website 20, Instagram 3, Photo 2, Category 1, city 0.
- Instagram in BOTH the column and socials: **0**. Instagram or website only in socials: **0**. Leading or trailing whitespace in any URL: **0** (the brief said 2).
- socials keys in prod: only `facebook`. 20 rows have `{}`.
- Shapes: 3 rows with no links at all. Instagram: 39 https links, 1 bare `instagram.com/...`, 2 handles. 5 websites have no scheme. 1 Facebook link is `profile.php`. 0 share links. Max About: null (none set).
- Categories: Dance School 24, Event Brand 11, Community Group 5, Promoter 3, Festival Brand 1, none 1.
- entity_members for organisers: 4 owner rows over 3 organisers, 0 managers.
- Side effect to put in the PR body: the full-form patch adds `https://` to the 5 schemeless websites and the 1 bare Instagram link on the first save of any field. The existing editor does the same, and the server accepts it.

**Freshness finding** (from code and docs; a live probe was blocked by this environment's network policy, which returned 403 for www.bachatacalendar.co.uk):

- `/organisers/:id` ships `edgeTtlBoundSeconds: 0`, so Vercel's `s-maxage` is 0 (`app/routes/organiser.tsx`).
- Cloudflare caches human HTML for 300 s. Nothing purges organiser pages: there is no `organiser` emit in `_emit_cache_revalidation_v1`, and `CF_URL_RULES` maps the `organiser-<id>` tag to no URL (`docs/ops/cloudflare-purge.md` lines 111 and 243-244).
- The save RPC calls no revalidation, and `/api/revalidate` needs the server secret, so the client cannot purge.
- Result: visitors can see the old page for up to about 5 minutes. The owner's own view is refreshed straight from the RPC's returned row and a refetch.
- The confirmation copy is therefore `Saved at HH:MM. Visitors may take a few minutes to see it.`

## Open (in this order)

1. Run every applicable CI step locally and record the result of each:
   - `npm run test:unit` (full suite)
   - `npm run lint` (the chain), `npm run lint:architecture`, `bin/check-integrity.sh`, `npm run check:legacy-tables`, `npm run check:legacy-program-rpcs`
   - `AUDIT_STRICT=1 npm run check:images`, `npm run check:image-widths`, `npm run check:mojibake` (+ self-test)
   - the rest of `architecture-guard.yml`
   - `npm run check:rpc-typing`, `npm run check:wallclock-brand`
   - `npm run build`, then `npm run check:bundle-budget` and `npm run check:first-load-requests`, with NO budget file touched
   - `npm run test:e2e`
2. Check that the owner chunk is a separate lazy file in `build/` and is not pulled into the first load of the organiser route.
3. Run `/code-review` before the final commit, per CLAUDE.md (Ricky types it). Use two rounds, since this is a user-facing change. Fold the fixes into this branch.
4. Open the ONE PR using GH_BOT_TOKEN (`gh pr create`, falling back to the REST API). Use the brief's PR body sections, including the "Verified on real data" block. Then STOP and report.

## Needs an admin PR

- The `organiser-photos` bucket and its policy, per the contract in `organiserPhotoModel.ts`. **This PR must not merge before that migration is applied.**
- An `organiser` entity type in `_emit_cache_revalidation_v1`, emitted by `organiser_profile_update_p5_v1`. A follow-up Website server change would then map `organiser-<id>` in `CF_URL_RULES` and `purgeTagsFor`, and raise the 0 TTL. Until then, visitors can see a stale page for up to about 5 minutes.
- Optional: a server-side category allow-list. Today the server accepts any text up to 80 characters; only the client offers a picker.

## Not verified

- No real sign-in.
- No phone keyboard. The visualViewport maths is unit-tested only.
- No real upload or live storage, because the bucket does not exist yet.
- No browser walk at 390x844.

## Next session prompt

See the final message of the session that wrote this file.
