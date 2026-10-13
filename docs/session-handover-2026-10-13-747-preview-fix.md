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
`vite.chunks.ts` `classifyChunkInGraph`, wired in `vite.config.ts`: a node_modules
module that a vendor-ui module statically reaches is filed in vendor-ui, so vendor-ui
can never import vendor-ui-modal. Whatever install a deploy gets, the cycle cannot
form. On today's graph it changes nothing (chunks are byte-identical, hashes unchanged).
With the mutant above it removes the cycle and all routes render.
Unit tests: `tests/chunkClassifierGraph.test.ts`.

## Step 4: gate
`playwright.build.config.ts` + `tests/e2e-build/no-stuck-routes.build.spec.ts`, run as
the new `build-smoke` job in `.github/workflows/phone-qa.yml`: a production build with
the fake Supabase baked in, served the way Vercel serves it. It fails on any uncaught
page error or a skeleton / "Loading..." still showing after 8 s on `/parties`,
`/event/<uuid>` and `/organisers/<slug>`, and on any static import cycle through a
vendor chunk. Red-first: 4/4 red on the cycle mutant (old classifier). Green 4/4 on
the branch.

## Limits (be honest)
The gate builds in CI, not on Vercel. If Vercel's build differs from CI's, the gate
cannot see that build. The classifier rule is what protects that build.
Owner action: redeploy the #747 preview with "Use existing Build Cache" unticked and
re-check `/parties`.

## Next
Steps 5-6 (local CI table, PR body) are in the PR body once pushed.
