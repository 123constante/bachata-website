# Review B: Website event-truth P1+P3 diff (independent, no code changes)

Branch `arc/event-truth-p1p3-review-b`, created from `origin/arc/event-truth-p1p3-fix` (572612e). Brief:
`arc/briefs-event-truth:briefs/event-truth-p1p3-review-b.md`. Reviewed: `git diff origin/main...origin/arc/event-truth-p1p3-fix`
minus `docs/handover/**` (31 files, +1107/-193), the three handovers (P1 UI, P3 guard, FIX), the admin SQL twin
(`bachata-admin` branch `arc/event-truth-p1p2-fix-sql` 8336b64 and PR #780 head 59729eb, shallow read-only clone),
and prod `stsdtacfauprzrdebmzg` (read-only SELECT, counts only). Written 2026-10-13 by the cloud worker. This file is
the only addition on the branch.

## Verdict: SHIP, with two conditions that are not Website code

No defect in the Website diff needs a code change before merge. Every unit suite the diff touches is green, the guard
canary is 150/150, five mutants (three guard, two UI) were all killed, the build and both bundle ratchets are green on
a clean build here, and the lib agrees with the admin SQL derivation on every prod shape (section 2). The two
conditions:

1. **Admin must carry the same lib bytes** (finding F1). Today no admin ref holds the Website's `a8d972e7` file.
2. **Land this PR and admin #780 in the same window** (finding F2). Either order alone reds CI #70 on main.

## Findings, by severity

### F1 (medium, cross-repo): the "byte-identical twin" is not byte-identical on any admin ref

- Website `src/lib/eventCategory.ts`: LF sha256 `a8d972e7...` (the brief's pin; confirmed by `tr -d '\r' | sha256sum`).
- Admin `lib/eventCategory.ts` on `arc/event-truth-p1p2-fix-sql` (8336b64) AND on PR #780's head (59729eb): LF sha256
  `a2b6364d...`. Admin `main` has no such file at all.
- The difference (confirmed by `diff` of the LF forms): the rule bodies, `genresOf`, `deriveCategories`, `categoryWord`,
  `categoryAgrees` and `storedCategory`, are IDENTICAL line for line. The Website file adds `setForStored`,
  `wordForStored`, `CATEGORY_WORD_LABEL`, `NOT_SET_LABEL`, `categoryLabelFor` (lines 105-134) and rewords three header
  comments. So the derivation agrees; the pin does not.
- Nothing in CI holds the twin: the Website's twin test (`eventCategory.test.ts`, last describe) skips unless
  `../bachata-admin-11april/lib/eventCategory.ts` exists next to the checkout (the owner's machine only), and the admin
  repo has no counterpart test. On the owner's machine, with the admin checkout at #780's head, that test FAILS (the
  bytes differ), which is the opposite of what the P1 handover's "sha256 matches the brief's pin" row implies.
- Failure scenario: a later admin edit to its copy (say, dropping `case 'social'`) passes both repos' CI; the parity
  fixture only pins the Website lib to the Website guard. The admin SQL would then disagree with the Website word.
- Fix (admin side, one file): copy the Website's `a8d972e7` file into admin before or with #780, or update the pin and
  the docs that say "byte-identical" (`docs/event-truth-table.md`, the lib header, CLAUDE.md's chunk note) until it is.

### F2 (medium, ordering): CI #70 is red on main in either merge order unless both land together

- Confirmed on prod (read-only): `check_event_truth_v1()` is still the P0 body (keys `check, computed_at, item_count,
  measured_as, section_count, series, series_count`; no `added_sessions`), and `_series_programme_genres_v1` /
  `_derive_series_category_v1` do not exist. The guard's `assertTruthPayload` therefore exits 2 (fail closed, by design).
- `db-contract-check.yml` runs on push and on a schedule (not only on `pull_request`), with the #70 step under
  `if: always()`, so:
  - this PR merged BEFORE #780 applies: every run on main exits 2 at #70 until #780 is applied;
  - #780 applied BEFORE this PR merges: main's P0 guard (7-id `category_drift` baseline) measures 0 drift and reports
    the 7 ids as STALE, exit 1, until this PR's empty baseline lands.
- Not a defect; the designed fail-closed behaviour. The orchestrator should apply #780 and merge this PR in one window,
  and say so in the PR body.

### F3 (low, copy): "Change the sessions on a date and it follows" overpromises on the common prod shape

- `src/modules/organiser/events/eventType.ts:56` (`typeSublabel`, editable with an upcoming date).
- The derivation (`_series_programme_genres_v1`, read in the migration) is the UNION of the series programme (sections,
  items) and the date-only sessions over ALL occurrences, with keep-if-agrees; per-date REMOVALS are
  `event_occurrence_session_override_p5` rows (`removed: true`, `programmeModel.ts:7`) and are not in the union.
- Prod today: 64 of 64 live series have a series programme; 35 of 64 are recurring, stored `party`, with party AND class
  sessions. Scenario: the organiser of one of those removes the party session on every upcoming date and adds a class:
  set stays {party, class}, stored `party` still agrees, the Type row still reads "Night" and the series stays under
  Parties. Only ADDING a date-only session of a genre the series lacks can move the word, and only when the stored
  value no longer agrees. For an organiser-created series (date-only sessions only, 0 on prod today) the copy is true.
- Not an off-screen-control violation (the date rows are on the page); it is a promise the rule cannot keep for
  today's series. Suggested wording: "Set by its sessions across all its dates. Add a session on a date and it
  follows." One string, one test row (the matrix's expected sublabel) if changed. Owner's call; ship without it.

### F4 (low, interplay, 0 rows on prod): the synthetic `sort_order = -1` date-time session and `seedSessions`

- `_cmd_occurrence_set_time_p5` (prod, read) inserts a date-only session with `sort_order = -1`, title = the series
  name and `type` from the STORED category (NULL -> `party`) when a date gets a time, the date has no session and the
  series has no programme times, which is every organiser-created series. The Website organiser editor offers that
  command (`seriesCommands.ts:249`, `occurrence.set_time`).
- Admin side: `_series_programme_genres_v1` and the #780 `check_event_truth_v1` both exclude `sort_order = -1`
  (confirmed in the migration text, lines 202/208/1838/1877), so the mirror and the guard never see it. The Website
  lib has no filter and needs none: no Website code derives from added-session rows; the guard reads the RPC.
- But `organiser_get_occurrence_programme_v1` -> `_organiser_programme_sessions_p5_v1` -> `_organiser_programme_rows_p5_v1`
  carry no `sort_order` filter (confirmed on prod), so the date page lists that row as a session and
  `seedSessions` (`newEvent.ts:49`, `sessions.length > 0 -> null`) counts it as "already holds a session".
- Scenario: Create -> dates listed -> seed fails (network) -> organiser opens the event, sets the time on date 1 (the
  -1 row appears, type `party` from the NULL mirror) -> returns and presses Create: the seed is skipped, the mirror
  stays NULL, the Type row says "Not set. Add a session to one of its dates and it is set for you." while date 1
  visibly lists a "party" session. Narrow (two failures in sequence), 0 such rows on prod, organiser self-serve is OFF
  in prod. The Website cannot tell the row apart (the session payload has no `sort_order`). Queue for admin: exclude
  `-1` rows from the organiser read, or expose `sort_order`. Not a fix-first.

### F5 (low, tests): one near-tautological assertion; one dead variable

- `src/lib/__tests__/eventCategory.test.ts` "categoryAgrees over every vocabulary token": asserts
  `categoryAgrees(token, setForStored(token)) === (set.length > 0)`; both sides come from the lib, so it proves
  internal consistency, not the mapping. The weight is carried elsewhere and that is enough: the parity corpus (27
  explicit cases, run by both readers) and `eventTruth.matrix.test.tsx`'s `EXPECTED_WORD` table spell every expectation
  out, and the mutants below red them. Cosmetic.
- `eventTruth.matrix.test.tsx` seed-tab case ends in `void chip;` (unused param). Cosmetic.
- No mock echoes its expectation: `pages.test.tsx` seed cases assert the RPC argument shape against literals; the e2e
  fake re-derives through the lib but the spec asserts the sent payload and the rendered word against literals.

### F6 (info): `kind_vs_type` still reports over series items only; date-only sessions are not in that report (the
guard handover says so). Reported-only path; no gate affected.

### F7 (info): organiser self-serve is OFF in production (`e2e-smoke.yml` comment, `VITE_ENABLE_ORGANISER_SELF_SERVE`).
The create-flow half of this diff (chips seed a session, no category sent) is not reachable on prod today; the guard,
the event page's ended noun and the organiser editor's Type row are. The 390x844 walk in the P1 handover needs the flag.

## 1. Prod shape survey (read-only, counts only, 2026-10-13)

| shape | count | what the diff does with it |
|---|---|---|
| live series | 64 (recurring 43, one_off 9, course 6, festival 6) | all measured by #70 |
| live series with NULL category | 0 (0 in any status) | `categoryAgrees(null, set) = false` reds nothing today |
| live series whose stored category disagrees with the union derivation (my SQL, same mapping, -1 excluded) | 7: course/party x4, festival/party x1, one_off/party x1, recurring/party x1, all class-only sessions | the 7 P0 baseline ids; #780 repairs them; the empty baseline then holds |
| live series with a series programme | 64 of 64 | the measurement floor is never date-only alone today |
| date-only sessions on live series | 25 on 11 series; kinds classes 14 / NULL 4 / party 5 / showcase 2; types class 15 / masterclass 1 / party 6 / performance 3 | every token is in the parity corpus |
| live series with date-only sessions ONLY | 0 | the organiser create has not run on prod |
| `sort_order = -1` added sessions | 0 (sort_order 0: 27, 1: 3, 3: 1); no negative item or section sort_order | F4 is theoretical today |
| live courses with NULL length | 2 | the two baseline ids, unchanged |
| section kinds on live series | classes 69, party 61, masterclass 7, showcase 1 | showcase says nothing (expected) |
| item types on live series | class 136, party 76, masterclass 8, competition 1, show 1 | competition / show say nothing |
| live festival stored `workshop` | 1 (has party and class sessions) | agrees (workshop counts as class); reads "Festival" everywhere |
| ended / archived with stored `workshop` | 2 courses ended, 2 one_off archived | event page reads "class", never "workshop" (matrix) |
| API cap | the guard reads one jsonb payload (no row cap); the workspace read is the newest 100 dates and a new series has at most 8 | not reachable |

## 2. Parity: Website lib vs admin SQL (`_series_programme_genres_v1`, `_derive_series_category_v1`), by reading both

| rule | lib (`src/lib/eventCategory.ts`) | SQL (migration 20261115180000) | agree |
|---|---|---|---|
| party, social -> party | `genresOf` | `IN ('party','social')` | yes |
| classes, class, workshop -> class | `genresOf` | `IN ('classes','class','workshop','masterclass')` | yes |
| masterclass -> class AND masterclass | `genresOf` | the two `bool_or`s | yes |
| NULL / '' / unknown says nothing | default branch | `IN` on NULL is NULL, `bool_or` ignores it, COALESCE false | yes |
| set order party, class, masterclass | `GENRE_ORDER` | `ARRAY[...]` in that order | yes |
| keep-if-agrees: party / class or workshop / masterclass | `categoryAgrees` | the three-arm IF | yes |
| else party > masterclass > class > NULL | `storedCategory` | the three IFs then NULL | yes |
| a token outside the CHECK (bogus) disagrees | `return false` | no arm matches, re-pick | yes |
| sources: series sections + items + date-only kind AND type | caller folds them into the two lists (parity test, e2e fake) | four UNION ALL arms | yes |
| ALL occurrences, no cancelled/past filter | n/a (caller) | no filter | the guard reads the RPC, which also has none |
| `sort_order = -1` excluded | n/a (no Website derivation over rows) | excluded in genres and in the RPC | see F4 |
| the guard's `deriveGenres` / `categoryAgrees` | pinned by the 27-case corpus, both readers | n/a | mutants M-G3 below prove the pin bites |

The #780 RPC's `added_sessions` entries are built as `jsonb_build_object('kind', a.section_kind, 'type', a.type)`,
exactly the `{kind, type}` the guard's `assertTruthPayload` demands, and `added_session_count` is an independent
base-table count with the same `-1` exclusion: after #780 the guard will not exit 2 on shape.

## 3. The guard: can it report green without checking?

- RPC error, empty payload, missing array, series listed twice, a field of the wrong type, totals that do not match
  their arrays, `added_sessions` missing / not an array / an entry with extra or renamed keys / a non-text value,
  `added_session_count` missing, null, a string or off by one: all `cannot(...)` -> `CannotMeasure` -> exit 2
  (`assertTruthPayload`, `main`). An empty series list or zero programme rows is `assertMeasured` -> exit 2.
- Before #780 (prod today): exit 2, confirmed by reading prod's RPC body (section F2). After #780: the payload shape
  matches the assertion exactly (section 2).
- Mutants I ran against the canary (file restored byte-identical after each, `git status` clean):
  - M-G1 tolerate a missing `added_sessions` (`?? []`): 147/150, 3 FAIL (the three payload cases).
  - M-G2 drop the `added_session_count` comparison: 147/150, 3 FAIL (off by one, string, null).
  - M-G3 ignore a date-only session's `type`: 145/150, 5 FAIL (2 derive + 3 parity).
- NULL stored category under mapped sessions = drift (the guard worker's decision): consistent with the lib and with
  #780 (a mirror the trigger writes is never NULL under a mapped set). 0 such series today. The revert recipe in the
  guard handover is accurate.

## 4. Owner rules, per organiser screen this diff touches

| screen | same fact, one mapping | copy points only at on-screen controls | empty state says what to do | disabled control carries a reason | untouched save sends nothing |
|---|---|---|---|---|---|
| New event (`NewEventPage.tsx`) | chips seed sessions; no word shown; the hint names the tab the seed lands under ("listed under Classes") which the matrix proves | "Make it weekly later from Repeats" (party hint): `org-row-repeats` exists on the editor (line 226-230); "open the event" is the `org-new-event-open` button | no-chip / no-name errors say what to do | chips locked after a failed step with `CHIPS_LOCKED_HINT` (pages.test) | n/a (create only sends on Create) |
| Event editor Type row (`EventEditorPage.tsx:214`) | `categoryLabel` -> `categoryLabelFor` (lib); same word as `runNoun` on the event page (matrix, 25 pairs) | `typeSublabel` never says "Change the sessions" when locked or no upcoming date (100 cases); F3 is about truth, not presence | "Not set" + "Add a session once a date is listed under When" / "...to one of its dates" | lock state handled by the sublabel | unchanged save path; `editorOrder.matrix` (4) per shape still green (ran) |
| Event page ended line (`endedRun.ts`) | `wordForStored`; a stored workshop reads "class" | n/a | n/a | n/a | n/a |

## 5. The chunk change (`vite.chunks.ts`, `lib-event-rules`)

- Built here (`npm run build`, exit 0): `assets/lib-event-rules-CVNvHUFc.js` source map lists exactly
  `src/lib/londonDate.ts` and `src/lib/eventCategory.ts`; `londonDate.ts` has no imports; the lib has none. Nothing
  else can ride in: the needle is `endsWith('/src/lib/eventCategory.ts' | '/src/lib/londonDate.ts')` with a
  `node_modules` exclusion, and the classifier test pins the list to those two paths and that they exist.
- `check:bundle-budget`: exit 0; event 47 chunks / allowance 47; every puller and chunk ratchet `[ok]`.
  `check:first-load-requests`: exit 0, all six pins match (32 / 32 / 32 / 51 / 32 / 51). Same numbers as the FIX
  handover.
- Bounds: a nested `node_modules/<pkg>/src/lib/londonDate.ts` and a `.bak` are refused (test); the branch sits ahead
  of the node_modules gate and after the commonjs-helpers branch, so it cannot steal `tslib`. The cost (the lib's
  bytes on every route that loads londonDate) is the accepted one; measured, not reasoned.

## 6. What I ran (Node 22, this container)

| check | result |
|---|---|
| `vitest run` over every suite the diff touches (21 files: lib x2, organiser events x12, shared x3, endedRun, chunkClassifier, plus siblings in the folder) | 1165 passed, 1 skipped (admin twin, no sibling checkout), 1 todo, 0 failed |
| `node scripts/check-event-truth-v1.mjs --self-test` | 150/150 |
| guard mutants M-G1 / M-G2 / M-G3 (section 3) | 3 / 3 / 5 FAIL, all killed |
| UI mutant U1: `NewEventPage` never saves the seed | `pages.test.tsx` 4 failed / 38 passed (the three chip cases + the refused-seed case) |
| UI mutant U2: `typeSublabel` always says "Change the sessions" | `eventTruth.matrix.test.tsx` 44 failed / 108 passed |
| `npm run build` + `check:bundle-budget` + `check:first-load-requests` | exit 0 / 0 / 0 (section 5) |
| `organiser-events.spec.ts` + `organiser-loop.spec.ts` (chromium, workflow env: placeholder key, self-serve flag on) | 10 passed (58.6 s), exit 0 |
| prod read-only survey (section 1) and function bodies (`check_event_truth_v1`, `_cmd_occurrence_set_time_p5`, `_cmd_series_set_recurrence_p5`, `organiser_get_occurrence_programme_v1`, `_organiser_programme_sessions_p5_v1`, the set_recurrence materialise call) | read |
| admin migrations 20261115180000 / 190000 and `lib/eventCategory.ts` on 8336b64 and PR #780 head 59729eb | read, diffed (F1, section 2) |

Also confirmed: `series.set_recurrence` materialises occurrences synchronously
(`_reconcile_series_occurrences_after_rule_change_p5_v1`) and `series.add_date` inserts the row, so `firstListedDate`
has a real occurrence id to seed on; `organiser_set_occurrence_programme_v1` sets `section_kind` from the type
(class -> classes, party -> party), so the seeded session reaches the derivation by both kind and type; `firstListedDate`
and the writer's `past_date` gate both use the London date. No stale importer of the deleted `CATEGORY_LABEL`
(homeModel), `OWNER_CATEGORIES`, `isOwnerCategory`, `KIND_CATEGORY` or `TYPE_CATEGORY` remains (the `CATEGORY_LABEL`
hits are the home-map's own `MapCategory` map, which derives from the RPC's `has_party` / `has_class` flags, not from
the stored category). CLAUDE.md is 12.0 KB (budget 19 KB). The lib's LF sha256 still starts `a8d972e7`.

## 7. Not checked

- The 390x844 browser walk on prod-shaped data (no organiser login here; the flag is off in prod, F7).
- The live guard against a database carrying #780 (needs the Supabase branch or prod after apply); only the shape
  match was verified by reading the migration.
- The full `npm run test:unit` and the full `test:e2e` list (the FIX handover ran both; I ran the 21 touched suites
  and the two organiser specs).
- The admin UI slice, the admin repo's own review, Lighthouse / document-weight jobs, the contract suites against the
  live DB.
- The calendar's masterclass / social tab parity (`calendarUtils.ts`, ask-Ricky file; `it.todo` stays).
- Whether `_reconcile_series_occurrences_after_rule_change_p5_v1` can leave the first weekly date unlisted (it ran
  synchronously in every path I read; not executed here).

## 8. Branch head, PR, checks

- Head: see `git log -1 arc/event-truth-p1p3-review-b` (the one commit on top of 572612e adds only this file).
- PR: none, by brief.
- Checks per job: no `pull_request` workflow runs on a docs-only branch with no PR; the checks run locally are in
  section 6. Verified / Not verified: sections 6 and 7.
