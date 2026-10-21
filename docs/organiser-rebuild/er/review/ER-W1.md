# ER-W1 review: wave 1 (ER-C2 + ER-C3 + ER-C4 + ER-C5)

Independent read-only review of `claude/er-wave1` @ `4c6d1f5`, diff base `b0983348`. Brief: `docs/organiser-rebuild/briefs/ER-REVIEW-W1.md` (sha c7a0927). Ticket dt_5a4260bf73ea. No source edits. Each mutation was made in a throwaway worktree and reverted, and `git status` was clean afterwards.

**Totals: 0 blocker, 13 major, 21 minor.**

The worst finding is C3-1. It changes what current users see on the default (non-rebuild) path: a mistyped or deleted event id now shows "Did not load. Check your connection" where it used to show "Not found". The other majors are in code that no route mounts yet (Ember, SessionSheet, VenuePicker) or in rules that nothing outside C3 reads yet. Fix them before those pieces go live.

Format: `SEVERITY | slice | file:line | what is wrong | exact failure (input -> wrong output) | proposed fix`

## ER-C3: rules, series lookup, rebuild switch

1. **MAJOR** | C3 | `src/modules/organiser/shared/useOrganiserSeries.ts:95` (also `flows/add/WhichDay.tsx:28` and `Time.tsx`) | The `gone` state cannot happen against the real server. For an unknown id, `_assert_can_edit_series_p5` raises `series_not_found: <id>` (read from prod with `pg_get_functiondef`, read-only). `isAccessRefusal` does not match it, so the hook returns `error`. The screens' `ws.isError` shares the same query key, so they render `Failed`. The test "gone when the workspace has no such series" fakes a reply with an empty id, which the server never sends. | Open `/account/o/add/<deleted or mistyped id>`. Before C3: "Not found" (`Missing`). Now: "Did not load. Check your connection, then try again", with a Try again button that can never work. This is the DEFAULT path, not behind the rebuild switch. | Map `/^series_not_found/` to `{state:'gone'}` in `resolveSeries`. Also stop the screens rendering `Failed` for that error. Add a hook test that uses the real error text.
2. **MAJOR** | C3 | `shared/eventRules.ts:160` | `dateInPast` fires for every status. AS BUILT: `first_date_past` applies only to draft, rejected and pending_review. `RuleSeries` has no status field. | A live weekly whose first date is 2026-01-01, checked on 2026-10-21, gets blockers `['dateInPast']` and "Not ready". Every live weekly will read Not ready once S4 Home reuses this text. | Add `status` to `RuleSeries` and gate the check on it. Add a fixture for a live series with a past first date.
3. **MAJOR** | C3 | `shared/eventRules.ts:151-169`, `event-rules.json` `blockers` | Client readiness misses facts the server checks at go-live: flyer (`no_flyer`/`cover`), description (still required by the server, AS BUILT), and festival `no_session_first_date` on ANY programme day. | A complete one-off with no flyer and no description gets `ready:true`, "Ready to publish", and `series_go_live_check_v1` refuses it. | Add `flyer`, `description` and a per-day festival check. Alternatively, label client readiness as advisory and always show the server check's result.
4. **MAJOR** | C3 | `event-rules.json` `formats`, `eventRules.ts:155` | `course` and `festival` pass the format check, but owner create accepts only `one_off` and `recurring` (AS BUILT, rule 14). | `{format:'course', ...complete}` gets `ready:true`, and the create is refused. | Add a separate `ownerCreateFormats: ["one_off","recurring"]` and use it in the create path.
5. minor | C3 | `eventRules.ts:76-79` | The rollover heuristic misreads daytime programmes. | Sessions 07:30-09:00 and 10:00-12:00 give start 10:00 and end 09:00. | Roll a session over only when the evening has already started (for example start >= 18:00), or only when an end passes midnight. Add a fixture.
6. minor | C3 | `eventRules.ts:62` | Any end before its start counts as a valid "next day". | Class 20:00-19:59 is accepted as a 23 h 59 class. | Add a maximum length shared with C4 (see C4-4).
7. minor | C3 | `eventRules.ts:139,165` | `in` also matches inherited properties, and the format function does not remove duplicates. | `parsePaymentMethods('constructor')` gives `['constructor']`. `formatPaymentMethods(['door','door'])` gives `'door,door'`, which the server refuses. | Use `Object.hasOwn` and dedupe.
8. minor | C3 | `scripts/check-event-rules-mirror.mjs:46-49,66` | It fails open, and its byte compare trips on line endings. Admin path: the C3 handover. | `--admin <typo>` or a bare `--admin` exits 0 with SKIPPED. The Website `.gitattributes` has `eol=crlf` and `git ls-files --eol` shows `w/crlf`, so an LF checkout of admin is never byte-equal. The script is in no workflow. | Exit 2 when `--admin` is given and the file is missing. Normalise CRLF before comparing, or compare git blobs. The owner adds the workflow step.
9. minor | C3 | `shell/rebuildSwitch.ts` | Default is OFF and nothing reads the switch yet, so it cannot leak today. It is a build-time env, so if it is set for "All environments" in Vercel, previews and prod get the same allowlist. | none today | Handover: set it in the Production scope deliberately.

