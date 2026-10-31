# P3 acceptance: FIXLIST

One list of everything the three journey audits marked FAIL, PARTIAL or blocker. Sources: [AUDIT-gate.md](AUDIT-gate.md), [AUDIT-public.md](AUDIT-public.md), [AUDIT-team.md](AUDIT-team.md) (all read from code and live function bodies, no browser). Things the audits could not settle are in [WALKLIST.md](WALKLIST.md).

Reading the ids: `A-gate-n` / `A-gate-Jn` / `A-public-n` / `A-team-n` are the audits' own finding ids. `Jx.y` is a journey step the audit marked FAIL (so `J-d1.1` is journey J-d1, step 1). `G-n` is a contract gap id. In the file column, `(admin repo)` means the fix is a database change that belongs to `bachata-admin-11april`, not this repo.

Severity: blocker / high / medium / low. A row is placed once; several audit ids can point at the same row when they describe the same fault.

## Rows

### P3-LAND (everything that still lands in the old organiser area)

| id | audit finding ids | journey steps | severity | what is wrong | fix slice | files | owner decision? |
|---|---|---|---|---|---|---|---|
| F-01 | A-gate-J1, A-team-1 | J-d1.1, J-d1.2, J-e1.1 (lands), J-e2.1, J-f1.1, J-f3.1 (with a page) | blocker | Someone who already runs a page can only reach the new organiser area by typing the web address. Sign-in, the claim landing, the dancer home links, Options, "Your areas" and "I organise events" all end in the old one. | P3-LAND | `lib/accountRouting.ts:352,396,405`; `lib/claimSignInLanding.tsx:20`; `lib/auth-otp-routing.ts:172-173`; `modules/organiser/home/index.tsx:119-120`; `components/account/DancerHome.tsx:298,310,320,330-352`; `modules/dancer-app/screens/options/optionsModel.ts:42`; `modules/dancer-app/.../NoProfileWayOut.tsx:31`; `modules/areas/home/areaStatus.ts:28` | YES: Move everyone who has a page to the new area at once, or only people who opt in one by one? (also: is the old area retired for page holders when this goes on?) |
| F-02 | A-gate-J2 | J-d1.3 | medium | The old links for New event, an event and Team still open the old organiser area while the new one is live. | P3-LAND | `modules/organiser/shell/legacyPaths.ts:23-28`; `components/AnimatedRoutes.tsx:241-255` | NO |
| F-03 | A-gate-J3 | J-x1.1 | medium | Old bookmarks and links (`/account/o`, an old event link, `/account/new`, `/account/team`, `/account?o=`) land in the old area; an old event link even loses the event and shows the old Home. | P3-LAND | `modules/organiser/shell/OrganiserRoutes.tsx:128-153`; `AnimatedRoutes.tsx:258-262`; `pages/Account.tsx:42,56-57`; `lib/accountRouting.ts:71-75`; `legacyPaths.ts:23-28` | NO |
| F-04 | A-gate-J7 | J-x1.2 (claim part) | medium | After claiming a page from its public page, the "go" link opens the old Home; an invite without a page and the email-code screen do the same. | P3-LAND | `modules/organiser/shared/components/PublicClaimCard.tsx:212`; `admin-organisers/join/JoinScreens.tsx:168`; `EmailCodeProof.tsx:27` | NO |
| F-05 | A-team-29 | J-g1.1 (accept lands) | low | After accepting an invite the person lands on the Welcome page while the words say "Open your organiser home". | P3-LAND | `p3/shell/paths.ts:69`; `JoinScreens.tsx:166-168` | NO |
| F-06 | A-gate-J12 | J-d9.6 (profile-lock link) | low | The "Complete your profile" link on Details and Prices leaves the new area for the old one with a full page load. | P3-LAND | `p3/screens/DetailsScreen.tsx:80`; `p3/screens/PricesScreen.tsx:45`; `shared/profileProgress.ts:45` | NO |

