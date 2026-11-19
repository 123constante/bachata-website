# Review: PR #1799 (claude/home-polish @ aaf3d6f)

Reviewer worker, read-only static review of `git diff origin/main...origin/claude/home-polish`
(17 files, +1028/-22). No browser walk, no vitest, no tsc was run (see Not verified).

## Verdict: PASS WITH NITS

## Hard-tier: PASS

No migrations, no `*.sql`, no new network writes, no secrets (the three Stripe URLs are public
Payment Links), no density-excluded file touched (EventCalendar, calendar/*, useCalendarEvents,
ui/dialog.tsx all absent from the diff).

## Checks, in brief order
1. Flag OFF = main: PASS. `flags.homePolish` is `VITE_ENABLE_HOME_POLISH === 'true'`, default OFF.
   AppChrome, GlobalHeader, HomeMapCard, HomeMapShell, AllEventsList, controls, cards all branch on it.
   Badge sizes and the Tonight/Today label are module-level flag reads, OFF gives the old values.
   One exception, see N1.
2. Flag ON vs registry row: PASS. Chip row, Today tab, menu sheet with search, map option 3, no
   BottomNav. `/djs` and `/cities` are routes in AnimatedRoutes. `/festivals` is a framework route
   (app/routes/festivals.tsx) and is already linked with `<Link to="/festivals">` elsewhere. Festivals
   opens the Festivals hub, not "a filtered Fest list" as the registry text says (N5).
3. Correctness: PASS with nits. Nearest restore only when permissions.query says granted, effect is
   cancelled on unmount. Cancel calls `geo.clear()` and `onNearest(false)`, generation guard drops a
   late fix. 0-tonight chip reads "Nothing on tonight in X". Sheet closes on pathname change. Search
   uses the existing debounced `usePublicSearch`, and the "Searching" state covers the debounce.
4. Phone: PASS with nits. Sizes are explicit px. Chips are 32px with a 6px `before:` hit area inside
   the row's 6px padding, so 44px and not clipped by `overflow-x-auto`. Chip row scrolls inside itself.
5. Hygiene: PASS with one nit (N4).

## Nits (none blocks)
- N1 `src/hooks/useGeolocation.ts:60-133`: the generation guard runs with the flag OFF too, so flag OFF
  is not byte-identical to main. Failure scenario: none found, `clear()` only cancels a pending request.
  Fix: none needed, but say so in the PR body as a deliberate flag-off bug fix.
- N2 `src/components/GlobalHeader.tsx` (flag branches): with the flag ON the desktop nav links, search
  and Sign in are removed at md+ as well as on phones. The registry row says "phone header". Failure
  scenario: desktop reader sees only logo + burger. Fix: scope the removal to `md:hidden` or confirm
  with the owner that desktop follows.
- N3 `src/modules/home-polish/HomeChipRow.tsx` (Cancel button, `h-[24px]`): below the 44px tap rule
  that the rest of the row meets. Failure scenario: mis-tap on a phone while locating. Fix: add the
  same `before:` hit-area box, or `h-[44px]` outside the chip.
- N4 `HomeChipRow.tsx:~61` `'Still looking…' : 'Finding you…'`: raw U+2026 in a JSX string. Entities
  cannot go in a JS string, so use `…` to keep it mojibake-proof. Run `npm run check:mojibake`.
- N5 `menuModel.ts:47` Festivals goes to `/festivals`, registry says a filtered Fest list.
  Confirm intent with the owner.
- N6 `MenuSheet.tsx:onKeyDown`: Escape is handled on the panel only, so it does nothing if focus is on
  `body` (for example after tapping blank space). Fix: also listen on `document` while open.
- N7 Handover lists the location spec as not built (shared provider, 30-min expiry, "~" distances).
  Accepted as a follow-up, not a defect of this PR. `far-from-you` only sees loaded rows.

## Not verified
- No `npx tsc`, vitest, `npm run lint`, `check:mojibake`, or 390x844 browser walk was run by this
  reviewer. The handover says pre-ship did not finish and the tsc baseline differs (106 vs 139 on main).
- No real-data shape survey (CLAUDE.md DoD); RATE_US_URL (`g.page/r/...`) and the Stripe links were not opened.
- Owner phone test with the flag ON is still outstanding.
