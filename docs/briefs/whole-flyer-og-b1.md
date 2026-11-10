# Brief: whole-flyer link card, slice B1 (renderer, URL, read path, bake, backfill script, guard)

Brief-version: 2
Branch: `claude/whole-flyer-og-b1`
Lane: careful, Opus build (public route, prod default; ONE independent review follows, dispatched by the lead). Website repo only. No SQL, no new table, no new route, no env or Vercel change, no workflow edit.

## Read first (the contract is binding)
`docs/design/whatsapp-whole-flyer.CONTRACT.md` DRAFT 4 (ACCEPTED by the lead), on branch `brief/whole-flyer-og-contract-d4` (`git fetch origin brief/whole-flyer-og-contract-d4`, then `git show FETCH_HEAD:docs/design/whatsapp-whole-flyer.CONTRACT.md`). Also its three review reports on branches `claude/review-whole-flyer-og-contract`, `-r2`, `-r3` (`docs/reviews/whole-flyer-og-contract-r1.md`, `-r2.md`, `-r3.md`): every finding in them is already folded into the contract, read them only to understand WHY. Inventory: `docs/design/whatsapp-event-preview.INVENTORY.md` (same branch). Owner decisions W1 to W4 are in contract section 1. The default of the new mode is OFF and nothing in this slice turns it on anywhere.