### GATE-RETRY (the "A few details first" gate)

| id | audit finding ids | journey steps | severity | what is wrong | fix slice | files | owner decision? |
|---|---|---|---|---|---|---|---|
| F-07 | A-gate-1 | J-d8 / J-d9 flag flip (no step id) | blocker | There is no grace period. Turning the gate on stops every event change for all 11 non-admin organisers at once (4 pages, 7 live upcoming events), including cancelling tonight's date. None of the 48 claimed pages would pass today. | GATE-RETRY | server `_require_onboarding_complete_v1` (admin repo); flag `organiser_onboarding_gate` | YES: When the gate is on, should cancelling or moving a date in the next 7 days always stay open, or is it a hard stop on every change? |
| F-08 | A-gate-2, A-team-5 | J-e7.1, J-e8.1 | high | The yellow banner says "Until then everything works as usual" even when the gate is on and nothing works, never says how long grace lasts, and contradicts itself. A failed read hides it without saying so. | GATE-RETRY | `p3/screens/GraceBanner.tsx:24-26,66-67`; `graceModel.ts:48` | YES: How long is grace, and should the banner show an end date? |
| F-09 | A-gate-5 | J-c7.2, J-e8.3 | high | After finishing the details sheet the person lands on Home or Page, not back at the change they were making, and has to find the event and redo it. Typed text on date, session and status sheets is lost. | GATE-RETRY | `p3/onboarding/GateSheet.tsx:65`; `gate.ts`; `shell/paths.ts:61-62`; `OnboardingFlow.tsx:130,286` | YES: After the details are done, redo the held change for them automatically, or take them back to the screen with a "Try again" button? |
| F-10 | A-gate-3 | J-e8 (create and organisers) | high | Creating a first event, or changing who runs an event, shows only a fixed line "Finish your details first" with no way to act. | GATE-RETRY | `flows/new/NewFlow.tsx:146-147`; `flows/new/useNewSend.ts:44-49`; `flows/add/useFlow.ts:54-56,67-68`; `p3/shell/P3Routes.tsx:94-97` | NO |
| F-11 | A-gate-4, A-gate-11 | J-d9 (tickets) | high | A refused ticket change says "That did not work. Try again in a moment", and trying again never works. "Add and sell" saves a draft and then says the same. The guard config also still calls both ticket changes "not gated", which is false. | GATE-RETRY | `p3/tickets/TypeSheet.tsx:119,127,130-131`; `TicketsEntry.tsx:160,166-167`; `tickets/ticketModel.ts:407-408`; `scripts/onboarding-write-doors.json:119-125` | NO |
| F-12 | A-gate-6 | J-c7 (Repeats) | medium | Changing a repeat rule opens the details sheet on its own before the person taps Save, and every refused preview writes a failed-change record. | GATE-RETRY | `p3/screens/RepeatSheet.tsx:147,163-171`; `p3/data/repeat.ts:10-13` | NO |
| F-13 | A-gate-7 | J-c7 (two counts) | medium | Details and Prices are locked up front by one count ("N answers left"), the gate sheet shows a different count ("N things left"), and the two can disagree. | GATE-RETRY | `p3/screens/EditTray.tsx:76-83`; `shared/profileProgress.ts:47-68` | YES: Lock the edit screens up front (no typing wasted), or leave them open and show the sheet at Save? |
| F-14 | A-gate-8 | J-d8 (several pages) | medium | A person who finished one page can change an event shared with their unfinished page, but cannot sell its tickets. | GATE-RETRY | server `_require_onboarding_complete_v1` loop and ticket gate lines (admin repo) | YES: Is "finished any one of the event's pages" the right rule for events run by several pages? |
| F-15 | A-gate-10 | J-c7 (new event, build branch) | low | On the new-event build the refusal shows its own card instead of the shared sheet; the cover photo is uploaded before the create so every refused create leaves a stray file; discarding a draft shows a wrong generic error. | GATE-RETRY | `p3/new/CreateFlow.tsx:228-232`; `p3/new/useCreateSave.ts` | NO |

