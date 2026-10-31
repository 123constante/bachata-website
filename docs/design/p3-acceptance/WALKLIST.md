# P3 acceptance: WALKLIST

Everything the three journey audits could not settle from code ("CANNOT-TELL") plus every "walk must check" step, deduped. Sources: [AUDIT-gate.md](AUDIT-gate.md), [AUDIT-public.md](AUDIT-public.md), [AUDIT-team.md](AUDIT-team.md). Fix rows are in [FIXLIST.md](FIXLIST.md). Accounts are named as in [ACCOUNTS.md](ACCOUNTS.md); person shapes (J-i walks) come from [PEOPLE-INVENTORY.md](PEOPLE-INVENTORY.md). All walks at 390x844. No walk writes to prod: seeds are made by the lead with the `[ACC]` prefix.

Routes below are under `/account/p3` unless a full path is given.

## A. Walkable today on prod-shaped test accounts, flags as on prod

| id | audit ids | what to open | account | flag state | what PASS looks like | needs seed data? |
|---|---|---|---|---|---|---|
| W-01 | A-gate Part 2 walk 3 (J-d9.2) | `events/<id>/details`; edit the name, then tap the Events tab, then phone Back, then the Back link | A-org-big | as prod | Each shows "Leave without saving?"; "Leave and lose them" leaves; "Keep editing" stays | no |
| W-02 | A-gate Part 2 walk 6 (J-d8.4), A-gate-J6 | Remove an event, note the page, then reload its deep link `events/<id>` | A-org-big (X-draft or a spare event) | as prod | Record the tag word and whether Add date, Repeats and date sheets are still enabled | no (use a spare seeded event) |
| W-03 | A-public-2, A-public walk 1 (J-v4, J-d6) | The public event page `/event/<id>` and the calendar for each of the 2 live recurring events with end-time drift | none (public) | as prod | The headline end time equals the last session's end on both | prod series ids from the lead (read-only SELECT) |
| W-04 | A-public-3, A-public walk 2 (J-v6, J-d7) | Public `/event/<id>` of an ended recurring event that has future cancelled dates (2 on prod) | none (public) | as prod | The page lists no date after the run ended | prod ids from the lead |
| W-05 | A-public-7, A-public walk 6 | Cancel a date in the organiser area, then go to `/calendar` and `/event/<id>` in the same tab without reload | A-org-big | as prod | Record how long the old state shows; PASS = new state at once | no (use a spare future date) |
| W-06 | A-gate-9, A-gate walk 4 (J-c7.3) | With the details sheet open (needs W-20 flag state) tap a tab, then phone Back | A-org-half | gate ON: see W-20 | Sheet closes on both and does not reopen; a `?o=` change keeps it | see W-20 |
| W-07 | A-team walk 3 (J-f2) | `/account/o` with the network off | A-dj (0 pages) | as prod | An error with Retry shows; Retry hands off to the new area | no |
| W-08 | A-public (group chat), series.set_group_chat | Set a group chat on an event, then open `/event/<id>` | A-org-big | as prod | CANNOT-TELL until seen: record whether the public page shows the group chat | no |
| W-09 | A-public (J-v4 rooms) | Session sheet on an event with rooms | A-org-big (K-course-now) | as prod | Record whether the screen offers rooms (P3 sends no rooms command) | no |
| W-10 | A-public (J-v5) | Line-up search and "add a new person" inside the Session sheet | A-org-big | as prod | A search finds a person; an empty search offers adding a new one | no |
| W-11 | A-public (J-v9, G-21) | Compare the admin editor's list of gaps against the new area | lead, with admin repo | n/a | Every gap in G-21 is either present in the new area or on the FIXLIST | no (needs admin repo, not walkable here) |
| W-12 | A-team walk 5 (J-g1.2) | Switch page and Home after a helper is added | A-helper after the add | as prod | Exactly one page listed | A-helper with an open invite to P-big |
| W-13 | A-team walk 6 (J-g2) | You > Page, Team and Tickets (S31-S34) as a manager | A-org-member | as prod (tickets: see W-24) | Page sheet saves; team controls show their reason beside them; tickets show the read-only note | A-org-member on P-big |
| W-14 | A-team walk 7 (J-g3) | More > Leave this page, then Done > Back to You, then Switch page | A-org-member | as prod | Leaves; page gone from Switch | no |
| W-15 | A-team walk 8 (J-g4) | More as the only owner | A-org-solo | as prod | Leave disabled with "Hand over first" beside it | A-org-solo (P-solo) |
| W-16 | A-team walk 9 (J-g5) | `events/<P-small id>` and its `/dates`, `/details`, `/prices`, `/history`, and `/door` | A-org-member (P-big only) | as prod | Each of the first five shows "Not yours"; `/door` shows not allowed | P-small event id |
| W-17 | A-team walk 10 (J-g6) | Home and Organisers for the shared event; the public page | A-org-big, A-org-partner | as prod | Both see S-shared; the public page names both | S-shared |
| W-18 | A-team walk 1 (J-e4.3) | Open a P-big event by deep link while P-small is chosen | A-org-big | as prod | Nothing flips, and the event opens | no |
| W-19 | all three audits, U8 and U10 | Every screen walked above | any | as prod | Tap targets are at least 44px and there is no garbled punctuation | no |