**Parked mirror question (item 2): can it be satisfied?** Not today. The script needs an admin checkout in CI (a token for the private admin repo, which needs owner and workflow approval) AND matching line endings. Until both exist it can only run by hand. I could not read the admin copy, because access to the admin repo was refused in this session.

**Out-of-card files (item 3).** `Time.tsx` and `WhichDay.tsx` changed on the default path:
- When Home misses, they add a workspace read.
- They now show "This event was archived" for an archived event, which is an improvement.
- The not-found case regressed (C3-1).

`notFoundText.ts` is new copy covered by `notFound.test.tsx`, but that test uses the fake reply described in C3-1. `addModel`, `changeModel` and `eventsApi` are pure refactors: same filter and order, covered by existing tests.

**Rule data vs the plan and AS BUILT match:**
- payment codes;
- festival `ticket_link` only;
- six kinds, with showcase stored as `performance`;
- level only on class and masterclass;
- quick lengths 45/60/90/120, default 60;
- festival defaults 22:00-04:00;
- cancel reasons.

C3 invented nothing beyond C3-2, C3-3 and C3-4 above.

## ER-C4: sessions

Note: C4 ships no loader or saver between stored rows and `SessionDraft` (parked). Below, a "round trip" means `SessionDraft[]` into `SessionSheet`, then Done, then what `onSave` receives.

Prod survey (read-only, counts, `event_series_program_item_p5`, 662 rows):
- times are `HH:MM:SS`;
- 223 rows have both times null, 0 have only one null;
- 2 end at 00:00;
- 40 are off the 15-minute grid;
- 7 classes run longer than 720 min;
- 47 lessons have a length off the quick list;
- `room` is null on 552 and never `''`.

1. **MAJOR** | C4 | `sessions/sessionsModel.ts:235`, `SessionSheet.tsx:292` | Level is treated as required.
   - Plan rule 11 lists "level per class" under OPTIONAL details. Rule 10 (the blocker list) has no level. D1 says stored values are left untouched. "A level keeps at least one chip" stops the last chip being removed; it does not make a level required.
   - So the plan supports neither blocking nor pre-filling. Answer to brief item 4: neither "blocks with a reason" nor "loading must pre-fill" is right. Load as `[]`, save as `[]`.
   - Failure: [class 20:00-21:00 with no level, party 21:00-02:00], untouched, gives Done disabled with "Pick a level". The organiser cannot add a DJ to the party. This hits 134 live classes.
   - Fix: drop the level issue, or apply it only to newly created sessions.