### HOME-COPY

| id | audit finding ids | journey steps | severity | what is wrong | fix slice | files | owner decision? |
|---|---|---|---|---|---|---|---|
| F-16 | A-gate-J4 | J-d2.4 | high | Home says "None of your live events has a date coming up. Add dates" beside events tagged "Finished", where dates cannot be added. The all-ended copy says "Add an event" but there is no such button on Home. | HOME-COPY | `p3/screens/HomeScreen.tsx:15-20,109-113,169-176`; `p3/model/status.ts` | NO |

### EDITOR-STATES

| id | audit finding ids | journey steps | severity | what is wrong | fix slice | files | owner decision? |
|---|---|---|---|---|---|---|---|
| F-17 | A-gate-J10 | J-d9.3 | low | If the venue list fails to load the place sheet is dead (Close only, no Try again); an empty list shows nothing. The per-date "Where" sheet has the same gap. | EDITOR-STATES | `p3/screens/DetailsScreen.tsx:149-159`; `p3/screens/DateSheet.tsx` (edit-where) | NO |
| F-18 | A-gate-J11 | J-d9.4 | low | On a festival with no prices the text says "or switch on 'It's free'" but the switch is not on screen (6 of 8 live festivals). | EDITOR-STATES | `p3/screens/PricesScreen.tsx:48,65`; `model/labels.ts:265` | NO |
| F-19 | A-public-9 | J-d7 (empty reasons) | low | If the list of cancel reasons comes back empty the sheet shows nothing and says nothing (cannot happen today: prod has 5). | EDITOR-STATES | `p3/screens/CancelEventSheet.tsx:80-95` | NO |
| F-20 | A-gate-J8 | J-d9.6 | medium | A manager gets full edit screens and no lock note; a contributor only sees "Not yours". The contract expects a lock with a reason. | EDITOR-STATES | `p3/screens/EditTray.tsx:77-84`; `EventPage.tsx:274`; server `_assert_can_edit_series_p5` (admin repo) | YES: May a manager edit event details and prices? |
| F-21 | A-gate-J5 | J-d8.2 | medium | Hide and Show have Undo, "Put it live" does not. | EDITOR-STATES | `p3/data/eventPage.ts:282`; `p3/screens/Toast.tsx:16` | YES: Is Undo of "Put it live" = "Hide it" fine, or should the contract drop Undo for it? |
| F-22 | A-gate-J6 | J-d8.4 | medium | After Remove the person stays on the event page, which now reads "Finished"; a later link to a removed event opens the full page tagged "Finished". | EDITOR-STATES | `p3/screens/StatusSheet.tsx:176`; `model/status.ts:28`; `p3/screens/EventPage.tsx` (WorkspaceGate) | NO |
| F-23 | A-gate-J9 | J-d3.1 (word) | low | An event whose only date was cancelled is tagged "Finished" on every screen (consistent, but it never ran). Prod has none today. | EDITOR-STATES | `p3/model/status.ts:23-24,35` | YES: Tag it "Cancelled" or "Finished"? |
| F-24 | A-gate-J13 | J-d9.5 | low | A half-typed per-date name, photos or price is dropped silently if the person taps the tab bar or phone Back. | EDITOR-STATES | `p3/screens/DateFieldSheets.tsx:35-50` | NO |
| F-25 | A-gate-J14 | J-d3.2 | low | The event page header shows a broken-image icon if the cover address is bad. | EDITOR-STATES | `p3/screens/EventPage.tsx:199` | NO |

### PAGE-SCOPE

