# Design record: P3-GATE, the A1 "A few details first" sheet

Source spec: `docs/plans/onboarding-arc.md` Appendix A, screen **A1** (and its "States for every screen"
paragraph). Scope: `docs/scoping/organiser-remaining.md` (branch `claude/audit-organiser-remaining`), Q3 row
"A1 gate screen", dead end **D8**, slice 4. Brief: `brief/p3-gate-screen`.

## What was wrong (D8)

When the server gate (`_require_onboarding_complete_v1`, flag `organiser_onboarding_gate`, OFF on prod) refuses
an event write, P3 showed the copy "Finish your details first, then you can add or change your events." as a
save error, with no control that goes there: copy pointing at a missing control. `isOnboardingRefusal` had no
caller outside tests.

## What was built

| A1 element (plan) | Built | Matches / does not and why |
|---|---|---|
| Trigger: an `onboarding_incomplete` refusal | `p3/onboarding/gate.ts` `useGatedCopy()`: every P3 write catch calls it; a refusal opens the gate and leaves NO error line; anything else keeps its words. It opens only while the refused screen is still mounted, tags the ask with that screen's path (GateHost drops an ask for another screen), and does nothing when no GateHost is listening (the person left the P3 frame) | Matches. Wired in EditTray (Details, Prices), CancelEventSheet, Toast Undo, StatusSheet, DateSheet, SessionSheet, RepeatSheet (save, and the dry-run preview at most once per sheet). `data/sessions.ts` `useDateSend` passes the refusal up as itself (it used to re-word it before any screen could see it). |
| Trigger: "any create/edit entry" while status says incomplete | **Not built** | The gate flag is OFF and the prod survey found 0 complete people: an entry gate would hold every organiser today. Needs `gate_on` from the status read; see the handover. |
| Mounted as | A sheet (`Sheet.tsx`, the C3 bottom sheet) drawn by `GateHost` in `P3Shell` over the refused screen | Brief: a sheet, so `P3Routes.tsx` / `paths.ts` / `surface.tsx` stay untouched. The sheet code is lazy (`lazyWithRetry`): nothing loads until a refusal. |
| Title "A few details first" | Same | Matches. |
| Body "We ask everyone who runs a page. It takes about five minutes and you only do it once." | Same | Matches. |
| List of the missing groups | "N things left" + one row per missing code | The count is graceModel's ONE count (`onboardingLeft`, with the codes behind it now exposed as `onboardingMissing`), the row words are Review's ONE mapping (`pageModel.reviewRow`). One row per code, not a coarser "group": a second grouping table would be a second mapping. |
| "Continue" | Link to `p3StartReview(page)` = `/account/p3/start?o=<page>&at=review` | Same target as Home's grace banner Continue. The page is the one the server named in the refusal's DETAIL (`organiser_id`), else graceModel's pick. When that page is not one of the person's (not in the status read): Continue goes to their own details (`/account/p3/you/details`) if any of theirs are missing, else it is off with the reason "These details are for a page you don&rsquo;t run, so its team finishes them." Never a page they cannot edit. |
| "Not now" (back to where they came from) | Closes the sheet; the refused screen and its typing stay | Matches. Leaving the screen (Back, a tab) also closes it. |
| States: loading | One muted row "Checking what&rsquo;s left&hellip;" in the list's place | Skeleton-like, no layout jump of the buttons (they are in a sticky foot). |
| States: read failed | "We couldn&rsquo;t load your details. Try again." + Try again button; Continue still offered (to the page the server named) | Matches the plan's read-failed copy. |
| States: admin | Never shown (closes itself) | Plan: "admin (never routed here)". The server never refuses an admin anyway. |
| States: status says nothing left | Never "finished" for a refused write (review fix round): the refusal's own DETAIL codes are listed instead | The status read lags or the page is not the person's. With no codes anywhere, the read-failed state with Try again shows. |

## Layout and tokens

Existing P3 tokens only. New CSS (three rules, `theme/p3.css`): `.p3-gate-go` (the Continue link drawn as the
44px primary button), `.p3-gate-row` (compact, non-tappable rows: 6px padding, 14px text), and its divider. The
buttons sit in the existing sticky `.p3-sheet-foot`, so ten rows (the prod maximum: survey 2026-10-30 found
2-10 codes missing per person and page) never push Continue or Not now out of view. Focus goes to the sheet's
first button with `focus({ preventScroll: true })` (Sheet.tsx), so opening it never scrolls the page. Sheets now
stack: only the topmost answers Escape, and each has its own title id (`useId`), so the gate over the Status sheet is
named "A few details first".

Geometry is pinned by `tests/e2e/p3-gate-sheet.spec.ts` (in `test:e2e`, no flag needed): the REAL GateHost,
GateSheet, Sheet and p3.css, mounted by `tests/e2e/harness/gateHarness.tsx` inside the dev server, signed in on the
organiser fake; 390x844, flowing clock, light and dark, 1 and 10 rows; sheet, Continue and Not now inside the
viewport, page not scrolled by opening, focus in the sheet with `preventScroll: true`, its accessible name, no
sideways scroll, no clipped text, every tap at least 44x44. Proven by mutation: dropping `preventScroll` turns all 4
red, as does dropping the focus call. Part 2 walks the real app (P3 flag on) on the organiser fake.

## Bundle

Zero bytes on the `/app` first load: 380,762 B before (origin/main 21364be) and 380,759 B after (gzip, exact,
the budget script's own measure); every route's first load is within 3 B of before (hash noise). The gate store
rides in the P3 shell chunk; the sheet is its own lazy chunk.
