import { defineConfig } from "vite";
import react from "@vitejs/plugin-react-swc";
import { reactRouter } from "@react-router/dev/vite";
import { sentryVitePlugin } from "@sentry/vite-plugin";
import path from "path";
// lovable-tagger (componentTagger) is intentionally NOT restored under framework
// mode: it's a dev-only Lovable annotation, non-essential, and untested against
// the reactRouter() dev plugin. Re-add later behind a dev guard if wanted.

// Source-map upload to Sentry only runs when SENTRY_AUTH_TOKEN is set
// (Vercel build-time secret). Local builds without the token still produce
// hidden source maps but skip the upload.
const sentryAuthToken = process.env.SENTRY_AUTH_TOKEN;
const sentryOrg = process.env.SENTRY_ORG;
const sentryProject = process.env.SENTRY_PROJECT;

// Pin the uploaded-artifact release to the EXACT value the runtime client reports
// (src/lib/sentry.ts: RELEASE_ID = VITE_VERCEL_GIT_COMMIT_SHA || VITE_RELEASE).
// Both sides read the same VITE_-prefixed vars in the same order, so the upload
// release == runtime release by construction.
//
// Vercel always exposes the un-prefixed VERCEL_GIT_COMMIT_SHA at build time, but
// Vite never inlines an un-prefixed var into the client bundle — so on its own the
// runtime couldn't report it. Promote it into the VITE_ namespace here (before Vite
// snapshots env for inlining) when no explicit release var is set: now Vite DOES
// inline it AND the upload below reads the same value, so upload release == runtime
// release with zero dashboard env config. An explicit VITE_VERCEL_GIT_COMMIT_SHA /
// VITE_RELEASE still wins.
if (
  !process.env.VITE_VERCEL_GIT_COMMIT_SHA &&
  !process.env.VITE_RELEASE &&
  process.env.VERCEL_GIT_COMMIT_SHA
) {
  process.env.VITE_VERCEL_GIT_COMMIT_SHA = process.env.VERCEL_GIT_COMMIT_SHA;
}

const sentryRelease =
  process.env.VITE_VERCEL_GIT_COMMIT_SHA || process.env.VITE_RELEASE;