| id | audit finding ids | journey steps | severity | what is wrong | fix slice | files | owner decision? |
|---|---|---|---|---|---|---|---|
| F-26 | A-team-2 | J-e4.1 (Home/Events/Stats show chosen page) | high | Home, Events and Stats mix every page together and show no page name, while "Switch page" says "Showing X". Stats has no page choice at all. | PAGE-SCOPE | `p3/data/home.ts:121-126`; `p3/data/stats.ts:63`; `switch/useOrganiserChoice.ts:8` | YES: Should Home show only the chosen page, or all pages with the page name on each? |

### DATES-100

| id | audit finding ids | journey steps | severity | what is wrong | fix slice | files | owner decision? |
|---|---|---|---|---|---|---|---|
| F-27 | A-team-4 | J-e5.2 (All dates) | medium | "All dates" shows only the newest 100 dates with no Load more, and the Past/All counts are too low (1 prod series has 132). | DATES-100 | `p3/data/eventPage.ts:119`; `p3/screens/AllDatesScreen.tsx:43` | NO |

### SERIES-EDIT-RULE

| id | audit finding ids | journey steps | severity | what is wrong | fix slice | files | owner decision? |
|---|---|---|---|---|---|---|---|
| F-28 | A-public-1 | J-v1 (scope ask), J-v1 (going people), J-v2 (going people in preview) | blocker | Owner rule R1 is not met. Changing cover, venue or prices applies to every date with no "this date only / all dates" question, and the repeat preview lists dates but never the people who are going. | SERIES-EDIT-RULE | `p3/model/repeat.ts:194,423`; `p3/data/repeat.ts:5-8`; `p3/data/sessions.ts:82,160` | YES: When a change is applied to all dates, should it overwrite dates the organiser already hand-edited, or keep them? |
| F-29 | A-public-5 | J-v7 | high | Moving a date is not checked for guest-list entries, going people or tickets, the screen does not warn, and nobody is told. Skip, remove and stop-repeating are guarded; move is not (3 future prod dates have guest-list entries). | SERIES-EDIT-RULE | `_cmd_occurrence_move_date_p5` (admin repo); `p3/screens/DateSheet.tsx` | YES: May a date with people on its guest list be moved at all, and must those people be told? |
| F-30 | A-public-6 | J-v2 / J-d5 (moved date) | medium | A moved date may be dropped or re-made when the repeat rule is later changed, because a move is not treated as a hand-edit. Not yet confirmed (see WALKLIST W-22). | SERIES-EDIT-RULE | `_occurrence_is_curated_v1`, `_reconcile_series_occurrences_after_rule_change_p5_v1` (admin repo) | NO |
| F-31 | A-public-4 | J-v6 (paused) | low | A paused event keeps its past nights on the event page but they vanish from the calendar and the organiser's "Past nights". | SERIES-EDIT-RULE | `get_calendar_events_v2` lines 82-83,123 (admin repo) | YES: Should a paused event's past nights stay in public history (the 2026-10-08 decision says the page keeps them)? |
| F-32 | A-public-2 | J-v4 | medium | On 84 future dates in 2 live recurring events the stored end time differs from the end time worked out from the sessions (-31 to +60 minutes), so the headline and calendar can disagree with the schedule. | SERIES-EDIT-RULE | trigger `trg_recompute_p5_headline_time`, `_p5_sync_series_default_times_v1` (admin repo) | NO |

### CACHE

| id | audit finding ids | journey steps | severity | what is wrong | fix slice | files | owner decision? |
|---|---|---|---|---|---|---|---|
| F-33 | A-public-7 | J-v3 / J-d7 (same tab) | medium | After a change in the organiser area, the event page and calendar in the same browser tab keep showing the old data for up to an hour. | CACHE | `event-page/useEventPageQuery.ts:391`; `hooks/useCalendarEventsRpc.ts:31`; `p3/data/dates.ts:339-342`; `p3/data/sessions.ts:282-283` | NO |
| F-34 | A-public-8 | J-v6 | low | There is no "see it as dancers see it" link from the organiser event page. | CACHE | `p3/screens/EventPage.tsx:153-154` | NO |

