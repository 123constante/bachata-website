// The manualChunks classifier, and the two package lists it reads.
//
// EXTRACTED FROM vite.config.ts so a test can drive it. As an anonymous
// function inside the config object it was unreachable: `defineConfig` takes a
// callback, `rollupOptions.output.manualChunks` is a property on the object
// that callback returns, and nothing can call it with a representative module
// id without standing up a build. So the rules below -- which decide what every
// route downloads -- were enforced only by whatever a full build happened to
// notice, and a build notices a mis-chunked package as a KB number on a route,
// long after the edit that caused it.
//
// tests/chunkClassifier.test.ts is what this move buys. It pins the ORDER
// (`tslib` first, for a reason the branch itself explains), the BOUNDS (a
// leading `node_modules/` and a trailing `/`, so `sonner-x` stays out), and the
// disjointness of the two lists against the REAL lists rather than fixtures.
//
// This file is imported by vite.config.ts and by that test, and by nothing
// else. It is NOT app source and must never import from `@/`.
//
// IT IS NOT TYPECHECKED BY CI, and the first draft of this header implied
// otherwise by citing its tsconfig.node.json `include` entry as though that
// were coverage. It is not: `npm run typecheck` runs tsconfig.app.json (whose
// include is src + app + generated route types), the root tsconfig is
// `files: []` plus project references, and no workflow runs
// `tsc -p tsconfig.node.json` at all -- that project also carries a
// pre-existing error in vite.config.ts's plugins array, so wiring it in is its
// own piece of work rather than a line to add here. The include entry buys
// editor and tsserver resolution, which is worth having and is all it is.
// What actually holds this file is tests/chunkClassifier.test.ts, which drives
// the behaviour rather than the types.

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
export const VENDOR_UI_SHELL_PACKAGES = [
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
export const VENDOR_UI_MODAL_PACKAGES = [
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
export function assertDisjoint(shell: string[], modal: string[]): void {
  const overlap = shell.filter((p) => modal.includes(p));
  if (overlap.length > 0) {
    throw new Error(
      `[chunks] ${overlap.join(", ")} appears in both ` +
        `VENDOR_UI_SHELL_PACKAGES and VENDOR_UI_MODAL_PACKAGES. A package ` +
        `belongs to exactly one group: the shell list is loaded by every route, ` +
        `so a duplicate silently puts modal-only weight on the homepage. Move ` +
        `it, do not copy it.`,
    );
  }
}

// Fires at MODULE LOAD, exactly as the bare `if` did when this lived inside
// vite.config.ts -- so a duplicated entry still stops the build rather than
// becoming dead text. Extracting it into a function is only what lets the test
// drive the throw with a deliberate overlap; this call is what keeps the REAL
// lists held to it. A test that called assertDisjoint with fixtures alone would
// prove the rule and leave its subject unchecked.
assertDisjoint(VENDOR_UI_SHELL_PACKAGES, VENDOR_UI_MODAL_PACKAGES);

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

/**
 * Rollup `manualChunks`: the group name a module id belongs to, or
 * undefined to leave it to rollup. Pure and total -- every branch is a
 * substring test on the id, so the test can drive it with literal paths.
 */
export function classifyChunk(id: string): string | undefined {
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
}
