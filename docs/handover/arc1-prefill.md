# Arc 1 integration: prefill wiring (`claude/arc1-prefill`)

Ticket dt_c74b85163fdc. Branch made from `origin/claude/arc1-pr3-claim` (dancer4 + ten + claim),
then `origin/claude/arc1-pr2-redeem` and `origin/main` merged in (main was already contained).

## Done
- **Merge conflict** `src/lib/auth-otp-routing.ts` (+ its test): flow 9b sign-in error copy. Took
  PR2-redeem's shorter words (each under 80 characters, test asserts it); its `manual` line had
  already auto-merged the same way.
- **One prefill store**: `src/lib/invitePrefill.ts`. `dancer4/prefillStore.ts` is deleted;
  `FinishProfile` (both the gated Dancer4Flow path and the plain form) and `Dancer4Flow` use it.
- **Bound link**: redeem already runs on the invite page with no `DancerProfileGate` (Join press,
  M57), then lands on `/account/o/welcome`, whose gate sends an incomplete profile to
  `/finish-profile`. The prefill is now stored ONLY when the preview says the link is bound
  (`email_hint` present), tagged with the redeeming user's id, and read by `FinishProfile`, so
  `planDancer4` skips name and city and saves them with the first answer.
- **Unbound link**: the gate comes first; anything a redeem carries is dropped (store cleared).
- **User change**: `readInvitePrefill(userId)` returns null and clears the store when the stored
  user id differs; sign-out already clears `invite_prefill_v1` (`personScopedStorage`).
- **Tests**: `src/modules/admin-organisers/__tests__/invitePrefillJourney.test.tsx`, link type x
  session state x user change, through the real page, gate and Finish screen. Red first on the
  unfixed code (6 of 9 failed). `inviteReasons.test.tsx` updated: read takes the user id, and a
  `/account/o/welcome` route (the claim slice moved Join's landing there; its two prefill tests
  could not find `landed` after the merge).

## Left / next
- Prod has no bound invites yet and `organiser_invites` has no prefill columns (admin PR 1,
  migration 20261129950000, not applied on prod as of 2026-10-21), so the bound path is verified
  on mocks only.
- `docs/handover/arc1-pr3-dancer4.md` still describes `prefillStore.ts`; this file supersedes it.
- No browser walk at 390x844 was done (no visual change: same screens, fewer questions).

## Checks run locally (this branch head)
- `npm run build`: pass. `npm run lint` (CI's `chmod +x bin/*.sh` applied): 20 of 20 links green.
- `npm run test:unit`: all pass except 15 that need the live DB or this sandbox
  (`*.contract.test.ts` x3 files; `tests/integrityCouldNotRun.test.ts`, which fails identically
  without this change).
- `npm run test:e2e`: 150 passed; the failures re-run alone pass except
  `organiser-home.spec.ts:55` (load failure + Retry), which fails identically without this change.
- A read with no user id (auth still resolving) returns nothing and keeps the store; only a known
  different user clears it (test added, red before that line).

## CI follow-up (build-smoke)
- `public-journeys.build.spec.ts` row `team-invite-existing-dancer` (M53) expected Join to land on
  `/account/o`; the claim slice (1d/7c) lands on `/account/o/welcome?o=<page>`. The journey row, its
  routing-model walk and its END screen (`org-page-welcome`) now say so. The full build suite
  (`playwright.build.config.ts`) passes locally: 66 of 66. The prose end text in
  `docs/account-system/JOURNEY-GRID.md` / `journey-grid.json` and the public-journeys MATRIX still
  say "`/account/o` Home"; `check:journey-grid` passes either way, so they were not changed here.

## Conflict merge (after #927-#930 squash-merged; #933 head 071e60d9)

Merged `origin/claude/arc1-pr3-claim` (071e60d9) into `claude/arc1-prefill`, then `origin/main` (already contained: "Already up to date").
Conflicted files, all resolved to the #941 side (it is a strict superset of the same prefill work: per-user store, bound-link-only, fix pass 2 cards):
- `src/lib/invitePrefill.ts` (add/add): kept #941 (`rememberInvitePrefill(p, userId)`, `readInvitePrefill(userId)`, `clearInvitePrefill`).
- `src/modules/admin-organisers/InviteRedeemPage.tsx`: kept #941 (bound-link card, already-on-team card, clear on failed redeem).
- `src/modules/admin-organisers/inviteModel.ts`: kept `parseInvitePrefill` (#941 name); no remaining `parsePrefill` references.
- `src/modules/admin-organisers/__tests__/inviteModel.test.ts`, `inviteReasons.test.tsx` (add/add): kept #941 tests.
- `src/pages/FinishProfile.tsx`: kept #941 (`useMemo` per-user read, edits overlay).
Go-live files, `auth-otp-routing`, `whichPageModel.ts` came in cleanly from #933/main untouched.

Commands: `npm run typecheck` 100 TS errors (baseline 106, no new); `vitest run src/modules/organiser src/modules/admin-organisers src/lib src/pages` 246 files / 6232 tests passed (exit 0); `npm run build` exit 0; `playwright tests/e2e/organiser-onboarding.spec.ts` 11 passed (a first run under load showed 3 failures that passed on re-run, and on the #933 head).
Not verified: `tests/e2e-build/public-journeys.build.spec.ts`, browser walk, CI on GitHub.
