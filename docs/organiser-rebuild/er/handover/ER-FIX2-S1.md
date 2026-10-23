# ER-FIX2-S1 handover: rules-shell (ticket dt_4a3c95189dd4)

Brief: `docs/organiser-rebuild/briefs/ER-FIX-W2.md` on `arc/briefs-organiser-r1`, pinned sha `ae6e2a7` (blob). The branch tip
blob `d34beed` only adds owner answers 13-14 (S7 byline, S8 merge order); nothing in S1 changed. Audit:
`ER-AUDIT-rules-shell.md` on `claude/audit-er-rules-shell` (`fa649f9`). Branch `claude/er-s1-rules`, `origin/main` (`3a21361`)
merged first with no conflict.

## Needs action elsewhere

- **ER-C13 (admin repo): the admin copy of `event-rules.json` needs the IDENTICAL change** (byte for byte; the file is CRLF
  in this repo's working tree, LF in git). New keys `formatOff`, `blockerVariants`, the four new `seriesLookup` keys,
  `ownerCreateFormats` + `festival`, the new blocker words, `serverCodes` reordered (session first), the fixed
  `$comment`, and three new `fixtures.readiness` rows plus `ticketUrl` on the ticket-link rows. Until then
  `check-event-rules-mirror.mjs` would report a diff once it is wired (it is still NOT wired: brief says KEEP).
- **Consumers on other slices** (none renamed, all additive):
  - S8 / C7: read `ownerCanCreate(format)` and `formatOffReason(format)` ("Not available yet" for course) instead of
    `flows/new/model.ts`'s own list. Festival is now ON in the rule set (decision 1); S8 still merges only after AD2+AD3.
  - S5 / C8: pass `ticketUrl` (the series `default_ticket_url`) into `RuleSeries`; without it a pre-live series with a ticket
    link reads "Add the ticket link". Use `useRebuildSwitch(eventOrganiserIds)` (the series `organiser_ids`, owner first,
    e.g. `linkedOrganiserIds(ws.series)`) instead of the no-argument form, so the switch is per event.
  - S4 / C11, S6 / C9: `isRetrySuccess(error)` in `shared/selfServeErrors.ts` (decision 5); `useRebuildSwitch(eventOrganiserIds)`.
  - S2 / C4: `rules.blockers.name` / `.sessionTimes` now read "Add an event name" / "Fix the session times"; your tests
    read them by reference, so they still pass, but the session sheet's words change. `isUntimedSession(x)` is exported.

## Findings

| id | outcome | what changed | red-first proof |
|---|---|---|---|
| F1 festival create | FIXED | `ownerCreateFormats` = one_off, recurring, festival; `formatOff: { course: "Not available yet" }` + `formatOffReason()`. | `eventRules.fix2.test.ts` "owner create formats": red (festival false, `formatOffReason` missing). C3-4 test that pinned festival OFF REWRITTEN (superseded by decision 1). |
| F2 one label map + AD1 codes | FIXED | Blocker words = prototype v7 FIX map (Pick a venue / Pick a date / Add a session / Add a flyer / Add how to pay). `GO_LIVE_LABEL` derives `venue`, `name`, `cover` and the five AD1 codes (`no_session_first_date`, `first_date_past`, `bad_session_times`, `no_payment`, `no_flyer`) from `event-rules.json` via `serverCodeBlocker()`. `session` / `upcoming_date` / `city` etc. are A-DB1 / D55 facts the rule set does not hold, so they keep their words. | fix2 "server go-live codes have labels": red (all five read "Something else on the event"). `goLive.webA1a` + `GoLiveFlow` tests that pinned "Add a venue" / "Upload a flyer" REWRITTEN to the v7 words; the D82 key-set test now includes the rule-set codes. |
| F3 ticket link without URL | FIXED (pre-live only) | `RuleSeries.ticketUrl?`; before go-live a chosen ticket link needs prototype v7 `okTicket` (https, dotted host); reason "Add the ticket link". Live / paused / ended are never turned Not ready by it (same stance as the 12 h cap; parked). | fix2 "ticket link needs a URL": red. Fixtures `fix.test` / `eventRules.test` that used a ticket link with no URL got a URL (rewritten, not deleted). |
| F4 untimed first-date session | FIXED | `isUntimedSession()`; `sessionTimes` ignores sessions with neither time (null or blank), so a live weekly with an untimed item reads ready. A half-filled pair or end = start still blocks; next-day pairs are fine. JSON fixture rows added. | fix2 "untimed sessions": red. **Disagreed (half):** `session` still counts untimed sessions for one-off / weekly / course (AS BUILT: "a first date has no session"; decision 3). Festivals keep the timed-per-day `festivalDay` check. Parked. |
| F5 mirror not wired | KEEP (brief) | Not wired. Needs owner: workflow step + ER-C13 admin copy. | n/a |
| F6 not-found words | FIXED | v7 title + one-line next step for archived / can't open / can't find (`notFoundLines()`), button "Back to your events". Curly apostrophe is a backslash-u2019 JSON escape (ASCII bytes, no mojibake risk). WhichDay + Time show both lines. | fix2 "not-found words": red. `notFound.test.tsx` rewritten from "Event not found" to the v7 words + line + button. |
| F7 cap 720 vs 600 | PARKED (owner pick) | unchanged | n/a |
| F8 dead exports | PARTLY | `serverCodes` now read by `goLiveCheck`; `ownerCanCreate`, `cancelReasons`, `readiness` stay for S5/S6/S8 (listed above). | n/a |
| F9 `$comment` | FIXED | "an end before its start means the next day, an end equal to its start is invalid, and a session with neither time is untimed and valid". | doc only |
| F10 "Pick a type" | FIXED | "Pick how often". | fix2 asserts no "type". |
| F11 switch per login + flash | FIXED | `rebuildEnabledForEvent(raw, eventOrganiserIds)` (owner = first id; `*` = every event); `useRebuildSwitch(eventOrganiserIds?)` (no argument = per login, unchanged for existing callers; `null` = event not read yet = false). `rebuildPending()`; OrganiserRoutes renders its skeleton while a real allowlist waits for the home read. Context value is now `{ raw, on, pending }`. | `rebuildSwitch.perEvent.test.ts`: red. |
| F12 vacuous untouched-save test | FIXED | Also asserts an edited draft IS a change. | Mutant "hasBasicsChanges always false" would now fail. |
| F13 retry-as-success | FIXED | `isRetrySuccess(error)`: `already invited` / `already linked` / `this invite is no longer open`. | fix2 "retry counts as success": red. |
| F14 behind main | FIXED | `origin/main` merged first. | n/a |

Red run on the unfixed code (new files only, before any source change): **49 failed / 10 passed** (2 files).

Mutation check after the fix (one at a time, reverted): untimed skip removed (7 fail), ticket URL check off (8),
pre-live gate removed (3), festival words off (1), per-event uses any page (1), pending ignores loading (1),
AD1 label spread removed (12), retry regex narrowed (1). **8/8 killed.**

## CI (per job, sandbox)

Run on `de61a41` plus the comment-only fix in the final commit. `lint:architecture` was re-run after that fix and passes.

| job | command | exit | note |
|---|---|---|---|
| architecture-guard / integrity | `bin/check-integrity.sh` | 0 | run through `bash`; sandbox file mode is 100644 (CI runs `chmod +x`) |
| integrity | `check:legacy-tables`, `check:legacy-program-rpcs` | 0 / 0 | |
| integrity | `lint:architecture` | 1, then **0** | Red at first: comments named the legacy field `organiser_ids` (`[no-legacy-organiser-fields]`). Comments reworded; passes now. |
| integrity | `AUDIT_STRICT=1 check:images`, image-widths (+ self-test), plan-hygiene self-test, artifact policy, mojibake self-test + guard, entry-point proof (+ self-test) | 0 | |
| typecheck / wallclock-brand | `check:rpc-typing`, `check:wallclock-brand` | 0 / 0 | |
| unit-tests / unit | `test:unit:offline` | 1 | 12185 passed, 5 failed, all in `tests/integrityCouldNotRun.test.ts`. Sandbox `NODE_PATH` holds typescript. Fails the same way on main and passes with `NODE_PATH` unset. |
| unit | `test:unit:timing`; tz New_York + Sydney files | 0 / 0 / 0 | |
| unit-tests / dancer-area-isolation | self-test + check | 0 / 0 | |
| lint | `npm run lint` | 1 | 18/20 links pass. The 2 failures are `check:integrity` (126, sandbox file mode) and `lint:architecture` (since fixed). |
| perf-budget / bundle-budget | `npm run build`, `check:bundle-budget`, `check:first-load-requests`, `check:chunk-cycles` (+ self-tests) | 0 | |
| phone-qa / build-smoke | build + `playwright.build.config.ts` | 0 | 67 passed |
| phone-qa / phone-qa | `playwright.phone.config.ts` | 0 | 272 passed, 74 skipped |
| e2e-smoke | `npm run test:e2e` | 1 | 158 passed, 2 failed, and both also fail on main. `organiser-home.spec.ts:55` (home-error). `organiser-layout.spec.ts:171` timeout (passed on rerun here). |
| workflow-lint | BOM, masking, notification, no-preview-prefixes | 0 | |
| db-contract-check | live-db gate, migration stamps, 11 `--self-test`s, script conventions | 0 | live `check-*.mjs` need prod secrets: not run |
| (not wired) | `check:event-rules-mirror` (+ self-test) | 0 / 0 | SKIPPED: admin copy not in the sandbox |
| not runnable | types-drift, phone-qa-section, real-data-verified, lighthouse / doc-weight / og / seo / synthetic previews, live contract tests | n/a | need secrets, the PR body or a deploy |

## Shapes

Checked (table tests, from ER-AUDIT section 4 / ER-FIX-C3 counts, not re-surveyed): live weekly with a past first date;
first date with an untimed item, null and blank (223 untimed in prod); timed + untimed mix; half-filled pair; end = start;
next-day pair; ticket link with no / blank / non-URL / http / https URL, pre-live and live / paused / ended (51 live
ticket-link series); festival with no sessions and no payment; course / festival / one_off / recurring create; event with
owner + co-organiser pages; event with no organisers (571).

Not checked: the real `default_ticket_url` presence on the 51 live ticket-link series; the real organiser_ids order on
the 6 two-organiser events.

## Verified

- Organiser suite 4101+ passed after the rewrites; full offline unit suite 12185 passed (5 sandbox-only failures, same on main); build, bundle budgets, phone-qa and build-smoke green; 8/8 mutants killed; red-first run recorded above.

## Not verified

- **Prod shape survey: NOT RUN.** The Supabase connector needs authorisation in this session; counts are ER-FIX-C3's.
- Admin repo (`bachata-admin-11april`) not reachable from this session: AD1/AD2 function bodies (`no_session_first_date`
  timed-or-not, retry refusal texts) not read; the retry texts come from the brief (decision 5).
- AD2 festival create on prod: not applied yet (brief); the rule set says ON per decision 1.
- Browser walk at 390x844 of the not-found screens and the no-flash skeleton: not done.
- Vercel preview: not checked.
