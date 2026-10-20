VERDICT: FIX PASS NEEDED

# B-WEB1 independent review (teacher + DJ areas)

Reviewer: independent cloud worker, ticket dt_2ecf886fa6f8. Slice branch `claude/people-b-web1-areas` at f45a5683
(matches the brief). Base `origin/main` 960fc4c. Compared against B-DB1 final bodies on admin
`claude/people-b-db1-roles` 79d30ad (`tests/fixtures/rpc-bodies/*.sql`). Brief file read from admin branch
`brief/people-publishing-2026-10-20` (head ee2e5d5 at read time; the dispatch named blob c951df6).

No blocking finding. Five "should" findings, four of them shown on measured prod data shapes or in a real browser.
The pinned contract, the B-DB1 interface match and diff-first are all correct. Each fix below is small and stays inside
the slice's own files, except where a finding says "orchestrator decision".

## Findings (most severe first)

### 1. should: the line-up list has no cap, and real teachers would get up to ~200 rows
- `src/modules/areas/shared/LineupList.tsx:27-46` renders every row.
- `my_lineup_appearances_v1` returns one row per (series, date, session), so a weekly class becomes one row a week.
  Prod survey (read-only counts; future, non-cancelled occurrences x programme items naming the person, BEFORE the
  public-visibility filter and the session-override de-dupe, so an upper bound):
  teacher: 54 people, max 202 rows, 18 people over 20 rows, 9 over 100. DJ: 19 people, max 169, 12 over 20, 3 over 100.
- Measured in Chromium with 200 rows: the dashboard is **12,377 px tall** at 390x844 (screenshot
  `teacher-dashboard-200-lineup.png`). A weekly teacher sees the same event name 50 times.
- Fix (client only): show the first 10 rows and a "Show all N" button (44 px); better still, group rows by
  series ("Midweek Moderna Class: next Wed 21 Oct, then 25 more dates") in server order. Add a test with 200 rows.

### 2. should: a list item typed but not added is silently lost
- `src/modules/areas/shared/inputs.tsx:29-66` (`ListInput` keeps the typed text in local state; only "Add" or Enter
  puts it in the draft), used by `RoleProfilePage.tsx` and the wizard field step (`roleWizard.tsx:17-26`).
- Measured in the harness (`teacher-profile-list-term-not-added.png`): type "Moderna" in "Styles you teach", do not
  tap Add. Save stays disabled with "Nothing has changed yet, so there is nothing to save." (wrong: the person
  just typed something). Then change "Role you dance" and Save: the patch sent was `{"partner_role":"Both"}`, and
  "Moderna" is gone. In the wizard, Continue on the styles step sends the list without the typed term.
