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
  // NOT measured into the shell -- placed here to keep the two chunks
  // ONE-DIRECTIONAL, which is a correctness rule and outranks the measurement.
  // Radix Tooltip >= 1.4 imports `useFocusScopeBranch` from this package, so
  // with it in the modal list `vendor-ui` imported `vendor-ui-modal` while
  // `vendor-ui-modal` already imported `vendor-ui`: a static cycle, and on the
  // PR #746 Vercel preview "TypeError: le is not a function" (the minified
  // letter varies per build; one chunk ran top-level code against the other's
  // unassigned keepNames `var`). With the
  // lockfile's Tooltip 1.2 the shell routes pay its weight for nothing (the
  // measured cost is in the PR #746 handover, not here, per the rule above;
  // routes that already load the modal layer pay nothing and no route's chunk
  // count moves). That is the price of the cycle being impossible on either
  // Tooltip line. The rule: nothing in this list may import anything in the
  // modal list. `npm run check:chunk-cycles` is what holds it.
  "@radix-ui/react-focus-scope",
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
  // @radix-ui/react-focus-scope moved to the SHELL list -- see the note there.
  // This chunk may import vendor-ui; vendor-ui must never import this chunk.
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

// Rollup's CommonJS interop helper, by its EXACT virtual id. The leading NUL is
// the whole reason this is a bounded literal and not the substring
// "commonjsHelpers": that bare needle sits ahead of the node_modules gate, so
// it was the one branch in this file that could match a path outside
// node_modules, and it would have silently pulled a first-party
// `src/lib/commonjsHelpers.ts`, or a vendored rollup-built
// `commonjsHelpers-<hash>.js`, into vendor-react. No real module id contains a
// NUL, so this cannot reach a file on disk. Value verified against the
// installed toolchain (`HELPERS_ID` in vite's bundled @rollup/plugin-commonjs),
// not assumed -- if a Vite upgrade renames it, the pin silently stops working,
// and what catches that is `check:bundle-budget` (the routes gain a chunk and
// ~50 KB), not this file.
const COMMONJS_HELPERS_ID = "\0commonjsHelpers.js";