## What main lacks
- extends: the test-only tall card (PR #1517) is the base to extend, never fork -- app/lib/ogCardRender.ts
- one owner of the layout choice, the mode env with four values, and the pure key/size/URL helpers -- grep: ogLayoutFor
- the mode switch OG_WHOLE_FLYER_MODE (off, test, allowlist, on) and its id list -- grep: OG_WHOLE_FLYER_MODE
- a live card URL that names its layout and canvas size (l=wf1&s=WxH) -- grep: l=wf1
- a renderer version and size in the baked R2 key (the wf1 segment) -- grep: wf1
- a layout header on live cards, only on l= URLs -- grep: X-OG-Layout
- the pure helper file for the above -- app/lib/ogLayout.ts
- the backfill script knowing which layout to write and skipping rows already on it -- grep: --layout
- extends: the bake route key and refusal rules -- app/routes/api.og.bake.tsx
- extends: the guard key regex and size checks -- scripts/check-og-images.mjs

## Files
- app/lib/ogLayout.ts (new, pure functions, NO sharp import so it can never enter the client bundle)
- app/lib/ogCardRender.ts
- app/lib/ogTallPreview.server.ts
- app/detailLoader.ts
- app/routes/event.tsx
- app/routes/api.og.card.tsx
- app/routes/api.og.bake.tsx
- scripts/backfill-og-images.mjs
- scripts/check-og-images.mjs
- tests/og*.test.ts (new and existing OG tests; the two existing OG test files that live next to the route and the host helper, named api.og.card.test.tsx and ogImageHost.test.ts, may also be edited: same family, no other test file)

Do NOT touch: festival.tsx, seoMeta.ts (festivals are out of scope, contract D3), `.github/workflows/*` (the guard reads `process.env.OG_WHOLE_FLYER_MODE`, default `off`; wiring `vars.OG_WHOLE_FLYER_MODE` into og-image-check.yml is a separate hard-tier change by the lead, required before owner step O1), `vercel.json`, `vite.config.ts`, `perf-budgets.json`, any calendar file in the density exclusions, any SQL.

## Deliverables
1. Layout owner and renderer: `app/lib/ogLayout.ts` with `ogLayoutFor(kind, entityId)` (contract D3: exactly four mode strings, anything else is off, allowlist with no ids is off, parsed once at module load, test mode returns legacy for every caller, allowlist holds `public_event_id` and an occurrence follows its series), the canvas rule (960 wide, ratio clamped to [0.8, 1.91], D1), the live URL builder/parser `l=wf1&s=<W>x<H>` (D4 b and b2: the route renders exactly `s`, refuses an `s` outside the D1 range through the legacy-fallback path, `s` is in the etag; l-less URLs stay byte-identical), the baked key builder/parser `<id>-<occ>-<cover16>-wf1-<W>x<H>.jpg`. `buildTallCard` in `ogCardRender.ts` becomes the whole-flyer builder for every ratio including wide (extend it): ladder q82, q74, q66, q58, JPEG only, never WebP; over budget is never silently returned (D6).
2. Page and route wiring (contract D2, D3, D4, D5, D6): `app/routes/event.tsx` and `app/detailLoader.ts` (`resolveOgCardImage` read rule D4 c: a legacy key is accepted only when `ogLayoutFor` is not whole-flyer; a `-wf<n>-<W>x<H>.jpg` key only when it is whole-flyer and n is current; any other shape means the live URL; applied to the last path segment of `image_url` with the query stripped, any host; the size is read from the key with NO fetch; only the live not-yet-baked path measures, under a 2500 ms budget, using the card resolver's cover (`fetchEventCardData`, the same one `ogTallPreview` uses), never `snap.event.imageUrl`; on a measure miss the page emits the l-less legacy URL at 1200x630, the PAGE response carries `X-OG-Layout: legacy-fallback` and `Cache-Control: no-store`). `app/routes/api.og.card.tsx`: layout comes from the URL, never from the mode; `X-OG-Layout: wf1` only on `l=wf1` responses; Cache-Control at most 3600 on `l=` responses while the mode is not on (set it per D5, the long cache returns only by a later named slice); every 200 under an `l=wf1` URL, degraded ones included, is drawn at the URL's `s` canvas with its `X-OG-Fallback` marker; a render error stays a `no-store` 302. `app/routes/api.og.bake.tsx`: writes the layout `ogLayoutFor` picks (the key carries version and size; the whole-flyer key and etag do NOT fold in `ogFactsTag`), REFUSES an over-budget card (422, `refused: over-budget`, same path as the `ogBakePolicy` refusals) and never uploads it. Keep `layout=tall` and `?ogtest=tall` answered exactly as today (one week after B1 is deployed it is removed in a NAMED later slice, not here); add `?ogtest=whole-flyer` beside it, applied only by `event.tsx`, never baked.
3. Backfill script and guard: `scripts/backfill-og-images.mjs` gets `--layout wf1|legacy` (required, it cannot read Vercel env), `--ids` (public_event_id; a series id expands to its occurrence targets), `--limit` (counts BAKES, not ids), reads each target's current `image_url` read-only and SKIPS targets already on the layout, prints how many targets are not yet on it; default behaviour without the new flags must stay exactly as today. `scripts/check-og-images.mjs`: `HEALTHY_BAKED_KEY_RE` accepts `(?:-[0-9a-f]{12}|-wf[0-9]+-[0-9]{3,4}x[0-9]{3,4})?[.]jpg$`; declared width/height EQUAL the decoded JPEG size; for LIVE URLs that carry `l=` only, Cache-Control as received is at most 3600 while the expected mode is not `on`; for BAKED URLs the key segment, the size in the key, the decoded size and the expected-mode layout all agree; expected mode comes from `process.env.OG_WHOLE_FLYER_MODE` (default `off`); ratio within [0.8, 1.91], at most 300 KB, JPEG, no fallback marker; a page response with `X-OG-Layout: legacy-fallback` is counted and reported.
4. Tests and PR evidence (see the two matrices below, all must be present and green; red first, then green). Five sample cards for the lead's preview: a script-free way is fine, for example a vitest that writes five JPEGs to a temp dir from synthetic flyers (very tall 0.56, tall 0.75, square 1.0, wide 1.78, ultra wide 3.14) and the PR body lists their byte sizes and decoded sizes. No real flyer is fetched by tests.

## Acceptance matrix 1: D4 read rule, mode x key shape (one table-driven test, real code path, `resolveOgCardImage`)
Modes: off, test, allowlist (entity IN list), allowlist (entity NOT in list), on. Key shapes: plain legacy (`-<16hex>.jpg`, 305 rows on prod), legacy with facts (`-<16hex>-<12hex>.jpg`, 96 rows), wf1 with size (`-wf1-960x1200.jpg`), a future wf2 key, a malformed or unknown shape, a key on the `r2.dev` host and on `media.bachatacalendar.co.uk`, a key with a query string, no baked row at all. Expected per cell (state each in the test): legacy mode (off, test, allowlist-not-listed): legacy key accepted and declares 1200x630; wf key rejected, live l-less URL, 1200x630. Whole-flyer mode (allowlist-listed, on): wf1 key accepted and declares exactly the size in the key with no fetch; legacy key rejected, live `l=wf1&s=..` URL with the measured size (or, on a measure miss, the l-less legacy URL at 1200x630 plus the fallback header); wf2 and malformed keys rejected, live URL. The declared size must equal the pixels of the URL it points at in EVERY cell: assert it by decoding a real render of the emitted live URL where there is one.

## Acceptance matrix 2: the flyer shapes (table-driven, REAL sharp render, no mocks)
F1 to F8 and F15 to F18 of the contract: very tall 0.56, tall 0.75, portrait 0.9, square 1.0, landscape 1.2, wide 1.59, wide 1.82, ultra wide 2.28 and 3.14, tiny (short side 373), huge (long side over 4000 px, the render must finish under the 2500 ms budget on this machine), PNG with transparency, animated (first frame), CMYK or 16-bit, EXIF-rotated. Assert for each: decoded size equals the canvas rule and the `s` in the URL; JPEG; at most 300 KB (use a pure-noise 1536x1920 source as the worst case and assert the ladder reaches a rung that fits or the same-size marker path, never a 1200x630 swap); the whole flyer is present (pixel check that the four flyer edges lie inside the canvas) and there is no text; mode off with no `l` is BYTE-IDENTICAL to main for the normal card (golden test on the existing cases); `l=wf1` with a cover whose ratio changed after declaration still returns exactly `s`; same entity with `l` absent and `l=wf1` gives two etags and two sizes.

## Guard mutation test (must exist and must kill every mutant)
In the guard's own tests, feed `check-og-images.mjs` fixtures and assert each FAILS: declared 1200x630 over a 960x1200 body; a text fallback with the marker stripped; a WebP body; a 3:1 card; a whole-flyer key served while the expected mode is `off`; `l=wf1` URL with Cache-Control 14400; an `l=wf1` URL answered with `X-OG-Layout: legacy`; a baked URL whose key size differs from the decoded size. And each healthy fixture PASSES: legacy plain key, legacy facts key, wf1 key with the right size.

## Standing header lines (do not restate in the PR, just obey)
- Prove the data source first: before coding, read prod read-only (project `stsdtacfauprzrdebmzg`): `get_og_image_v1`, `set_og_image_v1` and `og_render` shapes, and say in the PR which table and column each page path depends on and who writes it (expected: `og_render.image_url`, written by `set_og_image_v1`, called from the bake route). Counts only, no personal data, no writes.
- Zero bytes to the /app first load: run `npm run check:bundle-budget` on main and on the branch; sharp must stay out of the client bundle; never edit `perf-budgets.json` or `vite.config.ts`.
- Push rule: commit locally as often as needed, PUSH ONCE when the slice is coherent and its tests ran; never add `run-ci` yourself; one review fix round is one more push, stated up front. Stopping rule: ONE independent review, ONE fix round, then the lead's walk.
- Fixes to review findings are unreviewed code: keep them small and re-run the reviewer's own listed mutants and test commands.
- PR body: the repo's exact skeleton, `## Verified on real data` with the labels `- Shapes surveyed:`, `- Checks run:`, `- NOT verified:` and a per-job CI table; docs/tests-only parts do not need Phone QA but this PR has no `.tsx` UI path change in `src/`, so delete the `## Phone QA` section only if `scripts/check-pr-phone-qa.mjs` accepts that. Name in `NOT verified`: real WhatsApp rendering, Cloudflare zone settings, Vercel env values, every real event card.

## Out of scope (do not start)
Festivals; removing `layout=tall`; the Vercel env var and the GitHub repository variable (owner steps O1 to O3, contract section 10); `.github/workflows/og-image-check.yml`; flipping any mode; running the backfill against prod (the SCRIPT is built and unit-tested here, never run against prod by the worker); any change to what the calendar or any other page renders.

## Hand-over
When done: last commit subject ends with the done marker from the ticket; leave `docs/handover-whole-flyer-og-b1.md` (done, left, how to run the five-sample test, the exact commands to run the backfill dry in a later step). Report head SHA, PR number, checks per job, Verified / Not verified.
