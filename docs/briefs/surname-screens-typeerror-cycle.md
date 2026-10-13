# Brief: "TypeError: le is not a function" on the #746 Vercel preview = vendor-ui <-> vendor-ui-modal import cycle (Website)

Repo 123constante/bachata-website. Push ONLY on `claude/surname-screens` (PR #746, head 4cca649); you are the only worker on it. Never merge, never --no-verify, push once. Read `docs/briefs/surname-screens-typeerror-handover.md` on that branch first (the previous worker could NOT reproduce locally).

## CI rule (owner decision 2026-10-13)
GitHub minutes are capped: push ONCE, no empty trigger commits. Run every CI job step (read .github/workflows) in your sandbox; put a per-job table (command, exit code) in the PR body and the handover. Nobody runs anything on the owner's PC.

## Reproduced and diagnosed by the orchestrator (read the served chunks in the owner's Chrome, 2026-10-13 ~21:00 UK)
The error IS real on the #746 preview (bachata-website-93ekzig2o), in a clean Playwright browser and in the owner's Chrome. Absent on production and on the #743 preview. The previous worker's local build is clean, and its local chunk hashes (vendor-ui-DhDEy8r5, vendor-ui-modal-Afd33XxC) are NOT what Vercel serves for main (vendor-ui-5wf4BrKz, vendor-ui-modal-DI8a6Sr0), so a local build is NOT the same output as the Vercel build. Compare against the Vercel output, not a local main.

Served #746 chunks (vendor-ui-DCvdHbop.js, vendor-ui-modal-B-AOb8sN.js):
- `vendor-ui` begins with `import ... from "./vendor-ui-modal-B-AOb8sN.js"` (it imports `useFocusScopeBranch`, exported as `At as u`, which radix Tooltip content calls) AND `vendor-ui-modal` imports 15 names back from `vendor-ui`. That is a static import CYCLE between the two chunks.
- `le` in vendor-ui is the esbuild keepNames helper `__name` (`var Ao=Object.defineProperty, le=(e,t)=>Ao(e,"name",{value:t,configurable:!0})`) at byte ~2031. In a cycle where vendor-ui-modal evaluates first and calls a hoisted function declaration of vendor-ui (e.g. createContext helpers `Do`/`Je`) at top level, that function calls `le` while the `var le` is still undefined -> "le is not a function". Evaluation order depends on which chunk the entry loads first, so the cycle is latent and #746 (which changes what the shell reaches) flipped the order.
- `vite.chunks.ts` assigns radix packages by id needle: VENDOR_UI_SHELL_NEEDLES -> `vendor-ui`, VENDOR_UI_MODAL_NEEDLES -> `vendor-ui-modal`. The Tooltip is in the shell list and `@radix-ui/react-focus-scope` is in the modal list, so shell -> modal and modal -> shell edges both exist.

## Task
1. Reproduce the cycle in YOUR sandbox: build as Vercel does (read vercel.json, the Vercel build command/env; try `VERCEL=1`, the same node version, `npm ci`), then write a script that parses the static `import ... from "./x.js"` / `export ... from` edges between `build/client/assets/*.js` and reports cycles. Run it on the unfixed branch (must be RED if you can reproduce the Vercel output; if your build still has no cycle, say so honestly, then fix anyway by item 2 and check the guard on a synthetic cycle), and on main.
2. Fix at the cause: remove the cross-chunk cycle in `vite.chunks.ts` (for example put `@radix-ui/react-focus-scope` and whatever the shell Tooltip/other shell packages import from it into the shell list, or otherwise make the dependency one-directional). The lists have a documented disjointness rule and perf budgets (`perf-budgets.json`): measure the first-load KB before/after, keep ratchets green, and do not move weight onto the homepage without recording it. Do not touch the surname feature code; do not drop keepNames.
3. Add a permanent guard (a script wired into an existing CI step, or a vitest over a fixture build) that fails when two `vendor-*` chunks import each other, with a documented message. Prove it red on the unfixed config first.
4. Run all CI job steps in your sandbox, push once, update the PR body (`## Verified on real data` exact heading with `- Shapes surveyed:`, `- Checks run:`, `- NOT verified:`; NOT verified must say the Vercel preview was not re-walked). Leave `docs/briefs/surname-screens-typeerror-cycle-handover.md`.

## Output
New head SHA, the cause in one sentence, per-job table, red-first proof of the guard, honest Verified / Not verified. Stop after the push.