// The UI layer the app shell ALREADY loads on every route. Left unpinned, each
// of these packages lands in its own anonymous `index-*.js` -- a dozen-odd of
// them in a listing page's first load, one network request apiece, which is
// what this group exists to collapse.
//
// The list is deliberately the SHELL's Radix surface, not `@radix-ui/*`. Two
// wider rules were built and measured first, and both cost more than they saved:
//
//   - `@radix-ui` + `@floating-ui` as prefixes. This fuses every installed
//     Radix package, including the ones only a lazy route ever mounts, into a
//     chunk the first load pulls, and it cost the homepage more than the
//     supabase-defer arc had spent six phases winning it.
//   - Rollup's own `experimentalMinChunkSize` looked like the principled
//     answer -- it merges by co-loading, so it can tell eager from lazy where a
//     name list cannot. It is not usable here, and the reason is the part worth
//     keeping: its merge cost function counts the merged chunk's OWN modules and
//     NOT the dependency chunks that follow it into the load. Folding the small
//     `sentryCore` wrapper into the first load therefore dragged the whole
//     Sentry SDK behind it. It made the homepage dramatically heavier at every
//     threshold tried.
//
// Neither figure is quoted here on purpose. `npm run check:bundle-budget`
// prints the live numbers for all three budgeted routes and perf-budgets.json
// holds the baseline; a KB figure copied into a comment has no writer keeping
// it true, and the first draft of this file shipped several that the build
// already disagreed with.
//
// A package added later is simply not in either list, so it keeps today's
// per-package chunk -- a missed optimisation, never a regression. Putting one in
// the WRONG list is the mistake that costs: `vendor-ui` is loaded by every
// route, so a package only a lazy surface mounts moves its weight onto the
// homepage.
//
// Both lists below are MEASURED, not reasoned, and that distinction is the only
// thing keeping them honest. The first draft put every name in ONE group on the
// argument that the dialog and the tooltip dragged the same helpers in anyway.
// Walking the homepage's first-load graph showed a large fraction of them are
// not in it at all, and the homepage was paying for them on every view.
//
// So: re-measure before editing either list. Do not reason about what the shell
// "must" load -- that reasoning is what produced the draft above. The walker is
// the same one CI uses, and the entries are the ones perf-budgets.json already
// declares for `home`:
//
//   npm run build
//   node --input-type=module -e "
//     import fs from 'node:fs';
//     const g = await import('./scripts/check-bundle-budget.mjs');
//     const m = JSON.parse(fs.readFileSync('build/client/.vite/manifest.json'));
//     const { seen } = g.reachableWithPaths(m, [
//       'app/entry.client.tsx', 'app/root.tsx', 'app/routes/home.tsx',
//     ]);
//     const pkgs = new Set();
//     for (const k of seen) {
//       const map = 'build/client/' + m[k].file + '.map';
//       if (!fs.existsSync(map)) continue;
//       for (const s of JSON.parse(fs.readFileSync(map)).sources ?? []) {
//         const i = s.lastIndexOf('node_modules/');
//         if (i < 0) continue;
//         const r = s.slice(i + 13).split('/');
//         pkgs.add(r[0][0] === '@' ? r[0] + '/' + r[1] : r[0]);
//       }
//     }
//     console.log([...pkgs].sort().join('\n'));
//   "
//
// Anything it prints is shell. Anything it does not is not, however obviously
// the shell "ought" to need it.
const VENDOR_UI_SHELL_PACKAGES = [
  // Radix's primitive/utility layer, plus the two components root.tsx itself
  // mounts (the toaster and the tooltip provider). Every one of these is in the
  // homepage's first-load graph at 55847dd.
  "@radix-ui/primitive",
  "@radix-ui/react-collection",
  "@radix-ui/react-compose-refs",
  "@radix-ui/react-context",
  "@radix-ui/react-dismissable-layer",
  "@radix-ui/react-id",
  "@radix-ui/react-popper",
  "@radix-ui/react-portal",
  "@radix-ui/react-presence",
  "@radix-ui/react-primitive",
  "@radix-ui/react-slot",
  "@radix-ui/react-toast",
  "@radix-ui/react-tooltip",
  "@radix-ui/react-visually-hidden",
  // Popper's positioning engine -- reached from the tooltip, so shell-side.
  "@floating-ui/core",
  "@floating-ui/dom",
  "@floating-ui/react-dom",
  "@floating-ui/utils",
  // The variant helper every ui/ primitive calls, and the toaster root.tsx
  // mounts.
  "class-variance-authority",
  "sonner",
];

// The modal layer: focus trapping, scroll locking and the roving-focus pair.
// NOT in the homepage's first-load graph -- only surfaces that actually open a
// dialog or render a toggle group pull it -- so it is a SECOND chunk rather
// than part of the one above. Folding it into the shell group was measured and
// made the homepage meaningfully heavier for code it never renders. As its own
// group, the routes that DO mount a dialog pay one request for the whole layer
// instead of the several separate `index-*.js` chunks it used to arrive as, and
// the homepage pays nothing.
//
// This group is also where every tslib consumer in the pinned set lives
// (aria-hidden, react-remove-scroll, react-remove-scroll-bar,
// react-style-singleton, use-callback-ref, use-sidecar) -- see the tslib branch
// in manualChunks, which exists to keep this chunk from acquiring a false
// import edge to the Supabase client.
const VENDOR_UI_MODAL_PACKAGES = [
  "@radix-ui/number",
  "@radix-ui/react-dialog",
  "@radix-ui/react-direction",
  "@radix-ui/react-focus-guards",
  "@radix-ui/react-focus-scope",
  "@radix-ui/react-roving-focus",
  "@radix-ui/react-toggle",
  "@radix-ui/react-toggle-group",
  "aria-hidden",
  "get-nonce",
  "react-remove-scroll",
  "react-remove-scroll-bar",
  "react-style-singleton",
  "use-callback-ref",
  "use-sidecar",
];

