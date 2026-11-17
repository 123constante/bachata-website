# Review: organiser V3 PR #1733 (head 64318a52cb6f9441c7ca154adad873a64868a801)

## Verdict: PASS WITH NITS

## Hard-tier: PASS

Review only: no product code changed, nothing run (static read of `git diff origin/main...64318a5`, docs/design shots ignored).

## Checks

| Check | Result | Evidence |
|---|---|---|
| F1 zero pages -> Welcome | PASS | `V2Tabs.tsx:69-76` `useNoPageRedirect`; used by `V2Home` (`:79-86`) and `V2EventsTab` (`:91-93`). Tests: zero pages x2 in `V2Shell.routes.test.tsx`. |
| F1 no redirect loop | PASS | `/start` is a sibling route outside `P3Shell` (`P3Routes.tsx:99`, own frame), so it never renders `V2Home`/`V2EventsTab`. `isError` falls through to Events (no bounce on a failed read). |
| F1 claim just landed waits | PASS | `V2Tabs.tsx:74` `confirmation && home.isFetching` -> loading, same rule as `HomeScreen.tsx:71`. Test "a claim that just landed waits" covers it. |
| F2 location.state forwarded | PASS | `V2Home` `<Navigate ... state={state}>` (`V2Tabs.tsx:85`); `search` kept. Test asserts confirmation shows on Events. |
| F2 HomeNotices shared | PASS | Exported `HomeNotices`/`confirmationOf` (`HomeScreen.tsx:27,34`); `HomeScreen.tsx:80` now uses it, no copy. Markup identical to before. |
| Flag-off Home unchanged | PASS | `HomeScreen` output identical (pure extraction); `P3Routes.tsx:103` still `v2 ? <V2Home/> : <HomeScreen/>`. Old inline `V2Home` removed (V2-only). |
| Door link | PASS | `V2Tabs.tsx:186` gated on `flags.organiserTicketing`, `style={TAP}` (`minHeight:44`, `:18`), `P3_PATHS.eventDoor(id)` = `events/:seriesId/door` (`paths.ts:52`); route exists only when the same flag is on (`P3Routes.tsx:101`), so no dead link. Walk asserts height >= 44. |
| Flag read by name | PASS | Only `flags.organiserTicketing` / `flags.organiserGuestListLive`; no whole-object read added. |
| No edit under p3/tickets or p3/door | PASS | Diff touches only `screens/HomeScreen.tsx`, `shell/P3Routes.tsx`, `v2/V2Tabs.tsx`, tests, walk, handover, e2e coverage map. |
| No `organiser_raffle_night_set_v1` call | PASS | Only a guard route in the walk (`walk-v2-shell.spec.ts:69`); unit tests never mention it; owner walk asserts `sent()` false (`:110`). |
| Contributor cannot open/close raffle | PASS | `raffleModel.ts:176-181` `gate()` disables open/close unless `canEdit && n.canSet`; `RaffleSheet.tsx:93` `disabled={!g.enabled}`. Mock contributor seat returns `can_edit:false`, `can_set:false`. |
| Flag-off parity | PASS | New code only reachable via `v2Live()`; `NightsTab` `extra` is optional and unused by Raffle. |

## Findings (nits, none blocking)

1. **N-a, test gap, `tests/e2e/walk-v2-shell.spec.ts` contributor test (~`:111-118`).** It only takes a screenshot; it asserts neither the "View only" note (`raffle-viewonly`) nor that `raffle-button` is disabled, and never checks `sent()`. The handover/comment "fails the walk if called" is only true for the owner test (`:110`). The behaviour is correct (see `raffleModel.ts:176`); the test would not catch a regression. Suggest asserting `raffle-button` disabled and `sent()` false in the contributor and guests tests.
2. **N-b, `V2Tabs.tsx:186`, Door link shown to every seat, including a contributor.** The author flags this as a deliberate default; #1729 gives contributors Door check-in, and Door keeps its own refusal. Acceptable, but a seat with no Door access gets a link that ends in a refusal screen. Owner decision.
3. **N-c, `V2Tabs.tsx:91-93`, Back from Welcome.** For a zero-page user, Welcome's back target is `toHome` = Events in V2 (`P3Routes.tsx:65`), and Events redirects straight back to `/start` (replace). Not a render loop, but Back from Welcome cannot leave the area in-app. Flag-off Home behaves the same, so parity, not a regression.
4. **N-d, `V2Tabs.tsx:93`, the Events-tab redirect drops `state`.** `<Navigate to={r.to} replace />` carries no `state`, unlike `V2Home`. Harmless today (Welcome ignores the confirmation) and the loading branch is not used on this tab, so a claim landing directly on `/events` while refetching can bounce to Welcome on a stale answer (`useNoPageRedirect` returns `loading` but `V2EventsTab` only reads `r.to`). Low risk since claim/create land on the bare URL, but `r.loading` is ignored here: worth rendering the loading state for symmetry.
5. **N-e, `V2Tabs.tsx:186`, one 400-char line.** Pre-existing style, but the new `extra=` inline makes it hard to review; split for readability.
6. **N-f, handover "Not verified".** No prod-shape survey or prod-data browser walk (CLAUDE.md definition of done, items 1 and 4); raffle/guest RPC shapes are hand mocks. Disclosed honestly by the author. Flag stays default OFF, so exposure is nil until flipped; do the real-data walk before turning it on.

## Not verified by this review

Tests, lint, `pre-ship` and the walk were not run; findings come from reading the diff and the surrounding source at the PR head.
