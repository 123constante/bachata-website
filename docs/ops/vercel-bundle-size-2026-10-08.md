# Vercel function bundle size &mdash; 2026-10-08

Trigger: Vercel's 75% Deployment Storage warning on the 10 GB Hobby allowance.
Pool on the warning day: ~176 production deployments kept for 30 days plus ~240 previews
kept for 7 days. Each one stores the SSR function.

## How it was measured

- `origin/main` @ `79d74d5`, then `npm ci --ignore-scripts`, with the placeholder `VITE_*` env vars from `e2e-smoke.yml`.
- `vercel build --prod` (CLI 63.1.0), run offline with a stub `.vercel/project.json` (`framework: react-router`, `buildCommand: npm run build`, which is what `vercel.json` sets). This is the real
  Vercel react-router builder: it runs `react-router build` with `vercelPreset()`, then traces the
  server bundle with `@vercel/nft` into `.vercel/output/functions/*.func`.
- On a local build, a `.func` holds only a `.vc-config.json` whose `filePathMap` lists every file that
  would be uploaded. The sizes below sum those files. "Raw" means bytes on disk. "Deflated" means
  zlib level 6 per file, a rough stand-in for zip size.

## Function directories

| Function | What | Size |
|---|---|---|
| `index.func` | The **only** Node lambda (nodejs22.x, x86_64, streaming). Every route `.func` entry (`*.func`, `*.data.func`, `event/:id.func`, ...) are symlinks to it, so Vercel stores it once per deployment (deduped by digest, as `check-deployment-storage.mjs` notes) | **32.04 MiB raw / 11.39 MiB deflated**, 1,610 files |
| `middleware.func` | Edge middleware (`middleware.ts`), bundled into a single file | ~0.15 MiB |
| `.vercel/output/static` | Client assets and the 6 prerendered pages. Served by the CDN; these are not function storage | (build/client ~19 MiB) |

The SSR function has no `memory`, `regions`, `maxDuration`, `includeFiles` or `excludeFiles` set. `vercel.json` has no `functions` key and `.vc-config.json`
carries no memory or region values, so the platform defaults apply.

## Top contributors inside `index.func`