// The ONE first-party group, and it exists for the chunk COUNT, not for bytes.
//
// src/lib/eventCategory.ts is the canonical event-category rule (byte-pinned
// against its admin twin; see that file). It is a leaf -- it imports nothing --
// and it is read from two sides of the app that share no other module of their
// own: the public event page (endedRun.ts, inside the chunk the /event and
// /festival routes share) and the organiser editor (eventType.ts, inside the
// chunk the New event and Event editor pages share). Rollup files a module by
// the SET of entry points that reach it, and the union of those two sets is a
// set no other module has, so the lib got a chunk of its own: a few hundred
// bytes, ONE MORE REQUEST on every /event view, and the chunk ratchet in
// perf-budgets.json went red by exactly one -- the request-count regression
// that ratchet exists to catch and the KB budget cannot see.
//
// A manual chunk holding the lib ALONE does not fix that: it is still a chunk
// the route did not load before. The lib has to ride inside a chunk the route
// already loads. src/lib/londonDate.ts is that chunk: a single-module leaf like
// the lib itself, the site's calendar-time authority, and already in the
// first load of EVERY entry that reaches eventCategory (and of others besides,
// which pay the lib's few hundred bytes for nothing -- the cost of this
// pairing, accepted because the alternative is a request). Both are pure rule
// modules with no React and no imports, so neither drags anything into the
// other's routes. Measured, not reasoned: with this group in place the chunk
// counts of all eight budgeted routes and the request pins of the six
// prerendered ones match main, and /event is back on its pin; the numbers are
// in docs/handover/event-truth-p1p3-fix.md.
//
// The UNBUDGETED routes too (FIX-6 F-l, 2026-10-13): londonDate is in the root
// route's static graph, so lib-event-rules is in the first load of EVERY client
// entry -- all 83 route modules and lazy pages in the manifest -- and on each of
// them the first-load chunk + stylesheet count equals the pre-pairing build
// (merge-base 5e0ec4c), 83 of 83. Method and table:
// docs/handover/event-truth-p1p3-fix6.md. Its limit: a count of the manifest's
// static-import closure from entry.client + root + the entry, not a browser
// request trace; a lazy page's parent route chunk is not added (constant
// between the two builds).
//
// Bounded like the vendor needles, from the other side: the id must END with
// the module path (so a nested `node_modules/<pkg>/src/lib/londonDate.ts` does
// not match -- that copy belongs to its package), and it must not be under
// node_modules at all. Adding a module here moves its bytes onto every route
// that loads londonDate; re-measure with the command in the header first.
//
// src/lib/focusMode.ts (2026-10-16, dancer journey fixes) rides here too: the
// sign-up focus mapping, a no-import leaf that the root AppChrome reads on EVERY
// route, and that the lazy dancer-app shell and FinishProfile also import. Shared
// by root and lazy chunks, rollup gave it a chunk of its own: +1 first-load
// request on every budgeted route. Its bytes were already on every route (root),
// so pairing it here costs no bytes and takes the request back.
//
// src/lib/accountPaths.ts and src/lib/authRouting.ts (2026-10-16, review #789
// S6): import-free leaves the site header reads on EVERY route once
// VITE_ENABLE_ORGANISER_SELF_SERVE is on (account icon, sign-in link). Left to
// rollup, authRouting rode lib-account (accountRouting imports it), so the
// header pulled the whole lib-account chunk -- the avatar with it, ~2.5 KB gz --
// onto every public page. Here they cost ~0.5 KB gz on every route and no
// request, flag on or off; re-measure both flag states before moving them.
//
// src/modules/dancer-app/gate/useDancerArea.ts (2026-10-17, B1b review F2): the
// dancer-area gate hook. The going lock made RsvpBlock (event's lazy RSVP chunk)
// and FestivalHub import it beside RedirectIfAllowed (AnimatedRoutes) and the
// dancer-app shell, so rollup cut it into chunks of its own: auth 34 first-load
// chunks vs an allowance of 33, dancer-app 59 vs 57.
// PINNING ONE MODULE MOVES ITS UNASSIGNED STATIC DEPS TOO -- rollup adds them to
// the manual group -- so this group now also holds gateRpc, rpcLoose, useAuth and
// useAuth's leaves (getSupabase, lazyWithRetry, staleChunk, personScopedStorage,
// authResolution). All of them were already in every budgeted route's first load
// as separate small chunks, so the pin MEASURED -4 first-load chunks on every
// route (-3 on /app/*) and 0.3-0.6 KB gz less on each; the ratchets were tightened
// to match. Re-measure every route before moving it out again.
export const LIB_EVENT_RULES_MODULES = [
  "/src/lib/eventCategory.ts",
  "/src/lib/londonDate.ts",
  "/src/lib/focusMode.ts",
  "/src/lib/accountPaths.ts",
  "/src/lib/authRouting.ts",
  "/src/modules/dancer-app/gate/useDancerArea.ts",
  // `cn` (2026-10-21, D139): every route loads it from the root chunk. Pinned here
  // ONLY so the lib-org-ui group below cannot swallow it -- a pinned group takes its
  // unassigned static deps along, and then every route loaded lib-org-ui (+1 chunk
  // on all eight budgeted routes, measured).
  "/src/lib/utils.ts",
  // One boolean read by the event page, festival hub and dancer app: alone it was
  // its own chunk and one more first-load request on /event and /app.
  "/src/lib/goingCheckin.ts",
];

