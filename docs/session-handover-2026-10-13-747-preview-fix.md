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
**The root-cause fix is #748 (already on main, merged into this branch):** Radix Tooltip
>= 1.4, which Vercel's install resolved where the lockfile pins 1.2, imports
`useFocusScopeBranch` from `@radix-ui/react-focus-scope`. That package was in the modal
list, so vendor-ui imported vendor-ui-modal. #748 moved it to the shell list and added
`scripts/check-chunk-cycles.mjs` to perf-budget (CI's build). That explains why CI was
clean and the preview was not.

This branch first added a self-healing classifier rule (`classifyChunkInGraph`). It was
**dropped** after #748 landed: with the list fixed it was redundant, and its silent moves
went against "the lists are a measured fact". What stays from this branch:
- `vendorChunkCycleGuard` (Vite plugin in `vite.chunks.ts`, wired in `vite.config.ts`):
  fails EVERY client build, **Vercel's included**, on a static import cycle through a
  vendor chunk, naming it. #748's script checks CI's build; this is the only check that
  sees the graph Vercel actually builds. Verified on Vercel: the 35e5774 preview built
  green, so the guard did not trip there.
  Unit tests: `tests/vendorChunkCycleGuard.test.ts`.

## Step 4: gate
- Build time: `vendorChunkCycleGuard`. Red-first, on the merged tree: filing
  `@radix-ui/react-context` in vendor-ui-modal makes `npm run build` exit 1 and name
  `vendor-ui <-> vendor-ui-modal`.
- Route smoke: `playwright.build.config.ts` + `tests/e2e-build/no-stuck-routes.build.spec.ts`,
  run as the new `build-smoke` job in `.github/workflows/phone-qa.yml`. It does a
  production build with the fake Supabase baked in, served the way Vercel serves it.
  It fails on an uncaught page error, a VISIBLE skeleton or "Loading..." after 8 s, or
  missing route content on `/parties` (calendar day cells), `/event/<uuid>` (the
  schedule's first session) and `/organisers/<slug>` (the name heading).
  Red-first (same mutant, guard off): 3/3 red, `TypeError: Z is not a function`.
  Green 3/3. On GitHub: `build-smoke` green on 35e5774.
- The positive-content assertion found that `/event/<uuid>` was a 404 in the fake, so
  the first version had been passing without testing anything.
  `tests/e2e-phone/fakeSupabase.mjs` `resolve_public_event_ref_v1` now resolves an
  event id as well as a slug.

## CI on 35e5774 (before merging main)
Green: build-smoke, e2e-smoke, bundle-budget, lighthouse, doc-weight, integrity,
synthetic-preview, seo/og preview, unit NY and Sydney. Red:
- `unit (London, full)`: 2 cases in my classifier test. CI tests the merge with main,
  where #748 had moved focus-scope into the shell list. Gone with the classifier rule.
- `phone-qa`: `overlap /auth: horizontal page scroll @top` at both sizes, also on retry.
  It was flaky in the sandbox on f50eff1+fix too. Checked again after merging main
  (see the PR body).
- `contract-check`: see the PR body.

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

## Final state (this session)
- A second session (the original #747 worker, following PR events) pushed 10438c9,
  3b8d7a7, 8583ede and 27fe0b2 while this one worked. They were merged in, not
  rewritten. Its notes: `docs/session-handover-2026-10-13-website-small-queue.md`.
- `phone-qa` /auth on 35e5774: #744 on main fixes it ("clip the route entrance slide at
  `<main>`"). On the merged tree: 3 repeats x 2 sizes, no retries, all green, and the
  full phone suite gives 174 passed.
- `contract-check`: live prod DB drift (unmigrated DDL at 22:11 UTC on the surname
  functions, plus anon-grant posture). Red on main pushes too. Needs the admin or DB owner.
- Full local CI table on the final head: PR #747 body.
- Owner: re-check the preview (`/parties`, the event schedule, an organiser page).
  Never merge or approve.
