# Fix brief F-INT-fix -- ONE fix pass on PR #809 from the two whole-diff reviews

Repo `123constante/bachata-website`. Work on `claude/org-r1-integrate` ITSELF (head 8dffd70c; both reviewers are finished, you are the only worker on it). Opus. ONE push at the end (plus a PARTIAL push if cut short; a continuation worker is normal, so write `docs/organiser-rebuild/handovers/FIX-INT.md` with done / left / next steps before any stop). Read first: `git fetch origin claude/org-r1-review-INTA claude/org-r1-review-INTB arc/briefs-organiser-r1`, then `git show origin/claude/org-r1-review-INTA:docs/organiser-rebuild/reviews/REVIEW-INT-A.md` and the same for `-INTB` / `REVIEW-INT-B.md`; also `briefs/00-COMMON.md`. Plain git only, never `gh api`; shell commands without variables, loops or `$(...)`; check a PRODUCTION build (`npm run build`). Context: at 25% start nothing new, by 30% push PARTIAL. Last commit subject ends `[worker-done <ticket>]`. CI rule: GitHub Actions billing is intermittent; run EVERY CI job step you can in your sandbox (read `.github/workflows`) and put a per-job table (command, exit code) in FIX-INT.md and the commit body; say what a sandbox cannot run.

## Method (binding)
For every item that is a behaviour or copy rule: write the test FIRST, run it against the UNFIXED code and paste the red, then fix and paste the green. Add each to `consistency.matrix.test.tsx` / `consistency.render.matrix.test.tsx` where it is a cross-screen fact. One shared mapping per fact, never two copies. Do not touch the density-exempt calendar files, `src/components/ui/dialog.tsx`, or add migrations.

## Owner decisions already made (do not reopen)
- Edit-in-place pencils on /page (Edit city, year started, category: `edit-in-place/parts.tsx:35`, now 32x44) become 44x44 ON /page. Remove the width exemption in `tests/e2e/organiser-tap-targets.spec.ts` so width is checked too. If the component is shared with the public page, take the size from a prop or the `.org-theme` scope so the public page does not change.

