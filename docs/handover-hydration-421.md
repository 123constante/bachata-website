# Handover: React hydration error #421 on `/event/*`

Investigation only (brief `docs/briefs/hydration-421-web.md`, ticket
dt_df80681706a1). No source file was changed; every experiment below was
local and reverted. Date: 2026-10-20, base `main` @ 995c841.

## TL;DR

- **Error:** React 18.3.1 minified **#421**: *"This Suspense boundary received
  an update before it finished hydrating. This caused the boundary to switch to
  client rendering. The usual way to fix this is to wrap the original update in
  startTransition."* It is **not** a text/attribute mismatch (#418/#423/#425);
  across all runs only #421 appeared.
- **Boundaries:** the two lazy `<Suspense>` slots in
  `src/modules/event-page/bento/BentoPage.tsx`:
  1. `<Suspense fallback={<RsvpBlockPlaceholder/>}><RsvpBlock/></Suspense>` (lazy `RsvpBlock`, added #609, 2026-10-11)
  2. `<Suspense fallback={null}>…<LevelRatingPrompt/> / <DerivedLevelBadge/></Suspense>` (lazy, added #759 / R1a, 2026-10-15)
- **Cause, in plain words:** the server renders those blocks in full, but on the
  phone their code lives in separate lazy chunks that only start downloading
  when hydration reaches them. While a chunk is in flight React holds the
  boundary "dehydrated". During that window `BentoPage` re-renders from an
  ordinary (non-transition) update after mount, which hands the dehydrated
  `<Suspense>` new props. React cannot hydrate it with new props, so it throws
  the server HTML for that block away and client-renders it, which logs #421.
  On slow phones the window is long, so it fires on most loads.
- **Same bug already fixed once** for `FestivalDetail` (`src/pages/EventPage.tsx`,
  "Pre-hydration chunk warm-up" comment). The RSVP and level-rating lazies were
  added afterwards without that protection.
- **Routes affected:** `/event/:id` only (both lazies live in BentoPage). Home
  `/city/london`, `/festivals`, `/venue-entity/:id`, `/faq` logged nothing.

## Evidence

### Setup (local, read-only against prod data)

- The container env pre-sets `VITE_SUPABASE_URL` to a **test** project
  (`srrpv…`), which makes every `/event/<slug>` 404 locally. The prod URL and the
  public anon key (via Supabase MCP `get_project_url` / `get_publishable_keys`)
  were passed on the command line for each run. Server-side fetch needs
  `NODE_USE_ENV_PROXY=1 NODE_EXTRA_CA_CERTS=/root/.ccr/ca-bundle.crt` in this
  sandbox. The live site (`www.bachatacalendar.co.uk`) is blocked by the sandbox
  egress proxy (403), so it was not loaded directly.
- Dev: `npx react-router dev --port 3000 --host 127.0.0.1`.
- Prod: `npm run build`, then the build served by a scratch Node server using
  `createRequestHandler` (no `react-router-serve` in deps), `NODE_ENV=production`.
- Playwright Chromium, viewport 390x844 and 1280x800, console errors/warnings
  logged. Two knobs simulate a phone: CDP `Emulation.setCPUThrottlingRate`
  (4x) and a `page.route` delay on the three lazy chunk URLs
  (`RsvpBlock-*`, `LevelRatingPrompt-*`, `DerivedLevelBadge-*`).
- Event used: `/event/ronald-alba-halloween-edition-sensual-vibes` (the one in
  the brief). Also `/event/wimbledon-salsa-bachata-club` (live) and
  `/event/the-camden-tuesdays` (ended).

### 1. Dev build names the boundary

`app/entry.client.tsx`'s `onRecoverableError` logs `componentStack` but React
18.3 passes `null` for #421, so the dev copy of react-dom in
`node_modules/.vite/deps` was patched temporarily (not tracked; cache deleted
afterwards) to add the boundary's fiber stack to the message:

```
[hydration] This Suspense boundary received an update before it finished hydrating. ...
  BOUNDARY: at Suspense < at div < at div < at GlobalLayout < at BentoPage   (x2 per load)
```

`Suspense < div < div(GlobalLayout root) < GlobalLayout < BentoPage` is a
`<Suspense>` directly inside BentoPage's content `<div>`, and there are exactly
two of those: RSVP and level-rating. Delaying chunks one at a time splits them:

| delayed chunk (2.5 s, dev, 390x844) | #421 count |
|---|---|
| `RsvpBlock` only | 1 |
| `LevelRatingPrompt` + `DerivedLevelBadge` only | 1 |
| all three | 2 (3/3 runs; also 2 at 1280x800) |
| none (no match) | 0 |

### 2. What the "update" is

More temporary dev instrumentation at the #421 throw site
(`updateDehydratedSuspenseComponent`) printed the lanes:

```
DBG421 render=16 cur.childLanes=0 cur.lanes=0 dru=true  ... at div < at div   (BentoPage boundaries)
DBG421 render=1  cur.childLanes=0 cur.lanes=0 dru=true  ... (the render that committed)
```

`didReceiveUpdate=true` with `childLanes=0` means the boundary got **new props
from its parent re-rendering**, not a context change and not an update inside
it. Render lane 16 is DefaultLane and lane 1 is SyncLane; neither is a
transition, so React commits the client-render fallback and reports #421.
(Lane-128 transition renders also reached the boundary but never commit an
error, because a transition suspends instead.)

The context instrumentation (`propagateContextChange` hitting a
`DehydratedFragment`) showed the **only** context change reaching these
boundaries is `AuthProvider` at lane 128, a transition. That is
`src/hooks/useAuth.tsx`'s existing, correct #421 guard, so auth is **not** the
cause.

DefaultLane `setState` calls landing in BentoPage's subtree in the first ~2 s
(from a patched `dispatchSetState`) include `useEventRaffleConfig` (in
BentoPage and RaffleBlock), `useCoverCarousel`, `TapHintSticker`,
`EventStickyActionBar`, `RsvpBlock`, plus react-query `useSyncExternalStore`
notifications (SyncLane). **Disabling `useEventRaffleConfig` in BentoPage alone
changed nothing (2/2/2)**, so no single "bad setState" is the cause. Any
ordinary BentoPage re-render inside the chunk-loading window triggers it, and
there will always be some. The fix therefore belongs at the lazy boundary,
not at the updates.

Dev-only red herring: React Router's `HydratedRouter` calls
`setCriticalCss(undefined)` in an effect **only in development**, which changes
the framework context at DefaultLane and would cause #421 in dev on its own.
With that line disabled, dev still showed 2 to 3 #421 per load, and the prod
build (where that line is compiled out) reproduces too, so it is not the
production cause.

### 3. Production build: minified #421 reproduced

```
[error] [hydration] Minified React error #421; visit https://reactjs.org/docs/error-decoder.html?invariant=421 ... null
```

Loads with at least one #421, 5 runs each, 390x844, baseline `main` build:

| chunk delay | CPU | #421 per run |
|---|---|---|
| 0 | 1x | 0 0 0 0 0 |
| 300 ms | 1x | 0 0 1 1 1 |
| **0** | **4x** | **1 0 0 1 1** |
| 300 ms | 4x | 1 1 2 3 1 |
| 1000 ms | 4x | 3 3 3 3 2 |

On a fast desktop on localhost it rarely shows. With phone-like CPU and no
artificial latency it shows on 3 of 5 loads. That fits "every `/event/*` page"
on real phones over real networks (~95% of traffic is mobile). Up to 3 per load
under heavy delay: the two boundaries above plus one nested lazy inside them.
All of them disappear with the fix below.

Other routes, baseline prod build, 4x CPU, 3 runs each:

| route | #4xx count |
|---|---|
| `/event/wimbledon-salsa-bachata-club` | 0 1 0 |
| `/event/the-camden-tuesdays` (ended) | 0 0 0 |
| `/city/london` | 0 0 0 |
| `/festivals` | 0 0 0 |
| `/venue-entity/<id>` | 0 0 0 |
| `/faq` | 0 0 0 |

### 4. Proof by disabling (local, reverted)

| experiment (prod build, 390x844, 4x CPU, 5 runs per row) | delay 0 | 300 ms | 1000 ms |
|---|---|---|---|
| baseline `main` | 3/5 | 5/5 | 5/5 |
| **A. static imports** of `RsvpBlock`, `DerivedLevelBadge`, `LevelRatingPrompt` | **0/5** | **0/5** | **0/5** |
| B. keep lazy, wrap each `<Suspense>` slot in a `React.memo` component with primitive/stable props | 0/5 | 1/5 | 2/5 |
| C. keep lazy, module-scope warm-up `import()` (the FestivalDetail pattern); dev build, 1x CPU | 0/3 at 300 ms; 3/3 errors at 1000 ms and 2500 ms |

The dev build also gave 0/3 at both viewports for A.

## Smallest fix I would make (suggestion only, NOT implemented)

**Option A, static imports.** This is the only variant that removed it in every
run. In `src/modules/event-page/bento/BentoPage.tsx`:

```tsx
// before
const RsvpBlock = lazyWithRetry(() =>
  import('@/modules/event-page/bento/blocks/RsvpBlock').then((m) => ({ default: m.RsvpBlock })),
);
const DerivedLevelBadge = lazyWithRetry(() =>
  import('@/modules/event-page/bento/blocks/DerivedLevelBadge').then((m) => ({ default: m.DerivedLevelBadge })),
);
const LevelRatingPrompt = lazyWithRetry(() =>
  import('@/components/LevelRatingPrompt').then((m) => ({ default: m.LevelRatingPrompt })),
);

// after
import { RsvpBlock } from '@/modules/event-page/bento/blocks/RsvpBlock';
import { DerivedLevelBadge } from '@/modules/event-page/bento/blocks/DerivedLevelBadge';
import { LevelRatingPrompt } from '@/components/LevelRatingPrompt';
```

The `<Suspense>` wrappers can stay; they become no-ops at this level.

**Cost, measured (`npm run check:bundle-budget`):** `/event/:id` first-load
goes from **377.6 KB / 43 files to 389.7 KB / 49 files**. That is **over the
381 KB budget and the 43-chunk ratchet**. Both lazies were added specifically to
stay under that budget (see `perf-budgets.json` `//event` and
`//dancer-app-2026-10-15-r1a` notes), so option A needs an owner decision on a
budget raise of about 9 KB and +6 chunks, or a byte win elsewhere first.

**If the budget must hold: B + C together.** Wrap each slot in a memo
component (`RsvpSlot`, `LevelSlot` taking primitives: `eventId`,
`occurrenceId`, `goingCountLabel`, `derivedLevel`, `levelVoteCount`,
`isCancelled`, and building `snapshotQueryKey` / the badge element inside), and
fire the three `import()`s at BentoPage module scope like `EventPage.tsx` does
for FestivalDetail. B alone cut it from about 13/15 to 2/15. C closes the
short-latency cases B leaves. Neither guarantees zero on a very slow network.

## What could go wrong with the fix

- **A:** +12.1 KB gz and +6 first-load requests on the heaviest route, so
  `perf-budget.yml` turns red until budgets move. The level-rating modules are
  shared with the dancer app (`/app/*`), so rollup chunking may shift for that
  route too: re-run `check:bundle-budget` for every row. `RsvpBlock`'s header
  says it "must not import anything that lives only in this route's chunk"; a
  static import removes the reason for that rule but does not break it.
- **B:** memo only helps while the props are really stable. A new array or
  element literal passed in (e.g. `eventPageQueryKey(...).slice()` or the
  `badge` JSX) quietly brings the bug back. React-query data that really changes
  inside the window still triggers it (by design: the content changed).
- **C:** helps only if the chunk arrives before hydration reaches the
  boundary. On >=1 s chunk latency it did nothing in testing.
- Any option: the fallback that #421 causes is a client re-render of an
  identical tree, so it is unlikely anyone sees the fix, but check the RSVP
  placeholder and level card at 390x844 for flicker before and after.

## Regression test I would write

`tests/e2e/event-hydration-421.spec.ts` (Playwright, then **add it by name to
`test:e2e`**, since that list is explicit): load one `/event/<slug>` on the
production build at 390x844 with CDP CPU throttling at 4x and a `page.route`
delay of 1000 ms on every `/assets/*.js` request that is not in the document's
`modulepreload` set. Assert that no console message matches
`/Minified React error #4(18|21|23|25)|\[hydration\]/`. Run it against an
ongoing event (RSVP shown) and an ended one. On today's `main` it fails 5/5 at
that setting, so it would have caught both #609 and #759.

A cheaper unit-level guard, in the shape of
`src/hooks/__tests__/useAuthHydration.test.tsx`: render BentoPage's slot
markup through `renderToString`, `hydrateRoot` with the lazy factory held
pending, issue a non-transition parent `setState`, resolve the factory, and
assert `onRecoverableError` was not called. Fails on `main`; passes with A, and
with B for a stable-prop update.

## Not verified

- The live site itself (sandbox proxy returns 403 for
  `www.bachatacalendar.co.uk`). Production behaviour was reproduced on a local
  production build against prod data, not on Vercel.
- A real phone and a real network: CPU/latency were simulated.
- The third #421 seen only under heavy delay was not pinned to a component. It
  is nested under the two boundaries above and disappears with fix A.
- Organiser/teacher/DJ detail routes were not sampled.
