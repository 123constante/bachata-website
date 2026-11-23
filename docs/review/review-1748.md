# Review: PR #1748 (organiser slice 1: V2 shell nav + technical fixes)

- Branch: `feat/organiser-slice1-nav`, head `3f315ff81` (3f315ff81b73e3edd0fa1c48e07511c71887e31b), against `main` at `fd2ec24`.
- Brief: `brief/review-1748:docs/briefs/review-1748.md`. One round only.
- Diff: 12 files, +252 / -58 (src/modules/organiser/p3/** plus two tests and a handover doc).

## Verdict: PASS WITH NITS

No blockers. Every point the brief names checks out (below). The nits can go in a later slice.

## Hard-tier: PASS

No secrets, no schema/RPC/ACL change, no money path change, no write path change. Flag-off render is unchanged
(see "Flag-off behaviour"). `returnTo` cannot open-redirect. No raw Unicode punctuation in JSX.

## What was checked

| Brief point | Result | Evidence |
|---|---|---|
| Pushed screens hide bottom tabs | OK | `V2Shell.tsx`: `pushed = isPushed(pathname)` gates the exit bar, top bar, `V2Strip` and the `p3-tabs` nav. `isPushed` = create, `/events/:id/organisers`, `/you/*`. Test `slice 1 nav fixes` covers `/create` and `/you/team` (no top bar, no Back, no strip, 0 tabs). |
| Switcher keeps name + status | OK | `EventSwitcher` options read `Name &middot; <hint>` when there are 2+ events (`switchHintOf`: Draft / Hidden / N coming / No dates coming); one event shows the name alone. `V2Strip` shows seat word + page name + `SwitchControl` (shared with the P3 strip, one component) whose link keeps `?o=<page>`. Tests assert both on all four tabs. |
| returnTo cannot open-redirect | OK | `EVENT_PATH` is unchanged: anchored `^/account/p3/events/<[A-Za-z0-9_-]{1,64}>(/[a-z]+)?/?$`, and the result is rebuilt with `P3_PATHS.event(id)`, never the raw input. The PR only changes the no-back label (`Go to Events` under V2). |
| Undated-draft copy | OK | `NightsTab` no-nights state: "Add a date to this event to use Guest list." / "...Raffle." with a link "Add or edit a night" to `P3_PATHS.eventDates(id)` (`data-testid v2-<tab>-add-night`). Test asserts text and button. `nightsOfChoice` now counts dated draft/hidden nights; table test covers draft with/without a date, hidden, live x2, cancelled, all past, no event. |
| Flag-off behaviour unchanged | OK | `P3Routes`: every V2 element sits behind `v2`; the off branch renders the same `HomeScreen`/`EventsScreen`/`P3ShellV1`; catch-all still goes to `P3_PATHS.home` when off (test). `homeWordOf()`/`homePathOf()` return `Home`/`/account/p3` with flags off (test), so OnboardingFlow, returnTo and GetPaid read exactly as before. The V2 modules are now lazy, so flag-off users stop downloading them. |
| No secrets | OK | Diff greps clean; no env, keys or tokens. |
| HTML entities in JSX | OK | Only non-ASCII in added lines is `&middot;`-equivalent `·` inside a vitest expectation string (test file, not JSX). The JSX uses the JS escape `·` in a template string. `npm run check:mojibake`: 2798 files, no corruption. |
| Tests meaningful | OK | Route tests drive the real `P3Routes` under MemoryRouter: strip per tab, router Back (asserts `fireEvent.click` was preventDefault-ed and the location moved), pushed screens, tab search filtering, unknown-URL fallback on/off, switcher labels. Unit tests for `tabSearchOf` and `nightsOfChoice` are table-driven. |

Back/exit links changed from `<a href="/">` to router `<Link to="/">`: `/` is a route in the same `AnimatedRoutes`
tree (`CityRedirect`), so this is an in-app navigation, not a broken link.

## Blockers

None.

## Nits

1. `inSuspense` uses `fallback={null}`: the first V2 load shows an empty frame for one chunk fetch. A small
   loading line (as `V2State` already has) would be friendlier on a slow phone.
2. The test mock of `lazyWithRetry` picks V2 modules by `String(loader).includes('/v2/')`. It works today but
   depends on how the transform prints the loader; a path rename would silently switch those tests to real
   lazy loading. A comment or an explicit list would make the intent harder to break.
3. `finishLabel` inlines `'Go to Events'` while `GO_TO_HOME` is an exported constant; `OnboardingFlow` line ~989
   compares `c.primary === GO_TO_HOME`. It still works (that compare is on the model's word, not the label), but
   a `GO_TO_EVENTS` constant would keep the two in one place.
4. `V2Strip` returns null while the event choice loads, so the strip pops in after the read (small layout shift).
5. With exactly one event the switcher shows the name only (no status). That is a defensible choice, but the brief
   says "name+status"; confirm with the owner.

## Verified on real data

- Shapes surveyed: not run in this review (no prod read needed to judge the diff); the PR's own table tests
  cover draft with/without a date, hidden, live with 2 dates, one cancelled, all past, no event.
- Checks run (on 3f315ff81, in a worktree): `npx vitest run src/modules/organiser/p3` 158 files, 7352 passed,
  2 skipped; `npx tsc --noEmit -p .` 0 errors; `npm run check:mojibake` clean.
- NOT verified: browser walk at 390x844 of the V2 shell (flags off on live, no preview with flags on was opened);
  the PR's CI job results were not read (no GitHub API from this worker).
