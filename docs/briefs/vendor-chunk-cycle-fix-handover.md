> **Standalone PR.** This is the cycle fix split out of PR #746 (surname screens) so it
> merges FIRST in the Website train. #746 will drop the same files when it rebases onto
> main after this merges; identical content falls out of its diff. No surname code is here.

# Handover: "TypeError: le is not a function" = vendor-ui <-> vendor-ui-modal import cycle

Brief: `docs/briefs/surname-screens-typeerror-cycle.md` (branch `arc/briefs-account-lifecycle`).
Previous handover (not reproduced): `docs/briefs/surname-screens-typeerror-handover.md`.

## Cause (one sentence)

Radix Tooltip >= 1.4 imports `useFocusScopeBranch` from `@radix-ui/react-focus-scope`,
which `vite.chunks.ts` filed in the MODAL list, so `vendor-ui` imported `vendor-ui-modal`
while `vendor-ui-modal` already imported 15 names from `vendor-ui`; in that static cycle
one chunk runs top-level code before the other's keepNames helper `var` (`le`) is assigned.

## The finding that changes the picture: it is NOT #746's code

| Build (sandbox, Node 22, `npm ci` then the tree below) | `check:chunk-cycles` | Chromium console-clean spec (/auth /faq /parties /classes) |
|---|---|---|
| `main` bc43fb6, lockfile tree (Tooltip 1.2.16) | 0 PASS, no cycle | not run (same as branch) |
| `main` bc43fb6 + `npm i --no-save @radix-ui/react-tooltip@1.4.1 @radix-ui/react-focus-scope@1.3.1` | **1 FAIL**, vendor-ui <-> vendor-ui-modal | **4/4 failed, `pageerror: pe is not a function`** |
| branch 4cca649, lockfile tree | 0 PASS | 4/4 green (previous worker) |
| branch 4cca649 + the same Tooltip 1.4 tree | **1 FAIL**, identical chunk hashes to main (`vendor-ui-CYsQwwW5`, `vendor-ui-modal-BOP06TXp`) | **4/4 failed, `pe is not a function`** |
| branch + this fix + the Tooltip 1.4 tree | 0 PASS | **4/4 passed** |

So main breaks exactly the same way once it is built with Tooltip 1.4. #746 did not "flip
the evaluation order"; the #746 Vercel build got a different dependency tree.

The minified helper letter changes between builds (`le` on the preview, `pe` here).
Search logs or Sentry for the pattern "is not a function", not for the letter.

**OPEN, and it needs the owner (Vercel dashboard):** the committed `package-lock.json` pins
`@radix-ui/react-tooltip` 1.2.16 and `@radix-ui/react-focus-scope` 1.1.16. Vercel's #746 build
evidently had Tooltip >= 1.4 with focus-scope 1.3.x hoisted. A clean `npm ci` cannot produce
that. The likely causes are a project Install Command override (for example `npm install`
without the lockfile) or a restored build cache. Production happened to serve a tree without
the cycle, but its hashes do not match a lockfile build either. **Until that is found, any
production deploy can pick up the same tree.** With this fix merged, that tree no longer
produces the cycle, but Vercel still not building what CI tests is a gap in its own right.
Check: Vercel -> Project -> Settings -> Build & Development -> Install Command, then redeploy
#746 with "Use existing Build Cache" unticked.

## Fix (`vite.chunks.ts`)

`@radix-ui/react-focus-scope` moved from `VENDOR_UI_MODAL_PACKAGES` to
`VENDOR_UI_SHELL_PACKAGES`. Rule written into the list: nothing in the shell list may
import anything in the modal list. keepNames is untouched. No surname feature code is
touched. Lists stay disjoint (`assertDisjoint` holds).

First-load JS, lockfile tree, `npm run check:bundle-budget` before -> after:

| Route | Before | After | Budget |
|---|---|---|---|
| home (/city/:slug) | 204.0 | 205.2 (+1.2) | 215 |
| event | 379.7 | 379.7 (0) | 380 |
| auth | 288.9 | 290.1 (+1.2) | 310 |
| parties | 320.1 | 320.2 (+0.1) | 325 |
| classes | 320.2 | 320.2 (0) | 325 |
| faq | 230.0 | 231.2 (+1.2) | 245 |
| landing prose | 230.2 | 231.5 (+1.3) | 245 |
| landing style | 229.3 | 230.5 (+1.2) | 245 |