### PEOPLE-JOIN

| id | audit finding ids | journey steps | severity | what is wrong | fix slice | files | owner decision? |
|---|---|---|---|---|---|---|---|
| F-35 | A-team-17 | J-i1 (one profile rule), J-i2.3 | high | Signing up always fills a stub profile, so it is never retired and an already-listed person ends with two live profiles (2 of 4 linked prod accounts). | PEOPLE-JOIN | server `_stub_retire_blocker_v1` (`stub_has_content`) (admin repo) | YES: Does a name or city typed at sign-up count as "content" on the stub? |
| F-36 | G-34 (A-team gap check; no A-team id) | J-i9.2 | high | There is no merge path for two profiles of one person. | PEOPLE-JOIN | admin-only merge today (admin repo) | NO |
| F-37 | A-team-19 | J-i4.2, J-i4.3 | high | Listed dancers, and teachers who tick only Dancer, never see "Already listed?". | PEOPLE-JOIN | `lib/auth-otp-routing.ts:288,316` | NO |
| F-38 | A-team-15 | J-i18 (deleted account) | high | A deleted account's sign-in links a profile and retires the stub before the restore screen is shown. | PEOPLE-JOIN | `pages/AuthCallback.tsx:197,207`; `_account_link_refusal_v1` (admin repo) | YES: Should a restored account still link to its profile automatically? |
| F-39 | A-team-16 | J-i5.1 (and J-i8, J-i18) | high | Signing in from an invite link skips the deletion check and the "Already listed?" step. | PEOPLE-JOIN | `JoinPage.tsx:210` | NO |
| F-40 | G-36 (A-team gap check; no A-team id) | J-i18.1 | medium | A banned account does not see refusal copy. | PEOPLE-JOIN | not located by the audit | NO |
| F-41 | A-team-21 | J-i7.1, J-i7.2 | medium | Signing up with an email that already has an account silently signs in with no "you already have an account" line, and the ticked roles are dropped. | PEOPLE-JOIN | `pages/Auth.tsx:284,316` | YES: Offer to add the newly ticked roles to the existing account? |
| F-42 | A-team-23 | J-i6.2 | medium | When two profiles match one email ("ambiguous"), nothing is linked and nothing is shown. | PEOPLE-JOIN | `lib/auth-otp-routing.ts:316` | NO |
| F-43 | A-team-22 | J-i11.1, J-i11.2 | medium | A page that is already owned, or a profile claimed by someone else, is skipped silently with no way to ask to join. | PEOPLE-JOIN | `claim_my_organisers_v1` `CONTINUE WHEN` (admin repo) | NO |
| F-44 | A-team-18 | J-i15.1 | high | 49 (or 42) people on old team lists get no "you are on X's team" line, because rights read the new member table only. | PEOPLE-JOIN | rights RPCs (admin repo) | YES: Should an old team role carry over as a pending invite? |
| F-45 | A-team-20 | J-i12.2 | high | 5 pending teacher claims, up to 323 days old, point at records that no longer exist and nothing can approve them. | PEOPLE-JOIN | `profile_claims` (no writer) | YES: Is there a human claim queue, or are the 5 closed? |
| F-46 | A-team-3 | J-e3.1 | high | A person whose join request was refused gets a silent Welcome with no explanation. | PEOPLE-JOIN | `p3/onboarding/OnboardingFlow.tsx:401` | NO |
| F-47 | A-team-7 | J-f4 (G-25) | medium | The "dancer profile first" step can ask twice or not at all, depending on the route taken. | PEOPLE-JOIN | `lib/accountRouting.ts:118-130` | YES: Is a dancer profile required before organiser onboarding? |
| F-48 | A-team-8 | J-f4.2 | medium | Teacher, DJ and dancer sections live at a different place from the organiser "You" area, so there is not one You. | PEOPLE-JOIN | `p3/you/youRows.ts` | YES: Where does the one "You" live? |
| F-49 | A-team-6 | J-e1.1 (auto-claim) | medium | Auto-claim is built but has never run on real data (0 rows) and never claims a page that is not live. | PEOPLE-JOIN | `claim_my_organisers_v1` (admin repo) | YES: Should draft pages auto-claim? |
| F-50 | A-team-9 | J-g1.1 (invite) | high | An owner cannot send an invite link; only an admin can, and accepting one makes the person an owner. | PEOPLE-JOIN | `admin_issue_organiser_invite_v1`, `redeem_organiser_invite_v1` (admin repo); `teamPickerModel.ts:218` | YES: Should owners send invite links, and as Manager or as Owner? |
| F-51 | A-team-13 | J-g6 (leave event), J-g4 | medium | A co-organiser cannot leave an event (the server call exists but nothing uses it); nothing says what happens to live events when the last owner leaves (9 such pages); a contributor cannot leave alone. | PEOPLE-JOIN | `series_leave_v1` (no caller); `remove_organiser_member_v1`; `more/index.tsx:19,68` | YES: What happens to live events when the last person leaves? |
| F-52 | A-team-12 | J-g2 (contact) | medium | The page editor has no role check: a manager can edit contact (the contract wants read-only), and a contributor sees edit that the server refuses. | PEOPLE-JOIN | `page/index.tsx`; `useOwnPage.tsx` | YES: Should a manager edit the page name and photo? |
| F-53 | A-team-24 | none (data) | low | Two definitions of "has an account" disagree (49 vs 42 team rows). | PEOPLE-JOIN | backfill (admin repo) | NO |
| F-54 | A-team-25 | J-i14 | low | The match has no check for a profile that was merged into another. Safe by data today only. | PEOPLE-JOIN | `_dancer_profile_link_matches_v1` (admin repo) | NO |
| F-55 | A-team-26 | none (dead code) | low | Dead sign-in code remains and comments still call it live. | PEOPLE-JOIN | `claimMyDancerProfile.ts:92`; `claimSignInLanding.tsx:10` | NO |

