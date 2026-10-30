# G2: page-size budget without the extra chunk (scoping, read-only)

Ticket scope-g2. Docs only: no src, `perf-budgets.json` or vite edits are in this branch.

**Recommendation: Option D. Add `/src/lib/contactLinks.tsx` to `LIB_EVENT_RULES_MODULES` in `vite.chunks.ts`, on top of #1179's leaf.** It takes every chunk and request pin 2 below #1179's raised pins on eight routes, and dancer-app 2 below too. It also gets under main's current pins (#1162) by 1 on eight routes, and it is lighter in bytes than both main and #1179.

## What was measured

The brief says #1179 "raised the pins back". It is still OPEN (head `c289b1d`, base `1dc1660`), so the three trees are:

| tree | commit | what it is |
|---|---|---|
| A | `a1d0fa6` (= `1dc1660^`) | before #1162 |
| B | `1dc1660` | main now (#1162: accountRouting imports auth-otp-routing, pins tightened) |
| C | #1179 head | the import-free leaf `src/lib/p3StartPath.ts`, pins raised back |

Method: a clean checkout with `npm ci` (npm 11, node 22), the perf-budget workflow's placeholder `VITE_SUPABASE_*` env, then `npm run build`, `npm run check:bundle-budget`, `npm run check:first-load-requests`. A, B and C each pass their own pins, so these numbers reproduce CI. A first attempt on a shared, non-lockfile `node_modules` did NOT reproduce CI (home 270 KB, vendor-supabase pulled into home) and was discarded. Per-route chunk lists come from `build/client/.vite/manifest.json` (static `imports` closure from the budgeted entries).

## Which chunks the leaf adds back (C vs B)

`ls assets/*.js` with hashes stripped. B has 340 JS files, A and C have 343. The three that B folds away and C restores:

| chunk | raw | what it holds |
|---|---|---|
| `contactLinks` | 3.6 KB | `src/lib/contactLinks.tsx` (imports `react-router-dom` Link, `featureFlags`) |
| `chunk-OB3PAWPO` | ~123 KB raw, ~40 KB gz | react-router's internal shared chunk (named `chunk-6KYCQHYJ` on a non-lockfile install) |
| `auth-otp-routing` | 4.7 KB | `auth-otp-routing.ts` + `areaPaths.ts`; not in any budgeted route's first load, so not counted below |

Mechanism: in B, `accountRouting.ts` (pinned in `lib-account`) statically imports `auth-otp-routing`. Rollup's manual group takes the unassigned static deps of a pinned module, so `lib-account` swallowed `auth-otp-routing`, `areaPaths`, `contactLinks` and react-router's shared chunk. It grew from 7.0 KB to 144.9 KB raw (3.0 to 48.8 KB gz). In C that edge is gone, so `lib-account` is back to 7.1 KB raw, and the three chunks are separate again.

First-load chunk lists (manifest closure, names without hash): in A and C, `contactLinks` and `chunk-OB3PAWPO` are separate first-load chunks on all six checked route shapes. In B both are inside `lib-account`, which joins first load on home, event, auth, parties and faq (dancer-app already loaded it).

## Numbers (KB gz first-load / budget chunk count; requests = chunks + stylesheet + route manifest)

| route | A | B (main) | C (#1179) | **D (recommended)** | E |
|---|---|---|---|---|---|
| home | 209.2 / 37 | 212.5 / 36 | 209.2 / 37 | **207.4 / 35** | 210.7 / 36 |
| event | 377.2 / 41 | 380.4 / 40 | 377.2 / 41 | **375.4 / 39** | 378.7 / 40 |
| auth | 295.7 / 27 | 298.9 / 26 | 295.7 / 27 | **293.8 / 25** | 297.1 / 26 |
| dancer-app | 373.8 / 49 | 373.9 / 47 | 373.9 / 49 | **371.9 / 47** | 372.2 / 47 |
| parties, classes | 268.8 / 42 | 272.0 / 41 | 268.8 / 42 | **266.9 / 40** | 270.2 / 41 |
| faq, landing prose, landing style | 234.7 / 24 | 238.0 / 23 | 234.7 / 24 | **232.9 / 22** | 236.2 / 23 |
| requests: parties, classes | 44 | 43 | 44 | **42** | 43 |
| requests: faq + 2 landing | 26 | 25 | 26 | **24** | 25 |

(Landing prose and style differ from faq by under 0.4 KB; the full per-route figures are in the build logs, summarised here for faq. Budgets in `perf-budgets.json`: home 215, event 381, auth 310, dancer-app 374, parties/classes 325, faq/landing 245.)

Reading the table: B saved a request but cost +3.2 to +3.3 KB gz on every non-dancer route (home headroom 2.5 KB, event 0.6 KB), because `lib-account` became first-load. C gives that back, plus the chunk. D beats both.

## Options

### D (recommended): pin `contactLinks.tsx` into `lib-event-rules`

One line in `LIB_EVENT_RULES_MODULES`, plus the same module in `tests/chunkClassifier.test.ts:208`, which asserts the exact list (it failed, as expected, when D was applied without it).

- Chunks: the `contactLinks` and `chunk-OB3PAWPO` chunks both go (names diff vs C: exactly those two). 343 to 341 JS files. Each budgeted route loses 2 first-load chunks vs C.
- Pins it tightens, relative to #1179's raised values: chunkRatchet home 37 to 35, event 41 to 39, auth 27 to 25, dancer-app 49 to 47, parties and classes 42 to 40, faq and both landing rows 24 to 22. firstLoadRequestRatchet /parties and /classes 44 to 42, /faq and the three landing pages 26 to 24. That is nine chunk pins and six request pins, each 2 lower than C (dancer-app 2 lower than C as well). Against main today (B) it is 1 lower on eight routes and equal on dancer-app (47).
- Bytes: lower than A, B and C everywhere (table). `lib-event-rules` grows from 36.8 KB to 169.4 KB raw (13.8 to 57.5 KB gz) because react-router's shared chunk rides in it.
- vendor-ui / vendor-ui-modal: no effect. `vendor-ui` is 107,140 B raw and `vendor-ui-modal` 24,508 B raw in all five builds, gz within 5 B. No package moves between lists.
- Other checks run on D: `check:chunk-cycles` PASS (341 chunks, no import cycle); `tests/client/dancerAppChunks.test.ts` and all `tests/chunkClassifier.test.ts` cases pass except the exact-list assertion noted above. Puller ratchets unchanged (home 0, event 3, auth 2, dancer-app 4, rest 0).
- Phone-qa risk: none from the pin itself. It changes rollup config only; no `src` import changes and the leaf stays import-free, so the Node-side `VITE_ENABLE_TEACHERS_DIRECTORY` failure cannot return.
- Risk to note: react-router's ~40 KB gz now hashes with `lib-event-rules`, so any edit to any of the 11 pinned modules re-downloads it for returning visitors, where before it only changed with the dependency. Requests are the metered resource and bytes are not, so this is an acceptable trade, but it is a real cache cost.
- Prove it: `npm run build && npm run check:bundle-budget && npm run check:first-load-requests && npm run check:chunk-cycles` with the placeholder env; they report `UNDER` until the pins are lowered to the D row, then go green. Vitest: `tests/chunkClassifier.test.ts`, `tests/client/dancerAppChunks.test.ts`.

### E: pin `contactLinks.tsx` into `lib-account`

Measured. Same chunk and request counts as main (B) and still 1 below #1179's pins (home 36, event 40, auth 26, dancer-app 47, parties/classes 41, faq/landing 23; requests 43/25), but `lib-account` stays a 47 KB first-load chunk, so bytes are +1.5 KB over A on home (210.7 vs 209.2). Strictly worse than D on every route.

### F: import `P3_START_PATH` from a module already in first load (not built)

For example re-export it through `accountPaths.ts`, which is already pinned in `lib-event-rules` and import-free. C shows why this cannot tighten anything: C already has the leaf and sits at A's counts. The fold in B came from the `auth-otp-routing` and `contactLinks` edge, not from where the constant lives, so any Node-safe location returns A's counts. Restoring B's behaviour needs the edge back, which is what broke phone-qa. Not recommended.

## Not measured

- The CI run itself on D (all figures are local, but A, B and C each reproduced their own CI-passing pins, so I treat the offset as zero).
- The phone suite and phone-qa workflow on D. Only the chunk-cycles check and the two chunk vitest files were run.
- Real cache-hit effect of the `lib-event-rules` hash coupling; no production traffic or Vercel request data was read (read-only on prod, nothing was queried).
- The on-demand SSR routes `/city/:slug` and `/event/:id` are counted by the manifest closure, not by a browser trace.
- Branch-size margins: D lowers bytes everywhere, but the KB budgets for event (381) and dancer-app (374) were not re-justified in this doc.
