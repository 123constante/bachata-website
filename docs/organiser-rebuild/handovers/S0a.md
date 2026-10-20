# Handover -- S0a shell (organiser R1)

Branch `claude/org-r1-shell`, cut from `main` at `ecc3432` (#775 on main). Ticket `dt_0dbb617a4925`.
Brief: `arc/briefs-organiser-r1:docs/organiser-rebuild/briefs/S0a-shell.md` (sha 81e63df).

## Done

- **`shell/paths.ts` v2** -- `ORG_BASE = '/account/o'` and the full 4.1/D44 table:
  `home, switch, change, changeEvent(s), changeDate(s,o), changeTime|changeVenue|changeDay(s,o),
  add, addEvent(s), addDate(s,date), cancel, cancelEvent(s), cancelDate(s,o), newWhat,
  newName(format) (= /new/name?format=one_off|recurring), newVenue|newDate|newTime|newCover(s),
  events, event(s), eventDetails(s), team, teamAdd, teamPerson(userId), handover, handoverTo(userId),
  page, more, cover(s), done`. Every id through `encodeURIComponent`.
- **`shell/OrganiserRoutes.tsx`** -- every R1 route mounted. main's screens stay live on the new
  paths: Home `/`, events list `/events`, event editor `/events/:s`, NewEventPage `/new/what`,
  DatePage `/change/:s/:o`, Team `/team`, Profile `/page`. Every other R1 route is a
  `lazyWithRetry(() => import('./placeholders'))` per route group (one comment per line names the
  slice that swaps the import target). main's own URLs redirect (replace) to their R1 path:
  `/events/new -> /new/what`, `/events/:s/dates/:o -> /change/:s/:o`, `/profile -> /page`.
- **Account gate** -- `useAccountGate().status`: `complete` -> the area; `incomplete` ->
  `Navigate replace` to `finishProfileHref(path+search+hash)`; `loading` -> the skeleton
  (`org-route-loading`); `deleted` -> nothing; `signed-out` -> nothing inside, `AuthGuard` (still
  the outer wrapper) sends it to sign-in. `DancerProfileGate` is no longer imported by the module.
  Kept: `AuthGuard` + `useNoindexMeta`, `PrefetchOrganiserHome`, one lazy chunk per folder.
- **No tabs (D32)** -- `TabBar.tsx`, `tabs.ts` deleted; `hideTabs` gone; the shell renders
  header / content / optional action bar and nothing below. Two-column `list/detail/detailPlaceholder` kept.
- **`shell/legacyPaths.ts`** -- `legacyAccountPath('new')` now lands on `/new/what` (the other
  targets were already new paths); new `moduleLegacyPath()` for the three module redirects.
  **`shell/LegacyRedirect.tsx`** -- adds `ModuleLegacyRedirect`. **`shell/placeholders.tsx`** --
  one component, renders the route name (`data-testid="org-placeholder" data-route=<name>`).
- **Tests** (`shell/__tests__/`): `gate.matrix.test.tsx`, `routes.test.tsx`, `legacy.test.tsx`,
  `paths.test.ts`, `noTabs.test.ts`, `noHandBuiltLinks.test.ts` (+ `sourceScan.ts` helper).
  They replace `src/modules/organiser/__tests__/shell.test.tsx` and `legacyRedirect.test.tsx`
  (deleted: they tested these shell files and pinned the tab bar).

## Deviations (decide in review)

1. **Three deprecated aliases kept in `ORG_PATHS`**: `newEvent`, `date(s,o)`, `profile`, on main's
   URLs. Removing them breaks typecheck in files outside my row (`home/index.tsx`, `events/*`,
   `dates/index.tsx`, `edit-in-place/parts.tsx`) and 30 href assertions in their tests. Pointing
   them at main's URLs (which now redirect, replace, to the R1 path) keeps every outside file and
   test untouched. Each goes when its last caller's slice lands (S1, S2, S4, S5, S7) -- the
   `paths.test.ts` snapshot lists them under a "Deprecated" comment, so removing one is a
   one-line test change.
2. **`noHandBuiltLinks` known list**: `home/onboarding/EmailCode.tsx` (default `returnTo = '/account/o'`,
   S9's file) is on main. It is listed in `KNOWN` inside the test; a second test fails when a listed
   file no longer has a hit, so the list only shrinks. Test files (`__tests__/`, `*.test.tsx`) are
   excluded (they assert URLs, they do not build links); `.ts` is scanned as well as `.tsx`.
3. **One file outside the row**: `tests/regression/today/__snapshots__/account.today.test.tsx.snap`,
   regenerated with `-u`. The diff is removal-only: 10 x the `navigation "Organiser"` block with its
   four tab links (Home / Events / Team / Profile) -- exactly D32. Nothing else changed in it.
4. `tests/e2e/organiser-legacy-redirects.spec.ts`: the one expected target changed
   (`/account/new?organiser=x` -> `/account/o/new/what?organiser=x`), as the brief allows.

## RED first (new tests against main's shell, before any source change)

```
 Test Files  5 failed | 1 passed (6)
      Tests  53 failed | 14 passed (67)
 x gate.matrix.test.tsx: loading -> skeleton | signed-out -> AuthGuard only | deleted -> nothing |
   incomplete -> /finish-profile | complete -> the shell          (all 5 red)
 x legacy.test.tsx: /account/new -> /account/o/new/what (+ ?organiser), the 6 module redirects, encodes the ids
 x paths.test.ts: is the pinned table; newName carries the format
 x noTabs.test.ts: the two files are gone; no source file imports or names them
 x routes.test.tsx: all 7 main screens on new paths, all 25 placeholder routes, shell order without tab bar
 passing on main (unchanged behaviour): the 7 untouched legacyAccountPath rows, encodes the series id,
   "every entry is a string or function", the 3 noHandBuiltLinks tests, two-column split
```

`noHandBuiltLinks` red against a planted literal (`src/modules/organiser/home/Plant.tsx` =
`export const PLANT = '/account/o/team';`), then the plant removed and green again:

```
 FAIL  shell/__tests__/noHandBuiltLinks.test.ts > no hand-built /account/o links > only shell/paths.ts spells the base
- Expected
+ Received
- Array []
+ Array [
+   "home/Plant.tsx",
+ ]
      Tests  1 failed | 2 passed (3)
(plant removed)      Tests  3 passed (3)
```

## CI per job (run in the sandbox)

| Job | Command | Exit | Note |
|---|---|---|---|
| unit-tests | `npm run test:unit` | 1 | organiser module + `account.today`: all green after the change. Remaining reds are the 15 env/live-DB tests (`tests/eventViewCompat.contract`, `integrityCouldNotRun`, `latestEvents.contract`, `occurrenceProgram.contract`, `publicEventPageLineup.contract`) that fail identically on `origin/main` in this sandbox |
| typecheck | `npm run check:rpc-typing`; `npm run check:wallclock-brand` | 0; 0 | the CI job's steps. Full `tsc`: 96 errors on main = 96 here, identical lists |
| architecture-guard | `bash bin/check-integrity.sh`; `npm run check:legacy-tables`; `check:legacy-program-rpcs`; `lint:architecture`; `AUDIT_STRICT=1 npm run check:images`; `check:image-widths(:self-test)`; `check:plan-hygiene:self-test`; `check:workflow-artifact-policy(:self-test)`; `check:mojibake(:self-test)`; `prove:entry-point(:self-test)` | all 0 | `npm run lint` exits 1 only because `bin/check-integrity.sh` is not executable in the sandbox (CI runs `chmod +x bin/*.sh` first); run via `bash` it is 0. `eslint` on every touched file: 0 |
| perf-budget | `npm run build`; `check:bundle-budget(:self-test)`; `check:first-load-requests(:self-test)`; `check:chunk-cycles(:self-test)` | all 0 | `check:lighthouse` needs a deploy; `check:doc-weight` needs `GITHUB_REPOSITORY` (exit 1 on main too) |
| types-drift | `npm run gen:types` | not run | needs the Supabase token; S0a changes no types |
| e2e-smoke | `npm run test:e2e` (CI env) | 1 | **141 passed, 7 failed.** `organiser-layout` and `organiser-legacy-redirects`: green. Expected red, S8's specs: `organiser-home` x3 and `organiser-events` x1 assert main's URLs (`/events/new`, `/events/:s/dates/:o`) and now land on `/new/what` / `/change/:s/:o` via the redirect; `organiser-loop` clicks `org-tab-profile` (no tabs, D32). Load-sensitive: `dancer-home` "unfinished organiser hitting /account/o" and `auth-magic-link-returnto` "omits default returnTo" failed in the full run and **pass when rerun alone** (3/3). The gate now waits on two reads (profile + deletion status) where `DancerProfileGate` waited on one, so under load the 5s URL wait can expire first: watch it in CI |

## Verified

- Unit: the 6 shell test files green (67 tests); whole `src/modules/organiser` + `account.today` green.
- Typecheck: `tsc -p tsconfig.app.json` reports the same 96 pre-existing errors on `origin/main`
  and on this branch (sorted file lists diffed: identical); none in files this slice touches.
- Production `npm run build` and the perf-budget gates (bundle budget, first-load requests, chunk cycles).

## Not verified

- No browser walk at 390x844 on real data: the shell has no data of its own; the e2e smoke specs
  (mocked network) are the browser evidence. Ricky's phone: not tested.
- No Supabase read was needed (no data shape is read by S0a); none made.
- Lighthouse (`check:lighthouse`) needs a deploy; `check:doc-weight` needs `GITHUB_REPOSITORY`
  (fails the same way on `main` in the sandbox); `types-drift` needs the Supabase token (S0a changes no types).
- Vercel preview: not checked from here.

## Left / next steps

- S1-S9: swap your placeholder's import target in `OrganiserRoutes.tsx` (one line, the comment names
  you) and drop the `name` prop; never edit `placeholders.tsx`. When your screens stop using
  `ORG_PATHS.newEvent | date | profile`, delete the alias and its snapshot line.
- S9: fix the `EmailCode.tsx` default `returnTo` to `ORG_PATHS.home` and delete its `KNOWN` entry.
- S8: rewrite the URL expectations in `organiser-home.spec.ts` (3) and `organiser-events.spec.ts` (1) to the R1 paths.
- S8: `tests/e2e/organiser-loop.spec.ts` clicks `org-tab-profile` (tab loop) -- it cannot pass
  without tabs; it is S8's to rewrite or delete (plan 4.11).