// The SECOND first-party group (2026-10-16, dancer journey fixes): the ONE avatar
// (src/components/account/profiles/PersonAvatar.tsx + its pure avatarFallback.ts)
// rides with src/lib/accountRouting.ts. The avatar is shared by the dancer-app
// chunk and the lazy account pages (switcher, Continue as, /account, FinishProfile),
// so rollup cut it into a chunk of its own: +1 first-load request on /app/* (chunk
// ratchet 59 vs 58). accountRouting is in the first load of every one of those
// importers already; among the budgeted routes only dancer-app loads it, so the
// pairing moves ~0.6 KB gz onto no budgeted route that did not already pay it.
export const LIB_ACCOUNT_MODULES = [
  "/src/lib/accountRouting.ts",
  "/src/components/account/profiles/PersonAvatar.tsx",
  "/src/components/account/profiles/avatarFallback.ts",
];

// The THIRD first-party group (2026-10-21, W1 people surfaces S3): the people
// badge lookup (src/modules/person-page/badges.ts) rides with the public-entity
// slug resolver (src/lib/seo/useEntitySlugOrId.ts + resolvePublicEventRef.ts).
// S3 made the event page's ScheduleBlock read badges.ts, which the people pages
// and search already import; that importer set is unique, so rollup cut it into
// a chunk of its own: /event/:id 44 first-load chunks vs an allowance of 43.
// The resolver chunk is already in /event's first load, and every route that
// loads it also loads every dependency badges.ts brings (vendor-query, the
// Supabase client chunk, searchEntities), so the pairing adds no request
// anywhere. Bytes move only onto unbudgeted entries: the badge lookup lands on
// the festival / venue pages, the resolver on the people list and search pages.
// No budgeted route except /event loads either module.
export const LIB_PEOPLE_MODULES = [
  "/src/lib/seo/useEntitySlugOrId.ts",
  "/src/lib/seo/resolvePublicEventRef.ts",
  "/src/modules/person-page/badges.ts",
];

// The FOURTH first-party group (2026-10-21, slice B fix pass, decision D139): the
// organiser Ember `ui/` blocks the dancer app is built from. Each block has a
// unique importer set (the organiser screens AND the lazy dancer-app chunk), so
// rollup cut each into a chunk of its own: /app/* 59 first-load chunks vs an
// allowance of 56, eight of them one-block chunks. One group, ONE request. Every
// route that loads any of these blocks (the organiser screens and /app/*) already
// loads nearly all of them, so the pairing moves only a few KB onto those routes
// and no bytes onto any budgeted public route. Measured numbers and the per-route
// table: docs/people-arc/HANDOVER-restyle-b.md "Fix pass", B1. Adding a module
// here moves its bytes onto every route that loads any block; re-measure every
// route (`npm run build && npm run check:bundle-budget && npm run
// check:first-load-requests`) first.
export const LIB_ORG_UI_MODULES = [
  "/src/modules/organiser/ui/Card.tsx",
  "/src/modules/organiser/ui/Chip.tsx",
  "/src/modules/organiser/ui/Field.tsx",
  "/src/modules/organiser/ui/SearchField.tsx",
  "/src/modules/organiser/ui/Skeleton.tsx",
  "/src/modules/organiser/ui/States.tsx",
  "/src/modules/organiser/ui/SummaryRow.tsx",
  "/src/modules/organiser/ui/useKeyboardInset.ts",
];

const isLibOrgUiModule = (id: string): boolean =>
  !id.includes("node_modules") && LIB_ORG_UI_MODULES.some((needle) => id.endsWith(needle));

// SINGLE-MODULE pins, and they exist ONLY to stop the group above from
// swallowing them. Rollup adds every unassigned static dependency of a pinned
// module to that module's group, so without these the Supabase client and
// searchEntities (which root.tsx loads on EVERY route) would move into
// lib-people: every route, the homepage included, would then load the badge
// lookup and a direct vendor-supabase edge. Each pin holds exactly the one
// module its old automatic chunk held, so no route's chunk set changes.
export const SINGLE_MODULE_PINS: Record<string, string> = {
  "/src/integrations/supabase/client.ts": "supabase-client",
  "/src/lib/searchEntities.ts": "lib-search",
};