## B. Needs a preview build flag

| id | audit ids | what to open | account | flag state | what PASS looks like | needs seed data? |
|---|---|---|---|---|---|---|
| W-20 | A-gate walk 1 (J-e8 steps 2, 5), A-gate walk 1 of Part 1 | Make a change (Put it live, Cancel this date) while the gate is on; read the sheet; then follow Continue | A-org-half, A-org-unfinished | gate ON on a branch DB or test account (never prod) | The sheet asks only for what is missing, with answers already filled in; Not now leaves the person where they were | A-org-half: claimed page, no onboarding row |
| W-21 | J-e8.5 (Facebook link, R3) | Same, on a page whose website is a Facebook address | A-org-legacy-live | gate ON | Record whether the Facebook link blocks or is accepted; PASS = decided behaviour in the contract | P-legacy (website = Facebook URL) |
| W-22 | A-gate Part 1 walk 1 (rows 1-24) | Each of the 24 write doors in turn (status, repeats, details, prices, session, date sheet, add date) | A-org-half | gate ON | The sheet opens over the refused sheet, both stack, and the date sheet stays below | A-org-half with a live weekly |
| W-23 | A-gate walk 2, A-gate-7 | Details and Prices with the gate on and dirty text; tap the sheet's Continue | A-org-half | gate ON | Record the lock count against the sheet count; the leave prompt appears when text is dirty | A-org-half |
| W-24 | A-gate walks 3, 7, A-gate-4 | Ticket "Add ticket" and "Add and sell", Refund, Connect Stripe | A-org-tickets (charges off, then on) | gate ON and `VITE_ENABLE_ORGANISER_TICKETING` | Refused copy names the details and has a link; record whether the Refund and Stripe edge functions refuse an unfinished page | A-org-tickets (2 ticket types, 3 orders, 1 refunded) |
| W-25 | A-gate-6, A-gate walk 3 | Repeats on a series, change the weekday | A-org-half | gate ON | Record whether the sheet opens on its own before Save | A-org-half |
| W-26 | A-gate-5, A-gate walk 5 | Finish the sheet's Continue > Review > Live | A-org-half | gate ON | Record where the person lands and the number of taps to redo the change | A-org-half |
| W-27 | A-gate Part 2 walk 1 (J-d2.2) | Home > Next up > "N going"; and a night with 0 going | A-org-legacy-live | `VITE_ENABLE_GOING_PREVIEW=true`, `VITE_VERCEL_ENV=preview` | Button of at least 44px; opens a sheet with the event name and people; 0 going reads "Nobody has said they're going yet" as plain text | P-legacy: going people on the next 3 dates |
| W-28 | A-gate Part 2 (J-d1.4) | `/account/tickets/...` | A-org-tickets | `VITE_ENABLE_ORGANISER_TICKETING` | An event link goes to the event; anything else to Get paid; `?o` and `stripe` kept | no |

## C. Needs seeded data (the lead seeds; never a prod write)

