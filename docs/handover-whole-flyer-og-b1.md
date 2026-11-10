# Handover: whole-flyer link card, slice B1

Brief: `docs/briefs/whole-flyer-og-b1.md` on branch `brief/whole-flyer-og-b1`.
Contract: `docs/design/whatsapp-whole-flyer.CONTRACT.md` DRAFT 4 on
`brief/whole-flyer-og-contract-d4`. Branch: `claude/whole-flyer-og-b1`.

The mode defaults to OFF. Nothing in this slice turns it on anywhere: no env,
no Vercel setting, no workflow change, no SQL.

## Done

- `app/lib/ogLayout.ts` (new, pure, no sharp): the mode `OG_WHOLE_FLYER_MODE`
  (off, test, allowlist, on; anything else, wrong case included, is off;
  allowlist with no valid id is off; parsed once at module load) with
  `OG_WHOLE_FLYER_EVENT_IDS` (public_event_id, trimmed, lower-cased, UUID
  checked). `ogLayoutFor(kind, entityId)` is the one owner of the choice.
  Festivals are always legacy. Test mode is legacy for every caller. Also here:
  the D1 canvas rule (960 wide, ratio clamped to [0.8, 1.91], so heights 503 to
  1200), the live URL params `l=wf1&s=<W>x<H>` and their parser, the baked key
  `<id>-<occ>-<cover16>-wf1-<W>x<H>.jpg`, and the D4 c read rule
  (`acceptBakedKey`).
- `app/lib/ogCardRender.ts`: the #1517 tall builder is extended, not forked.
  One shared composer (`composeWholeFlyer`) and one JPEG ladder
  (`encodeJpegLadder`). `buildWholeFlyerCard(cover, canvas)` draws exactly the
  canvas it is given, for every ratio, wide included. Its ladder is q82, q74,
  q66, q58, JPEG only. A card still over 300 KB comes back at the same size
  with `overBudget: true`; it is never returned silently. `layout=tall` keeps
  its three-rung ladder and gives byte-identical output (golden test).
- `app/routes/api.og.card.tsx`: `l=wf1` renders exactly `s`, and the layout
  comes from the URL, never from the mode. Responses carry `X-OG-Layout: wf1`
  and `Cache-Control: public, max-age=3600`, with no CDN directive. The etag
  includes `l` and `s` and no facts. Degraded 200s are drawn at the `s` canvas
  and keep `X-OG-Fallback`. An over-budget card gets
  `X-OG-Fallback: over-budget`. A render error stays a no-store 302. An `s`
  outside the D1 range gets the legacy card with `X-OG-Layout: legacy-fallback`,
  `X-OG-Fallback: wf-size-invalid`, a 300 s cache and no etag. URLs with no `l`
  are byte-identical to main (golden test, flag off and on).
- `app/routes/api.og.bake.tsx`: writes whatever layout `ogLayoutFor` picks. A
  wf key carries the version and size and never the facts tag. An over-budget
  card is refused (422, `refused: over-budget`) on the ogBakePolicy refusal
  path, so nothing is uploaded and the row is recorded as error.
- `app/detailLoader.ts`: `resolveOgCardImageSized` applies the read rule and
  returns the URL plus its declared size. `resolveOgCardImage` is now
  `resolveOgCardImageSized(...).url`, so `festival.tsx` is unchanged. A wf key's
  size is read from the key, with no fetch. The live whole-flyer path measures
  through the injected `measureWholeFlyer` under a 2500 ms budget. On a miss it
  falls back to the l-less URL at 1200x630 with `legacyFallback: true`.
- `app/lib/ogTallPreview.server.ts`: adds `measureWholeFlyerCanvas`, which uses
  the card resolver's cover (`fetchEventCardData`), never
  `snap.event.imageUrl`. `resolveOgTallPreview` is unchanged.
- `app/routes/event.tsx`: og:image width and height come from the card. The
  `ogImageSize` key is added to the loader data only when the size is not
  1200x630, so the legacy page data is unchanged. A measure miss makes the page
  response `Cache-Control: no-store` with `X-OG-Layout: legacy-fallback`.
  `?ogtest=whole-flyer` forces the whole-flyer layout in mode `test` only
  (fix round, finding 5).
  It is never baked. `?ogtest=tall` behaves exactly as before.
- `scripts/backfill-og-images.mjs`: adds `--layout wf1|legacy` (required with
  any batch flag), `--ids`, `--limit` (counts bakes) and `--dry-run`. It reads
  `og_render` read-only, skips targets already on the layout, and prints how
  many are not yet on it. A bake that lands on the wrong layout counts as a
  failure (the Vercel mode disagrees with `--layout`). With no flags the run is
  exactly as before. The shebang was dropped so vitest can import the
  helpers, and the script was added to `TARGETS` in
  `scripts/prove-entry-point-dispatch.mjs`.
