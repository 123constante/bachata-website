# flyer-read-screen-1498 review

Independent review of PR #1498 (`claude/flyer-read-screen`, head ec27e2c) against the acceptance contract R1-R20 in `docs/briefs/review-flyer-read-screen.md`.
Method: code and test reading only. Nothing was run, no browser walk was done, and nothing touched production. Paths below are on the PR branch.
Slice 2 (`flyerToDraft.ts`, `flyerReadShape.ts`) is on main, so mapping rows are checked there for the points this screen depends on.

## Verdict
The screen is close and sound on states, the hand-off, the flag and the cover-on-save rule. There is **one contract FAIL (R16: the cover cannot be removed before saving)**. Several rows cannot be checked from code and need the 390x844 walk or the function review. There are no high-severity defects.

## Contract rows
| Row | Result | Evidence |
|---|---|---|
| R1 never see entry; function 401/403 | PARTIAL. Client PASS, function NOT CHECKABLE FROM CODE | Entry only when `flyerReaderOn()` (useFlyerRead.ts:18; CreateFlow.tsx `flyerOn`). No session sends nothing and shows the "unauthorised" card (useFlyerRead.ts:103-105; test "no session = unauthorised"). Route gating for P4/P5 is in code outside this diff. Function refusals are slice 1. |
| R2 pre-filled values equal truth table | NOT CHECKABLE FROM CODE here (slice 2 mapping). The 11-flyer test exists (flyerStart.render.test.tsx:264) | Not re-derived. |
| R3 multi-event note | PASS | flyerToDraft.ts:80 note `many_events`; shown by CreateFlow "From your flyer" card (CreateFlow.tsx ~l.277); test "several events: the note says so". |
| R4 past date kept, doubtful, noted | PASS (mapping) | flyerToDraft.ts:94-96 adds `past_date` and marks `firstDate` doubtful, with no year roll-forward. |
| R5 repeats note, no rule built | PASS | flyerToDraft.ts:86 `repeats` note. Weekly and monthly kinds keep the Repeats row (model.ts:46, CreateFlow Repeats row), so "set how it repeats below" points at a real control. |
| R6 not-enough names what is missing; editor opens with title | PASS | flyerToDraft.ts:153-154 names the missing items. The held card FlyerStart.tsx:98-110 lists what was found and "Use what we found" opens the form. Minor copy issue: see D7. |
| R7 venue one / two / none | PASS | `venueSaid` is shown as "Flyer says: ..." only when no venue matched (CreateFlow.tsx `p3-new-venue-said`). Matching is slice 2. |
| R8 only ticked sessions land; next-day ends | PARTIAL. Ticks PASS, next-day end NOT CHECKED | `applySessionChoices` keeps only ticked (flyerToDraft.ts:160-165); test "tick list adds only the ticked sessions". Next-day-end saving was not traced. |
| R9 price one doubtful row; ticket link printed only | PASS (mapping + screen) | flyerToDraft.ts:149-150 (`ticketUrlOf`, `isHttpUrl`, marked doubtful). The screen adds "Ticket link" as a way to pay so the field shows (useFlyerRead.ts:190). QR is never decoded (no code path). |
| R10 links stripped everywhere except ticket link; injection inert | PASS (code) | `cleanText` strips `http(s)://` and `www.` (flyerToDraft.ts:29-35). Flyer text is rendered only through React text nodes (FlyerStart.tsx:39-42, CreateFlow notes and `Flyer says`), with no `dangerouslySetInnerHTML`. Only the ticket link is a URL, guarded by `isHttpUrl`. Whether the model obeys "ignore the above" is a function matter. NOT CHECKABLE FROM CODE. |
| R11 limit / off screens have a next step | PASS | Every card has `Blank` ("Fill it in yourself") (FlyerStart.tsx:79-87, 98-110, 111-128). Daily limit shows reset time via `resetWords` (:116-117, falls back to "Back tomorrow."). Attempts, switched-off, not-organiser and unauthorised have their own copy. Test "each reader answer has its screen and a way forward" (:123). |
| R12 failed read: attempt used, no daily success | NOT CHECKABLE FROM CODE | Server side. The client only maps `read_failed` / `bad_image` / errors to "Couldn't read that one" (FlyerStart.tsx:126-128). |
| R13 concurrency | PARTIAL | Client allows one read at a time (`run.current` guard, useFlyerRead.ts:117). Two tabs or the server cap are NOT CHECKABLE. The limit screen shows from the function's `daily_limit` word. |
| R14 nothing saved or uploaded until the normal save; Back/refresh as today | PASS | Hand-off is memory only (`pending`, useFlyerRead.ts:210); the draft goes to the existing `DRAFT_STORE_KEY`. The file is uploaded only by `useCreateSave` (CreateFlow.tsx `cover`). Leave / Cancel call `forgetFlyerHandoff` (CreateFlow.tsx:194, leave-discard). A reload keeps the draft but loses marks, notes, ticks and cover. That is documented and consistent with the normal flow's in-memory cover. |
| R15 flag off or older screen: zero change | PASS from code, weak test | `flyerReaderOn()` needs all three flags (useFlyerRead.ts:18). `organiserFlyerReader` is `=== 'true'` so it defaults OFF (featureFlags.ts diff). With the flag off, KindStep renders the same tiles. It gains only two unused hooks and a Fragment, plus `forgetFlyerHandoff()` in `pick`, which is harmless. The "byte-for-byte" test (:109) compares flag-on-minus-entry with flag-off. It does not compare against main. See D6. |
| R16 cover on save only, existing crop/size check, **removable before saving** | **FAIL (removable)**; rest PASS | On save only through `useCreateSave` / `uploadEventPicture` (design record). `pickCover` runs `checkFlyerFile` (CreateFlow.tsx:207-214). The cover card has only "Choose a different photo" (CreateFlow.tsx:350-353) and no Remove control, so the flyer cannot be dropped as the cover. See D1. |
| R17 spend | NOT CHECKABLE FROM CODE | Server. The client maps `switched_off` to "paused for now". |
| R18 logging | PARTIAL | Client logs nothing from flyer text. Analytics carry field names only (`flyer_read_filled`, `flyer_read_changed`, useFlyerRead.ts:203-208). Reserve-before-model is server side. |
| R19 layout at 390x844, taps >=44px, contrast | PARTIAL | Taps are explicit px: `.p3-btn` min-height `var(--tap)` = 44px (p3.css:25,119); `.p3-new-file` 48px (create.css:40); entry row 56px; tick row 44px with a 22px box (create.css diff). Clipping, sideways scroll and contrast (gold token, `opacity: .6` disabled pick) are NOT CHECKABLE FROM CODE and need the walk. Every state has an action. |
| R20 copy | PASS | No non-ASCII characters in FlyerStart.tsx, useFlyerRead.ts, CreateFlow.tsx or create.css. JSX uses `&hellip;`. JS strings use `’` escapes. British spelling ("organisers"), full weekday names via `Intl` `weekday: 'long'`. |

