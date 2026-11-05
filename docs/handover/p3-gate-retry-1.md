# Handover: p3-gate-retry-1 (F-13 b)

Branch `claude/p3-gate-retry-1` (from main 8c60541). Brief: `brief/p3-gate-retry-1:docs/briefs/p3-gate-retry-1.md`.

## Done
- Step 0: `docs/design/p3-gate-retry-1/INVENTORY.md` (21 rows, data-source proof, coverage count).
- **One count.** `useEditLock` (EditTray.tsx) is now ONLY the ended/archived lock. Details and Prices no longer
  read `my_profile_progress_v1`; their lock box lost the "Complete your profile" link. No "answers left" anywhere
  in `src/modules/organiser/p3` (grep: only a history comment). The count a person sees is the gate sheet's
  "N things left" (`organiser_onboarding_status_v1`).
- **Open screens, gate at Save.** `useSaveRun` returns `gated` when the refusal was `onboarding_incomplete`
  (still ONE `useGatedCopy`). Details / Prices then keep the typing (`keptDraft.ts`, widened to
  `details` / `prices`, stored with the base they opened with). The checklist's "Back to your event" lands on the
  event page, which forwards (replace) to that screen; `useKeptEdit` lays only the person's own changes over the
  event as it is now, shows "We kept your changes", drops the copy. Nothing replayed. A closed event restores
  nothing; Prices rows the team has locked stay stored.
- Tests: new `p3/screens/__tests__/gateRetry.matrix.test.tsx` (46 rows). Red first on main: 10 rows failed
  (P1 / P3a x gate on/off x 2 screens = locked up front; P8 gate-on x 2 = typing not kept). Superseded lock
  assertions rewritten in `w3a.r3.test.tsx` and `seriesGallery.matrix.test.tsx`; `keptEdit.matrix.test.tsx`
  type-narrowed only.
- Review: one independent round (1 medium, 3 low). Fixed #1 (stale snapshot over a teammate's save), #2 (locked
  rows), #3 (closed event). Not fixed: #4 (a draft is kept on an onboarding refusal even when no GateHost
  listens: harmless, read only with KEPT_BACK_STATE, 60-minute expiry).

## Coverage P x J x S
P1, P2, P3a, P3b, P4, P8 x gate on/off x Details/Prices = 24 cells, each walking J1, J2/J3, J4 (refused rows),
J5 (refused rows); P5 / P6 x 2 x 2 = 8 cells (Not yours, nothing sent); P7 ended/archived x 2 = 4; counts
10/6/3/1/0, status failed/slow = 8 model rows; review rows 2. "Cannot happen": J4/J5 for any person the server
passes (P2, P3b, P4, gate off) - asserted as "saved, no sheet, nothing kept" instead. J6 (create, organisers,
tickets, Repeat): not rebuilt; covered by the existing suites (`gate.matrix`, `keptEdit.matrix`,
`pageScreens.matrix`, tickets tests), all green in this run (organiser + areas: 10,292 passed).

## Not done / Not verified
- **Browser walk at 390x844: NOT done** (owner context cap). Next worker: reuse
  `tests/e2e/walk-fix-gate-lost-edit.spec.ts` pattern for Details and Prices (refuse -> sheet -> Continue ->
  Back to your event -> typing kept), and gate-off / admin open screens.
- Bundle: branch /app first load 372.4 KB (budget 374 KB, all budgets green). Main NOT built for the
  byte-for-byte comparison; the reviewer confirmed every touched module is in a lazy P3 chunk.
- Admin repo not inspected (not attached).
- Prod gate flag is ON today (the brief said off): with it on, an unfinished person is now refused at Save
  instead of locked at open; if it is turned off they can save Details / Prices (the old lock was client-only).
- `.claude/hooks/pre-write-block.sh` did not intercept edits in this cloud session; `check:integrity` is green.
