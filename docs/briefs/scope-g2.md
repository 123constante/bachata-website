# Scope G2: page-size budget without the extra chunk (read-only docs job) - ticket scope-g2

Repo 123constante/bachata-website. Docs only: write ONE file `docs/scoping/g2-page-size-budget.md` on branch `claude/scope-g2-budget`, push, stop. No src, no perf-budgets.json, no vite config edits. End the last commit message with `[worker-done scope-g2]`.

## Background
PR #1162 (F4 label fix) made accountRouting.ts import P3_START_PATH from auth-otp-routing, which folded three chunks away and let the owner tighten nine chunk pins and six first-load request pins by one (dancer-app by two). It broke phone-qa on main, so PR #1179 moved P3_START_PATH into the import-free leaf `src/lib/p3StartPath.ts`; the folded chunk returned, so #1179 raised the pins back (dancer-app 49, the other eight +1, six first-load +1). Each extra chunk is one more edge request on every view of those pages and the account is metered on request COUNT.

## Question
How do we get the pins back down WITHOUT re-breaking phone-qa? Find which chunk the leaf adds on each of the nine budgeted routes (diff the largest-chunks and chunk lists of a clean build on main before #1162 `1dc1660^`... vs main now), and propose the smallest change that folds it back (for example pin the leaf into an existing chunk in the manual chunk lists in vite.config.ts / vite.chunks.ts, or import it from a module already in the first load). State for each option: which pins it tightens, byte and chunk effect, risk to the vendor-ui / vendor-ui-modal measured lists, and how to prove it (`npm run build` + `npm run check:bundle-budget` + `npm run check:first-load-requests` with the placeholder VITE_SUPABASE_* env from the perf-budget workflow).

## Rules
Measure, do not guess; quote the numbers. Read-only on prod. Recommend ONE option and say what you could not measure. One round, no code.
