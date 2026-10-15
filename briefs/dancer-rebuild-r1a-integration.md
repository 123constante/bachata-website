# Brief: R1a INTEGRATION (Website, branch claude/dancer-app-r1a)

Read first: `briefs/dancer-rebuild-COMMON.md`, `briefs/dancer-rebuild-INTERFACE.md` (incl. "Round-2 additions"),
`briefs/dancer-rebuild-W2-SHARED.md` (all on branch `arc/briefs-dancer-rebuild`, read with `git show`), then the
handovers on r1a: `docs/handover/dancer-rebuild-w1.md`, `-w2a.md`, `-w2c.md`, `-w2d.md`, and on their own branches
`arc/dancer-app-w2b` and `arc/dancer-app-w2e` (`docs/handover/dancer-rebuild-w2b.md`, `-w2e.md`).

## State you start from
`claude/dancer-app-r1a` @ df43188620be = main + R0 + W1(+finish) + W2a + W2c + W2d(+photo-delete fix), merged
server-side by the orchestrator. NOT yet merged (GitHub reported conflicts): `arc/dancer-app-w2b` @ 0a435d7e and
`arc/dancer-app-w2e` @ ed2dfa22.

## Tasks, in order (commit + push after each numbered step; it is your checkpoint)
1. `git merge origin/arc/dancer-app-w2b` then `git merge origin/arc/dancer-app-w2e` on r1a. Expected conflicts:
   `package.json` `test:e2e` spec list (keep the UNION of every slice's specs), shared shell files. Resolve keeping
   every slice's behaviour; say each resolution in the handover.
2. Duplicates: W2a and W2b each wrote a local `useMyDancerEdit`; delete both, use W1's (same query key
   `['my-dancer-edit', userId]`). W2b asks: mount `CityProvider` in `renderInShell`.
3. Base reds (red on r1a before you, owned by you now): `tests/client/dancerAppApi.test.tsx` (`fetchGate`, 1 test);
   `tests/regression/today/reminderBanner.today.test.ts` (R0 snapshot vs W1's `/app` banner seam, 2 tests). Fix the
   code or the snapshot, whichever is WRONG; say why. Also `scripts/check-dancer-area-isolation.mjs` flags
   `docs/session-handover-2026-10-15-dancer-w1.md`: move it to `docs/handover/` (or allow-list it, with reason).
   Pre-ship eslint reds in `shell/renderInShell.tsx` + 2 regression tests: fix.
4. Perf (owner decision already made): raise the `dancer-app` chunk-count / KB rows in `perf-budgets.json` with a
   one-line justification ONLY IF you prove the EVENT route's first-load BYTES grow by <= 0.5 KB gz vs main (measure
   main and r1a with the same command, quote both). If they grow more: lazy-load the level-rating children so the
   event route no longer pulls them, and fix the gate manifest; then re-measure.
5. Sandbox Playwright session fake: W1's reachability spec passed in W1's sandbox but failed in W2b/W2e. Make the
   fake sign-in deterministic so EVERY dancer-app spec (onboarding, home/nights, me/edit, photo, options) runs green.
6. Run EVERY CI job step yourself (read `.github/workflows/*.yml`), plus `npm run build` (production build, not dev),
   the R0 isolation check, every dancer-app e2e spec. Red-first: for any test you add or change, show it red on the
   unfixed code. Table each job: command, exit code, counts.
7. 390x844 screenshots of each screen (welcome/onboarding, home, nights, me, edit, photo, options) x shapes (new stub,
   partial, complete+extras, long name / long city, no photo, legacy foreign photo URL) into
   `docs/review-pack/r1a/*.png` + `measurements.md` (scrollWidth, every control >= 44px, elementFromPoint at the
   primary button). Label them MOCKED RPCs.
8. Handover `docs/handover/dancer-rebuild-r1a.md`: done / per-job table / Verified / Not verified / open owner
   questions (W2a+W2e: no Terms/Privacy pages exist; consent line is text-only, row disabled with reason).

## Boundaries
- Only this branch. Never open a PR, never merge to main, never approve. Plain git only (never `gh api`).
- Shell commands without variables, loops or `$(...)` where a plain command works.
- Supabase read-only. GitHub Actions may be refused by billing ("payments have failed"): that is not a code failure;
  your sandbox per-job table is the evidence.
- Context: at 25% start nothing new; by 30% push + handover with last commit subject ending
  `PARTIAL [worker-done <ticket>]`. Otherwise the final push carries `[worker-done <ticket>]`. Stop after that push.