// Bounded on both sides -- a leading `node_modules/` so a first-party path that
// happens to contain one of these words is never matched, and a trailing `/` so
// the name has to be the whole package directory (an unrelated `sonner-x` or
// `aria-hidden-fork` stays out).
//
// A NESTED copy (`.../<pkg>/node_modules/<matched-pkg>/`) matches too, for
// these needles and for the react-use-* prefix below alike, and that is a
// deliberate accepted cost rather than the no-op it might look like: npm nests
// a copy precisely when it is a DIFFERENT version, so a match pins a SECOND
// copy of the package into the chunk rather than deduplicating it. The build
// carries a couple of those today, all of them a few hundred bytes, and all of
// them reached through the react-use-* prefix rather than through this list.
// Bounded by the budgets in perf-budgets.json: if a nested copy of something
// substantial ever appears, that is what reds.
//
// Substring tests rather than one built regex, deliberately: a package name is
// a literal here, and building an alternation out of literals means escaping
// the characters a package name is allowed to contain (`leaflet.markercluster`
// has a dot). The first draft did exactly that and shipped a dead escape --
// worth the two extra lines to not have that class at all.
// The two lists must be disjoint, and this is a THROW rather than a comment
// because the failure is silent in every other way. `manualChunks` tests the
// shell list first, so a package listed in both is filed into `vendor-ui` --
// the chunk every route loads -- and the modal entry becomes dead text. The
// build succeeds, typecheck succeeds, and the budgets stay green until the
// accumulated weight crosses a threshold, at which point what reds is a KB
// number on a route with no obvious connection to the edit. Duplicating an
// entry is the single most likely way to edit these lists wrongly, since the
// natural move when the shell starts mounting a dialog is to add the name to
// the shell list rather than move it.
const VENDOR_UI_LIST_OVERLAP = VENDOR_UI_SHELL_PACKAGES.filter((p) =>
  VENDOR_UI_MODAL_PACKAGES.includes(p),
);
if (VENDOR_UI_LIST_OVERLAP.length > 0) {
  throw new Error(
    `[chunks] ${VENDOR_UI_LIST_OVERLAP.join(", ")} appears in both ` +
      `VENDOR_UI_SHELL_PACKAGES and VENDOR_UI_MODAL_PACKAGES. A package ` +
      `belongs to exactly one group: the shell list is loaded by every route, ` +
      `so a duplicate silently puts modal-only weight on the homepage. Move ` +
      `it, do not copy it.`,
  );
}

const toNeedles = (packages: string[]) =>
  packages.map((p) => `node_modules/${p}/`);
const VENDOR_UI_SHELL_NEEDLES = toNeedles(VENDOR_UI_SHELL_PACKAGES);
const VENDOR_UI_MODAL_NEEDLES = toNeedles(VENDOR_UI_MODAL_PACKAGES);

// `@radix-ui/react-use-*` -- Radix's per-hook packages, each a few lines, and
// every one currently installed a leaf: they import react and nothing else.
// This is the ONE unbounded rule in the file, and it is a prefix rather than a
// name list because the set turns over with Radix releases and a name list that
// missed a member would read as "this hook is not shared" when it had simply
// not been looked up.
//
// Grouped with the SHELL because the homepage's first-load graph already holds
// nearly all of the installed ones and the remainder are leaves of the same
// size, so the wrong-list cost the lists above are split to avoid does not
// arise here. Being unbounded, the risk it does carry is a future react-use-*
// package that is NOT a leaf; the budgets in perf-budgets.json are what catch
// that, and re-measure with the command above rather than assuming it still
// holds.
const RADIX_HOOK_NEEDLE = "node_modules/@radix-ui/react-use-";