### TEAM-RIGHTS (screen and server disagree)

| id | audit finding ids | journey steps | severity | what is wrong | fix slice | files | owner decision? |
|---|---|---|---|---|---|---|---|
| F-56 | A-team-10 | J-g5 (G-22) | high | The server does keep one page's organisers out of another page's events, but no test proves it, and the contract wrongly says the error is 42501 (it is "permission denied"). | TEAM-RIGHTS | `apply_aggregate_write_p5` l.582 (admin repo); new RPC test | NO |
| F-57 | A-team-11 | J-g2 | medium | A contributor may send four kinds of change but cannot open the workspace (0 contributors in prod today). | TEAM-RIGHTS | `apply_aggregate_write_p5` l.29,582 (admin repo) | NO |
| F-58 | A-team-14 | J-g6, J-g2 | low | The Organisers screen is locked for managers although the server allows them. | TEAM-RIGHTS | `organisersModel.ts:13,35` | YES: Should managers change who runs an event? |
| F-59 | A-team-27 | J-g3, J-g4 | low | Only the screen stops the last manager of a page with no owner from leaving (36 such pages); the server allows it. | TEAM-RIGHTS | `remove_organiser_member_v1` (admin repo) | NO |
| F-60 | A-team-28 | J-e6 (G-18) | low | Two pages already have a second owner; a manager sees no hand-over control and no reason why. | TEAM-RIGHTS | counts only | YES: What is a "second owner"? |

## Slice order

