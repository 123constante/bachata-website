# P3 organiser area: whole-area acceptance contract

Step 2 and Step 4 of `docs/briefs/p3-acceptance-contract.md`. **Every later P3 fix is judged against this file.** Screen and entry ids (S01..S47, E01..E14) are in [INVENTORY.md](INVENTORY.md). Test accounts (A-...) are in [ACCOUNTS.md](ACCOUNTS.md).

Owner, 2026-10-30: "I should not have to check everything; you should have created the new shell at production grade." The slices were checked one at a time and nobody owned the whole area. This contract is that whole.

## How to use it

- The **walker** signs in as the named account, runs each step at 390x844, and fills the `Pass/Fail` line with the result, the date, the commit SHA and a note for any FAIL. A blank line means not walked.
- **Expected text** in "double quotes" is the copy on main at 472ecde (lifted from the code). Text in [brackets] describes something the screen must show, with no exact wording fixed yet. If the copy changes, update this file in the same PR.
- **Universal rules** below apply to every step of every journey. They are not repeated in each journey.
- Gaps (`G-nn`) are what a journey needs and main does not have today. A step that depends on a gap is marked **[G-nn]**, and the walker records it as FAIL until the gap is closed.

## Universal rules (apply to every step)

- U1. **No dead end.** Every screen has a visible way back or onward. A lazy-load failure shows Try again plus a back link (P3RouteBoundary).
- U2. **No orphan copy.** No text names a control that is not on the screen ("tap X" means X is visible).
- U3. **Every empty state says what the person can do**, with the control to do it.
- U4. **A control that cannot work is disabled with a reason** that is visible next to it (not only in a tooltip).
- U5. **An untouched save sends nothing.** Opening a sheet or screen and pressing Save or Done without a change fires no RPC write (check the network tab for zero `series_command_p5`, `occurrence_command_p5` or `*_update_*` calls). Where the code disables Save when nothing changed, that counts as a pass.
- U6. **Nobody sees what they must not.** A non-member opening `/account/p3/events/<id>` sees the Not yours card and no data. A signed-out visitor lands on /auth. With the flag off, `/account/p3/*` is NotFound.
- U7. **Every read failure has an error state with Retry.** It never shows a blank screen or an infinite spinner.
- U8. **Tap targets are at least 44px** in real px (the html font-size is about 13.5px on phones, so rem sizes render small).
- U9. **One fact, one mapping.** A status tag, kind word or date count reads the same on Home, Events, the Event page and All dates.
- U10. **No mojibake.** Dashes, quotes and ellipses render correctly.

---

## Person (a): dancer only

### J-a1: dancer signs up and never organises
Account: A-dancer-new (fresh sign-up). Entries: E14, E03, E04, E06, E07.
1. Open /auth and choose sign up. The role screen (E14) shows "Dancer", "Organiser", "Teacher", "DJ", with Dancer selected. Each role says what it leads to **[G-05]**.
2. Keep Dancer, enter the email and the OTP. You land on the dancer home or the dancer app welcome, **not** `/account/p3`.
3. On `/account` the organiser section shows the collapsed "I organise events" card. Nothing on screen links to `/account/p3`.
4. Must be impossible: any P3 screen showing up before the person asks to organise.
Pass/Fail: ____

### J-a2: dancer types a P3 URL directly
Account: A-dancer. Entries: E01, E02. Screens: S01, S05, S06, S35, S42.
1. Open `/account/p3`. The app redirects to `start` and shows "Welcome" (S45), with a way back to the dancer app (U1).
2. Open `/account/p3/events`. You see [a no-page state that links to start], **not** the generic "Add an event" card **[G-07]**.
3. Open `/account/p3/stats`. You see [the same no-page state], not "no views".
4. Open `/account/p3/you`. You see the no-page state with a link to "Add a page" (S35).
5. Open `/account/p3/you/done` with no router state. You see [a sensible fallback with a way onward], not an empty card **[G-11]**.
6. Must be impossible: a 404, a blank screen, or a control that writes to a page that does not exist.
Pass/Fail: ____

### J-a3: dancer opens someone else's event
Account: A-dancer. Screens: S07, S23, S24, S27, S28, S29, S30.
1. Open `/account/p3/events/<series id of A-org-big>`. You see the Not yours card. No title, dates or counts leak.
2. Repeat with `/dates`, `/details`, `/prices`, `/history`, `/organisers` and `/door`. Each shows Not yours, or `not_allowed` on the door. None shows an editable form.
Pass/Fail: ____

### J-a4: deleted account opens P3
Account: A-deleted. Entry: E01.
1. Open `/account/p3`. You are refused, or sent to the restore screen, the same way R1's AccountGated handles it **[G-03]**.
Pass/Fail: ____

### J-a5: flag off
Any account, with `VITE_ENABLE_ORGANISER_P3` unset (preview env).
1. `/account/p3`, `/account/p3/start` and `/account/p3/events/x` all render NotFound.
2. Sign up as Organiser. You land on `/account/o` (R1), not P3 (E03).
Pass/Fail: ____

## Person (b): dancer who later adds teacher or DJ

### J-b1: dancer adds Teacher from Your areas
Account: A-dancer. Entries: E09, E07.
1. On the dancer home, tap the Your areas row ("Open or add a role"). This opens `/account/areas`.
2. Tap Add on Teacher. The DoYouSheet opens. Answer yes. `save_my_role_v1` fires once. You land on `/account/t`.
3. Answer no on DJ instead. `set_my_role_declined_v1` fires. The row reads as declined and can be changed later.
4. A sheet save that fails shows the error line, and the sheet stays open.
5. The teacher area offers a route to run their own classes or events (organiser) **[G-06]**.
Pass/Fail: ____

### J-b2: teacher decides to run events
Account: A-dancer-teacher. Entries: E09, E05. Screens: S45.
1. On `/account/areas`, tap Add on Organiser. This opens `/account/o`, and E05 hands off to `/account/p3/start` (0 pages).
2. "Welcome" shows. Continue to "Find your page". The S45 person steps skip "Do you teach?" or prefill it, because the teacher role already exists (the same fact on both screens, U9).
3. If the read in step 1 fails, the person must not end up in R1's old onboarding with no message **[G-08]**.
Pass/Fail: ____

### J-b3: signs up directly as Teacher or DJ
Account: A-teacher-new. Entries: E14, E03.
1. Choose Teacher at sign-up. You land on `/account/t`. The role screen said where Teacher leads **[G-05]**.
2. Nothing promises organiser powers. A later organiser path exists (J-b2) and is findable from the teacher area **[G-06]**.
Pass/Fail: ____

## Person (c): new organiser with no page