- Fix: `ListInput` adds the pending term on blur (or reports it upward so the form's diff includes it, and the
  wizard's `answer()` includes it). Test: type, no Add, Save sends the term.

### 3. should: the "no dancer profile" state offers a retry that can never work, and points at a control that is not there
- `RoleAreaPage.tsx:52-58` and `RoleProfilePage.tsx:121-127` show `ErrorState` with "Try again" for `no_profile`;
  the copy says "Finish your dancer profile first", with no link to do it (WEB-COMMON: no text pointing at an absent
  control; an empty state carries one action). On the dashboard the line-up card at the same time says "Check your
  connection, then try again" (`LineupList.tsx:24` ignores the refusal code), which is wrong.
- Real shape: 2 of 26 accounts on prod have no persona (`_dancer_profile_id_for_account_v1` is NULL), so both RPCs
  raise `no_profile` for them. Screenshot `teacher-dashboard-refusal.png`.
- Fix: for `no_profile` render one state (not two) with ONE action, "Finish your dancer profile", linking to a path
  taken as a prop (B-WEB3 passes it); hide the line-up section in that state. `not_signed_in` likewise: one
  "Sign in" action, not "Try again". Add both to the table-driven screen tests.

### 4. should (latent, 0 rows today): a line-up row with no slug links to a URL that does not open
- `LineupList.tsx:30` uses `eventHref({ slug: r.slug, event_id: r.seriesId })`. When `slug` is null this becomes
  `/event/<series id>`. `/event/:id` resolves through `resolve_public_event_ref_v1`, which matches
  `legacy_event_id = id OR (legacy_event_id IS NULL AND id = id)`; for a bridged series the series id is NOT the
  public id (see `src/modules/event-page/CLAUDE.md`, "eventId is the PUBLIC event id").
- Prod: 60 of 68 publicly visible series are bridged with `legacy_event_id <> id`; 0 visible series have no slug
  today (611 hidden/template ones do). So no row hits it today; the first public series without a slug would.
- Fix, client only: when `slug` is null render the row without a link. Better (orchestrator decision, pinned-shape
  change): B-DB1 adds `event_id` (= `COALESCE(legacy_event_id, id)`) to each row and the client links with it.

### 5. should: a wizard field step sends an RPC for an untouched answer
- `roleWizard.tsx:21-28`: Continue always calls `onAnswer(sent)`, and `submitRoleWizardStep` always calls
  `save_my_role_v1`, even when the answer is empty or equals the prefilled `value`. The server is diff-first so it
  writes nothing and spends no rate token, but the binding owner rule is "saving an untouched record sends nothing".
- Fix: in `answer()`, when `toServerValue(field, draft)` equals `toServerValue(field, toDraftValue(field, value))`,
  call `onSkip` (or disable Continue with the visible reason "Type an answer or tap Skip"). Test it.

### 6. nit: client text rules miss the server's control-character rule
- `roleModel.ts:62-75`. The server refuses `[[:cntrl:]]` in text and list items (`invalid_text` / `invalid_list`);
  the client does not check, so a pasted tab in "DJ name" reaches the server and the copy says "This answer is too
  long", which is not the reason. Fix: refuse control characters on the client (pricing keeps new lines) and make
  the `invalid_text` sentence "too long or has a character that cannot be saved".

### 7. nit: length is counted in UTF-16 units, the server counts characters
- `roleModel.ts` `.length` and the inputs' `maxLength`: an 80-character name with emoji is refused by the client
  though the server would accept it. Fix: `[...s].length`. Low impact.

### 8. nit: the server-order test would not catch a sort by name
- Mutation: sorting rows by `eventName` before render -> **0 failed / 90 passed** (the fixture rows "Later Night",
  "Sooner Social" are already in name order). A sort by date IS caught (2 failed). Fix: a fixture whose server order
  is neither name order nor date order.

### 9. nit: a dated row opens the event, not that date
- Rows are per date but the link has no `occurrenceId` (the pinned shape has none), so "Sat 5 Dec" opens the
  event's default date. Needs `occurrence_id` from B-DB1; record for a later slice.

### 10. nit: unanswered "Private lessons" reads as "No" after any first teacher save
- B-DB1 / D20 store `offers_private = false` on a member's first teacher row, and author decision 3 counts "No" as
  filled. A teacher who only saves "Years teaching" then sees "2 of 7 details added" and "No" selected for a question
  they never answered. Consistent with D20 by design; recorded for the owner, no change asked.

## Files outside the owned paths
| File | Verdict |
|---|---|
| `src/modules/areas/index.ts` | needed: brief item 2 names this file (lazy pages only); it holds only the four lazy exports. |
| `src/modules/areas/__tests__/areas.screens.test.tsx`, `roleModel.test.ts` | needed: the brief asks for these tests; tests only. |
Everything else is in `wizardStep.ts`, `shared/**`, `teacher/**`, `dj/**`, the handover and `docs/people-arc/screens/B-WEB1/**`.
No edits to `AnimatedRoutes.tsx`, `src/lib/areaPaths.ts`, `src/modules/organiser/**` or any A-WEB2 file.

## Slice-specific checks
| Check | Result |
|---|---|
| (a) cleared field sends `null`, cleared list `[]` | Accepted by B-DB1 `save_my_role_v1` key by key: text/link/longtext `null` -> stored NULL; list `[]` (and `null`) -> `[]` -> stored NULL, read back `[]`; `years_teaching` `null` -> NULL; `offers_private` `null` accepted (`boolean` or `null`) and the column is nullable on prod (`information_schema`: all 12 role-detail columns nullable). No client mapping needed. |
| (b) field keys, refusal codes, wizard contract | Keys equal `_role_fields_v1` for both roles (kinds: years=int, yesno=bool, text, link, longtext=pricing, list). All 11 refusal codes are raised by B-DB1 with these exact messages (`rate_limited` from `_member_rate_check_v1`); anything else (e.g. a 23xxx) maps to the calm fallback. `wizardStep.ts` is byte-identical to the pinned text apart from CRLF line endings (repo convention). |
| (c) `submitRoleWizardStep` -> `set_my_role_declined_v1` | `{ p_role, p_declined }`, No -> `true`, Yes -> `false`; Skip sends nothing. Parser matches `my_role_intent_v1() || {changed}` = `{roles, declined, changed}`. Mutation inverting it: 3 failed. |
| (d) line-up rows keep server order | Yes; B-DB1 orders by date, start time, title, series. See nit 8 for the test's blind spot. |
| (e) no link to a public teacher/DJ page | None. The only links: back link, "Edit details" (prop path), event links. |

## Correctness review (code-review low depth)
| Rule | Result |
|---|---|
| One string-named boundary, `UntypedRpc`, no `as never` | Yes, `areaApi.ts`; `check:rpc-typing` exit 0. |
| Parsers refuse unexpected shapes | Yes, all four (`malformed_answer`). `parseLineup(null)` -> `[]` (server never returns null; harmless). `event_name` can never be null on prod (0 rows), so a strict parse is safe. |
| Missing function -> normal error state, no crash | Yes, measured (`*-error.png`; fake answers "Could not find the function ..."). Mutation swallowing the error: 2 failed. |
| No direct table reads | None (`.from(` absent in the module). |
| No secret or personal data in logs | No `console.*` or Sentry calls in the module. |
| Empty patch never sent from the profile form | `saveMyRole` refuses `{}`; Save disabled with reason when untouched. |

## UI rules, measured (Chromium via Playwright, temporary harness with a fake RPC boundary, not committed)
Every row: 20 screen/state combinations at 390x844 AND 360x640 (40 renders). Targets = every `button, a, input,
textarea, [role=button]` by `getBoundingClientRect`. Contrast = WCAG ratio of each visible text node's colour against
its nearest opaque background (disabled-button text at reduced opacity is not included; see Not verified).

| Screen / state | <44 px targets (390 / 360) | Min contrast | Overflow-x | Notes |
|---|---|---|---|---|
| Teacher dashboard filled | 0 / 0 | 6.42 | no / no | completeness line + progressbar, one primary |
| Teacher dashboard empty | 0 / 0 | 6.42 | no / no | line-up empty state: "When an organiser adds you to a line-up, it shows here." (no action button: nothing the person can do; acceptable) |
| Teacher dashboard loading | 0 / 0 | 6.98 | no / no | 5 shimmer animations; 0 with reduced motion |
| Teacher dashboard error (missing fn) | 0 / 0 | 6.42 | no / no | calm error + Try again |
| Teacher dashboard refusal (no_profile) | 0 / 0 | 6.42 | no / no | **finding 3** |
| Teacher dashboard 200 line-up rows | 0 / 0 | 6.42 | no / no | **finding 1**: 12,377 px tall |
| DJ dashboard filled / empty / error | 0 / 0 | 6.42 | no / no | same meter and copy as teacher (one shared mapping) |
| Teacher profile filled / empty | 0 / 0 | 6.42 | no / no | every label "(optional)"; Save disabled with reason when untouched |
| Teacher profile loading / error | 0 / 0 | 9.89 / 6.42 | no / no | 4 animations, 0 with reduced motion |
| DJ profile filled | 0 / 0 | 6.42 | no / no | |
| DJ profile save refused (rate_limited) | 0 / 0 | 6.42 | no / no | plain sentence, no code |
| Teacher profile, list term not added | 0 / 0 | 6.42 | no / no | **finding 2** |
| Wizard: do you teach / years / styles / DJ pricing | 0 / 0 | 6.98 | no / no | Continue disabled with "Choose Yes or No to continue."; unlockLine states a real effect only |

| WEB-COMMON rule | Result |
|---|---|
| 44 px targets | Pass, 0 under 44 in 40 renders. |
| 4.5:1 contrast | Pass, lowest 6.42:1 (`--mut` on card). |
| One shared mapping | Pass: one registry, one completeness rule/sentence, one error table, both roles. |
| No text pointing at an absent control | **Fail** for `no_profile` (finding 3); "Nothing has changed yet" is wrong while a list term is pending (finding 2). |
| Every empty state has one action | Line-up empty state says what will happen, with nothing to tap; acceptable as there is nothing to do. `no_profile`: fail (finding 3). |
| Disabled control carries a visible reason | Pass (Save, Continue, Add when full or duplicate). |
| Untouched save sends nothing | Profile form: pass. Wizard field step: finding 5. |
| Plain British English, no internal codes | Pass; no codes on screen in any refusal state. |
| Reduced motion | Pass: 0 running animations in all 20 states with `prefers-reduced-motion: reduce`. |

Screenshots (390x844): `docs/people-arc/reviews/B-WEB1-screens/` (20 PNGs, 832 KB in total).

## Red-first and mutations
- Author's tests on `origin/main` (module absent): `Test Files 2 failed (2)`, "Failed to resolve import". On the slice:
  `Test Files 2 passed (2) / Tests 90 passed (90)`.
- One mutation per main rule (each restored after; `git status` clean):

| Rule | Mutation | Result |
|---|---|---|
| Diff-first | `diffPatch` sends every key | 17 failed / 73 passed |
| Refusal copy | `roleErrorMessage` always returns the fallback | 19 failed |
| Parser refuses bad shape | `parseLineup` returns `[]` for a non-array | 1 failed |
| Server order | sort by date / sort by name | 2 failed / **0 failed** (nit 8) |
| Declined mapping | `p_declined` inverted | 3 failed |
| Field-set equality | extra `bio` key in the registry | 5 failed |
| Disabled with reason | hide the "Nothing has changed" line | 2 failed |
| 44 px | line-up row `min-h` 56 -> 40 | 2 failed |
| Missing function -> error state | `fetchMyLineup` swallows the error | 2 failed |

## CI: every applicable job step, run in this sandbox on the slice head
| job | step | command | exit |
|---|---|---|---|
| architecture-guard | integrity | `chmod +x bin/*.sh` then `bin/check-integrity.sh` | 0 |
| architecture-guard | legacy tables | `npm run check:legacy-tables` | 0 |
| architecture-guard | legacy program RPCs | `npm run check:legacy-program-rpcs` | 0 |
| architecture-guard | runtime architecture | `npm run lint:architecture` | 0 |
| architecture-guard | images | `AUDIT_STRICT=1 npm run check:images` (with the review PNGs added) | 0 |
| architecture-guard | image widths | `check:image-widths:self-test`, `check:image-widths` | 0 / 0 |
| architecture-guard | plan hygiene canary | `npm run check:plan-hygiene:self-test` | 0 |
| architecture-guard | workflow artifact policy | `:self-test`, guard | 0 / 0 |
| architecture-guard | mojibake canary / guard | `check:mojibake:self-test`; `git grep` pattern on the new files | 0 / clean |
| architecture-guard | entry-point proof | `prove:entry-point:self-test`, `prove:entry-point` | 0 / 0 |
| typecheck | rpc typing / wallclock brand | `check:rpc-typing`, `check:wallclock-brand` | 0 / 0 |
| unit-tests | dancer-area isolation | `--self-test`, `check:dancer-area-isolation` | 0 / 0 |
| unit-tests | offline suite | `npm run test:unit:offline` | 1: 5 failed / 9464 passed, all 5 in `tests/integrityCouldNotRun.test.ts` (safe-write helper fixtures); the same 5 fail on `origin/main` in this sandbox (5 failed / 62 passed), so they are environmental, not this slice |
| unit-tests | live contract suites | `ci-live-db-gate.mjs` + live specs | NOT RUN: need Supabase secrets |
| workflow-lint | masking, notification (+self-test), no-preview-prefixes (+self-test) | `node scripts/...` | 0 (all five) |
| perf-budget | canaries | bundle-budget / first-load-requests / chunk-cycles self-tests | 0 / 0 / 0 |
| perf-budget | build | `npm run build` (production) | 0 |
| perf-budget | budgets | `check:bundle-budget`, `check:first-load-requests`, `check:chunk-cycles` | 0 / 0 / 0 |
| perf-budget | doc weight / lighthouse | `check:doc-weight`, `check:lighthouse` | NOT RUN: need a deployed preview and `GITHUB_REPOSITORY`; no VERCEL_TOKEN used |
| db-contract-check | migration authority | `node scripts/check-migration-stamps.mjs` | 0 |
| db-contract-check | live contract steps | `check-*.mjs` against the DB | NOT RUN: need Supabase secrets; the slice has no DB code |
| phone-qa | phone / build specs | `playwright.phone.config.ts`, `playwright.build.config.ts` | NOT RUN: the pages are unrouted, so no spec reaches them; measured in the harness instead (table above) |
| e2e-smoke | `npm run test:e2e` | | NOT RUN: no spec reaches unrouted pages |
| phone-qa-section, real-data-verified, owner-approval | PR-body checks | | N/A: no PR |

## Verified
- Slice diff, file scope, and every claim above against B-DB1's final function bodies (79d30ad).
- Clearing semantics key by key, including the prod column nullability.
- Prod shape survey (read-only counts only): role-detail rows (20 teacher, 22 DJ; none break a client limit; 2 with
  `offers_private` NULL), line-up row counts per person (finding 1), visible series without a slug (0) and bridged
  ones (60 of 68) (finding 4), accounts without a persona (2 of 26) (finding 3).
- All 20 states rendered and measured in Chromium at 390x844 and 360x640, plus reduced motion; production build green.
- Red-first on main and one mutation per main rule.

## Not verified
- Against the real RPCs: none of the four exist on any database yet; the harness uses a fake at the boundary.
- Line-up counts are an upper bound (before the public-visibility filter and override de-dupe); the true per-person
  maximum needs B-DB1 on a branch DB.
- Contrast of disabled-button text (rendered at reduced opacity) was not measured.
- Real keyboard, real screen reader, a real phone; route wiring and auth gating (B-WEB3); the wizard shell (A-WEB1b).
- Vercel preview checks (doc weight, Lighthouse): not run, no token used.
