# Flyer reader: whole-arc review (R1-R20)

Brief: `docs/briefs/review-flyer-arc.md` (branch `brief/review-flyer-arc`, sha 433736ed). Contract: `docs/briefs/flyer-arc-contract.md` on the same branch (draft 2026-11-08).
Reviewed: `origin/main` at `a6a156c` (slice 2 #1494 `7d80b0e`, slice 3 #1498 `5e300d3` incl. review fixes D1, D2, D5, D7).
Reviewer: independent (not the builder, not the lead). Report only, no code changed.

Method: read the mapping (`src/modules/organiser/p3/new/flyerToDraft.ts`, `flyerReadShape.ts`), the screen (`FlyerStart.tsx`, `useFlyerRead.ts`, `CreateFlow.tsx`, `create.css`), the save path (`useCreateSave.ts`, `events/media.ts`, `shared/flyerModel.ts`), routes (`p3/shell/P3Routes.tsx`) and both test files. Every "missing" claim below was checked with `git grep` on `origin/main`. One throwaway vitest probe (deleted, not committed) ran `flyerToDraft` / `flyerHandoff` on the fixture rows and four extra shapes; its output is quoted where used.

**Not in scope of this repo:** slice 1 (admin `event-flyer-read` function, usage table, spend cap, kill switch; admin #1328/#1330). The admin repo is not attached to this session, so every server-side half of a row is NOT VERIFIABLE FROM CODE here.

## Verdict

**Ready to turn on: NO.** One HIGH defect (N1: a monthly "1st Saturday" flyer becomes a wrong date AND a wrong repeat rule, unmarked) and one contract FAIL that follows from the same code path (R4: a past date on a repeating flyer is silently moved forward). Two smaller FAILs (R10 bare domains survive, R11 attempts-limit copy gives a next step that cannot work). Blockers at the end.

## Contract rows

| Row | Result | Evidence |
|---|---|---|
| R1 P4/P5 never see the entry; function 403/401 | Client PASS. Function NOT VERIFIABLE FROM CODE | P5: all P3 routes sit inside `<AuthGuard>` (P3Routes.tsx:78); a missing token sends nothing and shows "unauthorised" (useFlyerRead.ts:103-105; test "no session = unauthorised, nothing sent"). P4: no page = "Set up your page first" card before the kind step renders (CreateFlow.tsx:413-421), so the entry never mounts. No render test for the P4 case (the entry tests at flyerStart.render.test.tsx:100 all assume a page). 403/401 from the function is slice 1. |
| R2 flyers 1, 2, 4, 5, 8, 9, 10 equal the truth table; no invented value | **FAIL (flyer 5)**; others PASS against the fixture | Fixture rows `flyerReadFixtures.ts` + `flyerToDraft.matrix` `it.each(ROWS)`, and "the 11 reference flyers through the hand-off". Flyer 5 (monthly first Saturday): `firstDate` = `2026-11-14`, which is the **second** Saturday of November, and `withFirstDate` then builds `repeat.nths = [2]` (probe: `{"freq":"monthly","monthBy":"nth","nths":[2],"weekday":6}`), with `firstDate` NOT doubtful. That is an invented value. See N1. Note: `flyer-reader-8-flyers-truth.md` is not on main or the brief branch (`git grep` empty), so "equal to the truth table" is checked against the fixture summary, not the truth file itself. |
| R3 flyers 3, 6: first event, note "N events, others not read" | PASS | flyerToDraft.ts:80 `many_events`; shown in the "From your flyer" card (CreateFlow.tsx:280-285); tests "several events: the note says so", fixture rows 3 and 6. |
| R4 flyers 2, 5, 8: past date kept, doubtful, "this date has passed"; never next year | **FAIL (repeating kinds)**; PASS for one-off | One-off (2, 8): flyerToDraft.ts:94-97 keeps the date, marks it doubtful, adds `past_date`; test "never moves a past date to next year". Repeating (5, and any weekly/monthly flyer that prints a dated past occurrence): line 88 takes the `weekday` branch first and replaces the printed date with the next weekday from today. Probe: monthly read with `date_start 2026-10-04`, weekday Saturday -> `firstDate 2026-11-14`, notes `[repeats, no_venue]`, no `past_date`, date not doubtful. The date IS moved, silently. |
| R5 flyers 1, 4, 5: one date + "this repeats, set how it repeats below"; no repeat rule built | PARTIAL | Note: flyerToDraft.ts:86, shown above the Repeats row. But `withFirstDate` (model.ts:137-143) auto-derives a rule from the first date, as the hand-made flow does, so a rule IS pre-set: weekly = correct weekday (probe flyer 1: `weekdays [6]`); monthly = the nth of the guessed date, wrong for flyer 5 (N1). Consistent with J11 (same as a hand-made draft), but the mapping never tells the form the rule is a guess. |
| R6 flyers 7, 11: not-enough note names what is missing; editor opens with the title | PASS (code); test gap | flyerToDraft.ts:152-154; held card + "Use what we found" (FlyerStart.tsx:337-350); D7 title tests. Gap: fixture 7 gives the course a venue (`venue_name: 'The Ritz Club'`), contrary to the contract's "course no date no venue", so the not-enough path for flyer 7 is untested. Probe with the contract shape (course, title only): notes `[not_enough]`: correct. |
| R7 venue: exactly one -> set; two or none -> empty + "Flyer says" | PASS | flyerToDraft.ts:114-127 (`hits.length === 1`); "Flyer says: ..." CreateFlow.tsx:300; test "venue: exactly one match sets it, two or none leave it null and doubtful". Matching is a substring on name or neighbourhood (model.ts:177-180): a short flyer name could match one unrelated venue by neighbourhood. Real-venue matching is NOT VERIFIED (contract F). D2 timeout path continues with no match (test "D2: a venue list that never settles"). |
| R8 tick list; only ticked land; after-midnight ends saved next-day | PASS | `applySessionChoices` (flyerToDraft.ts:161-167) keeps HH:MM; `endsNextDay` = end <= start (shared/programmeModel.ts:233) is what the save reads. Tests "applySessionChoices adds only ticked ones and keeps a next-day end as an earlier end", "the tick list adds only the ticked sessions". A doubtful `sessions` read starts unticked (flyerToDraft.ts:136). |
| R9 single price = one doubtful row; tiers = none; ticket link printed only, doubtful; QR never decoded | PASS (client); tiers NOT VERIFIABLE | flyerToDraft.ts:140-150; test "single price is one Ticket row in pounds". Tiers -> no rows depends on the function returning `price: null` (slice 1). No QR code path exists (`git grep -i qr` in `p3/new`: none). Minor: an unknown currency becomes GBP (probe: CHF 20 -> `GBP 20`), marked doubtful only (N5). |
| R10 links stripped everywhere but the ticket link; injection changes nothing | **FAIL (partial)** | `cleanText` strips only `http(s)://` and `www.` (flyerToDraft.ts:29). Probe: title `Night bachata.co.uk/tix ...` and venue `see salsa.london` pass through unchanged. They render as React text (no link, no `dangerouslySetInnerHTML`), so nothing is clickable, but the title is saved and published as the event name. Injection text is inert on this side; whether the model obeys it is slice 1. Free `notes` are never shown (A16). |
| R11 P6/P7/P8 right screen with a next step; copy never points at a missing control | **FAIL (P7 copy)**; rest PASS | All cards have "Fill it in yourself" (FlyerStart.tsx:318-326; test "each reader answer has its screen and a way forward"). Daily limit: no number, reset time in London (D5 fixed, :355-358). Attempts limit: "Too many tries in a row. Wait a few minutes before the next flyer" (:360), but the contract's attempts cap is **15 per day**, so waiting minutes does not help (N3). Switched off: "paused for now" (:362). |
| R12 failed read: attempt used, success not used | NOT VERIFIABLE FROM CODE | Server (slice 1). Client maps `read_failed`/`bad_image`/off-shape to "Couldn't read that one" (FlyerStart.tsx:367-369; useFlyerRead.ts:63). |
| R13 attempts cap hard; success cap soft; limit screen once reached | Client PASS; server NOT VERIFIABLE | One read per hook (`run.current`, useFlyerRead.ts:117; test "reading: one at a time"). Two tabs are not guarded client-side (by design: the server cap). The limit screen shows from the `daily_limit` word whatever the count. |
| R14 nothing saved/uploaded until save; Back/refresh as today | PASS | Hand-off in module memory only (useFlyerRead.ts:210-215); draft to the existing `DRAFT_STORE_KEY`; upload only in `useCreateSave` (:154-168). Leave/Cancel forget it (CreateFlow.tsx:196, 383); test "leaving without saving forgets the flyer". Refresh keeps the draft but drops marks, notes, ticks and the cover: documented, same as the normal flow's in-memory cover. |
| R15 flag off / older screen: zero change | PASS (code); test weak (D6) | `flyerReaderOn()` needs all three flags (useFlyerRead.ts:18); `organiserFlyerReader` is `=== 'true'` (featureFlags.ts:74), default OFF. NewFlow (P10) has no flyer code (`git grep -n flyer src/modules/organiser/flows/new/*.tsx`: none outside tests). Flag matrix test :100. D6 still open. Whether `organiserP3`/`organiserSelfServe` are on in prod: NOT VERIFIED. |
| R16 cover on save only, existing check, removable | PASS | Upload only through `uploadEventPicture` (`checkFlyerFile` + `checkFlyerBytes` + `reencodeFlyer`, events/media.ts:9-13). "Remove photo" (CreateFlow.tsx:360, `p3-new-file` 48px); tests "D1: Remove photo drops the flyer cover..." and the D1 control. |
| R17 spend: kill switch, monthly cap | NOT VERIFIABLE FROM CODE | Server. Client maps `switched_off` only. |
| R18 reserve before model; no image/key/text in logs; analytics field names only | Client PASS; server NOT VERIFIABLE | No `console`/Sentry calls in FlyerStart.tsx, useFlyerRead.ts, flyerToDraft.ts. Analytics `flyer_read_saved` carries `flyer_read_filled`/`flyer_read_changed` field names only (useFlyerRead.ts:203-208; test "save: ... only field names are recorded"). D4 still open. |
| R19 390x844: taps >= 44px explicit px, no clipping/sideways scroll, contrast, every state has an action | PARTIAL | Taps explicit px: `.p3-btn` var(--tap) 44px, `.p3-new-file` 48px (create.css:40), entry row 56px (:22). Every state has an action (R11). Clipping, sideways scroll and contrast NOT VERIFIED: no 390x844 walk has been run on this arc (cont1 handover "Not verified"). |
| R20 British English, full weekdays, entities | PASS | No non-ASCII bytes in FlyerStart.tsx, useFlyerRead.ts, CreateFlow.tsx, flyerToDraft.ts, create.css (`grep -P '[^\x00-\x7F]'`: none). JSX uses `&hellip;`; JS strings use `’`. Weekdays via `Intl` `weekday: 'long'` (useFlyerRead.ts:25; test "resetWords: full weekday, London time"). |

Tally: PASS 9 (R3, R7, R8, R14, R16, R20 full; R9, R13, R18 client side), PARTIAL 3 (R5, R15 test strength, R19), FAIL 4 (R2 flyer 5, R4 repeating, R10 bare domains, R11 P7 copy), NOT VERIFIABLE 3 (R12, R17, and the server halves of R1, R9, R13, R18).

## Findings, ranked

### New in this review

1. **N1 (HIGH, R2 + R4 + R5)**: repeating flyers ignore the printed date. flyerToDraft.ts:88 picks `nextDateOnWeekday(today, weekday)` whenever a weekday is present. For a monthly "1st Saturday" flyer this gives the next Saturday (14 Nov 2026, a 2nd Saturday), and `withFirstDate` then builds a "2nd Saturday every month" rule. The date is not marked doubtful, so the organiser gets no "check this" mark. A printed past occurrence on a weekly/monthly flyer is also moved forward with no `past_date` note (R4). Failure: an organiser saves a monthly social that publishes on the wrong Saturday every month. Fix direction: for monthly, use the nth from the read (`recurrence_text` or the printed date's nth) or leave `firstDate` empty and doubtful; when `date_start` is printed, keep it and apply the R4 rule; mark a computed date doubtful. Add fixture rows with the contract's truth shapes.
2. **N2 (MEDIUM, R10)**: bare domains (`bachata.co.uk/tix`, `salsa.london`) survive `cleanText` (flyerToDraft.ts:29), so a link in the title (contract C: "a flyer with a link in the title") is saved as the event name. Not clickable. Fix: also strip `\b[\w-]+(\.[\w-]+)+(/\S*)?` shaped tokens with a known TLD, with a test.
3. **N3 (MEDIUM, R11)**: attempts-limit copy says "Wait a few minutes before the next flyer" (FlyerStart.tsx:360), but the cap is 15 per day. The next step it names does not work. Fix: same shape as the daily limit ("back <time>" from `resets_at`, or "back tomorrow").
4. **N4 (LOW, test gap)**: fixture 7 gives the course a venue, so the contract shape "course no date no venue" (not-enough) has no test (flyerReadFixtures.ts row 7). No P4 render test for R1. The truth file `flyer-reader-8-flyers-truth.md` is not in either repo branch read here, so the fixtures cannot be audited against it.
5. **N5 (LOW, R9)**: a currency other than GBP/EUR/USD becomes GBP (flyerToDraft.ts:142). Doubtful mark only. Fix: no row for an unknown currency.

### Parked from the slice 3 review (D3, D4, D6, D8), re-checked on main

| ID | Still present? | Severity now | Evidence |
|---|---|---|---|
| D3 | Yes | LOW | `open()` still runs from a `useEffect` keyed on `verdict` with an eslint disable (FlyerStart.tsx:313-316). StrictMode (dev) double-runs it: two navigations and two draft writes. Prod-harmless. |
| D4 | Yes | LOW | `flyer_read_saved` still called through a cast, not in `AnalyticsEventMap` (useFlyerRead.ts:204; `git grep flyer_read_saved src/lib/analytics.ts`: none). A typo would be silent; this is the J12 / gate 5 measure, so it matters for the "14 of 20 unchanged" bar. "Check this" also returns when a field is changed back (CreateFlow.tsx:259). |
| D6 | Yes | LOW | Byte-for-byte test (flyerStart.render.test.tsx:109) compares flag-on-minus-entry with flag-off, never with main's markup. |
| D8 | Yes (by design) | INFO | HEIC relies on the iOS picker converting (flyerModel.ts:20, `FLYER_ACCEPT` = jpeg/png/webp). A desktop HEIC gets the file-type card with a next step. |

## Ready to turn on: NO

Exact blockers (all must clear before `organiserFlyerReader` goes on for Ritmo Latino):

1. **N1**: fix the repeating-date mapping (monthly nth, printed date kept, computed date doubtful) with red-first tests from the contract's truth shapes (flyers 1, 4, 5 and a dated past weekly/monthly).
2. **N3**: attempts-limit copy must name a next step that works (reset time or tomorrow).
3. **N2**: strip bare domains from flyer text, with the contract's "link in the title" shape as a test.
4. **Slice 1 evidence**: R1 (403/401), R12, R13 server, R17, R18 server are unproven from this repo. The admin function review and its tests must be linked as evidence for these rows (gate E1).
5. **Gate E3 walk**: R19 (and R2/R14/R16 on a real phone) needs the 390x844 walk on a Ritmo Latino-shaped account with screenshots; none exists yet.

Not blockers (fix when convenient): N4, N5, D3, D4 (raise to blocker before gate 5, since it is the accuracy measure), D6, D8.

## Not verified
- Anything in the admin repo (function, usage table, RPC rows, spend cap, kill switch, RLS/GRANT).
- No browser walk, no screenshots, no contrast or clipping check.
- Real venue matching against the prod venue list; the live model on real flyers, Spanish, blurry, HEIC, Instagram story.
- Whether `organiserP3` and `organiserSelfServe` are on in prod, and the env value of `VITE_ENABLE_ORGANISER_FLYER_READER`.
- The truth file `flyer-reader-8-flyers-truth.md` (not found).
- The full unit suite was not run; only the throwaway probe above.