### J-c1: sign up as Organiser and create a page
Account: A-org-new (fresh). Entries: E14, E03. Screens: S45, S01, S02, S03.
1. Choose "Organiser" ("I run events, socials or a school") and finish the OTP. You land on `/account/p3/start`, which shows "Welcome".
2. Go to "Find your page". Search a name that has no match. You see [a no-match line plus a Create control].
3. Choose Create. "Name your page", then "Which city?" (`search_cities`; a city error shows Retry), then "What kind of page?".
4. "Is this the best number?" leads to "Show on WhatsApp too?", then "Your logo" (skippable; an upload error stays on the step).
5. Person steps: "Your first name", "Your photo", "How do you dance?", "Do you teach?" (if yes: "Styles you teach", "Which levels?", "Years teaching", "Languages you speak"), "Nationality".
6. Review. The submit button is disabled with a reason while anything is incomplete (U4).
7. Submit. You see "You're live" or "Sent for a quick check" (the organiserDetail flag). The way onward reaches Home.
8. Home (S01) shows [no events: "No events here yet" and Add an event]. The Grace banner (S02) shows only if onboarding steps are left.
9. In Settings (S03), Save is disabled when the name is unchanged, empty or too long (U5).
10. Must be impossible: going Back mid-flow and losing typed data without a warning; creating two pages by double-tapping (create fires once).
Pass/Fail: ____

### J-c2: claim an existing page inside P3
Account: A-org-claimer, with a seeded unclaimed page P-claimable. Screens: S45 (Claim sheet), S43, S01.
1. In "Find your page", search P-claimable. The Claim sheet opens and `claim_organiser_v1` fires once.
2. Home waits while it refetches, then shows P-claimable's events (S01 does not flash the no-page redirect).
3. On `/account/p3/you/add` (S43), a second claim works the same way. The page now counts 2 and the Switch row (S36) appears.
Pass/Fail: ____

### J-c3: ask to join and wait
Account: A-org-waiting (one open access request, no page). Entries: E04, E06. Screens: S45, S43.
1. Sign in. ContinueAs (E04) sends you to the P3 Welcome. If the dancer profile is unfinished, it goes via /app/welcome first.
2. The Welcome screen says [a request is waiting, who it was sent to, and what happens next]. Nothing implies the person already has a page.
3. Open Home, Events and You. Each shows the waiting state, not a generic empty card **[G-07]**.
4. When the owner approves (S39 resolve), the next visit shows Home with the page.
Pass/Fail: ____

### J-c4: claim from the public organiser page
Account: A-org-claimer2. Entry: E10.
1. Open `/organisers/<P-claimable-2>` and tap claim. `claim_organiser_v1` fires once.
2. The "go" link lands in the same area as a claim made inside P3 (P3 Home while P3 is live) **[G-02]**.
3. Signed-out path: sign in to claim, then you return to the claim and land in the same place.
Pass/Fail: ____

### J-c5: accept a team invite
Account: A-invitee + a live invite token. Entries: E11. Screens: S37.
1. Open `/invite/<token>`. The preview shows the page name. Bind and redeem fire once each.
2. Done says "Open your organiser home" and must land on P3 Home or a screen with that title. Today it lands on You/Welcome **[G-09]**.
3. A used, expired or revoked token shows the dead-link copy with "request a new invite" (`request_new_invite_v1`). Signing in with the wrong account shows the wrong-account state.
Pass/Fail: ____

### J-c6: first event (New event flow)
Account: A-org-new after J-c1. Screens: S47, S42, S07.
1. From the Home empty state, tap Add an event. This opens `new/what`. Choose a kind, then `new/name`.
2. If the profile is incomplete, the name step is blocked with a reason and a link to start review (U4).
3. Steps: venue (venues loading/error), date, time, cover (upload error). "Save as draft and leave" works at each step.
4. Put it live. Done (S42) has "See it live", which opens the public page. Back leads to the Event page (S07) for the new series.
5. Must be impossible: a series created twice by a double tap; an untouched step sending a command (U5).
Pass/Fail: ____

### J-c7: onboarding gate on a refused write
Account: A-org-unfinished (page exists, onboarding incomplete). Screens: S41, S46, S02.
1. Try a gated write (for example, Put it live). The "A few details first" sheet (S41) opens.
2. Its link goes to `you/details` (S46) or start review. Finish there, then return. The write now succeeds.
3. Changing route closes the gate sheet.
Pass/Fail: ____

## Person (d): organiser with live events

### J-d1: returning organiser finds P3
Account: A-org-big. Entries: E04, E05, E06, E07, E08, E12, E13.
1. Sign in. ContinueAs lands on **P3 Home** while P3 is live **[G-01]**. Today it lands on R1 `/account/o`.
2. The dancer home "Open the organiser area" link, the Options link and the Your areas Organiser row all reach P3 Home **[G-01]**.
3. Legacy `/account/new`, `/account/series/<id>` and `/account/team` reach the P3 equivalents while P3 is live **[G-04]**.
4. `/account/tickets/...` (ticketing on) reaches S07 or S34 (E13).
Pass/Fail: ____

### J-d2: Home
Account: A-org-big. Screens: S01, S02, S04, S06.
1. Home shows Next up (the next live date across all series), the views tile, and going numbers (p3GoingOn).
2. Tap Next up "going". The Who is going sheet (S04) shows the people list, or [none yet].
3. Tap the views tile. Stats (S06) shows the default range. A range with no views shows "Show 30 days".
4. On A-org-ended-only, Home shows [the all-ended copy with Add an event], not a stale Next up.
Pass/Fail: ____

### J-d3: Events list over every shape
Account: A-org-big. Screens: S05.
1. The list shows every non-archived series: weekly, monthly, every-2-months, custom, explicit dates, course, festival, one-off, cancelled one-off, ended, paused and draft. Each row has the same status tag as its Event page (U9).
2. A series with no photo shows the placeholder, not a broken image.
3. With more than 100 series rows in the API response, all of them are reachable (check against the seeded count) **[G-10, verify]**.
Pass/Fail: ____

### J-d4: weekly series, many dates
Account: A-org-big, series W-weekly-130 (130+ dates, 3 cancelled, 2 skipped). Screens: S07, S23, S16, S17.
1. The Event page shows the coming dates and the kind word, with the partial line "100 of N" when there are more.
2. All dates (S23): the filter counts add up to the seeded totals. Each filter has its own empty copy.
3. One date (S16) > Move / Time / Skip / Cancel (with a reason) / Reset to normal. Each needs a valid input before its button enables, and each has Undo.
4. A cancelled date shows as cancelled. Bring it back restores it.
Pass/Fail: ____

