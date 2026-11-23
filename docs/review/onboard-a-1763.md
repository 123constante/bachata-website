BLOCK

# Review: PR #1763 buyer onboarding slice A (flag OFF)

Reviewed head `3bfe74e2d042aeef642584e3a3159e6a446a8b7c` (`origin/claude/onboard-a`), merge-base `ddd2156`, read-only. Brief: `brief/review-onboard-a-1763:docs/briefs/review-onboard-a-1763.md`. Line numbers are at the reviewed head.

**What the verdict means.** With the flag OFF (the default) I found nothing that changes what a person sees or what is sent, so merging as-is harms nobody. The BLOCK is for H1 to H3: each one is a wrong outcome for a real buyer the moment `VITE_ENABLE_BUYER_ONBOARDING` is turned on, each is a small fix, and none is caught by the PR's tests. If the owner prefers to merge flag-OFF and fix in a follow-up, H1 to H3 must land before the flag is switched on.

## Must fix before the flag goes on

### H1. A valid ticket loses its QR and door code at midnight (high)
- `src/modules/tickets/ticketCardStatus.ts:28`, used at `src/modules/tickets/MyTicketsPage.tsx:50` and `src/modules/dancer-app/screens/tickets/TicketCard.tsx:59`.
- `passed` = `date < londonTodayKey()`, a plain calendar-day compare (`src/lib/londonDate.ts:202`, no late-night grace). A night that starts on the 16th and runs to 02:00 is "passed" at 00:00 on the 17th: the card is greyed, the QR is replaced by "This night has passed" and the door code is removed too (`code` is null when the QR is hidden). There is no "show anyway".
- Flag OFF today the same ticket only moves to the Past section with the QR collapsed; "Show QR code" still opens it. So flag ON takes away something a buyer can use at the door now: late arrival, re-entry, or a ticket bought at 23:50 that is shown on Home at 00:05 (the dancer card uses the order's `event_date`).
- Fix: keep the ticket valid until the night is really over. Use the same after-midnight rule the rest of the site uses (`src/lib/programDayRollover.ts`: 00:00 to 08:00 belongs to the day before), in the one mapping, and add matrix rows for "00:30 the morning after" (valid) and "09:00 the morning after" (passed). The tests today only cover "yesterday" as a date string, so they pass with the bug.

### H2. "Your ticket is under another email" is shown when it is not true (high)
- `src/modules/dancer-app/screens/tickets/useTicketCard.ts:73`, drawn at `TicketCard.tsx:39-41`.
- The code treats "paid order, QR read ok but empty" as "bought under another email". The live `my_ticket_order_qr_v1` (read on prod, read-only) returns empty in four more cases, all for the buyer's OWN order:
  1. `paid_at` is older than 2 hours. Home now keeps `?o=` in the address, so a refresh or a reopened tab the next day says the ticket is under another email.
  2. The order was refunded. `ticket_order_public_status_v1` reports a refunded order as `paid` on the order-id path, and the QR read only returns `status = 'paid'` orders. So a refunded order says "another email", not "This ticket was refunded" (review target 5).
  3. Tickets not issued yet (the existing comment on line 70 says so).
  4. A guest order (the handover already lists this one).
- Fix: do not state a cause the client cannot know. Either keep the existing neutral line ("Your tickets are in your email") until the RPC returns a reason, or show the note only when the server says the order belongs to another account. The handover's own "needs the RPC to say why it is empty" is the right fix; until then remove the claim.

### H3. "Not you?" ignores a failed sign-out (medium)
- `src/modules/tickets/TicketPickerB1.tsx:163-166`.
- `signOut()` returns `"failed"` when nothing was signed out (`src/hooks/useAuth.tsx:169-178`, `:222-227`). `notYou()` throws the result away and opens the empty email card regardless. The person is still signed in as the old account; if they close the card, the line still reads "Tickets go to {old email}" and Continue pays with it.
- Also no busy guard: `signOut` can take up to 3 s (server wait), and the button can be tapped again meanwhile, starting a second sign-out.
- Fix: `const outcome = await signOut(); if (outcome === 'failed') { show a plain line such as "We could not sign you out. Try again."; return; }`, and disable the button while it runs. Add a test row for `signOut` resolving `'failed'`.

## Nits (do not block)

- N1. Flag OFF is not byte-identical in one edge: `TicketPickerB1.tsx:78` changed `user?.email ?? verifiedEmail` to `user?.email || verifiedEmail`. For a signed-in user whose `email` is an empty string, main opens the email card even after a code was verified; the PR pays with the verified email. Arguably better, but it is a flag-OFF behaviour change. Fix: keep `??` or note it in the PR body.
- N2. Flag OFF adds a `data-ticket-status="valid"` attribute to `TicketCard.tsx:63` and `MyTicketsPage.tsx:56`. Not visible; mentioned only because the brief asks for identical.
- N3. No test proves the basket survives "Not you?" (`src/modules/tickets/__tests__/pickerNotYou.test.tsx:50-56` checks only that sign-out ran and the email box is empty). By reading it does survive: the basket is React state plus `bc.pickerBasket.*` in sessionStorage, which is not in `src/lib/personScopedStorage.ts`. Fix: add one assertion that a chosen quantity is still shown after the click.
- N4. No test for `MyTicketsPage` status rendering (`my-ticket-status`), for the Home to Tickets forward (`src/modules/dancer-app/shell/DancerAppRoutes.tsx:59-61`), or for the teaser Home order card (`src/modules/dancer-app/screens/teaser/TeaserScreens.tsx:72-81`). The handover admits the second. CLAUDE.md asks for every screen x every shape.
- N5. `ensureProfile.matrix.test.ts:33` "archived retired stub: created silently" does not match the server: the live function returns `created: false` whenever a `dancer_profiles` row with that id exists, so an archived row is not healed and the person still gets "Message us". The fake models that shape as "no row". Fix: make the fake return `created: false` for it and expect `no_profile`, or confirm with admin that an archived stub has no row.
- N6. `TeaserScreens.tsx:72` uses `has('o')`; `useTicketCard` requires a valid order id. A malformed `?o=x` shows the "no order" card on top of Home. Fix: use the same `isOrderId` test.
- N7. `src/modules/tickets/myTicketsModel.ts:153` still says "Older tickets are still valid." next to cards that now say "This night has passed". Reword when the flag goes on.
- N8. `scripts/dancer-area-isolation-allowlist.json:11-17`: the 7 new seams sit above the existing list, not in path order. Cosmetic.
- N9. `TicketThanksPage.tsx:15-16`: an `import` after `const` declarations. Works (imports hoist); move it up with the others.

## What I checked, by review target

1. **Silent create.** One call site only: `src/modules/dancer-app/api/rpc.ts:220-235`, reached from three queries (`DancerAppShell.tsx:73`, `useMyDancerEdit.ts:57`, `useProfileSides.ts:50`; the last is enabled only when a dancer profile already exists). Flag OFF throws the original error before any new code. Any create failure rethrows the ORIGINAL `no_profile`, so the "Message us" card is the fallback. It is never on the sign-in or payment path (`TicketPickerB1` and checkout do not import it). No retry storm: the three queries share one key (deduped), the app default is `retry: 1` (`src/App.tsx:51`), so worst case is 2 x (read, create, read); the server limit of 5 a day applies only to real inserts and an existing row returns before it. Live function read on prod: `SECURITY DEFINER`, `search_path` pinned, execute granted to `authenticated` only, insert is `ON CONFLICT DO NOTHING` (safe for two tabs). OK.
2. **Flag OFF identical.** Read every hunk in `TicketPickerB1`, `TicketThanksPage`, `MyTicketsPage`, `TicketCard`, `TeaserScreens`, `useTicketCard`, `DancerAppRoutes`, `rpc.ts`. All new branches are behind the flag. Exceptions: N1 and N2.
3. **"Not you?".** Basket kept (see N3); the person lands on the email + code card and can go back to the picker, so not stranded on success. Failure path: H3.
4. **Lands on Home; poll.** `TicketThanksPage.tsx:49` to `/app/home?o=`; teaser people get the card on Home, everyone else is forwarded to `/app/tickets?o=` (same place as flag OFF), including when the profile read failed (`teaserState` = off). The poll is the existing `useOrderStatus`: at most 8 repeats (2, 4, 8 s then 15 s), then "processing"; stops on unmount. It cannot loop forever. A paid order is not hidden, but its reason line can be wrong: H2.
5. **Status mapping.** All four statuses covered, precedence refunded > cancelled > passed, QR and door code hidden for all three, tests assert the mapping and the dancer card. Problems: H1 (passed fires too early), H2 (a refunded order never reaches the mapping today), N4 (`MyTicketsPage` untested). As the handover says, refunded and cancelled cannot fire from live data until the admin RPCs send them.
6. **Allowlist.** Exactly the 7 files in the diff added, one `seamNotes` entry, no prefix or rule widened. `node scripts/check-dancer-area-isolation.mjs` on the PR head: OK (rules a+b+c).
7. **Copy.** British English; no new weekday strings; no raw Unicode punctuation in the new JSX (the new strings are plain ASCII); "Not you?" tap target is `min-h-[44px]` in px. OK.

## Checks run

- `npx vitest run` on the three new test files at the PR head: 3 files, 37 tests, all pass.
- `node scripts/check-dancer-area-isolation.mjs` at the PR head: exit 0.
- Prod, read-only SELECT of function definitions only (no rows, no personal data, no write): `ensure_my_dancer_profile_v1`, `my_ticket_order_qr_v1`, `ticket_order_public_status_v1`.

## Not verified

- No browser walk at 390x844, flag ON or OFF (review by reading and unit tests only).
- Full unit suite, e2e, lint chain, `tsc` on the PR branch: not run (brief: low RAM, targeted only).
- Whether ticket sales can still be open after midnight for a night in progress (decides how often H1's "bought then instantly passed" case happens; the late-arrival case does not depend on it).
- What `my_dancer_edit_v1` returns for a view-only person or an archived profile (N5 rests on the `ensure` function's text, not on a live call).
- That the query cache clear on sign-out does not empty the picker for a moment on a real phone (N3 is by reading).
- PR #1763's CI status and PR body were not inspected.

## Handover (review worker, ticket dt_9bd567aa10ac)

- Done: this verdict. Review PR: #1765 (docs only, branch `claude/review-onboard-a-1763`). PR #1763's branch was not touched.
- Left / next steps: the author of #1763 fixes H1 to H3 (or the owner accepts a flag-OFF merge with the three fixes as a follow-up before the flag goes on), then a 390x844 walk with the flag ON.
- tsc: not run. This branch holds one `.md` file and no source files, so there are no branch files for tsc to check.
