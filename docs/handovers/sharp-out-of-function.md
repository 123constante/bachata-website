# Handover: sharp-out-of-function (dt_f7660272bd5f) -- STOPPED, brief premise does not hold

Status: **no code changed.** Owner decision needed before any work proceeds.

## What the brief assumed
`sharp` is only needed for the branded OG card behind `OG_BRANDED_CARD_ENABLED`
(OFF), so it can be excluded from the function while the flag is OFF.

## What the code actually does (origin/main 5334e3bf)
sharp renders **every** OG image today, flag OFF included:

| Path (flag OFF) | Function | Uses sharp |
|---|---|---|
| `/api/og/card?kind=image&src=...` | `buildImageCard` (letterbox resize + JPEG encode) | yes |
| `/api/og/card?kind=event|festival`, cover present | `buildCoverCard` -> `buildImageCard` (flag OFF branch) | yes |
| `/api/og/card`, no cover / no data | `buildFallbackCard` (Pango text render + composite) | yes |
| `/api/og/bake` (writes the R2 cards middleware serves) | `buildCoverCard` | yes |

`app/seoMeta.ts` `normalizeOgImage` (line ~144) routes live og:image for profiles
through `/api/og/card?kind=image`, and middleware.ts uses the same path for
DJ/dancer meta. Excluding `node_modules/sharp/**` / `@img/sharp-libvips-*` would
make every one of those throw at import -> `render-error` redirect to the static
image, and stop the bake from producing new cards. That breaks the brief's own
rule "the OG route behaves exactly as today with the flag OFF".

The 18.70 MB of `@img/sharp-libvips-linux-x64` is the runtime binary those
flag-OFF paths need, not dead weight.

## Options for the owner (pick one)
1. **Move OG rendering out of the deploy** -- render/letterbox at upload time in
   admin (or a Supabase Edge Function / separate small Vercel project) and have
   `/api/og/card` only redirect to stored JPEGs. Removes sharp from this repo's
   function; real work (new pipeline + backfill), its own brief.
2. **Replace sharp with a smaller encoder** for the flag-OFF paths (e.g. a WASM
   JPEG/resize lib for `buildImageCard`; the text fallback card pre-rendered as a
   static asset). Keeps behaviour close; needs a visual parity check per card type.
3. **Attack storage from the retention side instead**: 518 retained deployments
   x 14 MB is the 7.28 GB. Pruning old preview deployments (Vercel deployment
   retention policy / deleting old previews) frees space without touching code.
   Cheapest and immediate.
4. Splitting the OG routes into their own function does NOT help: sharp still
   ships in that deployment, so per-deployment storage is unchanged (or larger).

Recommendation: 3 now (no code, immediate), 1 later if storage keeps growing.

## Verified / Not verified
- Verified (code read): every flag-OFF OG path calls sharp (functions above,
  `app/lib/ogCardRender.ts` lines ~100-146, `app/routes/api.og.card.tsx` loader).
- Not verified: no nft trace re-run (unneeded to establish the blocker); no
  Vercel deployment size read.