| id | audit ids | what to open | account | flag state | what PASS looks like | seed needed |
|---|---|---|---|---|---|---|
| W-29 | A-gate Part 2 walk 4 (J-d3.3) | Events list | A-org-big | as prod | All series listed; scrolls to the last; count matches the seed | P-big plus 100 extra live one-offs (about 116 series) |
| W-30 | A-team walk 2 (J-e5.1) | Home Next up; Events; an ended event | A-org-history | as prod | Next up skips past dates; ended events show Ended | P-history: 86 past dates, 3 series |
| W-31 | A-public walk 8 (J-d4) | `events/<W-weekly-130>/dates` | A-org-big | as prod | After the fix, "100 of N" with Load more; before it, record the cap | W-weekly-130 (132 dates, 30 past, 3 cancelled, 2 skipped) |
| W-32 | A-public-6, walk 5 (J-v2, J-d5) | Move one date of W-weekly-130, then change the repeat rule | A-org-big | as prod | The moved date survives the rule change | W-weekly-130 |
| W-33 | A-public-5, walk 4 (J-v7) | Move a date that has a guest-list entry | A-org-big | as prod | Record whether the screen warns and where the guest entry ends up | one future date with a guest-list entry |
| W-34 | A-public-4, walk 3 (J-v6) | Pause P-paused; open its public page, the calendar and the organiser's "Past nights" | A-org-big | as prod | Past nights appear on all three (or the decision says otherwise) | P-paused (80 dates, 40 past) |
| W-35 | A-public-10, walk 7 (J-v8) | Two tabs, same date, two saves | A-org-big (tab 2: A-org-member) | as prod | The second save is refused or warned | no |
| W-36 | A-public walk 9 (J-d6) | A festival's Session rows and a course's scope-disabled reason | A-org-big | as prod | Read-only copy on the festival rows; a reason on the disabled scope | F-festival, K-course-now |
| W-37 | A-public (J-v3), walk 10 | Cancel a date that has going people | A-org-big | as prod | Record what the going people see (nothing is sent today) | W-weekly-130 with 3 future dates having people going |
| W-38 | A-team walk 4 (J-f4.1) | Reach the dancer-first step via `/account/o` and directly via `/account/p3/start` | A-org-nodancer | as prod | Count how many times it asks; PASS = once | no |
| W-39 | A-team-6 (J-e1.1), A-team J-e1 | Sign in; open Home | A-org-autoclaim | as prod | The page is claimed once; the other page (different email) is not | P-autoclaim with a claim email set; P-autoclaim-other |
| W-40 | A-team walk 11 (J-i1, J-i2.2, J-i1.2/1.3) | Sign up with an email that matches a listed teacher; open You and the public teacher page | person seed: listed teacher with an email | as prod | Same teacher slug and line-ups; You shows the existing details | PEOPLE-INVENTORY D2 shape |
| W-41 | A-team walk 12 (J-i13) | You for a teacher + DJ + dancer | person seed: teacher + DJ + dancer | as prod | One You area with all role sections | PEOPLE-INVENTORY D3 shape |
| W-42 | A-team walk 13 (J-i15.2) | Public team of a page after a legacy team member links | person seed: legacy team row | as prod | One row, not two | PEOPLE-INVENTORY D4 shape |
| W-43 | A-team walk 14 (J-i16) | Team > search for a name nobody has | A-org-big | as prod | The empty search offers invite by email | no |
| W-44 | A-team walk 15 (J-i18.2) | Sign in as a banned account | person seed: banned account | as prod | Refusal copy shows (see FIXLIST F-40) | a banned account |
| W-45 | A-team walk 16 (J-i6) | Sign in with an email that matches two profiles | person seed: ambiguous pair | as prod | Nothing links; record what shows (today: nothing; see F-42) | an ambiguous pair (none in prod) |
| W-46 | A-gate Part 2 walk 2 (J-x1.2) | Open the real approval email's link signed in | lead, with admin repo or mailbox | P3 live | Lands on the new Home or Welcome, not the old Home | the real email template (sender is outside this repo) |
| W-47 | A-team (refund auth, J-g2 tickets) | Refund and Stripe actions as manager, contributor, another page's organiser | A-org-member, A-org-tickets | `VITE_ENABLE_ORGANISER_TICKETING` | Refused for anyone who is not an owner or manager (the audit did not read the edge function) | A-org-tickets plus a contributor seat (none in prod) |

## Coverage

CANNOT-TELL / walk items per audit, and where each one is placed:

| audit | source items | placed | where |
|---|---|---|---|
| gate | 16: Part 1 section 5 items 1-7 (W-22, W-23, W-25, W-06, W-26, W-24, W-24), Part 2 items 1-6 (W-27, W-46, W-01, W-29, W-06, W-02), plus roll-up J-e8.2 (W-20) and J-e8.5 (W-21), J-d1.4 note (W-28) | 16/16 | A and B and C |
| public | 15: walks 1-10 (W-03, W-04, W-34, W-33, W-32, W-05, W-35, W-31, W-36, W-37), plus journey CANNOT-TELLs for group chat (W-08), rooms (W-09), J-v5 (W-10), J-v9 (W-11); A-public-3, A-public-6, A-public-10 are findings placed here (W-04, W-32, W-35) | 15/15 | A and C |
| team | 16 walks (W-18, W-30, W-07, W-38, W-12, W-13, W-14, W-15, W-16, W-17, W-40, W-41, W-42, W-43, W-44, W-45), plus A-team-6 (W-39), refund auth (W-47), and the U8 / U10 sweep (W-19) | 19/19 | A and C |

Placed here as findings rather than FIXLIST rows: A-gate-9 (W-06), A-public-3 (W-04), A-public-10 (W-35). A-public-6 is in both lists (FIXLIST F-30 for the fix, W-32 for the proof). Dropped: none.

Not verified: no browser walk, no code change. Several walks (W-20 to W-26) need a branch database or test account with the gate on, which this docs-only task did not create.
