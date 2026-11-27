# Brief P89: Get paid honours `?returnTo=` (Website, UI fix)

Brief-version: 2
Size: 2 files, 200 lines. Design: none (one existing-pattern back link on an existing screen; no new screen).
Branch: `claude/p89-getpaid-returnto`. One PR. No switch (bug fix: the link already promises a way back).

## What main lacks
- GetPaid.tsx on origin/main has 0 uses of returnTo: GetPaidBody never reads ?returnTo= and has no way back to the event. -- grep: tix-getpaid-back-to
- GetPaidBody calls useStartOnboarding(org.id) with no 3rd arg, so Stripe drops returnTo on the round trip. -- grep: getPaidReturnTo

Go live's "Set up payouts to sell paid tickets" row (code `ticket_payouts`, `src/modules/organiser/shared/goLiveCheck.ts`, added in #2509) links to
`withReturnTo(P3_TICKET_PATHS.getPaid(), ORG_PATHS.event(seriesId))` = `/account/p3/you/get-paid?returnTo=%2Faccount%2Fo%2Fevents%2F<id>`.
That route renders `GetPaidScreen` -> `GetPaidContent` -> `GetPaidBody` in `src/modules/organiser/p3/tickets/GetPaid.tsx`, which never reads `returnTo`.
The organiser finishes Stripe, lands back on Get paid, and has no way back to the event they were putting live.

## Files
- src/modules/organiser/p3/tickets/GetPaid.tsx (edit; GetPaidBody near line 129 only)
- src/modules/organiser/p3/tickets/__tests__/getPaidReturnTo.matrix.test.tsx (new)
- INVENTORY.md (new, worker notes; not shipped code)

## What to build
0. Write INVENTORY.md first: every field, state and option from the admin app, the current Website and the public page, each with file:line. Build only after it exists, and report the coverage count (inventory items covered / total) at the end. Scope here: every state of GetPaidBody in GetPaid.tsx (Stripe none/started/waiting/connected, owner/non-owner, switchedOff, busy, note, stripe=return/refresh) and every returnTo shape below.
Smallest fix, in GetPaid.tsx only, the `you/get-paid` screen; leave `GetPaidStart` alone:
1. Read the sanitised returnTo once: `readReturnTo(location.search)` from `src/modules/organiser/flows/doneState.ts` (already rejects external, `//` and Done). Use the same `params` the screen already has.
2. Keep it across the Stripe round trip: pass a 3rd arg to `useStartOnboarding(org.id, undefined, X)` where X = `withReturnTo(P3_TICKET_PATHS.getPaid(org.id), back)` when back is set, else undefined (unchanged). `P3_TICKET_PATHS.stripeBack` then sends Stripe back to Get paid WITH `returnTo` and `stripe=return|refresh`, so the existing connect-return polling still runs on this screen. The existing effect that deletes `stripe` from the URL must keep `returnTo` (it does: it copies params).
3. Draw a way back when back is set: a `<Link>` to `back`, label `backToEventLabel(null)` ("Back to your event") when `returnToSeriesId(back)` is non-null, else `GO_BACK_LABEL`. When `state === 'connected'` it is the primary button (same classes as the screen's primary action); otherwise a text link (`p3-link`) under the screen title. Tap target min 44 px height in explicit px (html font-size trap). `data-testid="tix-getpaid-back-to"`.
4. Without a returnTo, or with an unsafe one (`https://evil.test`, `//evil.test`, `/account/o/done`), the screen is byte-for-byte unchanged and onboarding URLs are unchanged.

Use HTML entities in JSX, never raw Unicode punctuation. No new copy beyond the two existing label helpers.

## Tests (new file `src/modules/organiser/p3/tickets/__tests__/getPaidReturnTo.matrix.test.tsx`, table-driven, follow getPaid.matrix.test.tsx mocks)
- returnTo = event path x Stripe state (none, started, waiting, connected): back link present, href = event path, primary only when connected.
- returnTo = `/account/o/go-live?series=S1`: label "Back to your event". returnTo = `/account/p3/you`: label "Go back".
- Unsafe returnTo (3 cases above) and no returnTo: no back link; `startOnboarding` called with the old two URLs.
- With returnTo, tapping Connect: `startOnboarding` return/refresh URLs both contain `/you/get-paid?o=` AND `returnTo=<encoded event path>` AND `stripe=return` / `stripe=refresh`.
- Arrival with `?returnTo=..&stripe=return`: after the effect, URL still has returnTo, not stripe.
Run the new tests against the unfixed code first and say they fail.

## Prod shape
Organisers on Get paid: none/started/waiting/connected Stripe states and owner vs non-owner roles all exist (see getPaid.matrix.test.tsx shapes). Non-owner: back link still shows (it is navigation only).

## Done
- Every CI job step that applies (read .github/workflows; at least test:unit for the touched folder, typecheck, lint chain) run, results in the PR body.
- PR body from the repo template, "Verified on real data" block filled, honest "Not verified" (no phone walk).
- Handover in PR body: head SHA, checks per job.
