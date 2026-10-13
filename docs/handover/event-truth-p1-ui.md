# Handover: event-truth P1 -- Website UI/tests slice

Branch `arc/event-truth-p1p3-ui` (the dispatch ticket named this branch; the brief's text says
`arc/event-truth-p1p3-ui-b`, neither existed on origin, the ticket wins). Created from `main`
at 5e0ec4c. First commit is the brief's patch `briefs/a8efae3c.patch` applied unchanged with
`git am` (b054f22 here; author and message kept). No PR opened (the orchestrator merges into
`feat/event-truth-p1p3`). The guard worker's files were not touched.

Byte-pin check: `tr -d '\r' < src/lib/eventCategory.ts | sha256sum` = `a8d972e7...` (matches
the brief). The lib was NOT edited.

## 1. Review of a8efae3c -- findings and fixes

| # | Finding | Fix |
|---|---------|-----|
| F1 | `src/modules/organiser/shared/homeModel.ts` kept a second copy of the word mapping (`CATEGORY_LABEL`: workshop -> "Workshop"), the very thing the slice retires. No importer anywhere in `src/` (the home-map `CATEGORY_LABEL` is a different type, `MapCategory`). | Removed the dead copy. |
| F2 | `tests/e2e/organiser-events.spec.ts` (in the `test:e2e` CI gate) still asserted the OLD error copy "Choose what it is: ..." and `category: 'class' / 'party'` in the create payload. e2e-smoke would have gone red on the orchestrator's PR. | Spec now asserts "Choose the first session: a class, a party or a workshop." and `not.toHaveProperty('category')` on both creates. |
| F3 | Type row mutant gap: swapping the Type row back to the raw stored value survived every GREEN test (only the already-red snapshot moved). | New `eventTruth.matrix.test.tsx` reds it on every party and workshop shape (28 cases). |
| F4 | `seedSessions` had no pure unit test (only the three page-level seed tests). | New `newEvent.seed.test.ts` (18 tests). |
| F5 | `src/lib/__tests__/eventCategory.test.ts` imported `categoryAgrees` and voided it. | Table over stored x set, plus "every stored value agrees with its own set". |
| F6 | Calendar tab membership DRIFT (not fixed, see section 7): `src/components/calendar/calendarUtils.ts` derives `hasClass` / `hasParty` from program items with its own list (`party`, `class`, `workshop`), so a lone **masterclass** session is NOT under Classes and a lone **social** is NOT under Parties, where the shared rule says they are. The file is on the CLAUDE.md "ask Ricky before changing" list. | Pinned as two `it.fails` cases that turn green (and must then be deleted) the moment calendarUtils reads `deriveCategories`. |

