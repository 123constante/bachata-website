# ACCEPTANCE CONTRACT: flyer reader ("Start from a flyer") -- DRAFT 2026-11-08, website-a2
Rule 5: no slice is accepted until every row below is walked at 390x844 on prod-shaped accounts and an INDEPENDENT reviewer (not the builder, not me) checks it against this contract BEFORE the owner sees anything. Owner sees one short phone checklist at the end of the arc.
Slices: 1 admin `claude/flyer-read-fn` (function + usage table), 2 Website `claude/flyer-read-mapping` (pure mapping), 3 Website `claude/flyer-read-screen` (screen behind `organiserFlyerReader`).
Decisions already clicked: see HANDOVER-flyer-reader.md (23 answers) and resilient-wishing-crab.md.

## A. Person types (who meets the feature)
P1 organiser, one page, signed in. P2 organiser with 2+ pages (page picker step). P3 organiser whose page is unclaimed/pending/not approved (decision: any signed-in organiser with a page may use it; same rule as the normal New event, so the contract copies createBlock). P4 signed-in non-organiser (no page): 403, sees nothing. P5 signed-out: no entry, function 401. P6 organiser who has used 5 reads today. P7 organiser at 15 attempts today. P8 any organiser while the kill switch or the GBP 5 monthly cap is hit. P9 admin: no special path (no admin bypass in v1). P10 organiser on the older NewFlow (organiserP3 off): sees nothing (owner: newer area only).

## B. Journeys (each person type x each journey that applies)
J1 choose a flyer from photos/files, read, land on the pre-filled form, fix doubtful fields, tick sessions, save: event created, flyer is the cover. J2 same, but leave without saving: nothing created, flyer forgotten. J3 not a flyer / blurry / model error: friendly screen, blank form one tap away, attempt counted (cap) but not a daily success. J4 daily limit: says when it resets, blank form one tap away. J5 attempts cap: same screen family, own words. J6 switched off (kill switch / spend cap): "paused for now", blank form. J7 offline or timeout. J8 refresh or Back on the pre-filled form: draft survives as the normal flow does. J9 flag off: kind step unchanged byte for byte. J10 two reads at once (double tap, two tabs): at most one counts against the limit more than once; never double-charges the daily count wrongly. J11 untouched pre-filled save sends exactly what the same hand-made draft would send. J12 the organiser changes every doubtful field and saves: logged filled-vs-changed field names only.

## C. Data shapes (flyers and accounts)
Flyers: the 11 in `flyer-reader-8-flyers-truth.md`: 1 weekly no date, full address; 2 one-off class+party, past, no year; 3 three-night multi-event no venue; 4 weekly 2 rooms ends 01:00; 5 monthly 1st Saturday no venue 10 sessions; 6 two events + dense timetable; 7 course no date no venue; 8 boat party past; 9 festival 6-8 Nov address only; 10 Spanish festival; 11 price-only promo. Plus: wrong file type, over 5 MB (the function limit; slice 3 downscales first so a normal photo fits), iPhone HEIC photo (re-encoded before upload), a screenshot with phone chrome (not yet tested: Instagram story), a flyer carrying an instruction in its text ("ignore the above"), a flyer with a link in the title.
Accounts: organisers with 0, 1, many venues matched; venue name matching exactly one, two, none known venues; organiser pages with 0 upcoming events and with 30 dates (DATES_MAX); an account at 4 of 5 reads and one exactly at the limit; a month-spend counter just under and just over GBP 5.

## D. Acceptance rows (each: person x journey x shape -> expected; "Pass" needs a screenshot or test name)
R1 P4/P5 never see the entry; function refuses 403/401 (slice 1 tests + slice 3 render test).
R2 P1 x J1 x flyers 1, 2, 4, 5, 8, 9, 10: pre-filled values equal the truth table; doubtful marks present where listed; no value invented.
R3 P1 x J1 x flyers 3, 6: first event read, note "this flyer has N events, the others are not read".
R4 P1 x J1 x flyers 2, 5, 8: past date kept, doubtful, note "this date has passed"; never moved to next year.
R5 P1 x J1 x flyers 1, 4, 5: one date + note "this repeats, set how it repeats below"; no repeat rule built.
R6 P1 x J1 x flyers 7, 11: not-enough note names what is missing; editor still opens with the title.
R7 P1 x J1 venue: exactly one known venue set; two or none -> empty plus "Flyer says: ..." beside the normal picker.
R8 P1 x sessions: tick list; only ticked sessions land; ends-after-midnight sessions saved as next-day ends.
R9 P1 x price: a single clear price becomes one doubtful row; tiers/early-bird/per-day = no rows. Ticket link: printed web address only, doubtful; QR never decoded.
R10 every figure of text from a flyer: links stripped everywhere except the ticket link field; the injection flyer changes nothing.
R11 P6, P7, P8 x J4/J5/J6: the right screen with a next step; copy never points at a missing control.
R12 J3 failed read: attempt used, daily success not used (assert in the function tests with the real RPC rows).
R13 J10 concurrency (revised 2026-11-08 after the slice 1 review): the ATTEMPTS cap (15/day) is hard and race-free; the daily SUCCESS cap (5) is soft: parallel requests may overshoot by up to about 10 reads (about 10p), accepted by the lead because the attempts cap and the GBP 5/month cap bound the cost. The screen must still show the limit screen once the count is reached.
R14 J2/J8: nothing saved and nothing uploaded until the normal save; Back/refresh behaves as today.
R15 J9/P10: flag off or older screen: zero change (test + walk).
R16 Cover: flyer becomes the cover on save only, through the existing crop/size check; removable before saving.
R17 Spend: kill switch off -> normal; on -> refuses before calling the model; monthly cap reached -> refuses and the month counter does not grow.
R18 Logging: reserve BEFORE the model call; no image, key or flyer text in any log; analytics carry field names only.
R19 Accessibility/layout at 390x844 for every state: tap targets >= 44px (explicit px, html is ~13.5px), no clipping, no sideways scroll, contrast >= 4.5, every empty/loading/error state has an action.
R20 Copy: British English, full weekday names, entities not Unicode punctuation in JSX.

## E. Gates (in order)
1 Slice 1: independent review (migration, spend cap, kill switch, RLS/GRANT), fixes, one run-ci, owner Approve (batched with the deploy click, owner click 2026-11-08), merge + apply, lead reads prod back, function deployed.
2 Slice 2: matrix tests red first covering R2-R10 shapes; merged.
3 Slice 3: INVENTORY.md + design record, tests for R1, R11, R14-R16, R19-R20; orchestrator walks every state at 390x844 on a Ritmo Latino-shaped account and looks at each screenshot.
4 Whole-arc: an independent reviewer (different model) goes through R1-R20 with the evidence; only then the flag is turned on for Ritmo Latino, and the owner gets ONE short phone checklist.
5 Live accuracy: first 20 real Ritmo Latino flyers; bar 14 of 20 saved unchanged; then all signed-in organisers (owner decision).

## F. Not verified yet (honest list)
Venue matching against real venues; blurry flyers; Instagram story/screenshot with caption text; HEIC; two reads at once; the live Anthropic call; Spanish on the live model; whether organiserP3 and organiserSelfServe are on in prod (lead checking).
