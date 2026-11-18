# Review: PR #1790 organiser Round 4 (flag organiserR4) at head b8ca2d154

One round, risky classes only. Colours/layout not reviewed (owner checks boards).

## Verdict: PASS WITH NITS

## Hard-tier: PASS

## Checks run
- `npx tsc --noEmit -p .` on the PR head tree: 0 errors.
- `npx vitest run src/modules/organiser/p3/r4 src/modules/organiser/p3/door`: 18 files, 612 tests passed.
- `npm run check:mojibake`: clean (2875 files).
- Diff vs origin/main: 47 files, no `supabase/migrations`, no env files, no secret-shaped strings.

## The five asked checks
1. **Flag off = no change.** `featureFlags.ts:113` adds `organiserR4` from `VITE_ENABLE_ORGANISER_R4 === 'true'` (default off). `P3Routes.tsx` `r4Live()` needs R4 + P3 + Dash; `v2 = !r4 && v2Live()`. With r4 false every ternary falls to the old element, `P3Shell` is unchanged, `DoorScreen r4={false}`. `CancelEventSheet` was refactored into `useCancelSend` with the same body (render identical). `RefundSheet` takes the R4 branch only inside `useR4Look()` (context default false). `TicketsEntry` new props are optional; `hidden={ordersOnly || undefined}` is a no-op without them. `DetailsScreen.useVenueCity` only gained `export`. PASS.
2. **New routes gated + guarded.** `eventAll`, `edit`, `raffle`, `team/door-invite` are registered only under `{r4 && ...}`; all sit inside the existing `<AuthGuard>` and the same shell and `WorkspaceGate`/`useEventChoice` as the old screens, so non-organisers get the same handling as before. Note `events/:seriesId/door` pre-exists behind `organiserTicketing`. PASS.
3. **Saves.** Edit night (`r4/R4EditNight.tsx:99`) reuses the Details plan/save/scope/kept-draft machinery; Save is disabled unless `form.dirty`, no blocker, no lock, not busy, and `plan.length > 0`, so an untouched record sends nothing; error shown from `save.error`. Cancel reuses `useCancelSend` (kept idempotency key), button disabled while busy, sheet `locked={busy}`. Refund reuses the same `go()`, confirm disabled while busy. Raffle open/close goes only via the existing `RaffleSheet`; R4Raffle itself writes nothing and is "Coming soon" unless `organiserRaffleLive`. Team add (`R4Team.tsx:90`) is a `useMutation` with `isPending` disabling the button and inputs, handles `team_full`. Door invite writes nothing (Copy button permanently disabled with a reason). PASS.
4. **Raw Unicode in JSX.** No raw punctuation in any `.tsx`. Nit N1 below for `.ts` model strings.
5. **Secrets/migrations.** None.

## DB contract
The PR adds no new rpc/table reads of its own; every read goes through existing helpers (`useRaffleNights`, `searchTeamPeople`, `addTeamMemberByProfile`, `fetchCancellationReasons`, `useVenueOptions`). No direct venue SQL, so the `COALESCE(co.venue_id, e.venue_id)` rule is not engaged. No legacy tables referenced.

## Nits (non-blocking)
- N1 `src/modules/organiser/p3/r4/r4NightModel.ts:64-65`, `r4TeamModel.ts:83`, `r4EditModel.ts:16`: raw `‘ ’ … £` in plain TS strings. Not JSX and `check:mojibake` passes; the rest of the module uses `\u` escapes, so prefer those for consistency.
- N2 `R4DoorInvite.tsx` uses inline `style={{...}}` for font size; move to `r4.css` when convenient.
- N3 `R4Team.tsx:140` guards the add with `!full` but the pending state is the only double-submit guard; fine given `disabled`, just noting there is no in-flight key (the RPC adds by profile, so a repeat is a server-side already-member case).

## Not verified
- No browser walk, no 390x844 check, no e2e (`walk-r4-shell.spec.ts` not run).
- No prod data shape survey and no Supabase reads; the RPC names were not checked against prod (only that they are existing helper calls).
- Did not read every line of R4Home/R4Tickets/R4Compare/R4Events or the CSS; money logic in `r4TicketsModel.ts` was judged via its passing matrix tests, not line by line.
- Server-side behaviour of cancel/refund/team RPCs not exercised.
- Did not run the full CI workflow set.