| # | Package / path | Raw MiB | Deflated MiB | What it is | Removable? | Risk |
|---|---|---:|---:|---|---|---|
| 1 | `@img/sharp-libvips-linux-x64` | **17.83** | **7.67** | One file: `libvips-cpp.so`, the native image library behind `sharp` | **No, not safely.** `app/lib/ogCardRender.ts` calls `sharp` at request time from `/api/og/card` (the live OG-image fallback for entities that have not been baked yet) and from `/api/og/bake` | High: social share previews would fail (500) |
| 2 | `build/server/<bundle>` | 2.10 | 0.51 | Our own SSR bundle (`server-build-*.js` 1.43 MiB, plus the lazy route chunks). **No `.map` files are traced in** | No | n/a |
| 3 | `react-dom` | 1.65 | 0.40 | SSR renderer. 0.98 MiB of it is `react-dom.development.js`, which nft traces because of the `NODE_ENV` branch | Dev half only (see "small wins") | Low&ndash;medium |
| 4 | `date-fns` | 1.22 | 0.38 | 605 files, because it is externalised and imported through its index | Only by bundling it (`ssr.noExternal`) | Medium |
| 5 | `maplibre-gl` | 1.06 | 0.29 | Map library. Client-only in practice, but the server build imports it (and also emits a 0.73 MiB `maplibre-gl-worker` chunk) | Yes, with a code change (client-only import) | Medium |
| 6 | `react-router` | 0.90 | 0.20 | Framework runtime (includes a `development/` build) | No | n/a |
| 7 | `motion-dom` | 0.84 | 0.24 | framer-motion core | No | n/a |
| 8 | `lucide-react` | 0.72 | 0.14 | Icons (one CJS file) | No | n/a |
| 9 | `@tanstack/query-core` | 0.48 | 0.14 | Data layer | No | n/a |
| 10 | `framer-motion` | 0.47 | 0.14 | Animation | No | n/a |
| 11 | `leaflet` | 0.43 | 0.11 | Map. Client-only in practice, same as maplibre | Code change | Medium |
| 12 | `sharp` | 0.43 | 0.11 | JS wrapper around libvips | No (see #1) | High |
| 13 | `@supabase/auth-js` | 0.43 | 0.09 | Supabase client | No | n/a |
| 14 | `@img/sharp-linux-x64` | 0.40 | 0.17 | sharp's native addon | No | High |
| 15 | `@supabase/storage-js` | 0.22 | 0.04 | | No | n/a |
| 16 | `@supabase/postgrest-js` | 0.21 | 0.04 | | No | n/a |
| 17 | `@img/sharp-wasm32` | 0.15 | 0.04 | sharp's WASM fallback. It is never loaded on linux-x64 glibc | Yes (`excludeFiles`) | Low |
| 18 | `vaul` | 0.15 | 0.03 | Drawer UI | No | n/a |
| 19 | `tailwind-merge` | 0.14 | 0.03 | | No | n/a |
| 20 | `react` | 0.13 | 0.04 | | No | n/a |
| 21 | `ws` | 0.13 | 0.03 | Supabase realtime transport | No | n/a |
| 22 | `@radix-ui/react-select` | 0.11 | 0.02 | | No | n/a |
| 23 | `@tanstack/react-query` | 0.11 | 0.04 | | No | n/a |
| 24 | `@supabase/realtime-js` | 0.11 | 0.03 | | No | n/a |
| 25 | `@supabase/supabase-js` | 0.08 | 0.02 | | No | n/a |
| 26 | `leaflet.markercluster` | 0.08 | 0.02 | Client-only map plugin | Code change | Medium |
| 27 | `@floating-ui/core` | 0.08 | 0.02 | | No | n/a |
| 28 | `sonner` | 0.07 | 0.02 | | No | n/a |
| 29 | `semver` | 0.07 | 0.02 | Used by sharp's platform check | No | n/a |
| 30 | `@emnapi/runtime` | 0.06 | 0.01 | sharp-wasm32 dependency | With #17 | Low |

### Build-only packages: none are in the function

The function contains **0 bytes** of `vite`, `esbuild`, `rollup`, `lightningcss`, `typescript`, `@babel/*`,
`@react-router/dev`, `playwright` or `@sentry/*`, and no source maps.
Nothing in `app/` or `src/` imports `@sentry/*` any more, and the server build's bare
imports are all runtime packages (react, react-router, radix, supabase, date-fns, framer-motion, sharp,
maplibre/leaflet, @vercel/functions, ...).

## Compared with the 2026-09-07 guard note (27.70 MiB)

- **The original cause is fixed.** The `@sentry/react-router` import that pulled the Vite toolchain into the lambda is gone.
- **A new cause has taken its place: OG card rendering with `sharp`.** `libvips-cpp.so` alone is 17.83 MiB raw, which is 56% of the function.
- **Net raw size: 32.04 MiB today vs 27.70 MiB on 09-07, about 16% worse.** This holds only if Vercel's `/builds`
  `size` is uncompressed bytes. If that field is the compressed (zip) size, today's equivalent is about 11.4 MiB,
  which would be about 59% better. This sandbox has no `VERCEL_TOKEN`, so this was not settled.
  `node scripts/check-deployment-storage.mjs` with a token reads the live value and settles it.
- Per deployment, either way, **sharp is now the dominant multiplier**. Retention count is the other multiplier.

## What is configurable

- `vercel.json` `functions`: per-glob `memory`, `maxDuration`, `regions` (Hobby: one region), `includeFiles` and
  `excludeFiles`. None are set today. Whether `excludeFiles` is honoured for functions emitted by the
  react-router *framework builder*, rather than `api/*` functions, needs proof on a preview
  deployment before anyone relies on it.
- `.vercelignore` limits the **uploaded source**, not the traced function. It is already tight, and it cannot
  shrink `index.func`, because nft traces from `node_modules` that Vercel installs fresh.
- `ignoreCommand` already skips preview builds that change nothing in the app, so it lowers the
  *retention-count* multiplier.
- Deployment retention (dashboard, Project &rarr; Settings &rarr; Deployment Retention) is the other lever. It does
  not live in the repo.

## Recommendation

**This analysis makes no code change.** No reduction of 20% or more is both clear and safe:

- **Small safe wins, about 8% combined.** Exclude the `*.development.*` builds of react-dom and react-router from the function
  (about 2.49 MiB, safe only because Vercel runs with `NODE_ENV=production`), plus `@img/sharp-wasm32` and `@emnapi/runtime` (about 0.2 MiB).
  Each needs proof that `excludeFiles` applies to framework functions (see above). They are worth doing only with a preview check.
- **A riskier fix that would reach about 55%: take libvips out of the SSR lambda.** Two possible routes:
  1. **Render OG cards without sharp.** For example, use `satori` + `@resvg/resvg-wasm`, at a few MiB raw. This needs a
     visual-parity check of the 1200x630 JPEG output (font metrics, the text-wrapping arithmetic in
     `ogCardRender.ts`, cover resize/crop), plus WhatsApp/Facebook preview checks on a preview deployment.
  2. **Bake only, outside Vercel.** Generate cards in a scheduled GitHub Action or an admin-side job, upload them to R2, and
     have `/api/og/card` redirect to R2 or a static fallback instead of rendering. This needs the bake job, a fallback for
     entities that have not been baked yet, and a decision on how quickly a cover change must show up.

  Splitting the OG routes into their own server bundle does **not** help. Every bundle traces its own
  react/react-router/supabase copy, so total bytes per deployment go up.
- **Medium-risk extra: about 5%.** Make `maplibre-gl`/`leaflet` imports client-only, so the server build stops importing
  them. That saves about 1.6 MiB traced plus the 0.73 MiB worker chunk.