2. **MAJOR** | C4 | `SessionSheet.tsx:271-275,292`, `SessionCard.tsx:64,217` | The per-card reasons never show. `tried` is set only in `done()`, and `done()` cannot run while Done is disabled. | Session 2 of 2 has no level: click Done and 0 `session-issues` elements render. The footer says "Pick a level" without saying which session. | Show each card's reason at all times, or keep Done enabled and scroll to the first bad card on tap.
3. **MAJOR** | C4 | `sessionsModel.ts:92-116,234` | An untimed session (220 parties) gives dead-end pickers. | `{start:'',end:''}`: the Start select shows 08:00 while its value is `''`; the End select has 0 options; the reason is "End after start". Choosing the 08:00 already on screen fires no change. | Add a "Pick a start" placeholder option, disable End until a start is set, and make the reason "Pick a start time".
4. **MAJOR** | C4 | `sessionsModel.ts:47,108-110,118-121` | `MAX_SESSION_MINUTES = 600`, but `programmeModel.ts:59` has `sessionMaxMinutes: 12*60`. This is a second, conflicting copy of a limit, and C3 owns neither. | Party 20:00-07:00 (660 min): the End select shows 20:15 while the model holds 07:00, and the reason "End after start" is false. The 7 stored classes over 720 min block Done for their whole date (rule 28: no change without the owner). | Put one cap in `event-rules.json`. Keep a stored out-of-range end as a visible option with a true reason.
5. **MAJOR** | C4 | `SessionSheet.tsx:264,276` | Saving an untouched list still saves. | Untouched [late 01:00, eve 21:00], then Done: `onSave` is called once with a new array re-sorted to [eve, late]. Any caller that diffs by index sees a change. This breaks the ER-COMMON rule "saving an untouched record sends nothing". | When the list is deep-equal to the initial list, close without calling `onSave` (or pass `changed:false`). Add a test.
6. minor | C4 | `sessionsModel.ts:181` | A null room crashes the sheet. | `roomVisible([{room:null}])` throws a TypeError. 552 of 662 rows have a null room. | Use `(s.room ?? '').trim()`, and give the loader a contract.
7. minor | C4 | `SessionDraft` start/end | A stored `HH:MM:SS` time is treated as invalid. | `'21:00:00'` behaves like the untimed case (C4-3). Every stored row is in this format. | Ship a `fromStored` normaliser; the `programmeModel.ts:180` `hhmm` helper already exists.
8. minor | C4 | `SessionCard.tsx:135-162`, `sessionsModel.ts:170-172` | Other can look pressed while the end list is hidden. | Class 19:00-20:15 loaded with `otherLength:false` shows Other pressed and a read-only end. This affects 47 lessons. | Derive `otherLength` from the length on load.
9. minor | C4 | `sessionsModel.ts:233-234` vs `event-rules.json:33,39` | The same fact is worded twice. | Bad times read "End after start" (C4) vs "Session times invalid" (C3). "Name needed" is hard-coded. `STEP=15`, the 120-minute non-lesson default and the party-to-djing `searchRole` choice are not in the rules. | Read the text from `rules.blockers`, and move the constants into the JSON.
10. minor | C4 | `SessionCard.tsx:218` | A raw Unicode `·` in a JSX string (CLAUDE.md: entities only). | none (cp1252 mojibake risk) | Use `'·'` or `&middot;`.
11. minor | C4 | `SessionSheet.test.tsx:239-248` | The test "...returning focus to the opener" never asserts focus. Focus does return (scratch probe), but no mutant of focus return would turn this test red. | none today | Assert `document.activeElement === opener`.
12. minor | C4 | `SessionSheet.tsx:289-293` | The disabled-Done reason is not linked to the button. | A screen reader hears a dimmed "Done" with no reason. | Add `aria-describedby`.

Checked and correct:
- an 00:00 end ("00:00 (next day)");
- off-grid 21:07-02:07 loads and saves unchanged;
- a level on a party is kept;
- an unknown kind renders and saves as-is;
- the room is list-wide;
- tap targets are explicit 44px;
- Escape closes the sheet;
- icon buttons are labelled;
- the no-results line says what to do;
- kinds, labels, level flags and quick lengths are read from C3 (`eventRules.ts:111-123`).

## ER-C5: venue picker

1. **MAJOR** | C5 | `venue/venueApi.ts:29-34` (`toError`) | Errors are sorted by the substring `'rate'`, and every other server refusal becomes `failed`, which shows "Check your connection and try again". The repo's `shared/selfServeErrors.ts` (`isServerRefusal`, `permission_denied: ...`) is not used. | `{code:'P0001', message:'permission_denied: authentication_required'}` gives "Check your connection". If AD1 codes the 5-a-day limit like the existing caps (`permission_denied: ..._daily_cap`), the limit also gives "Check your connection", while Add stays enabled and can never succeed. | Pin the exact limit code from AD1's SQL and match it anchored. Send unmatched server refusals to a non-network message. Add test rows for both.
2. **MAJOR** | C5 | `venue/VenuePicker.tsx:86-94` | After a create, the `['organiser-venue-options']` cache (staleTime 10 min) is not updated. `Details.tsx:192` and `dates/index.tsx:76` name the venue from that cache. | Create "Zumba Loft" and pick it: the event's venue row reads "Venue" for up to 10 minutes. Brief: the new venue is "usable on the event at once". | `setQueryData` to append the draft, or invalidate the query.
3. minor | C5 | `VenuePicker.tsx:26` | The rate-limit text "added a lot of venues just now" is wrong for a 5-a-day limit. | Hitting the limit: the text implies waiting a few minutes. | Use "You can add 5 venues a day. Try again tomorrow, or pick an existing venue."
4. minor | C5 | `VenuePicker.tsx:141,153,155` | The `bad` postcode message can never show (the lookup is disabled until the shape is valid), and the disabled reason misleads. | "E1 6A" gives the reason "Postcode needed". | Change it to "Full UK postcode needed".
5. minor | C5 | `VenuePicker.tsx:92` | When `existing:true` returns a venue that is not in `all`, the code falls back to the TYPED name, not the stored one. No test covers this. | A typed "zumba loft" matches the stored "Zumba Loft": the row shows the typed casing. | Add a test row, or read the name from the result.
6. minor | C5 | `VenuePicker.tsx:117`, `venueSearch.ts:14` | Raw non-ASCII in the source: a `' · '` separator, and a regex holding literal combining marks. | A cp1252 round-trip silently corrupts the regex range. | Use `·` and `/[̀-ͯ]/g`.
7. minor | C5 | `VenuePicker.tsx` (step changes) | The focused button unmounts on each step change, so focus drops to `<body>`. The "Is it one of these?" step has no Back. | Keyboard or screen-reader user: focus is lost after a lookup. | Focus each step's heading or first field, and add a Back button.