### J-d5: monthly, every-N-months, custom and explicit dates
Account: A-org-big, series M-monthly, M-every2 (interval 2), C-custom, D-dates. Screens: S13, S14, S15, S10.
1. Repeats (S13) opens on the correct rule for each series. The preview lists the dates it will create. A preview error or an empty preview is explained.
2. Changing the rule sends one command (send once). Reopening without changes sends nothing (U5).
3. Add a date (S14) rejects an invalid day with the problem copy. Skipped date (S15) can bring a date back.
4. Stop repeating (S10) states how many dates go and keeps the past ones.
Pass/Fail: ____

### J-d6: course and festival
Account: A-org-big, series K-course (8 sessions, all past), F-festival (live, programme). Screens: S20, S21, S22, S07.
1. Course: the Event page shows the session count. Sessions edit "every date" or "just this date". A scope that is not allowed is disabled with a reason.
2. Festival: session rows are read-only, and the screen says why.
3. Line-up (S22): fewer than 2 characters shows the hint. A search error shows the error. An unchanged line-up sends nothing.
4. Remove all sessions (S21) asks first.
Pass/Fail: ____

### J-d7: one-off: cancel and bring back
Account: A-org-big, series O-oneoff-future. Screens: S12, S08.
1. Status > Cancel the event. The reasons load. Confirm stays disabled until a reason is picked. It sends once.
2. With reasons empty or failed, you see an error with Retry, or [an explicit empty line]. Never nothing **[G-12]**.
3. Bring it back restores the event. The tag updates on Events and Home (U9).
Pass/Fail: ____

### J-d8: status changes
Account: A-org-big. Screens: S08, S09, S10, S11.
1. Status list: each greyed row says why it is greyed.
2. Hide, then Show, then Put it live. Each has Undo.
3. End it asks "Did tonight happen?" and needs an answer. It lists the dates that will go.
4. Remove archives the series. It leaves Events. A deep link to it then shows not found or archived, not a broken page.
Pass/Fail: ____

### J-d9: details, prices and per-date fields
Account: A-org-big. Screens: S24, S25, S26, S27, S18, S19.
1. Name & details: open and leave without a change sends nothing, and no leave prompt appears (U5).
2. Edit a field, then try to leave. The Leave? sheet appears. Undo mine reverts.
3. Pick place: venues loading and error states. A city lookup failure shows Retry.
4. Prices: the free switch, the locked rows count, and "no prices".
5. Per-date name, photo and price (S19): a dirty sheet asks before closing. A cancelled date is locked, with a reason.
6. A non-owner team member (A-org-member) sees the edit lock banner with a reason.
Pass/Fail: ____

### J-d10: history, co-organisers, team, handover
Account: A-org-big (owner) and A-org-member. Screens: S28, S29, S39, S40, S44, S36.
1. History: 50 rows, then Load more. Empty shows [nothing has changed yet].
2. Organisers: only the owner can edit. Removing the last organiser is disabled with a reason.
3. Team: add by search or browse. A full team shows the full state. Owner-only actions are hidden or disabled for a member.
4. Handover to a member, then confirm. Afterwards the old owner is a member.
5. Leave (as a member, from You > Account) asks first. You end up somewhere with a way onward.
6. Switch page (2+ pages): the choice sticks across Home, Events and Stats.
Pass/Fail: ____

### J-d11: drafts only, and ended only
Accounts: A-org-drafts-only, A-org-ended-only. Screens: S01, S05, S07.
1. Drafts only: Home's Next up says [nothing is live, put a draft live] with the control. Events shows the drafts tagged Draft.
2. Ended only: an ended recurring series shows as Ended, never as Draft (the 2026-10-08 lesson).
Pass/Fail: ____

### J-d12: tickets, door and get paid (organiserTicketing on)
Account: A-org-tickets. Screens: S31, S32, S33, S34, S30.
1. Get paid: Start goes to the Stripe onboarding. The `?stripe=return` back note appears. A non-manager sees Start disabled with a reason.
2. Tickets sheet: add a type, close it, refund (owner). A non-manager gets the read-only note.
3. If the home read fails, the Tickets row shows an error, not nothing **[G-13]**.
4. Door: camera denied falls back to the list. Offline shows the banner. 500+ sold shows the truncated line.
Pass/Fail: ____

### J-d13: You hub, page editor, help
Account: A-org-big. Screens: S35, S38, S42, S44.
1. You: rows that cannot work are disabled with a reason. An open request shows a badge.
2. Organiser page editor: save leads to Done (S42), and Done's onward link works.
3. Help is reachable from You > Account and from Team.
Pass/Fail: ____

---

## Round 2 additions (2026-10-30, brief `docs/briefs/p3-acceptance-contract-r2.md`)

Round 1 ids above are unchanged. Round 2 adds owner rules (R1-R4), persons (e), (f), (g), a states matrix, cross-area journeys (J-x), profile journeys (J-p) and event-editing journeys (J-v). New entry rows E15-E18 are in INVENTORY.md. New gaps are G-16 onwards.

### Owner rules (2026-10-30). The walker tests these as rules, like U1-U10

- **R1. Series edits ask each time, with a preview.** Any edit to a repeating series asks "this date only" or "all dates". The preview lists the dates that change AND who is going on them. Dates edited by hand are kept when "all dates" is applied.
- **R2. One person, one account.** There is one "You" area, with a section per role (dancer, teacher, DJ, organiser). "Switch page" switches organiser pages only, never roles.
- **R3. Old data is accepted until edited.** A stored value that fails a new check (e.g. a Facebook link where a new validator refuses it) is shown and kept as-is. Only editing that field asks for a valid value. An untouched save is never blocked and sends no command (sharpens U5).
- **R4. Walk-first priority.** P1 journeys are walked first, in this order: (1) existing organisers meeting the onboarding gate (J-e8), (2) the public page matches what was set (J-x2), (3) co-organisers and several pages (J-g1..J-g6, J-e4). Everything else is P2 unless marked. **Round 3:** the "already in the system comes to join" class is P1 BESIDE the gate, walked in slot (1) right after J-e8: J-i1, J-i2, J-i4, J-i8, J-i10, J-i12, J-i13, J-i15. Slots (2) and (3) are unchanged.

Prod facts behind R4 (survey in ACCOUNTS.md section 4): **all 10 claimed pages have no completed onboarding row**, so every existing organiser meets the gate on their first gated write. 29 pages carry a Facebook link (R3).

### Extra states (apply to every person; matrix S-1..S-11)

Each P1 journey is walked once more under each state below. Record one Pass/Fail per state in the journey's `States:` line.

