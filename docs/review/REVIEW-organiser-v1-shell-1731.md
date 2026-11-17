# Review: organiser V1 shell PR #1731 (head 49b4de5)

Read-only code review from the diff. No browser or CI run by me (30 CI checks and the 10/10 walk were taken as given).

## Verdict: PASS WITH NITS

## Hard-tier: PASS

Safe to merge with `organiserShellV2` OFF. Two flag-ON regressions (F1, F2) must be fixed or accepted before the flag is turned on.

## Focus 1 - flag-OFF parity: PASS
- `P3Routes.tsx`: `P3Shell()` returns `<P3ShellV1 />` when `v2Live()` is false, so the same shell and layout route. `index` is `HomeScreen`, `events` is `EventsScreen`, and the `{v2 && <Route/>}` children evaluate to `false`. React Router skips non-elements, and the file already used this pattern.
- `toHome` returns `{P3_PATHS.home, 'Home'}` when the flag is off, which matches main.
- The wrapper `P3Shell` is a stable module-level component, so there is no remount churn.

## Focus 3 - money, auth, RLS: PASS
- No change to `AuthGuard`, the routes' guards, any RPC or any SQL.
- `TicketsEntry`, `GuestListSheet`, `RaffleSheet` and `AccountEntry` are reused unchanged.

## Focus 4 - bundle and flags: PASS
- `v2Live` reads `flags.organiserShellV2`, `flags.organiserP3` and `flags.organiserDash` by name. `shellV2On` takes a `Pick`, never the whole `flags` object.
- `V2Tabs` reads `flags.organiserGuestListLive` and `flags.organiserRaffleLive` by name.
- The `ticketBookingFee.ts` chunk pin has a matching test update.

## Focus 2 - routing under flag ON: findings
**F1 (should fix before flag ON): a new organiser with no page no longer reaches Welcome.**
- On main, `HomeScreen.tsx` (about line 57): `organisers.length === 0` leads to `<Navigate to={P3_PATHS.start} replace />`.
- With V2, `index` is `V2Home`, which redirects to `/events`. `V2EventsTab` renders `EventsScreen`, which shows `NoPageCard` (`scope.noPage`).
- Failing case: a signed-in user with zero organiser pages opens the organiser area. Today they land on Welcome (find, claim or create). With V2 they land on a card.
- The tabs' Gate also offers "Find or create a page", so this is recoverable, but it is a different first-run path.
- Fix: make `V2Home` or the V2 shell redirect to `P3_PATHS.start` when `home.data.organisers.length === 0`.

**F2 (should fix before flag ON): claim and create confirmations and notices are lost.**
- `HomeScreen` shows `location.state.confirmation`, `ClaimNotice` and `GraceBanner`. `V2Home` redirects with `<Navigate ... replace />`, passes only the query string and drops `location.state`.
- `EventsScreen` renders none of the three.
- Failing case: after a claim or create, onboarding navigates to `P3_PATHS.home` with `{state:{confirmation}}` (see `paths.ts:90` and `OnboardingFlow.tsx:142`). V2 shows no confirmation. Claimed-at-sign-in pages get no `ClaimNotice` or `GraceBanner`, so the person is never told which pages were attached.
- Fix: forward `state` in `V2Home`, and render `ClaimNotice` and `GraceBanner` in `V2EventsTab`.

**N1 (nit): `?e=` is dropped on pushed pages.** Tab links carry `search`, but event-page links (`P3_PATHS.event(...)`) carry no `?e=`. After opening an event and coming back through `toEvents`, the choice comes from sessionStorage if the person picked one explicitly. Otherwise it falls back to the computed default. Harmless, but a shared `?e=` link does not survive a round trip.

**N2 (nit): the sessionStorage key `p3v2-event` is not scoped to the page.** An id from another page is ignored because `resolveEventId` checks `rows`, so there is no wrong-event case.

**Checked and fine:**
- `V2Home` keeps `?o=` and `?e=`.
- `*` still redirects to `P3_PATHS.home`, which now redirects to Events.
- `tickets`, `guests` and `raffle` do not collide with `events/:seriesId`.
- `v2TabOf` maps anything non-tab to Events.
- The `eventChoice` default and tie-break are deterministic.
- sessionStorage access is try/catch-wrapped.
- The back link is a full-page `<a href="/">`, which is intended.

## Not verified
Nothing was run (no tsc, tests or browser); this is a read of the diff against main.