KB gz. Chunk, puller and request ratchets are unchanged. **Recorded weight on the homepage:
+1.2 KB gz.** On the lockfile tree the shell routes pay for focus-scope without using it,
because Tooltip 1.2 does not import it. That is the price of making the cycle impossible on
both Tooltip lines. A per-version alternative (keep it modal until the lockfile moves) would
leave the Vercel tree broken, so it was not taken.

On the synthetic Tooltip 1.4 tree, event, parties and classes come out OVER budget (event
386.4 / 380), because that tree carries two copies of several Radix packages. That is a
property of the mixed tree, not of the fix, and it is one more reason for Vercel to build
the lockfile.

## Guards added

1. `scripts/check-chunk-cycles.mjs` (`npm run check:chunk-cycles`, `:self-test`).
   - It parses static `import`/`export ... from "./x.js"` edges in `build/client/assets/*.js`
     with Tarjan's algorithm and fails (exit 1) on ANY static chunk cycle. vendor-* cycles
     are listed first.
   - Its floor is the build manifest: for every chunk the manifest lists, the parsed edges
     must equal the manifest's `imports`. Otherwise it exits 2. Chunks outside the manifest
     (`manifest-*.js`, the maplibre worker) are named on PASS.
   - Wiring: `perf-budget.yml` bundle-budget job (canary before the build, the check after
     the request count with `if: !cancelled()`), `scripts/pre-ship.mjs` CHECKS, and
     `prove-entry-point-dispatch.mjs` TARGETS.
   - **Red-first proof:**
     - Unfixed config + Tooltip 1.4 tree: exit 1, naming
       `vendor-ui-CYsQwwW5.js -> vendor-ui-modal-BOP06TXp.js: import{u as gs}from...` and the 15-name back-edge.
     - Fixed config: exit 0.
     - Parser mutant (STATIC_EDGE blind to `import{`/`import*`): exit 2, "parsed edges
       disagree with manifest". It is not a false PASS.
     - Self-test: 36 cases. Two mutants of the manifest cross-check (`extra = []`, and
       skipping an absent chunk) each red one case.
2. `tests/chunkClassifier.test.ts`:
   - focus-scope -> vendor-ui pin.
   - "never let a shell package depend on a modal package", a buildless early warning over
     the installed tree.
   - **Red-first:** both red (2 failed / 31) on the unfixed config with the Tooltip 1.4 tree;
     33/33 after the fix.
   - Named gaps: it checks direct deps only, top-level copies only, and not the react-use-*
     members.

## CI (run in the sandbox)

The per-job table is in the PR #746 body. Not run (need secrets, a live preview or prod
writes): db-contract-check, types-drift, lighthouse, doc-weight, seo/og/synthetic-ssr
against the preview, live-qa.

Sandbox quirk: `NODE_PATH=/usr/local/lib/node_modules_global` resolves a global TypeScript
and reds 5 cases in `tests/integrityCouldNotRun.test.ts`. They are green with `NODE_PATH`
unset, which is how a CI runner looks.

## Review

`/code-review` high, two rounds (stopping rule: user-facing fix, two rounds).
- Round 1: 10 findings. Findings 1-3 ("cause not shown", "contradicts the handover",
  "not measured into the shell") came from a reviewer who did not have the reproduction
  above. They are answered by it, and the KB cost is recorded here, as the file's rule asks.
  The other 7 were fixed.
- Round 2: 9 findings. All were fixed except the nested-copy gap in the classifier test,
  which is documented instead.
- **The round-2 fixes are unreviewed code** (no third round, per the stopping rule).

## NOT verified

- The #746 Vercel preview was NOT re-walked after this push. The sandbox proxy blocks
  vercel.app.
- The real Vercel dependency tree was not inspected. The Tooltip 1.4.1 + focus-scope 1.3.1
  tree is a reconstruction that matches the served shape (1 name out, 15 back), not a copy
  of it.
- Why Vercel does not build the lockfile is unknown (see OPEN above).
- SSR routes `/city/*`, `/dancers/<slug>` and `/event/*` were not walked in a browser.
- Phone sizes were not rendered signed-in.