// Self-policing: a Vercel PRODUCTION build that can't upload+associate sourcemaps
// would silently ship a release whose prod errors are undebuggable. Fail the build
// instead so the gap can't go unnoticed. The release var is required too — without
// it the upload and the runtime would disagree (see above).
if (process.env.VERCEL_ENV === "production") {
  const missing = [
    !sentryAuthToken && "SENTRY_AUTH_TOKEN",
    !sentryOrg && "SENTRY_ORG",
    !sentryProject && "SENTRY_PROJECT",
    !sentryRelease &&
      "VITE_VERCEL_GIT_COMMIT_SHA (or VITE_RELEASE) — the release the client reports; without it uploaded sourcemaps can't associate",
  ].filter(Boolean);
  if (missing.length) {
    throw new Error(
      `[sentry] Production build is missing required env var(s): ${missing.join(
        ", ",
      )}. Sourcemaps would not upload/resolve — add them to the Vercel Production scope.`,
    );
  }
}

// https://vitejs.dev/config/
export default defineConfig(({ isSsrBuild }) => ({
  server: {
    host: "::",
    port: 8080,
  },
  plugins: [
    // reactRouter() owns the React transform in framework mode. vitest cannot
    // load the RR plugin, so fall back to plugin-react-swc under VITEST.
    process.env.VITEST ? react() : reactRouter(),
    // Sentry sourcemap upload. Framework mode emits to build/client + build/server
    // (was dist/** under the SPA). Runtime Sentry is browser-only, so the client
    // bundle's maps are the ones that resolve prod errors; server maps included so
    // loader/SSR stack frames also symbolicate. Only active with SENTRY_AUTH_TOKEN
    // (Vercel prod scope) — dormant on local + preview builds.
    sentryAuthToken && sentryOrg && sentryProject &&
      sentryVitePlugin({
        authToken: sentryAuthToken,
        org: sentryOrg,
        project: sentryProject,
        release: sentryRelease
          ? {
              name: sentryRelease,
              setCommits: { auto: true, ignoreMissing: true },
            }
          : undefined,
        sourcemaps: { assets: ["./build/client/**", "./build/server/**"] },
        telemetry: false,
      }),
  ].filter(Boolean),
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
  build: {
    sourcemap: "hidden",
    // Client-build manifest feeds scripts/check-bundle-budget.mjs (perf
    // programme, Pillar D): it walks the entry/route import graphs to enforce
    // first-load JS budgets in CI. Never emitted for the server build.
    manifest: !isSsrBuild,
    // Function-form manualChunks, CLIENT BUILD ONLY (the guard matters: the RR7
    // server build uses inlineDynamicImports, which any manualChunks breaks --
    // that conflict is why the old object-form config was removed). Pins the
    // stable heavy vendors into their own chunks so a route-code change doesn't
    // re-hash -- and so re-download -- framer-motion/query/supabase/sentry for
    // returning visitors.
    //
    // React core MUST be pinned too, as one chunk with react-dom + scheduler
    // (the lockstep trio -- never split them apart). Left unpinned, rollup fused
    // react into vendor-motion (verified in the build manifest: every chunk
    // imported vendor-motion just to reach useState), which silently dragged
    // framer-motion's ~44KB gz back into the first load of every page -- the
    // exact regression this config exists to prevent. The bundle-budget CI
    // check is the tripwire if this ever recurs.
    //
    // The 2026-08-14 request-count groups below (vendor-icons, vendor-ui,
    // vendor-ui-modal) trade AGAINST that cache-hit argument, and the trade is
    // deliberate rather than overlooked. A single Radix patch inside a routine
    // dependabot batch now re-hashes the whole vendor-ui chunk where it used to
    // re-hash one tiny per-package chunk, and adding one icon re-hashes all of
    // vendor-icons. It is still the right side of the trade while Vercel meters
    // edge REQUESTS and this account is well over allowance on them while
    // comfortable on bytes: the re-download is paid once per deploy by
    // returning visitors, the request count is paid by every visitor on every
    // page. Revisit if that ratio ever inverts. .github/dependabot.yml holds
    // majors of these packages out of the weekly batch for the same reason it
    // already held the older tuned chunks.
    ...(!isSsrBuild
      ? {
          rollupOptions: {
            output: {
              manualChunks(id: string) {
                if (!id.includes("node_modules")) return undefined;
                // tslib rides with react, and it is FIRST, for a reason that is
                // not about react at all. DO NOT DELETE THIS BRANCH after
                // checking that the homepage is unaffected -- it is not the
                // homepage this protects.
                //
                // tslib is a shared helper runtime, not a Supabase dependency,
                // but it is installed as one -- so left unpinned rollup files it
                // inside vendor-supabase, and every OTHER chunk compiled with
                // tslib helpers acquires a static import edge to the whole
                // Supabase client to reach a few one-line functions. Every such
                // consumer in the pinned set is in VENDOR_UI_MODAL_PACKAGES, so
                // what this protects is vendor-ui-modal, and what it shows up as
                // is the vendor-supabase puller count on the routes that load
                // the modal layer -- /event's ratchet in perf-budgets.json is
                // the one that moves. The homepage does not load that chunk and
                // will look unchanged either way, which is exactly the audit
                // that would wrongly conclude this rule is obsolete.
                //
                // It rides with vendor-react rather than taking a chunk of its
                // own because a standalone `vendor-tslib` was a fraction of a KB
                // and ONE MORE first-load request on every route -- the unit
                // this whole change exists to reduce. vendor-react is in every
                // route's first load already and tslib has no dependencies of
                // its own, so the merge is free and breaks the same false edge.
                //
                // FIRST, because every test under it is an unbounded substring:
                // a nested `@sentry/browser/node_modules/tslib/` would match
                // `@sentry` and land tslib in vendor-sentry, re-creating the
                // identical class against a different heavy chunk. The puller
                // ratchet only watches vendor-supabase, so that would ship
                // green.
                if (id.includes("node_modules/tslib/")) return "vendor-react";
                if (
                  id.includes("node_modules/react/") ||
                  id.includes("node_modules/react-dom/") ||
                  id.includes("node_modules/scheduler/")
                ) {
                  return "vendor-react";
                }
                if (id.includes("framer-motion")) return "vendor-motion";
                if (id.includes("@sentry")) return "vendor-sentry";
                if (id.includes("@tanstack")) return "vendor-query";
                if (id.includes("@supabase")) return "vendor-supabase";
                // lucide ships one ES module per icon and rollup honours that
                // literally: 19 single-icon requests in /parties' first load at
                // 55847dd, 47 icon-only chunks across the build.
                //
                // This one is deliberately UNCURATED, unlike the Radix lists
                // above, and the asymmetry is the point: it pins the union of
                // every icon the app references ANYWHERE into a chunk the shell
                // loads, so an icon added to a lazy page does add bytes to every
                // route. Accepted knowingly. Curating it would mean a name list
                // of a hundred-odd icons going stale on every design tweak, to
                // save single-digit KB on a set whose members are a couple of
                // hundred bytes each and compress almost entirely into each
                // other -- the union is a fraction of what the per-icon chunks
                // cost as requests. The bound is home's budget in
                // perf-budgets.json.
                if (id.includes("node_modules/lucide-react/")) {
                  return "vendor-icons";
                }
                if (
                  id.includes(RADIX_HOOK_NEEDLE) ||
                  VENDOR_UI_SHELL_NEEDLES.some((needle) => id.includes(needle))
                ) {
                  return "vendor-ui";
                }
                if (VENDOR_UI_MODAL_NEEDLES.some((n) => id.includes(n))) {
                  return "vendor-ui-modal";
                }
                return undefined;
              },
            },
          },
        }
      : {}),
  },
}));