## Attack inputs
- **Untrusted text / HTML injection**: PASS, see R10.
- **Failed read burns a daily success**: client cannot tell. NOT CHECKABLE FROM CODE (slice 1).
- **Downscale below 5 MB**: PASS. `reencodeFlyer` always runs (useFlyerRead.ts:99); the output is at most 1600px edge, quality steps 0.85 to 0.48, and the target is the 2 MB bucket limit (flyerModel.ts:28-33, 219, 235). Input is capped at 10 MB (:24).
- **User JWT, not anon key**: PASS. The session `access_token` is sent as `Authorization: Bearer` (useFlyerRead.ts:76-81), and no session means no request. `supabase.functions.invoke` still adds the project `apikey` header as the gateway needs. That is not the Authorization credential.
- **Every state has a way forward**: PASS. No state is a dead end, including reading (Cancel).
- **No copy points at a missing control**: PASS with one nit (D7).
- **Cover only on save**: PASS.
- **Legacy flow untouched / flag defaults OFF**: PASS (R15).

## Defects, ranked
1. **D1 (medium, contract FAIL R16)**: the flyer cover cannot be removed before saving. The cover card offers only "Choose a different photo" (CreateFlow.tsx:350-353). A flyer-sourced cover is attached by default, so an organiser who does not want it must pick another photo. Fix: add a "Remove photo" control (>=44px) that clears `cover`, and a test.
2. **D2 (low-medium)**: a good read waits on the venues query (`venues.isPending`, FlyerStart.tsx:68), and `goodRead && !held` shows "Reading your flyer..." with only Cancel (:90-97). If the venue list never settles, the person is stuck on the reading card after the read was already counted. A timeout or "Continue without venue matching" is needed. Hangs only: an errored query is not pending.
3. **D3 (low)**: `open()` runs inside `useEffect` keyed on `verdict` (:74-77) with an eslint disable. Under React StrictMode (dev) it runs twice, so it navigates and writes the draft twice. It is harmless in prod but is a code smell.
4. **D4 (low)**: `flyer_read_saved` is not in `AnalyticsEventMap` and is called through a cast (useFlyerRead.ts:204). A rename or typo would not be caught. The event only reaches `window.dataLayer`. Also, "Check this" returns if a changed field is changed back, which contradicts the design record's "cleared the first time".
5. **D5 (low)**: the daily-limit title hard-codes "5" (FlyerStart.tsx:117) while the function owns the limit.
6. **D6 (low, test strength)**: the "flag off is byte-for-byte" test (:109) does not compare against main's kind step. It only checks that the entry is the sole difference between flag on and flag off. A regression in the shared markup would pass.
7. **D7 (nit)**: the not-enough card's title always says "date and venue" (FlyerStart.tsx:101) even when only the name is missing. The note text from flyerToDraft:153 names the real gap.
8. **D8 (info)**: the HEIC path relies on the iOS picker converting to JPEG (flyerModel.ts:20). A HEIC file from a desktop picker gets the file-type problem card, which is fine.

## Not verified
Everything runtime: no unit run, no tsc, no browser walk at 390x844, contrast, clipping, the live function, the refusal body shape (`error` / `reason` / `code`, `resets_at`) against the deployed function, two reads at once, venue matching on real venues, whether the three flags are on in prod, and slice 2's next-day-end saving.
