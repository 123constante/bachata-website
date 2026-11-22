# Editor v2 slice 12e handover (money-path fixes from the review of 12a-12d)

Files: `TicketsV2.tsx`, `PaySheets.tsx` (`busy` prop only), `__tests__/moneyFixes.test.tsx` (new, 11 tests). Flag `organiserEditorV2` stays OFF; no migration; no visual change.
Also touched (forced by the fixes, not in the brief's list): `__tests__/stripeSwitch.test.tsx`, `__tests__/paySheets.test.tsx` -- the `useSummary` mock gains `refetch`; the Switch sheet now opens after an async fresh read (`findByTestId`); the two return tests use the polling flow; the 12c "sell here" test seeds the paused-by-switch list.

## Fixes
1. Stripe return uses `useConnectReturn` (poll 3 s for 30 s). Warning only after polling ends not connected; clears (and "Stripe connected" toast) when `connected` turns true.
2. Return effect depends on `orgId`; `?stripe=` is deleted only once handled. `refresh` calls `onboard.go()`, never warns.
3. `change`: ticket types first, series write last; a throw or a failed series write rolls finished type moves back and shows the existing error toast.
4. Reopen scope: `sellHere` reopens only ids the switch paused. The list is kept in `sessionStorage` (`v2-paused-by-switch:<seriesId>`) so it survives a reload; with storage blocked it lives for the visit only. Undo restores each type's prior status (captured at click time) and skips a type whose status is neither the one we set nor the prior one.
5. Sold guard: payDoor / openLink re-read the sales summary while mode is `here`; not ok = toast "Not saved. Try again.", nothing acts, buttons stay enabled. The Switch sheet shows the fresh count.
6. `inFlight` ref in `change` (+ `checking` ref for the fresh read); `busy` disables and `aria-busy`s `door-done`, `link-done`, `how-door`, `how-link`, `switch-do`.
7. No Undo when `undoPlan` is null, or when nothing changed. A change with nothing to write now says its toast (before: silent no-op, because `saveNow([])` returns not-ok).

## Item 8 (checked, NOT changed)
- (a) Multi-org: onboarding and `useStripe` both use `organiserIds[0]`, so the return is consistent on this screen. `stripeBack(origin, organiserId, ...)` puts the organiser id in the return URL but TicketsV2 never reads it; if another entry point (Get paid for a second org) ever returns here, it must read it.
- (b) `TicketsView` first branch `!p.stripe` always shows the Connect button; the door/link footer is outside that ternary so it still renders below it for door/link mode with no Stripe. I did NOT compare against the prototype (checklist rows 88-97 are not in this checkout): owner to confirm. The Connect screen DOES flash while `stripe.state` is still null (loading), since `connected` is false then; fix would gate on `stripe.state !== null`.
- Known gap: a series with only hand-paused types and Sell here pressed reopens nothing (just the toast). Intended by brief item 4.

## Verified / Not verified
Verified: `npx vitest run src/modules/organiser/p3/v2`: 24 files, 304 pass. tsc run on this branch (`tsconfig.app.json`): 0 errors in files touched (project total 162 lines with `error TS`, pre-existing, not compared to baseline). `npm run check:mojibake` clean. eslint on touched source: 0 errors.
Not verified: new tests were NOT run against the unfixed code; 390x844 walk; pre-ship; /code-review; prod data-shape survey; real RPC (mocked); real Stripe round trip. No PR (per brief).