| id | state | expected |
|---|---|---|
| S-1 | signed out | /auth, then back to the same screen after sign-in |
| S-2 | expired session mid-flow | sign-in prompt; typed data survives or a warning says it will not |
| S-3 | wrong account (signed in as someone else) | wrong-account state naming the signed-in email, with Sign out |
| S-4 | deleted / hidden / suspended account | refused or restore screen (G-03); never a working editor |
| S-5 | slow network (DevTools Slow 3G) | busy state on every button; no double send |
| S-6 | save that half-fails (one of two writes errors) | an error names what did and did not save; no silent success |
| S-7 | Back button mid-flow | previous step with data intact, or a Leave? sheet |
| S-8 | refresh on each screen | same screen, same page choice, no blank |
| S-9 | two people editing the same event | the second save is refused or warned, never silently overwrites [G-24] |
| S-10 | clock change, after-midnight event, multi-day festival | dates and times read in London time; a 23:00-03:00 social is ONE date; a festival spans its days |
| S-11 | non-London city | copy never says "London" for a page in another city |

## Person (e): existing organiser with pages already in the system

### J-e1: page auto-claimed at sign-in by email (P2)
Account: A-org-autoclaim. Entries: E04, E02.
1. A page has a claim email set to the account's email. Sign in. The page is claimed with no search, and you land on P3 Home for that page **[G-17]**.
2. A page whose claim email does not match is NOT claimed.
3. Must be impossible: auto-claiming a page already claimed by someone else.
Pass/Fail: ____ States: ____

### J-e2: page claimed through find-and-claim (P2)
Account: A-org-claimer (as J-c2), then sign out and in again.
1. After the claim, the next sign-in goes straight to P3 Home, not to `start` and not to R1 **[G-01]**.
Pass/Fail: ____ States: ____

### J-e3: page waiting on an open access request (P2)
Account: A-org-waiting (as J-c3). Same as J-c3, plus:
1. The owner refuses the request. The next visit says it was not approved and what to do next, never a silent empty Home.
Pass/Fail: ____ States: ____

### J-e4: holding 2+ pages (P1)
Account: A-org-big (P-big, P-small). Screens: S36, S01, S05, S06.
1. Switch page (S36) lists both. Choose P-small. Home, Events and Stats all show P-small only; the page name is visible on each.
2. Refresh (S-8) and sign out / in: the choice sticks or the screen says which page it shows.
3. An event of P-big opened by deep link while P-small is chosen opens normally (it is still yours) and does not flip the choice silently.
4. Switch page never offers roles (R2).
Pass/Fail: ____ States: ____

