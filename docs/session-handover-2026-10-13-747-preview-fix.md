# Handover: PR #747 broke pages on the Vercel PREVIEW (2026-10-13)

Brief: `docs/briefs/747-preview-fix.md` (branch `arc/briefs-website-small-queue`).
Branch: `claude/website-small-queue` (PR #747). Base head before this session: f50eff1.

## What the owner saw
`/parties` on skeletons forever (`TypeError: le is not a function` at
`vendor-ui-DCvdHbop.js:1:3129`, called from `vendor-ui-modal-*.js`), the event page's
schedule card on "Loading..." forever, an error on `/organisers/<any>`. Home fine.

## Step 1: reproduce (production build, head AND main)
- `npm run build` at f50eff1 and at main bc43fb6, served with `scripts/_serve-build.mjs`
  and the phone suite's fake Supabase: **neither breaks**. All three routes render.
- Both builds produce `vendor-ui-DhDEy8r5.js` / `vendor-ui-modal-Afd33XxC.js`,
  byte-identical, with and without every `VITE_ENABLE_*` flag, from the existing
  node_modules AND from a clean `npm ci`. CI's own Perf Budget build of f50eff1 logs the
  same `vendor-ui-DhDEy8r5.js`, and so has every Perf Budget build since 2026-10-12.
- The preview served **`vendor-ui-DCvdHbop.js`**: Vercel built different vendor chunks
  from the same commit. The sandbox cannot reach `*.vercel.app` or the live site
  (proxy 403), so Vercel's build could not be inspected directly.

## Step 2: cause
`le` sits where Radix's `var __name` helper sits in our vendor-ui (column ~3129 is
`createContextScope`'s `__name(() => ...)`). It is undefined only if vendor-ui-modal's top
level runs before vendor-ui's has, which needs a **vendor-ui <-> vendor-ui-modal
import cycle**. Proved by mutation: filing `@radix-ui/react-context` in vendor-ui-modal
makes that cycle, and the production build then fails `/parties`, `/event/<uuid>` and
`/organisers/<slug>` with `TypeError: Z is not a function` and the same stuck
skeleton / "Loading..." (the lazy chunks behind it reject, so Suspense never resolves).
So the preview's chunk graph had a cycle that the reproducible build of the same commit
does not. Most likely Vercel install / build-cache drift. **Not proven**: that needs the
Vercel build log, or a redeploy with the build cache off.

Ruled out: the PR's code. Its source diff leaves the vendor chunks byte-identical. The
programme read is fine on prod data (event 34156f15: 2 people, both carry
`nationality_code`, 1 coded), so the schedule hang is not data.

## Step 3: fix (all four small-queue fixes kept)
Two layers, both in `vite.chunks.ts` and wired in `vite.config.ts`:
1. `classifyChunkInGraph` (the `manualChunks` rollup calls): a node_modules module that
   a vendor-ui module statically reaches (through unlisted or modal modules; dropped
   importers ignored) is filed in vendor-ui, so vendor-ui can never import
   vendor-ui-modal. Logs a modal-LISTED package it moves. Memoised per build. On today's
   graph it changes nothing (chunks byte-identical, `vendor-ui-DhDEy8r5` /
   `vendor-ui-modal-Afd33XxC`).
2. `vendorChunkCycleGuard` (a Vite plugin): fails ANY client build on a static import
   cycle through a vendor chunk, including a three-chunk one the classifier does not
   look through. This runs inside Vercel's build too. So if Vercel builds a different
   graph again, the deploy fails loudly instead of shipping pages stuck on loading.
Unit tests: `tests/chunkClassifierGraph.test.ts` (13).

## Step 4: gate
- Build time: `vendorChunkCycleGuard` (above). Red-first: old classifier plus the mutant
  makes `npm run build` exit 1 and name the cycle.
- Route smoke: `playwright.build.config.ts` + `tests/e2e-build/no-stuck-routes.build.spec.ts`,
  run as the new `build-smoke` job in `.github/workflows/phone-qa.yml`. It does a
  production build with the fake Supabase baked in, served the way Vercel serves it.
  It fails on an uncaught page error, a VISIBLE skeleton or "Loading..." after 8 s, or
  missing route content on `/parties` (calendar day cells), `/event/<uuid>` (the
  schedule's first session) and `/organisers/<slug>` (the name heading).
  Red-first: old classifier plus the mutant with the build guard off gives 3/3 red
  (`TypeError: Z is not a function`). Green 3/3 on the branch.
- The positive-content assertion (added after review) found that `/event/<uuid>` was a
  404 in the fake, so the first version of the check had been passing without testing
  anything. `tests/e2e-phone/fakeSupabase.mjs` `resolve_public_event_ref_v1` now resolves
  an event id as well as a slug.

## Review (one round, CI-guard change)
`/code-review xhigh` returned 15 findings. Fixed: credential env filter (blank the keys,
not omit them), cycle check moved into the build (was a regex over minified output, and
CI-only), positive content assertions, visible-only "Loading" with `\u2026` (not a raw
ellipsis), memoisation, `isIncluded`, a log on a moved listed package, the comment that
named a nonexistent script, an accurate local recipe, the preload header, the
`docs/ci-guard-notes.md` row, and trigger paths (`react-router.config.ts`,
`scripts/_serve-build.mjs`). Not taken: running build-smoke on every `.ts` change. It
would also run the 25-minute phone suite, and the cycle class is already caught in
every build by the guard.

## Limits (be honest)
The route smoke runs in CI, not on Vercel. The build guard is what covers Vercel's
build. The preview's actual graph was never seen: no network route to Vercel from the
sandbox. Owner action: redeploy the #747 preview (this push does that) and re-check
`/parties`, the event schedule and an organiser page. If Vercel's graph still has the
cycle, the deploy now FAILS with the cycle named in the build log.