- `scripts/check-og-images.mjs`: `HEALTHY_BAKED_KEY_RE` accepts the wf
  suffix. Added `wholeFlyerFailures`, which checks that the declared size
  equals the decoded JPEG size, that the body really is a JPEG, the ratio is in
  [0.8, 1.91], `l=` live cards have a cache of at most 3600 s while the mode is
  not on, an `l=wf1` card carries `X-OG-Layout: wf1`, and a baked wf key matches
  the current version, the decoded size and the expected mode. The expected
  mode is `process.env.OG_WHOLE_FLYER_MODE`, default off. Pages that answer
  `X-OG-Layout: legacy-fallback` are counted and reported. The self-test has
  the 8 mutants and 4 healthy fixtures.

## Fix round (brief `docs/briefs/whole-flyer-og-b1-fix.md`, review findings 1, 2, 3, 5, 6)

- Finding 1 (red `unit (Europe/London, full)`): `tests/ogWholeFlyerGolden.test.ts`
  no longer pins a sha256 for the four TEXT-drawing cases (text rasterisation is
  host-dependent; the hashes were pinned on Windows). Those cases now compare
  the route's bytes with main's builder call (`buildFallbackCard` /
  `buildCoverCard`, bodies unchanged by this PR) run in the same test on the
  same host, and still assert status, content-type, Cache-Control, the edge
  header, ETag, markers and the decoded size. The four text-free cases keep
  their pinned hashes. Mutant (one byte of scan data flipped in the route's
  l-less output): 7 of 7 l-less cases red; reverted.
- Findings 2 and 3 (guard holes, `scripts/check-og-images.mjs`): an `l=wf1`
  URL must decode to exactly its `s=` ("decoded size differs from s="), and a
  JPEG/PNG whose size cannot be read is a failure ("cannot read decoded size")
  for live, baked and legacy URLs; the baked-key size check no longer skips on
  a null size. Both mutants had zero failures before and fail now; they are in
  `--self-test` and `tests/ogWholeFlyerGuard.test.ts` (asserting the named rule).
- Finding 5: `?ogtest=whole-flyer` applies in mode `test` only; table test of
  mode x query in `tests/ogWholeFlyerEventPage.test.ts`, which also asserts no
  request to `/api/og/bake`.
- Finding 6: `missingConfig(opts)` in the backfill script; a dry run without
  the secret exits 0 and prints the counts (end-to-end against a local
  PostgREST stand-in); a real run without it still exits 2 before any request.
- Finding 4 left as is (contract D4 c; no prod effect), per the brief.

## Left (not in B1, per brief)

- Wire `vars.OG_WHOLE_FLYER_MODE` into `.github/workflows/og-image-check.yml`.
  This is a hard-tier change for the lead and must happen before owner step O1.
  Until then the guard expects `off`.
- Owner steps O1 to O3 (Vercel env and the GitHub variable), B2 staged check,
  B3 backfill batches, B4 flip.
- Remove `layout=tall` / `?ogtest=tall` one week after B1 is deployed (a named
  slice).
- Bring festivals in (a named slice).
- The guard floor `MIN_BAKED_PAGES = 2`: in mode `on` before the backfill, the
  sampled pages may show no baked object (the read rule rejects every legacy
  key), so that floor can red until B3 runs. Decide this at B4.
- Known limit of the guard: a whole-flyer-SIZED text fallback with its marker
  stripped cannot be told apart from bytes alone. The mutant fixture covers the
  1200x630 text fallback under a wf URL, which the size and layout rules catch.

## How to run the five-sample test

```bash
npx vitest run tests/ogWholeFlyerCard.test.ts -t "five preview samples"
ls -l "$(node -e 'console.log(require("os").tmpdir())')/og-whole-flyer-samples"
```

It prints each sample's byte size and decoded size, and writes
`very-tall-0.56.jpg`, `tall-0.75.jpg`, `square-1.0.jpg`, `wide-1.78.jpg` and
`ultra-wide-3.14.jpg`, all rendered from synthetic flyers.

## Backfill, dry run (a later step; never run by the worker)

Needs `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY`. `OG_BAKE_SECRET` is
required only when a bake will be sent: `--dry-run` runs without it (fix round,
finding 6).

```bash
# What a wf1 batch WOULD bake, read-only, nothing POSTed:
node scripts/backfill-og-images.mjs --layout wf1 --dry-run
# Only the B2 allowlist events (series ids expand to their occurrences):
node scripts/backfill-og-images.mjs --layout wf1 --ids <id1>,<id2> --dry-run
# A real batch of 25 bakes, only once the Vercel mode writes wf1:
node scripts/backfill-og-images.mjs --layout wf1 --limit 25
# Rollback re-bake after mode off:
node scripts/backfill-og-images.mjs --layout legacy --limit 25
```

After each real batch, run the read-only counts of `og_render` by status. Include
any `status = error` rows the batch created.
