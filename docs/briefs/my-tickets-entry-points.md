# my-tickets-entry-points (Website, BUILD-visual, small; re-verified 2026-11-04 against main 2b8831448 and PR #1334 head 5d026d15)

Brief-version: 2
Lane: Website, normal. Model: Sonnet, medium. Branch: `claude/my-tickets-entry-points`.
Serves: scope-queue-1 item 3 (docs/briefs/scope-queue-1.md). **Dispatch only after `my-tickets-screen` (#1334) is MERGED**: it adds the route `/account/my-tickets`, `MY_TICKETS_PATH`, the `myTickets` breadcrumb. Do not run in parallel with it. **Also run BEFORE the thank-you QR slice** (brief `my-ticket-order-qr-web`, when written): both edit `TicketThanksPage.tsx`; one after the other, never stacked.

Context line: stay under 50% of your context; early checkpoint push, push + handover by 50%. Never approve/merge/--no-verify. Plain git only. Supabase READ-ONLY (you will not need it). No migration. Never ends a turn on a background task. Source files over 2 KB go through scripts/safe-edit.py / safe-write.py (read the hook message). Hard limits are at the end.

## What main lacks (proofs; main has NO My tickets route until #1334 merges, so these are read on #1334's head 5d026d15 -- re-check on main after the merge)
- No link to My tickets on the paid thank-you page. The breadcrumb label "Your tickets" is `ticketsThanks: { label: 'Your tickets' }` (`src/lib/breadcrumbs/siteIa.ts:81`, a label only). The paid copy says "Confirmed. Your tickets are in your email." (`thanksCopy`, `ticketCheckoutModel.ts:336-352`) and nothing points at a control. -- extends: src/modules/tickets/TicketThanksPage.tsx
- `thanksCopy` returns only `{title, body}`; a link cannot live there. The page already has `useAuth()` (`const { user, authStatus, retryAuth } = useAuth();`, line 197) and `buildSignInHref`, so the signed-in test needs no new import. -- extends: src/modules/tickets/TicketThanksPage.tsx
- No tickets row on the signed-in dancer account page. `src/pages/Account.tsx` renders `DancerHome`, whose `<nav aria-label="Your nights" className="grid grid-cols-2 ...">` holds two cards (`dancer-home-attendance`, `dancer-home-parties`) at `src/components/account/DancerHome.tsx:281-292`. `Account` is `lazyWithRetry` (AnimatedRoutes.tsx:69) and has NO row in `perf-budgets.json`, so it is NOT on the app shell's first-load path (the older text of this brief said it was; that is wrong). -- extends: src/components/account/DancerHome.tsx
- There is NO existing DancerHome test file (`git ls-tree` finds no `DancerHome*.test`); only `signOutEntryPoints.test.tsx` imports its `SignOut` export. The test for the new row is a NEW file. -- extends: src/components/account/__tests__/ (new file)
- The My tickets path constant lives in the tickets module: `MY_TICKETS_PATH = '/account/my-tickets'` in `src/modules/tickets/myTicketsModel.ts:11`. The account-side path constants live in `src/lib/accountRouting.ts` (`MY_ATTENDANCE_PATH`, line 52). `DancerHome` must not import the tickets module (it would drag it into the Account chunk with the flag off). -- extends: src/lib/accountRouting.ts
- The failed state keeps its homepage link. The event id is not returned by `ticket_order_public_status_v1` (re-read on prod 2026-11-04: keys are only `status, ticket_count, event_title, event_date`); returning it is an admin change, not in this brief, do not work around it. -- extends: src/modules/tickets/TicketThanksPage.tsx (no change)

## Files
- `src/modules/tickets/TicketThanksPage.tsx` (the paid + signed-in link only)
- `src/lib/accountRouting.ts` (one exported literal for the dancer account side, see below)
- `src/components/account/DancerHome.tsx` (one row)
- tests: `src/modules/tickets/__tests__/orderStatus.test.tsx` (extend; it already has `TicketThanksPage reads the order`), `src/modules/tickets/__tests__/flagOff.test.ts` (extend), NEW `src/components/account/__tests__/DancerHome.ticketsRow.test.tsx`
- `docs/handovers/my-tickets-entry-points.md`
- Do NOT touch `src/components/EventCalendar.tsx` or other density-exempt files, `thanksCopy`, or any copy that exists today.

Nothing else. No route, no API, no package, no migration.

## What to build (tests first, red on main-after-#1334; say so)
1. Thank-you page: when the state is `paid` AND `user` is signed in (the existing `useAuth` result), show one link "See your tickets" to `MY_TICKETS_PATH` (import it from `../myTicketsModel`: the page is already in the tickets module and `myTicketsModel` is pure; it must NOT import `qr.ts`, flagOff pins that). Tap target `min-h-[44px]` explicit px. Signed out: no link, existing sign-in copy stays. Pending, processing, failed, unknown order, no order: no link.
2. `accountRouting.ts`: `export const MY_TICKETS_ACCOUNT_PATH = '/account/my-tickets';` and a test (in the new DancerHome test file) asserting it equals `MY_TICKETS_PATH` from the tickets model, so the two cannot drift.
3. DancerHome: one card, `data-testid="dancer-home-tickets"`, same card style and `min-h-[44px]` as its neighbours, label "My tickets", sub-line "Your tickets and door codes" (no new copy beyond these two strings), linking to `MY_TICKETS_ACCOUNT_PATH`. Rendered in the nav as a full-width row under the two cards (`col-span-2`), only when `flags.publicTicketing` AND not loading AND `completion.status !== 'signed_out'`. Flag off: the nav renders exactly today's two cards.
4. `flagOff.test.ts`: add that `DancerHome.tsx` does not import `modules/tickets` (`git grep`, as the file already does for other importers), and that `TicketThanksPage.tsx` imports the model only (not `qr`).

## Tests red first
Table, thank-you: order state (paid, pending, processing, failed, unknown order, no order) x viewer (signed in, signed out) -> only paid + signed in has the link (red on main for that cell). Table, DancerHome: flag (on, off) x state (loading, signed out, no profile, incomplete profile, complete profile, organiser-only account) -> row only on flag on and not loading and not signed out; flag off renders exactly the two cards today renders. Equality test for the two path constants.

## Run before you push (read `.github/workflows`; say the result of each)
`npx vitest run src/modules/tickets src/components/account`, `npx tsc --noEmit`, the lint chain steps that apply (`npm run lint`), `npm run check:bundle-budget` after `npm run build` (the Account chunk has no row: say it is not budgeted, and report the Account chunk size before and after if you can). Per-job table in the handover.

## Phone QA (the orchestrator walks it; the worker does not need a browser)
390x844 and 320x568: thank-you paid (signed in and out), pending, failed; the account page row. Tap target 44px. Shapes: dancer with and without a dancer profile, organiser-only account.

## Hard limits specific to this brief
No change outside the Files. No new dependency. Flag `publicTicketing` OFF on prod: flag off changes nothing, proved by the tables above. No new copy except "See your tickets", "My tickets", "Your tickets and door codes". Do not pass or log a token (this slice never touches one).

## Done when
New cells red-then-green, tests, tsc and lint green, one push, handover with Verified / Not verified (Not verified: a real purchase redirect from Stripe; a real phone). Then: orchestrator walk, pack, owner Approve/merge per the normal lane.