1. **P3-LAND** (F-01..F-06): nothing else is reachable by real organisers until the landing points at the new area; also the only blockers that need no server change.
2. **GATE-RETRY** (F-07..F-15): the gate must have a grace answer and a working retry before the flag is ever turned on; F-07 is a blocker.
3. **SERIES-EDIT-RULE** (F-28..F-32): the other blocker (owner rule R1) and the move-with-bookings risk; most of it is admin-repo database work, so start it early in parallel.
4. **PAGE-SCOPE** (F-26): a three-screen change that needs one owner answer and unlocks the multi-page walks.
5. **HOME-COPY** (F-16): small, high-visibility copy that a lot of real accounts (live-but-past events) will meet on day one.
6. **EDITOR-STATES** (F-17..F-25): dead states and copy; low risk, can ship as one batch after the Undo / manager decisions.
7. **CACHE** (F-33, F-34): a small fix that makes every later browser walk trustworthy (no one-hour stale pages).
8. **DATES-100** (F-27): one screen, server already supports paging.
9. **PEOPLE-JOIN** (F-35..F-55): largest and mostly admin-repo; order inside it: F-38/F-39 (deleted and invite sign-in safety) first, then F-35/F-36 (double profiles), then the rest.
10. **TEAM-RIGHTS** (F-56..F-60): do F-56 (the test) early because it is cheap; the rest wait for the owner's rights decisions.

## Owner decisions

Answer these as clicks; each is one row above.

1. **F-01 Landing.** Everyone with a page lands in the new area: (a) all at once, (b) only people who opt in, (c) all at once and retire the old area for page holders.
2. **F-07 Gate on.** With the gate on, cancelling or moving a date in the next 7 days: (a) always stays allowed, (b) is blocked like everything else.
3. **F-08 Grace.** Grace lasts: (a) 14 days, (b) 30 days, (c) another length. Banner shows the end date: (a) yes, (b) no.
4. **F-09 After the details sheet.** (a) Redo the held change for them automatically, (b) take them back to the screen with a Try again button.
5. **F-13 Edit screens.** (a) Locked up front, (b) open, with the sheet shown at Save.
6. **F-14 Several pages.** An event run by several pages can be changed when: (a) any one of its pages is finished, (b) the person's own page is finished, (c) all pages are finished.
7. **F-20 Manager edits.** A manager may edit event details and prices: (a) yes, (b) no, view only.
8. **F-21 Undo for Put it live.** (a) Undo means "Hide it", (b) no Undo for Put it live.
9. **F-23 Cancelled one-off.** Tag it: (a) Cancelled, (b) Finished.
10. **F-26 Several pages on Home.** (a) Home shows only the chosen page, (b) Home shows all pages with the page name on each.
11. **F-28 All dates.** A change to all dates: (a) overwrites hand-edited dates, (b) keeps them.
12. **F-29 Move with guests.** A date with people on its guest list: (a) cannot be moved, (b) can be moved after a warning, and the people are told, (c) can be moved after a warning, nobody is told.
13. **F-31 Paused.** A paused event's past nights stay in public history: (a) yes, (b) no.
14. **F-35 Sign-up name.** A name or city typed at sign-up: (a) counts as content on the old profile, (b) does not, so the old profile is merged away.
15. **F-38 Restored accounts.** A restored account: (a) links to its profile automatically, (b) is asked first.
16. **F-41 Existing email.** Signing up with an existing email: (a) offer to add the new roles, (b) just sign in with a note.
17. **F-44 Old team roles.** (a) Carry over as a pending invite, (b) do not carry over.
18. **F-45 Claim queue.** The 5 stuck teacher claims: (a) close them, (b) build a review queue.
19. **F-47 Dancer first.** (a) A dancer profile is required before organiser onboarding, (b) it is not.
20. **F-48 One You.** The one "You" screen: (a) holds all roles, (b) stays organiser only and links to a roles page.
21. **F-49 Auto-claim.** Draft pages: (a) auto-claim too, (b) only live pages.
22. **F-50 Invites.** Owners send invite links as: (a) Manager, (b) Owner, (c) they do not (keep add-by-profile).
23. **F-51 Last owner leaves.** Live events then: (a) pause, (b) pass to the managers, (c) the leave is blocked.
24. **F-52 Manager and page.** A manager editing the page name and photo: (a) allowed, contact read-only, (b) allowed including contact, (c) not allowed.
25. **F-58 Managers and Organisers.** A manager may change who runs an event: (a) yes, (b) no.
26. **F-60 Second owner.** (a) Allowed on purpose, (b) a hand-over only ever has one owner.