### J-e5: page with 50+ past events and a long history (P2)
Account: A-org-history (P-history: 86 past dates across series, like prod's largest). Screens: S01, S05, S07, S23, S28.
1. Home Next up skips past dates. Events lists ended series as Ended.
2. All dates "Past" filter count matches the seed. History pages with Load more.
Pass/Fail: ____ States: ____

### J-e6: page with two owners (P2)
Account: A-org-coowner-1 and A-org-coowner-2 on P-shared.
1. Prod has a single `claimed_by` per page, so "two owners" means one claimer plus a second person with owner-level team rights **[G-18]**. Both see the same Home; owner-only controls (S29 edit, S39 hand over, S40) behave the same for both, or the difference is stated on screen.
Pass/Fail: ____ States: ____

### J-e7: half-claimed page (P2)
Account: A-org-half (claimed, no onboarding row, no contact confirmed; prod: 10 of 10 claimed pages look like this).
1. Home loads. The Grace banner (S02) says what is left and links to it.
2. Reads never fail for the missing row.
Pass/Fail: ____ States: ____

### J-e8: existing organiser with live events meets the onboarding gate (P1, priority 1)
Account: A-org-legacy-live (claimed page, 3 live weekly series, no onboarding row). Screens: S41, S46, S02, S07.
1. Sign in and open Home. Live events show. Nothing is blocked just by opening (grace period): the banner says how long the grace lasts and what is left.
2. Make a gated write (edit a date time). "A few details first" opens. It asks only for what is missing, prefilled from existing data.
3. Finish. Return to the same edit; the write succeeds without retyping.
4. Close the sheet without finishing: the live events stay live and public (J-x2), only the write is refused, with a reason.
5. Legacy page data failing new checks (Facebook link) does not block the gate (R3).
Pass/Fail: ____ States: ____

## Person (f): dancer, teacher or DJ who later says they are an organiser

Organiser is a seat on a page, not a label (R2).

### J-f1: from the dancer home link (P2)
Account: A-dancer. Entry: E07.
1. The dancer home offers a way to start organising [G-06]. It lands on P3 `start`, not R1.
Pass/Fail: ____ States: ____

### J-f2: from the /account/o hand-off (P2)
Account: A-dancer-teacher. Entry: E05. As J-b2; also the hand-off read failing shows a message (G-08).
Pass/Fail: ____ States: ____

### J-f3: from Your areas (P2)
Account: A-dj (dancer + DJ role). Entry: E09.
1. Add Organiser leads to P3 `start`. The DJ role stays; nothing is lost.
Pass/Fail: ____ States: ____

### J-f4: dancer-profile-first gate and one account (P2)
Accounts: A-org-nodancer (organiser intent, no dancer profile), A-dancer-teacher.
1. If a dancer profile is required before organising, the screen says so and links to it, once; after finishing you return to where you were [G-25].
2. The teacher/DJ profile and the organiser page show as sections of ONE You area (R2). The same name and photo are not asked for twice when they already exist.
Pass/Fail: ____ States: ____

## Person (g): co-organiser / invited helper (P1, priority 3)

### J-g1: invite and accept (P1)
Accounts: A-org-big (owner), A-helper (fresh). Entries: E11, E17. Screens: S39, S37.
1. Owner invites from Team. The invite email link opens `/invite/<token>`, accept lands on P3 Home for P-big (G-09).
2. The helper sees P-big only.
Pass/Fail: ____ States: ____

### J-g2: owner vs manager rights per screen (P1)
Accounts: A-org-big (owner), A-org-member (manager/member).

| area | owner | manager | walker |
|---|---|---|---|
| page name, photo | edit | [decision needed: edit or read-only with reason] | ____ |
| contact details | edit | read-only with reason | ____ |
| team (add, remove, hand over) | edit | hidden or disabled with reason | ____ |
| events (dates, details, prices) | edit | edit, or edit-lock banner with reason (S24/S27) | ____ |
| tickets, refunds, get paid | edit | read-only note (S31-S34) | ____ |
Pass/Fail: ____ States: ____

### J-g3: leave a team (P1)
Account: A-org-member. Screens: S44.
1. Leave asks first, then lands somewhere with a way onward. The page no longer appears in Switch page.
Pass/Fail: ____ States: ____

### J-g4: last owner leaves (P1)
Account: A-org-solo (only owner, no team).
1. Leave is disabled with a reason ("hand over first") or explains what happens to the page and its live events [G-23].
Pass/Fail: ____ States: ____

### J-g5: manager of page A never acts on page B (P1)
Accounts: A-org-member (member of P-big only), page P-small.
1. Every P-small deep link (`/events/<id>`, `/dates`, `/details`, `/prices`, `/door`) shows Not yours. Direct RPC writes with the P-small id are refused by the server (42501) [G-22].
Pass/Fail: ____ States: ____

### J-g6: co-organiser on a shared series (P1)
Accounts: A-org-big, A-org-partner (owns P-partner). Series S-shared lists both pages (prod: 6 series list 2+ pages).
1. Both organisers see the series. Only rights stated in S29 apply. The public page lists both organisers.
Pass/Fail: ____ States: ____

## Cross-area journeys

### J-x1: old links, bookmarks and emails land in the new area (P2)
Entries: E12, E13, E15, E16, E17.
1. Each saved R1 path (`/account/o`, `/account/o/series/<id>`, `/account/new`, `/account/team`) lands on the P3 equivalent while P3 is live [G-04, G-26].
2. Claim, invite and approval email links land in P3 Home or the matching screen, never in R1 [G-26].
Pass/Fail: ____ States: ____

### J-x2: the public page shows what the organiser set (P1, priority 2)
Account: A-org-big. Entry: E18. For each edit below, open `/event/<id>` at 390x844 straight after.

| edit in P3 | public page must show | walker |
|---|---|---|
| move one date / change its time | the new date and time; going people see the change | ____ |
| cancel one date (reason from the fixed server list: venue_closed, teacher_unavailable, bank_holiday, low_signups, other) | that date marked cancelled with the reason label | ____ |
| change the repeat rule | only the new future dates; hand-edited dates kept (R1) | ____ |
| new cover photo | the new cover (cache-busted) | ____ |
| price / free switch | the new price or "free" | ____ |
| hide / end / remove | hidden or gone as the status says | ____ |
Pass/Fail: ____ States: ____

## Profiles area (J-p, severity rated)

| id | journey | account | severity | Pass/Fail |
|---|---|---|---|---|
| J-p1 | Legacy value failing a validator (stored Facebook link) shows, survives an untouched save, and is only checked when edited (R3) | A-org-legacy-live | **High** | ____ |
| J-p2 | Owner vs manager rights per field (as J-g2 table) | A-org-big, A-org-member | **High** | ____ |
| J-p3 | One person, several roles: dancer + teacher + organiser shown in one You (R2) | A-dancer-teacher-org | Medium | ____ |
| J-p4 | Public result after save: photo crop, bio at max length, links, contact privacy (show_phone/email_publicly off hides them) | A-org-big | **High** | ____ |
| J-p5 | Team add / remove / leave, last owner leaves (J-g3, J-g4) | A-org-big, A-org-solo | Medium | ____ |
| J-p6 | Page lifecycle: unclaimed, claimed, hidden, taken down, duplicate, merge; each state's P3 screen says what the person can do [G-27] | seeded pages per state | Medium | ____ |

## Event editing (J-v, severity rated)

| id | journey | account / series | severity | Pass/Fail |
|---|---|---|---|---|
| J-v1 | Series vs one date: each series edit asks "this date only" / "all dates" with a preview of dates and going people (R1) [G-16] | A-org-big W-weekly-130 | **Critical** | ____ |
| J-v2 | Change the repeat rule on a running series: preview lists which dates move or go and who is going on them; hand-edited dates kept [G-16] | M-monthly, W-weekly-130 | **Critical** | ____ |
| J-v3 | Dates taken off, cancelled, moved: going people see the change; cancel reason from the fixed server list only | W-weekly-130 | **High** | ____ |
| J-v4 | Times live on sessions: session times, rooms, per-date venue and line-up edit and show publicly | K-course-now, F-festival | **High** | ____ |
| J-v5 | Line-up search and add a new person not yet in the system | K-course-now | Medium | ____ |
| J-v6 | Publish state transitions incl. past one-off and ended recurring (never Draft) | E-ended, O-oneoff-past, X-draft | **High** | ____ |
| J-v7 | Editing with tickets sold or people going: what is blocked is disabled with a reason (e.g. date move with sold tickets) | A-org-tickets | **High** | ____ |
| J-v8 | Concurrent edits (S-9) [G-24] | A-org-big + A-org-member | Medium | ____ |
| J-v9 | Admin-editor capabilities missing from the new editor are listed as GAP (G-21) and each either has a P3 control or a stated "ask us" route | - | Medium | ____ |

PARKED on purpose (owner, 2026-10-30), not journeys: undo history, make a copy, bulk cancel/move.

---

## Round 3 additions (2026-10-30, brief `docs/briefs/p3-acceptance-contract-r3.md`): a person already in the system comes to join

Built from the data, not from memory: every journey below cites a prod fact (D1-D8) or a code fact (C1-C5) and the entry rows E19-E26 in [PEOPLE-INVENTORY.md](PEOPLE-INVENTORY.md) (also added to INVENTORY.md). Seeds are ACCOUNTS.md section 6. New gaps are G-28 onwards. Severity: **P1** = walked beside the gate (R4), P2 otherwise.

Prod in one line: 203 persons, 8 with an account; 132 listed teachers/DJs with no account and only 3 teacher/DJ persons with an email; 72 persons hold 2+ roles (23 teacher + DJ + dancer); 49 active team rows belong to people with no account; 5 teacher claims pending up to 323 days on ids that no longer exist; all 44 accounts are email-only.

Rule for every J-i journey (R2 sharpened): **one person ends with one account, one persona, one You area.** After the journey, the walker checks (read-only SQL on the `[ACC]` rows): the person row has exactly one `auth_user_id`; exactly one `dancer_profiles` row has `claimed_by` = the account; no new `person` row was created for someone who was already listed.

### Listed person, no account

#### J-i1: listed teacher signs up with the SAME email as on file (P1)
Account: A-listed-same (seed: person + persona with email E, roles teaching + dancing, no account). Entries: E19, E03, E04.
1. Sign up with E, tick Teacher. E19 answers `linked`. No "Already listed on Bachata Calendar?" screen appears (it only shows after `no_match`).
2. You shows the listed name, photo and the Teacher section with the existing teacher details (years teaching, styles); nothing asks to re-enter them. Blank sign-up fields filled only where the listed profile was empty.
3. The public teacher page is the same URL/slug as before sign-up; event line-ups that named this teacher still name them.
4. Sign out, sign in by typed code (E21): same account, same You, no second link attempt shown.
Must be impossible: a second persona for E; the listed details overwritten by sign-up blanks; the link happening with an unproven email (`email_unproven`).
Pass/Fail: ____ States: S-1 ____ S-5 ____ S-8 ____

#### J-i2: listed teacher signs up with a DIFFERENT email (P1)
Account: A-listed-other (seed: listed teacher with email E1; sign up with E2). Entries: E19, E20.
1. Sign up with E2, tick Teacher. E19 answers `no_match`. "Already listed on Bachata Calendar?" shows with "Ask us and we'll link it to your account." and the link "Ask us to link your profile".
2. Continue lands on the planned landing; You shows an EMPTY teacher section (a new stub), not the listed one.
3. After an admin links the listed profile (E25 / manual), the next sign-in shows the listed profile, and the stub made in step 2 is gone or merged; one persona remains **[G-28, G-34]**.
Must be impossible: linking by name match without proof; two teacher pages for one person on the public site after the admin link.
Pass/Fail: ____ States: S-1 ____

#### J-i3: email typo or variant (P2)
Account: A-listed-variant (listed email `Name.Teacher@example.test`).
1. Sign up with `name.teacher@example.test` (case differs): links (E19 `linked`) **[G-31]**.
2. Sign up with ` name.teacher@example.test ` (spaces): the form trims it; links.
3. Sign up with `nameteacher@example.test` (dot removed) or a one-letter typo: does NOT link; treated as J-i2.
Must be impossible: a typo that matches a DIFFERENT listed person links to them.
Pass/Fail: ____

#### J-i4: listed person with NO email on file signs up (P1; 132 prod rows, D1)
Account: A-listed-noemail (listed teacher + DJ, no email). Entries: E19, E20.
1. Sign up ticking Teacher: E19 `no_match`, "Already listed?" shows (as J-i2 step 1).
2. Sign up ticking Dancer only: NO "Already listed?" step is shown today **[G-29]**; expected: a listed dancer is offered the same way to ask.
3. The person can find their listed profile from inside the app (search by name, or "Is this you?" on the public profile) **[G-28]**; today the only path is WhatsApp.
Must be impossible: the account quietly sitting beside the listed profile with no prompt anywhere.
Pass/Fail: ____

#### J-i5: "Already listed?" answered yes / no / not sure (P2)
Account: A-listed-other.
1. Expected screen: three answers. Yes -> ask to link (today: WhatsApp link). No -> continue, nothing sent. Not sure -> show what we hold (a search by name, or "we'll check and message you") **[G-32]**.
2. Today the screen has only "Ask us to link your profile" and Continue. The walker records the screen as it is and FAILs step 1 until G-32 is decided.
3. Typed-code sign-up (E21): the step must show on this path too **[G-35]**.
Pass/Fail: ____

#### J-i6: two listed profiles share the email (ambiguous) (P2; 1 prod email on 2 persons, D6)
Account: A-listed-ambiguous.
1. Sign up with the shared email: E19 answers `ambiguous`, nothing links.
2. The person is told we found more than one profile and how to resolve it **[G-33]** (today: silent; no "Already listed?" either, because it only follows `no_match`).
Must be impossible: linking either profile at random.
Pass/Fail: ____

### Person who already has an account

#### J-i7: signs up again with the same email (P2)
Account: A-dancer (existing).
1. Choose "Sign up", type the existing email, enter the code: the person lands signed in to the SAME account, with a line that they already had one **[G-41]**.
2. Roles ticked on this second sign-up are offered, not silently added or dropped.
Must be impossible: a second `auth.users` row; the existing profile reset.
Pass/Fail: ____

#### J-i8: signs in with the other method (code vs link) (P1)
Account: A-org-legacy-live and A-deleted.
1. Same account by link (AuthCallback) and by typed code (AuthStepper): same landing, same page choice.
2. A deleted account gets the restore screen on BOTH paths **[G-35]**.
3. A Teacher/DJ sign-up with `no_match` sees "Already listed?" on BOTH paths **[G-35]**.
Pass/Fail: link ____ code ____

#### J-i9: one person, two accounts (P2; 0 in prod today, D7)
Account: A-two-1 (linked to the listed persona) and A-two-2 (second email, own stub).
1. Signing in as A-two-2 shows the stub, never the persona already linked to A-two-1.
2. A path exists to say "this is also me" and end with one account **[G-34]** (decision: admin join via E25, or in-app).
Must be impossible: both accounts linked to the same persona; two organiser seats for one person counted as two people.
Pass/Fail: ____

### Claims and proof of identity

#### J-i10: two people claim the same profile (P1)
Accounts: A-claim-1 (proven email = the listed email), A-claim-2 (other email).
1. A-claim-1 links via E19. A-claim-2 has no path to the same persona except asking an admin.
2. Organiser page: A-claim-1 claims (E10); A-claim-2 then sees the page as claimed and is offered "ask to join" (`request_organiser_access_v1`), never a second claim.
Must be impossible: `claimed_by` overwritten; both shown as owner.
Pass/Fail: ____

#### J-i11: claim on a profile that is already claimed (P2)
Account: A-claim-2 with the listed email recorded on a page already claimed by A-claim-1.
1. At sign-in E22 returns nothing; the person is told the page is already run by another account and offered ask-to-join **[G-37]** (today silent).
2. E19 `already_linked` for someone else's persona: a message with "Tell us" **[G-37]**.
Pass/Fail: ____

#### J-i12: someone who is not that person tries to claim (P1)
Account: A-impostor (knows the listed name, not the mailbox).
1. The only proof accepted is a proven mailbox matching the email on file (E19, E10, E11 `email_unproven`). Name, Instagram or phone never link anything.
2. With no email on file, the claim goes to a human queue that can see and act on it: today `profile_claims` has 5 teacher claims up to 323 days old pointing at ids that no longer exist, with no writer on main **[G-30]**.
Must be impossible: any link without a proven mailbox or an admin decision.
Pass/Fail: ____

### Several roles, team rows, venues

#### J-i13: listed as teacher AND DJ AND dancer joins (P1; 23 prod persons, D3)
Account: A-listed-three (one person, roles teaching + djing + dancing, email on file).
1. Sign up ticking Teacher and DJ: one link, one account. You shows ONE area with Dancer, Teacher and DJ sections from the same person (R2). Switch page lists organiser pages only.
2. Public pages: the teacher and DJ pages are the same person (same photo, name); no duplicate created.
3. Ticking only Dancer at sign-up still links the same person; Teacher and DJ sections are present because the roles are on the person row.
Must be impossible: three personas or three accounts; a role section missing because a different box was ticked.
Pass/Fail: ____

#### J-i14: merged or archived listed rows (P2; 19 archived, 2 merged, D6)
Accounts: A-listed-archived (email on an archived persona), A-listed-merged (email on a merged-away person whose survivor has a different email).
1. Archived: no link (E19 links live rows only); a fresh account; the archived row stays hidden.
2. Merged: the account links the SURVIVOR or nothing, never the merged-away row **[G-38]**.
Pass/Fail: ____

#### J-i15: listed team member with no account joins (P1; 49 prod rows, D4)
Account: A-team-legacy (active `organiser_team_members` row on P-big, person with email, no account).
1. Sign up with that email: E19 links the person. The person sees P-big in P3 with the team role they hold, or a clear line "You are listed on P-big's team. Ask the owner to invite you" **[G-39]**.
2. The owner's Team screen shows ONE row for this person before and after (not the legacy row plus a new one).
Must be impossible: gaining owner rights from a legacy `Leader` row without a grant; seeing page B's data (J-g5).
Pass/Fail: ____

#### J-i16: owner adds a listed person who has no account (P2)
Account: A-org-big.
1. Team search by name finds only confirmed accounts (E24), so the listed person is not found; the screen offers invite by email instead (U3).
2. After the invite is accepted (E11, email must match), the person's listed persona is the one linked, not a new one.
Pass/Fail: ____

#### J-i17: invite bound to a person the sign-in cannot link (P2)
Account: A-helper-noprofile (invite with `person_profile_id`, account email matches the invite but not the persona).
1. Redeem returns `not_linked`: no seat, and the screen says what to do next (never a blank Done).
Pass/Fail: ____

#### J-i18: deleted, suspended or venue/vendor contact (P2)
1. Deleted account (erase request) signs in: restore screen before any claim runs **[G-36]**; restoring keeps the old links.
2. Banned account: refused with a message; no claim runs.
3. Venue contact, videographer or vendor (68 venues, 2 + 2 listed, none linked): no join path; the copy never offers one that does not exist **[G-40]**.
Pass/Fail: ____

## Gap list (as of main 472ecde; G-16 onwards added in round 2; G-28 onwards in round 3)

| id | gap | journeys | severity |
|---|---|---|---|
| G-01 | No UI path takes an organiser who already has a page into P3. ContinueAs, the dancer home, Options, Your areas and the claim card all go to R1 `/account/o`. The E05 handoff only fires at 0 pages (`auth-otp-routing.ts:172-173`, `accountRouting.ts:352`, `areaStatus.ts:28`). | J-d1 | **Critical**: the area is unreachable for its main users without typing the URL |
| G-02 | A claim from the public card lands on R1 (`PublicClaimCard.tsx:212`, `claimSignInLanding.tsx:20`). A claim inside P3 stays in P3. | J-c4 | High |
| G-03 | P3 has no AccountGated, so a deleted account can open `/account/p3` (`P3Routes.tsx:65` vs `OrganiserRoutes.tsx:76-83`). | J-a4 | High |
| G-04 | Legacy `/account/new`, `/series`, `/team` redirect to R1 even while P3 is live (`legacyPaths.ts:23-28`). | J-d1 | Medium |
| G-05 | The sign-up role screen describes each role but never says what it leads to, and Organiser grants nothing until a page exists (`auth-otp-routing.ts:219-228`). | J-a1, J-b3 | Medium |
| G-06 | No prompt offers organising outside the Your areas Organiser row (or Go live). The Teacher and DJ areas have no organiser route. A dancer-only account sees only "Open or add a role" and a collapsed "I organise events" card. | J-b1, J-b3 | Medium |
| G-07 | No-page and waiting states exist only on Home (redirect) and You. Events shows the generic "Add an event" empty card, and Stats shows "no views" (`EventsScreen.tsx:9`). | J-a2, J-c3 | Medium |
| G-08 | If the E05 handoff read fails, it returns null and the person stays in R1's old onboarding with no message (`organiser/home/index.tsx:119`). | J-b2 | Medium |
| G-09 | The invite Done says "Open your organiser home" but opens You/Welcome, and falls back to R1 when there is no org id (`JoinScreens.tsx:168`, `joinCopy.ts:80`). | J-c5 | Low |
| G-10 | Lists over the 100-row API cap are unproven for the Events list and Next up. The Event page has "100 of N" but `organiser_home_v1` paging is unverified. Prod has an organiser with 45 series and one with 258 dates. | J-d3, J-d4 | High until proven |
| G-11 | `you/done` opened without router state has no defined fallback (`flows/Done.tsx:57`). | J-a2 | Low |
| G-12 | An empty cancellation-reasons list renders nothing (`CancelEventSheet.tsx:81`). | J-d7 | Low |
| G-13 | The Tickets row renders nothing if the home read fails (`TicketsEntry.tsx:54`). Co-organiser names fall back silently to "Organiser page" on error (`SeriesOrganisers.tsx:91`). | J-d12, J-d10 | Low |
| G-14 | The flag pair is checked separately in 4+ places (`AnimatedRoutes.tsx:224,266,272`, `home/index.tsx:119`, `JoinPage.tsx:357`), so the checks can drift apart. | J-a5 | Low (guard) |
| G-15 | No prod series uses every-N-months (interval > 1) or explicit-dates mode, so these shapes exist only in seeds. | J-d5 | Info |
| G-16 | Owner rule R1 is not met on main: the Repeats preview (S13) lists dates but not who is going, and there is no per-edit "this date only / all dates" choice outside sessions (S20). Whether hand-edited dates survive a rule change is unproven. | J-v1, J-v2 | **Critical** (owner rule) |
| G-17 | Auto-claim by email: `organiser_claim_emails` exists but has **0 rows** in prod, and no `src/` code reads it (only a test mentions it). Sign-in auto-claim is unproven. | J-e1 | High until proven |
| G-18 | "Two owners" has no single meaning: `organiser_profiles.claimed_by` holds one user; team roles in prod are `Leader` (48 pages) and `Member` (5 pages). The owner must decide what a second owner is. | J-e6 | Decision |
| G-19 | Every claimed page in prod (10 of 10) has no completed `organiser_onboarding_progress` row, so every existing organiser hits the gate. Grace period length and copy are unproven. | J-e7, J-e8 | **Critical** (P1) |
| G-20 | 29 pages carry a Facebook link. R3 (accept until edited) is unproven for the page editor and Settings. | J-p1, J-e8 | High |
| G-21 | Admin-editor fields with no P3 control, from the `organiser_profiles` columns: `gallery_urls`, `address`, `google_maps_url`, `founded_year`, `trusted_at`, claim email (`organiser_claim_emails`), front-door flag (`organiser_front_door_flags.run_by_us`), series co-organiser invites (`series_organiser_invites`). Not checked against the admin repo in round 2 (not readable here). | J-v9 | Medium (confirm list) |
| G-22 | Cross-page isolation for a member of page A acting on page B is proven only by the Not yours card, not by a server-refusal test. | J-g5 | **High** (P1) |
| G-23 | No defined outcome when the last owner leaves a page with live events. | J-g4 | Medium |
| G-24 | No known conflict check for two people editing the same event; the later save may overwrite silently. | J-v8, S-9 | Medium |
| G-25 | The dancer-profile-first gate (`dancerFirst.refusal.test.tsx`) for an organiser-later path is not described in P3 copy. | J-f4 | Medium |
| G-26 | Destinations of old R1 bookmarks (E15) and claim/approval email links (E16) are unverified while P3 is live. | J-x1 | Medium |
| G-27 | Page lifecycle states other than live: prod has only `live` pages (49), so hidden, taken down, duplicate and merge exist only in seeds. | J-p6 | Info |
| G-28 | Matching is by proven email only (C1) and only 3 listed teacher/DJ persons carry an email (D1). The 132 listed teachers/DJs with no account have no in-app way to find and claim their profile; the only path is a WhatsApp message. | J-i2, J-i4 | **High** (P1) |
| G-29 | "Already listed?" shows only when Teacher or DJ was ticked (`auth-otp-routing.ts:316`); a listed dancer, or a teacher ticking only Dancer, never sees it. | J-i4 | Medium |
| G-30 | `profile_claims`: 5 teacher claims pending up to 323 days, their `profile_id` matches no `person` or `dancer_profiles` row, and no `src/` writer exists. Nobody can approve them. | J-i12 | **High** (data) |
| G-31 | Case / whitespace normalisation of the email match in `claim_my_dancer_profile_v1` and `claim_my_organisers_v1` is server-side and unread here. | J-i3 | Medium until proven |
| G-32 | The brief's yes / no / not sure answers on "Already listed?" do not exist; the screen has a WhatsApp link and Continue. Owner decision. | J-i5 | Decision |
| G-33 | E19 `ambiguous` shows nothing to the person. | J-i6 | Medium |
| G-34 | No account linking or account merge: OTP email only, `person_account_links` 0 rows. A person with two emails ends with two accounts; the stub from a non-matching sign-up has no defined fate after an admin link. | J-i2, J-i9 | Medium (decision) |
| G-35 | The typed-code path (AuthStepper) skips the deletion/restore check and the "Already listed?" step that the link path (AuthCallback) runs. | J-i5, J-i8 | **High** (P1) |
| G-36 | The dancer persona claim runs before the deletion check (`AuthCallback.tsx:197` vs `207`). | J-i18 | Medium |
| G-37 | A page or persona already claimed by someone else is silent at sign-in (empty list / `already_linked`). | J-i11 | Medium |
| G-38 | No merged-row handling at sign-in; `person_merge_decisions` has 4 `merge` rows but `person_merge_log` has 0. | J-i14 | Medium |
| G-39 | 49 active legacy `organiser_team_members` rows belong to people with no account, and 10 `entity_members` holders have no `person` row: the legacy team and the P3 roles are two lists with no defined mapping at join. | J-i15 | **High** (P1) |
| G-40 | Venue contacts, videographers and vendors have no join path (vendors only via team auto-claim). | J-i18 | Info |
| G-41 | Signing up with an email that already has an account: outcome and copy unproven. | J-i7 | Medium |

## Coverage

73 inventory rows (47 S + 26 E; E15-E18 added in round 2, E19-E26 in round 3). Rows covered by at least one journey:

| journey | covers |
|---|---|
| J-a1 | E03, E04, E06, E07, E14 |
| J-a2 | E01, E02, S01, S05, S06, S35, S42, S45 |
| J-a3 | S07, S23, S24, S27, S28, S29, S30 |
| J-a4 | E01 |
| J-a5 | E01, E03 |
| J-b1 | E07, E09 |
| J-b2 | E05, E09, S45 |
| J-b3 | E03, E14 |
| J-c1 | E03, E14, S01, S02, S03, S45 |
| J-c2 | S01, S36, S43, S45 |
| J-c3 | E04, E06, S39, S43, S45 |
| J-c4 | E10 |
| J-c5 | E11, S37 |
| J-c6 | S07, S42, S47 |
| J-c7 | S02, S41, S46 |
| J-d1 | E04, E05, E06, E07, E08, E12, E13 |
| J-d2 | S01, S02, S04, S06 |
| J-d3 | S05 |
| J-d4 | S07, S16, S17, S23 |
| J-d5 | S10, S13, S14, S15 |
| J-d6 | S07, S20, S21, S22 |
| J-d7 | S08, S12 |
| J-d8 | S08, S09, S10, S11 |
| J-d9 | S18, S19, S24, S25, S26, S27 |
| J-d10 | S28, S29, S36, S39, S40, S44 |
| J-d11 | S01, S05, S07 |
| J-d12 | E13, S30, S31, S32, S33, S34 |
| J-d13 | S35, S38, S42, S44 |
| J-e1..J-e8 | E02, E04, S01, S02, S05, S06, S07, S23, S28, S36, S41, S46 |
| J-f1..J-f4 | E05, E07, E09 |
| J-g1..J-g6 | E11, E17, S29, S37, S39, S40, S44 |
| J-x1 | E12, E13, E15, E16, E17 |
| J-x2 | E18 |
| J-p1..J-p6, J-v1..J-v9 | S13, S16, S17, S20, S22, S38 (and the S rows above) |
| J-i1..J-i6 | E03, E04, E19, E20, E21 |
| J-i7..J-i9 | E04, E21, E25, E26 |
| J-i10..J-i12 | E10, E11, E19, E22, E23 |
| J-i13..J-i18 | E11, E19, E24, E25, E26, S37 |

**Coverage: 73 rows, 73 covered, 0 uncovered.** (Round 2: 25 round-1 journeys + 35 new journey ids: J-e1..8, J-f1..4, J-g1..6, J-x1..2, J-p1..6, J-v1..9. Round 3: 18 more, J-i1..J-i18.)

Covered thinly (one journey, and the step depends on a flag the walker may not have on): S04 (needs p3GoingOn) and S30-S34 (need organiserTicketing). The walker records "flag off, not walked" instead of PASS. That is a known limit, not a silent omission.