Reviewed and found sound (no change): copy points only at controls that exist ("Open the
event" button is rendered with the error; "add it on its first date" = the date page's "Add a
session"; "Repeats" row exists in the editor); the sublabel for a series with no session says
what to do; ASCII only (no raw Unicode punctuation added; the one non-ASCII hit in
`seriesCommands.ts` line 5 is a pre-existing comment arrow); no density change (no layout
touched); `seedSessions` never seeds twice (page test + unit test); the retry after a lost
reply replays the create under its idempotency key, as the pre-existing schedule path does.

## 2. Mutation proof (run against the UNFIXED tree, b054f22, 2026-10-13)

| Mutant | Red tests on the unfixed tree | After this slice |
|--------|-------------------------------|------------------|
| (a) `seedSessions` -> `return null` | `pages.test.tsx`: "the class/party/workshop chip seeds one session on the first upcoming date" (3) + "a refused first session is shown, not swallowed" (4 red) | + `newEvent.seed.test.ts`: 7 red ("seeds exactly one session" x3, "the start is the create start time", chip -> word x3) |
| (b1) Type row shows the raw stored value (capitalised) | NONE green (only the already-red editorOrder snapshot) -- the gap | `eventTruth.matrix.test.tsx`: 28 red (every party / workshop / course / festival shape's "Type row" case) |
| (b2) `runNoun` reads the raw category (old code) | `endedRun.test.ts` "names a class, workshop and masterclass from CATEGORY, not shape" (1 red: stored workshop must read class) | same, plus the matrix's "the event page ended line uses the same word" (one_off/workshop, recurring/workshop) |
| (c) `createPayload` sends `category` again | `createModel.test.ts`: "sends only the five always-keys for a bare party", "sends the exact keys for a full weekly class", "adds exactly one key, naming the one organiser" (3 red). `fixesBatch` and `pages` stay green because `createSeriesCommand` -> `upsertCommand` strips it again (two layers). | + `newEvent.seed.test.ts` "a create carries no category for any chip" (reds only if both layers regress) |
| (c2) `upsertCommand` lets `category` through | `ownerWritesD8.test.ts` "upsertCommand drops every category, an owner one included" (1 red) | same |

## 3. Consistency matrix (`src/modules/organiser/events/__tests__/eventTruth.matrix.test.tsx`)

Shapes: format {one_off, recurring, course, festival} x stored {party, class, workshop,
masterclass, null} x {has an upcoming date, none} = 40, each built from the prod-shape library
(`shapes.ts`: live-oneoff-upcoming / live-oneoff-past, live-weekly-until / live-norule-lapsed,
live-course / ended-course, live-festival / a past festival) through the real parsers.

Per shape, one editor mount: the Type row ends with `categoryLabelFor(format, stored)` (the one
mapping), the expected word table is spelled out in the test too (workshop -> Class, party ->
Night, course/festival -> the format, null -> Not set), the sublabel is `typeSublabel` and says
what sets it or what to do ("Add a session to one of its dates and it is set for you."), the
dates list the sublabel points at is on the page, and an untouched record sends no
`series_command_p5`. Per shape, pure: `runNoun(format, null, stored)` is `wordForStored ?? 'night'`,
and `setForStored(stored)` equals `deriveCategories` over the stored value's genre (SET reading).

Calendar tabs: `transformCalendarEvents` + `matchesCategory` over program item types held
against `deriveCategories(...).set` for every seed and every organiser session type; the two
drifts (masterclass, social) pinned as `it.fails`.

New event chips: every chip enabled before Create (the create's first date is today + 7, so
"a chip that cannot seed" does not exist on this screen by construction -- pinned in
`newEvent.seed.test.ts`); after a refused seed every chip is disabled WITH the reason as a
`role=alert` and "Open the event" on screen, Create still enabled for the retry.

String-literal survey (`'workshop' | 'party' | 'masterclass'` in `src/modules/organiser` and
`src/modules/event-page`, non-test): every survivor is a SESSION type (programme rows, schedule
block rendering, status tone, `SESSION_TYPES`, `SEED_SESSION`), none is a series-category word
copy. The one category copy (F1) is gone.

## 4. Snapshot

`editorOrder.matrix.test.tsx.snap` regenerated (29 cases, `vitest run -u` on that file only).
The only lines that changed are `org-row-type`: "Chosen when the event was made. To change it,
ask the Bachata Calendar team." + Party/Class -> "Set by its sessions. Change the sessions on a
date and it follows." + Night/Class, and "Set by its format." + Course/Festival. That is the
owner's label set, so the snapshot, not the code, was updated.

## 5. CI steps run locally (Node 22.22.0)

| Job / step | Result |
|------------|--------|
| unit-tests: full `vitest run` | 273 files pass; 4 files red for ENVIRONMENT only: the three `*.contract.test.ts` need live Supabase secrets ("Invalid API key"), `integrityCouldNotRun.test.ts` needs a temp repo where `typescript` does not resolve. Identical set red on the unfixed tree; the 29 editorOrder reds are gone. CI's `test:unit:offline` path excludes the contract suites. |
| unit-tests: `test:unit:timing` | not run separately (EdgeTtl suite is in the full run above) |
| typecheck.yml: `check:rpc-typing`, `check:wallclock-brand` | both pass (the workflow runs only these two; `npm run typecheck` itself has 92 pre-existing errors, none in a file this branch touches) |
| lint chain `npm run lint` | 16/16 links green (eslint tail WARN, informational); `bin/*.sh` need `chmod +x` locally as the workflow does |
| architecture-guard integrity job: `bin/check-integrity.sh`, legacy-tables, legacy-program-rpcs, lint:architecture, `AUDIT_STRICT=1 check:images`, image-widths self-test + guard, plan-hygiene self-test, workflow-artifact-policy self-test + guard, mojibake self-test + git grep, prove:entry-point self-test + sweep | all exit 0 |
| perf-budget canaries (bundle-budget, first-load-requests self-tests) | pass |
| perf-budget build + budgets | not yet run at this commit (follow-up commit carries the result) |
| e2e-smoke `npm run test:e2e` (placeholder env) | running at this commit (follow-up commit carries the result) |
| `npm run pre-ship` | running at this commit (follow-up commit carries the result) |
| eslint on every touched file | clean |
| db-contract-check, phone-qa, real-data-verified, owner-approval | need secrets / a PR; not runnable here |

## 6. 390x844 walk script (for the orchestrator, on prod-shaped data)

Login as an organiser owner with at least one live series; phone viewport 390x844.

1. `/account/o/events/new`. Expect: name field, "First session" label with chips Class /
   Party / Workshop, hint "Choose one. It becomes the first session; you can add more after."
   Tap Create with nothing: "Give your event a name." Name it, tap Create with no chip:
   "Choose the first session: a class, a party or a workshop." Nothing sent.
2. Tap Workshop (hint: "One date with a workshop session (listed under Classes)..."), Create.
   Expect the editor to open; Type row reads "Class" with "Set by its sessions. Change the
   sessions on a date and it follows." Open the one date: one session "Workshop", class type,
   20:00-22:00. Check the DB mirror: `event_series_p5.category` = `class` (derived by the
   trigger, admin #780), never `workshop`.
3. New event again, tap Party, Create. Type row "Night"; the date holds one session "Party"
   20:00-01:00 (ends next day). Public calendar after publish: listed under Parties only.
4. New event, tap Class, Create. 8 weekly dates; first date holds "Class" 20:00-22:00; the
   other 7 dates hold none (date-only sessions). Type row "Class".
5. Press Create twice fast on a slow connection (or replay): the first date must hold ONE
   session, never two.
6. Open an existing series the team marked masterclass: Type row "Masterclass"; a course:
   "Course" + "Set by its format."; a festival: "Festival".
7. A draft with no sessions at all: Type row "Not set" + "Add a session to one of its dates
   and it is set for you." Add a session on a date, return: the row follows.
8. Ended event public page (`/event/:id` of an ended weekly class with stored `workshop`):
   "This class has finished and is no longer running." (never "workshop").
9. Save with nothing changed on every shape above: the preview bar button stays disabled and
   nothing is sent.

Known copy limits to eyeball: the hint strings fit two lines at 390px (13px muted text).

## 7. Decision for Ricky

- Calendar tab drift (F6): make `calendarUtils.ts` read `deriveCategories` (a masterclass-only
  date under Classes, a social-only date under Parties) or accept the client drift because the
  RPC's `has_class` / `has_party` (the SQL twin) are what the server says anyway. The file is
  on the density-exclusion "ask first" list, so it was not edited. The two `it.fails` cases go
  when it is.

## 8. Verified / Not verified

Verified: every unit test named above on this tree (5869 -> 6028 passing); the mutants in
section 2; lint chain; every architecture-guard integrity step; typecheck.yml's two guards;
eslint on touched files; the snapshot diff is Type-row-only.

Not verified: a real browser walk (no login or prod data here: the script is section 6);
the live contract suites (no secrets); the DB trigger actually deriving `category` from the
seeded session (admin #780, not applied here); Vercel preview; phone-qa.