## Orchestrator decisions (log each in FIX-INT.md "Decisions"; the owner can overrule)
1. Managers can add people (match `ROLE_EXPLAINER`); this ships only with admin A1b, already a recorded ship blocker. Also record admin A1 (browse RPC `organiser_team_browse_people_v1`, missing on prod) as a ship blocker; no code change for it.
2. Say "page", never "organiser", in team copy (INT-B S-10); keep onboarding "organiser" wording (N-11) unchanged.
3. A cancelled-only event outranks "Needs a cover" on My events (INT-B N-9).
4. Dates use full weekday and month names everywhere through ONE formatter in `shared/` (INT-B S-1).
5. Remove the review clause from every role explainer (no review step exists).
6. Do NOT fix (list under "Queued" in FIX-INT.md): INT-A S8 (admin `p_expected_version`), INT-A NOTE-2 (main's date page write rules), INT-B N-3 footer, N-7 wording drift except "Press Resume" -> "Tap Resume". N-10: verify only; if it really shows a UUID, fix; else note.

## Work list
**BLOCKING**
- A-B1 / B-B2 (same defect): `tests/e2e-build/public-journeys.build.spec.ts:40,42,43` wait for `home-dates`; point to an R1 Home testid (`org-page-home` / `home-job`). Re-check M35's hops (`/finish-profile`, `/app/welcome`). Also trace the 4th red `auth-consent.build.spec.ts:63` (INT-A did not): run it on `origin/main` and on the branch; fix if ours, say so if base-identical. Run `npx playwright test --config playwright.build.config.ts` and paste the count.
- A-B2: access refusal. In `events/OneEvent.tsx`, `events/Details.tsx`, `flows/fix/CoverFlow.tsx`, `flows/cancel/Confirm.tsx` (and any other workspace reader screen: grep) branch on `isAccessRefusal` and show the no-access copy with NO retry; one matrix row per screen.
- B-B1 / A-S3 / B-S2: delete `LIFECYCLE_CHIP` (`jobs/homeJobs.ts:61`); `seriesChip` uses `lifecycleTag(...).label` from `shared/eventState.ts`. Replace the inline literals ("Live" `page/index.tsx:84`, `switch/index.tsx:69`; "Draft" `flows/add/WhichEvent.tsx:37`; "Cancelled" `events/EditorRows.tsx:87`) with the shared mapping. Table-driven test over EVERY lifecycle_status value (live, draft, paused, ended, archived, pending_review, rejected): My events chip == One event chip == date page word.

**SHOULD**
- A-S1: "Put back" in `events/DatesTakenOff.tsx` goes through `useEventSend` / `useFlowSend` (key in a ref, conflict -> `EventConflict`); CONFLICTS row; retry test asserts the SAME key is reused.
- A-S2: one conflict view: delete the copies at `flows/add/parts.tsx:72` and `flows/change/parts.tsx:83`, use `EventConflict` (testId prop if needed).
- A-S4 + B-N1: one owner_only string and one role-help string in `shared/selfServeErrors.ts`, used by `team/teamErrors.ts`, `edit-in-place/teamPickerModel.ts`, `team/Person.tsx`. Kill "Make owner" at `selfServeErrors.ts:243` and `teamPickerModel.ts:159` (use: "add them as a Manager, then open their name and tap Hand the page over"). Make the matrix scan ERROR COPY (strings in `shared/*.ts`), not only rendered screens, for "Make owner" and "for review". `src/modules/admin-organisers/inviteModel.ts:224` has the same string (pre-existing): fix it too and update its pin.
- A-S5 / B-S10: remove the review clause (decision 5); "page" wording (decision 2); managers add people.
- A-S6: add the 12 missing routes to `shell/__tests__/routes.test.tsx` with their testids; drop the duplicate `/account/o/done`.
- A-S9: pin the past-date test by file count or list, or a looser stem, so a reworded copy fails it; prove with a mutant.
- B-S1: full weekday + month formatter in `shared/`, used by `homeModel.ts:59-60`, `eventModel.ts:267,281`, `dateCap.ts:156`, `eventState.ts:63`, `teamModel.ts:153`, `ui/londonDate.ts:20`; align `dateList.ts dayLabel`. Test: one date reads identically on Home, My events, One event, Details, Team.
- B-S3: "Leave this team" links -> "Leave this page".
- B-S4: a page with NO series at all: Change, Cancel and Add show "No events yet" + New event; keep "No coming dates" only for events with no future dates.
- B-S5: `team/AddSomeone.tsx` (a) empty-after-filter shows the "No one found" state; (b) Retry button (`search.refetch()`) and `role="alert"` on the error line.
- B-S6: One event `MonthDots`: weekday header row plus an sr-only state per marked date.
- B-S7: My events row title `line-clamp-2` instead of `truncate` (and the Home job title at `home/index.tsx:44`); check at 390 that rows stay compact.
- B-S8: focus: pass `returnFocusRef` at each SheetView call site (EditorSheet, DateSheet, OrganiserSheet, SignOutSheet); `team/Person.tsx:88` confirm becomes `role="group"` with focus moved in and back; leave-guard in `EditInPlaceLayer.tsx` gets `trapTab` and refocus on Stay.
- B-S9: `ui/Field.tsx` note gets a real `id`; DateSheet input gets `aria-invalid` + `aria-describedby`.
- B-S11: removed-session grey chip uses `--fg` on faded rows.

**NOTE (small, do them)**
- A-N1: `flows/new/useNewSend.ts:8` and `flows/fix/CoverFlow.tsx:57` import the shared `isVersionConflict`.
- A-N3: New-event name step keys its idempotency key by name+format.
- A-N7: fix the S6/S7 seam copy; "Add them back" should open the add flow for THAT person if cheap, else list under Queued.
- A-N8: `EventList.tsx` and `home/index.tsx` pass `?o=` when the person has more than one page, or correct the `NewFlow.tsx:76` comment; unknown `?o=` falls back to the first page (keep) with a matrix row.
- B-N6: `motion-reduce:animate-none` on the shared spinners.
- B-N8: the 10 raw Unicode punctuation hits in TS strings -> `\u` escapes (find them with `LC_ALL=C.UTF-8 grep -rnP '[\x{2014}\x{2026}\x{2018}\x{2019}\x{201C}\x{201D}]' src/modules/organiser`) and run `npm run check:mojibake`.
- B-N7: "Press Resume" -> "Tap Resume" only.
- B-N9: decision 3.
- Dead files (A-N6): delete `events/EditorGroup.tsx` and `home/StaleLink.tsx` (+ its test) if truly unimported; keep `shell/placeholders.tsx`.

## Done =
FIX-INT.md with: red-first table (item, red message, green), decisions, Queued list, per-job CI table, Verified / Not verified. Every item above is either done with a test or listed under Queued with a reason.