Server interface (item 1): the RPC names and arguments match AS BUILT exactly:
- `{venues:[...]}` and `{venue_id, existing}` are unwrapped correctly;
- `p_area` comes from the postcodes.io ward, else parish, else district, and lands in `venues.neighbourhood`;
- `existing:true` selects that venue and creates nothing.

So the picker will work against the real function, apart from error mapping (C5-1). Both functions are absent from prod today, which is expected (server not landed).

Outside wave 1, for the owner of `get_organiser_venue_options_v1`: prod returns every venue including other people's drafts. That goes against the AS BUILT visibility rule for similar venues.

## ER-C2: Ember look

1. **MAJOR** | C2 | `ui/ember.css:33` (`--gold:#f0703a`) on `--card2:#33373d` | A selected Chip in Ember fails text contrast. | `<EmberWorld><Chip selected>Sensual</Chip></EmberWorld>`: 14px semibold accent on card2 = **4.04:1** (needs 4.5). | Use `--fg` text with an accent border and check, or a lighter accent tone (~#f5865a) for text on card2.
2. **MAJOR** | C2 | `ui/ember.css:39-40` (`--warn-bg: rgba(240,112,58,.14)`, `--warn-fg:#f0703a`) | Warn tags and notes fail contrast in Ember: StatusTag draft/party, home `problem`, the `dates/index.tsx:167` cancelled note. | Inside a Card the composite background is #463633: text = **3.86:1**. On bg it is 4.41:1. | Lower the warn-bg alpha to ~.08, or lighten warn-fg (~#ff9a6a).
3. minor | C2 | `__tests__/ember.test.tsx` | Nothing guards the selector scope (proved by mutation, below). | `.ember-world,` changed to `:root,` in ember.css: all 63 tests stay green, while every public page would get the graphite ground and Outfit. | Add a test that ember.css selectors are only `.ember-world` / `.org-theme`.
4. minor | C2 | `ui/ember.css:31` `--ph:#9097a1` | Placeholder text on card2 = 4.06:1. | Placeholder in an Ember field on card2. | Use #9aa1ab or lighter.
5. minor | C2 | `DateChip.tsx:19`, `PersonRow.tsx:35` use `--r-chip` | In Ember, `--r-chip:999px` makes the 48x52 DateChip a stadium shape. | Ember DateChip renders near-round. | Give DateChip its own token, or use `--r-ctl`.
6. minor | C2 | `ui/ember.css:10`, `theme.css` | An `.org-theme` inside `.ember-world` resets every token. | `<EmberWorld><OrganiserShell/></EmberWorld>` (`OrganiserShell.tsx:84` carries `org-theme`) loses Ember. Nothing does this yet. | Document that EmberWorld sits inside the shell, or add `.ember-world .org-theme` to the override selector.

**Scope (brief item 5): no default screen changes.**
- Every one-line ui change swaps a hard-coded value for `var(--x, <same value>)`, and the default tokens restate today's values.
- SheetView adds `ember-world` only inside EmberWorld (tested).
- Chip without `onRemove` returns the same `<button>`, and no existing caller passes `onRemove`.
- The Chip remove hit area is explicit `h-[44px] w-[44px]`, with an `aria-label`; no rem tap sizes.

Contrast passes:
- ink on accent: 6.46;
- AttentionStrip warn-fg on warn gradient: 5.02 / 5.21;
- accent on bg / card / sheet: 5.37 / 4.66 / 4.66;
- ok-fg on ok-bg: 6.87.

`focusReturn.test.tsx`: the 2-line change ADDS `sessions/SessionSheet.tsx` to the list of call sites that must pass `returnFocusRef`, so the test got stricter, not weaker.

## Cross-slice (item 7)

- Kinds, labels, level flags, quick lengths and payment codes have one source (`event-rules.json` via `eventRules.ts`). C4 and C5 read it, and C5 duplicates nothing.
- Duplicates found: the session-length cap (C4-4, which conflicts with `programmeModel.ts`), the bad-times wording (C4-9), and "Name needed" (C4-9).

## Item 9: calendar exclusion list and `ui/dialog.tsx` untouched

`git diff --name-only b0983348 origin/claude/er-wave1 | grep -E 'calendar|EventCalendar|useCalendarEvents|ui/dialog'` exited **1** (no match). Proven untouched.

## Item 6: mutation tests (each reverted)

| # | Slice | Mutant | Tests | Result |
|---|---|---|---|---|
| 1 | C3 | past-date `<` changed to `<=` | eventRules.test.ts | RED |
| 2 | C3 | after-midnight rollover offset removed | eventRules.test.ts | RED |
| 3 | C3 | festival allows every payment code | eventRules.test.ts | RED (2) |
| 4 | C3 | workspace fallback removed in `resolveSeries` | useOrganiserSeries + notFound | RED |
| 5 | C3 | level allowed on workshop in the JSON | eventRules tests | RED |
| 6 | C4 | level issue dropped | sessions | RED (3) |
| 7 | C4 | `setEnd` accepts any end | sessions | RED (5) |
| 8 | C4 | Done always enabled | SessionSheet.test | RED |
| 9 | C5 | picker ignores `existing:true` | venue.test | RED |
| 10 | C5 | `toError` loses the rate-limit branch | venue.test | RED |
| 11 | C2 | Chip remove 44px changed to 32px | ember.test | RED |
| 12 | C2 | **`.ember-world,` changed to `:root,` in ember.css** | ember.test | **GREEN (survives)**: C2-3 |
| 13 | C2 | **Chip without `onRemove` wrapped in an extra span** | ember.test | **GREEN (survives)**: the "default render unchanged" test checks only that no remove button exists |
| 14 | C4 | (no mutant) the focus-return test asserts no focus | SessionSheet.test | cannot fail on focus: C4-11 |

Weakest tests overall:
- the C2 scope test;
- the C4 focus test;
- the C3 `gone` test, which passes against a server reply that never happens (C3-1).

## Commands and exit codes

| Command | Exit |
|---|---|
| `npx vitest run src/modules/organiser` (wave1 @ 4c6d1f5) | 0 (126 files, 3641 passed, 2 skipped) |
| `npx eslint <changed .ts/.tsx>` | 0 (2 warnings, react-refresh in EmberWorld.tsx) |
| `npm run typecheck` (wave1) | 2: 99 errors, none in wave-1 files |
| `npm run typecheck` (base b0983348) | 2: 99 errors, so all pre-existing |
| `npm run build` | 0 |
| `npx vitest run src/modules/organiser/venue` | 0 (30) |
| `npx vitest run src/modules/organiser/sessions` | 0 (123) |
| `npx vitest run` ember + focusReturn | 0 (74) |
| `npx vitest run` shared/__tests__ + notFound + rebuildSwitch | 0 |
| `node scripts/check-script-conventions.mjs` | 0 |
| `node scripts/check-event-rules-mirror.mjs` | 0 (SKIPPED) |
| `node scripts/check-event-rules-mirror.mjs --self-test` | 0 |
| `EVENT_RULES_ADMIN_REQUIRED=1 node scripts/check-event-rules-mirror.mjs` | 2 |
| `node scripts/check-event-rules-mirror.mjs --admin` (no value) | 0 (fails open: C3-8) |

The Supabase read-only SELECTs were counts only on `event_series_program_item_p5` and `venues`, plus one `pg_get_functiondef` (`_assert_can_edit_series_p5`) and catalogue lookups.

## Verified / Not verified

**Verified:**
- the four slices' unit tests, eslint, build, and typecheck parity with the base;
- the 14 mutants above;
- prod shapes for sessions and venues (counts);
- the prod text of `series_not_found`;
- RPC names and arguments of C5 vs AS BUILT;
- WCAG ratios computed from the Ember tokens;
- the exclusion-list diff proof;
- the C4 round-trip behaviour (scratch jsdom probes, deleted).

**Not verified:**
- No browser walk at 390x844: no route mounts EmberWorld, SessionSheet or VenuePicker yet. C3-1 is proven from code and the prod function text, not in a browser.
- The admin repo: access was refused here, so the admin rules copy, its line endings and AD1's real rate-limit error code are unread.
- AD1 functions are not on prod (server not landed), so there is no end-to-end run.
- The real postcodes.io response was not fetched.
- The full `npm run lint` chain and the other CI workflow jobs were not run.
- No real phone.