## Contract corrections the audits found (for CONTRACT.md, not fix rows)

G-17 and G-08 are stale; G-31 is resolved; G-35 applies to `/invite/:token` only; J-g5 "42501" should read "permission denied"; E19 / J-i11 step 2 returns "no match", not "already linked"; J-g1 cannot be walked as written (see F-50); A-org-big needs a seed (no prod user claims 2+ pages); 0 contributor seats in prod (AUDIT-team, "Contract corrections").

## Coverage

Counting rule: a finding is an audit id (`A-gate-n`, `A-gate-Jn`, `A-public-n`, `A-team-n`); a FAIL step is a journey step the audit marked FAIL or PARTIAL. Steps with a finding id are placed with that finding; steps with only a contract gap id are placed as their own row.

| audit | findings | FAIL / PARTIAL steps and roll-ups | placed in FIXLIST |
|---|---|---|---|
| gate | 25 (A-gate-1..11, A-gate-J1..J14) | 14 (J-d1 x3, J-d2 x1, J-d8 x2, J-d9 x3, J-x1 x2 = 11; plus roll-ups J-c7.2, J-e8.1, J-e8.3 = 3) | 24 findings + 14 steps |
| public | 10 (A-public-1..10) | 7 (J-v1 x2, J-v2, J-v4, J-v6, J-v7, J-d7) | 8 findings + 7 steps |
| team | 29 (A-team-1..29) | 28 (J-e 7, J-f 3, J-g 4, J-i 14) | 29 findings + 28 steps |

**Not placed in FIXLIST, with reason (placed in WALKLIST instead because the audit itself could not settle them):**
- A-gate-9 (verified in code as working; needs a browser confirm) -> W-06.
- A-public-3 (cannot tell from the code read) -> W-19.
- A-public-10 (cannot tell whether every screen sends the version) -> W-24.

Findings placed (equal to findings found minus the three above): gate 24/25, public 8/10, team 29/29. Every FAIL step is placed: gate 14/14 (J-d1.1/.2 F-01, J-d1.3 F-02, J-d2.4 F-16, J-d8.2 F-21, J-d8.4 F-22, J-d9.3 F-17, J-d9.4 F-18, J-d9.6 F-20+F-06, J-x1.1 F-03, J-x1.2 F-04, J-c7.2 F-09, J-e8.1 F-08, J-e8.3 F-09), public 7/7 (J-v1 x2 and J-v2 F-28, J-v4 F-32, J-v6 F-31, J-v7 F-29, J-d7 F-19), team 28/28 (J-e1.1 F-01, J-e2.1 F-01, J-e3.1 F-46, J-e4.1 F-26, J-e5.2 F-27, J-e7.1 F-08, J-e8.1 F-08, J-f1.1 F-01, J-f3.1 F-01, J-f4.2 F-48, J-g1.1 invite F-50, J-g1.1 accept F-05, J-g2 contact F-52, J-g6 leave F-51, J-i1 F-35, J-i2.3 F-35, J-i4.2/.3 F-37, J-i5.1 F-39, J-i6.2 F-42, J-i7.1/.2 F-41, J-i9.2 F-36, J-i11.1/.2 F-43, J-i12.2 F-45, J-i15.1 F-44, J-i18.1 F-40).

Dropped: none. Note for the lead: AUDIT-public's totals line says "7 fail" journeys but its table marks six journeys FAIL (J-v1, J-v2, J-v4, J-v6, J-v7, J-d7); the seven in the count above are the seven FAIL steps, not journeys.