const isLibPeopleModule = (id: string): boolean =>
  !id.includes("node_modules") && LIB_PEOPLE_MODULES.some((needle) => id.endsWith(needle));

const singleModulePin = (id: string): string | undefined => {
  if (id.includes("node_modules")) return undefined;
  for (const [needle, group] of Object.entries(SINGLE_MODULE_PINS)) {
    if (id.endsWith(needle)) return group;
  }
  return undefined;
};

const isLibAccountModule = (id: string): boolean =>
  !id.includes("node_modules") && LIB_ACCOUNT_MODULES.some((needle) => id.endsWith(needle));

const isLibEventRulesModule = (id: string): boolean =>
  !id.includes("node_modules") &&
  LIB_EVENT_RULES_MODULES.some((needle) => id.endsWith(needle));

/**
 * Rollup `manualChunks`: the group name a module id belongs to, or
 * undefined to leave it to rollup. Pure and total -- every branch is a
 * substring test on the id, so the test can drive it with literal paths.
 */
export function classifyChunk(id: string): string | undefined {
  // BEFORE the node_modules gate, and that placement is the whole point.
  // Rollup's CommonJS interop helper is a VIRTUAL module -- COMMONJS_HELPERS_ID
  // -- so it has no node_modules in its id, the early return below never sees
  // it, and rollup is free to file it in whichever chunk it likes. Every CJS
  // package in the tree (react and react-dom included) imports that helper, so
  // whichever chunk receives it is acquired as a STATIC import by essentially
  // every other chunk in the build.
  //
  // MEASURED, not feared: adding vendor-leaflet below captured this helper, and
  // all eight budgeted routes immediately gained 50.9 KB gz and one first-load
  // chunk -- /faq and the landing pages included, none of which mount a map.
  // vendor-maplibre sits one branch away from doing the same thing with 250 KB.
  //
  // This is the tslib rule's twin (see below) and it is here for the same
  // reason: the defect is not "this package is heavy", it is "a shared runtime
  // helper landed in a heavy chunk and dragged the chunk everywhere". Pinning
  // it to vendor-react is safe because vendor-react is already in every route's
  // first load, so the edge it creates costs nothing new.
  if (id.includes(COMMONJS_HELPERS_ID)) return "vendor-react";
  // The SECOND branch ahead of the node_modules gate, and the only first-party
  // one. LIB_EVENT_RULES_MODULES above says what it buys and how it is bounded.
  if (isLibEventRulesModule(id)) return "lib-event-rules";
  if (isLibAccountModule(id)) return "lib-account";
  if (isLibPeopleModule(id)) return "lib-people";
  if (isLibOrgUiModule(id)) return "lib-org-ui";
  const pinned = singleModulePin(id);
  if (pinned) return pinned;
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
  // maplibre-gl is the vector basemap renderer and it is BY FAR the heaviest
  // package in the tree: 277.7 KB gz across maplibre-gl.mjs and the
  // maplibre-gl-shared.mjs it imports (measured, not read off a badge -- the
  // two are a real import edge, so neither number stands alone). It is pinned
  // here for ONE reason, and it is not first-load weight: nothing eager
  // imports it. HomeMapCard is lazy and mapMounted-gated, so this chunk is
  // only ever fetched after hydration, behind the placeholder still.
  //
  // What the pin buys is CACHE ISOLATION. Left unpinned it files inside
  // HomeMapCard's chunk, and every edit to our own map code -- a pin tweak, a
  // popup string -- re-hashes 278 KB of unchanged vendor with it. Our map code
  // is ~61 KB gz and changes often; the renderer changes on version bumps.
  // TWO needles, both bounded to a whole directory under node_modules, per the
  // rule the rest of this file follows and tests/chunkClassifier.test.ts pins.
  // A bare `includes("maplibre")` would also swallow a nested vendor folder --
  // node_modules/some-lib/dist/maplibre/ -- which is the exact case that test
  // file calls out. The adapter joins the renderer deliberately: it is
  // meaningless without maplibre-gl and the two version together.
  if (
    id.includes("node_modules/maplibre-gl/") ||
    id.includes("node_modules/@maplibre/")
  ) {
    return "vendor-maplibre";
  }
  // Leaflet has to be pinned BECAUSE maplibre is, and the reason is worth
  // recording: the adapter above statically imports leaflet, so with only the
  // maplibre rule in place rollup HOISTED leaflet into vendor-maplibre --
  // measured, not feared. That left a chunk named for one renderer carrying
  // another, and it broke the cache argument in both directions: a maplibre
  // version bump re-hashed leaflet and vice versa. markercluster meanwhile
  // stayed behind in HomeMapCard, so the leaflet stack was split across two
  // chunks for no reason at all.
  //
  // Three groups, each with its own change rate: vendor-maplibre (~294 KB gz,
  // moves on version bumps), vendor-leaflet (~42 KB gz, moves almost never),
  // and HomeMapCard (~19 KB gz of our own map code, moves constantly). None of
  // them is in any route's first load -- HomeMapCard is lazy AND mapMounted-
  // gated -- so the extra split costs a request at MAP MOUNT, not on the
  // first-load graph the request ratchet watches.
  if (
    id.includes("node_modules/leaflet/") ||
    id.includes("node_modules/leaflet.markercluster/")
  ) {
    return "vendor-leaflet";
  }
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

/**
 * Every static import cycle that passes through a vendor-* chunk, as
 * "a.js -> b.js -> a.js", given each chunk's static imports.
 */
export function findVendorChunkCycles(imports: Record<string, readonly string[]>): string[] {
  const cycles: string[] = [];
  const isVendor = (f: string) => /(^|\/)vendor-[^/]*$/.test(f);
  for (const start of Object.keys(imports).filter(isVendor).sort()) {
    const seen = new Set<string>();
    const path = (from: string): string[] | null => {
      for (const next of imports[from] ?? []) {
        if (next === start) return [from, next];
        if (seen.has(next)) continue;
        seen.add(next);
        const rest = path(next);
        if (rest) return [from, ...rest];
      }
      return null;
    };
    const loop = path(start);
    if (loop) cycles.push(loop.join(" -> "));
  }
  return cycles;
}

/**
 * Vite plugin: fail the CLIENT build when any static import cycle passes through
 * a vendor chunk -- the "TypeError: le is not a function" class (#746/#747: one
 * chunk of the cycle runs its top level against the other's unassigned keepNames
 * `var`, and every lazy chunk behind it rejects, so pages sit on their loading
 * state). scripts/check-chunk-cycles.mjs (#748) checks CI's build after the fact;
 * this runs INSIDE every build, Vercel's included. That is the point: #747's
 * preview built a different graph from the same commit (a newer Radix Tooltip
 * than the lockfile's) while CI's build of it was clean, so only a check in the
 * deploy's own build sees that graph. Such a deploy now fails, naming the cycle,
 * instead of shipping.
 */
export function vendorChunkCycleGuard() {
  return {
    name: "vendor-chunk-cycle-guard",
    apply: "build" as const,
    generateBundle(
      this: { error: (message: string) => never },
      _options: unknown,
      bundle: Record<string, { type: string; imports?: string[] }>,
    ) {
      const imports: Record<string, string[]> = {};
      for (const [file, out] of Object.entries(bundle)) {
        if (out.type === "chunk") imports[file] = out.imports ?? [];
      }
      const cycles = findVendorChunkCycles(imports);
      if (cycles.length > 0) {
        this.error(
          `[chunks] static import cycle through a vendor chunk -- a chunk on it can run before the one it imports has finished ` +
            `(PR #747: "TypeError: le is not a function", pages stuck loading). Fix the grouping in vite.chunks.ts:\n  ${cycles.join("\n  ")}`,
        );
      }
    },
  };
}
