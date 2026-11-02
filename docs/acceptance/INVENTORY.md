# Acceptance inventory: the organiser area (r1)

Written BEFORE `CONTRACT.md`. Owner words (2026-10-30): "I should not have to check everything."
Sources: code at `main` ff20808 (fix round); prod `stsdtacfauprzrdebmzg` read-only SELECT counts, **re-run 2026-11-02**
(no personal data); live function bodies of `_assert_can_edit_series_p5`, `_assert_can_edit_occurrence_p5`,
`redeem_organiser_invite_v1`, `claim_organiser_v1` (re-read 2026-11-02).
Nothing here was executed in a browser. Tests were located, not run (see "Not verified" in the handover).

Two organiser UIs exist side by side: the R1 area `/account/o/*` (`src/modules/organiser/shell/OrganiserRoutes.tsx`)
and the P3 area `/account/p3/*` (`src/components/AnimatedRoutes.tsx:267`, routes in
`src/modules/organiser/p3/shell/P3Routes.tsx`). Which one a person gets is decided by the flags
`organiserP3` + `organiserSelfServe` (`AnimatedRoutes.tsx:224`). **The flag values in prod were not verified**;
every row below says "R1" or "P3" where the screen differs. Both must pass the contract until one is deleted.

## A. Person types (8)

| ID | Person | How the server sees them | Evidence |
|---|---|---|---|
| P1 | Signed-out visitor | `auth.uid()` null; invite preview is anon-safe | `InviteRedeemPage.tsx:12`; `OrganiserRoutes.tsx` AuthGuard (sends to /auth with returnTo) |
| P2 | New account, no dancer profile | `_require_complete_dancer_profile_v1` refuses | `AccountGated` `OrganiserRoutes.tsx:79` -> Finish screen `profileCompletion.ts:121` |
| P3 | Dancer with profile, no organiser page | no `entity_members` row | `p3/you/AddPageScreen.tsx`; `NO_PAGE_ADD` `teamRules.ts` |
| P4 | Invited joiner (holds a `/invite/:token` link) | redeem seats them as **owner** | `redeem_organiser_invite_v1` (live body); `join/JoinPage.tsx` |
| P5 | Owner | `_is_entity_member(...,['owner','manager'])` true | `_assert_can_edit_series_p5` |
| P6 | Manager | same check true; team rules differ (`teamRules.ts`) | same |
| P7 | Contributor | edit refused: "a contributor is not an organiser of record" (A06) | `_assert_can_edit_series_p5` |
| P8 | Admin | `is_admin()` short-circuit; only role that may edit a series with empty `organiser_ids` | `_assert_can_edit_series_p5` |

## B. Journeys (34)

| ID | Journey | Screen that serves it (file:line where grepped; file-level otherwise) |
|---|---|---|
| J01 | Open an invite link, see who invited you (preview) | `admin-organisers/InviteRedeemPage.tsx` -> `join/JoinPage.tsx` |
| J02 | Sign in from the invite (email code) without leaving it | `join/JoinPage.tsx` (steps), `join/joinModel.ts:94` |
| J03 | Answer dancer-profile questions inline | `join/AboutStep.tsx` |
| J04 | Redeem -> done, land on the page | `join/JoinPage.tsx:241-248` (outcome switch), `join/JoinScreens.tsx` |
| J05 | Invite refusals: invalid / used / revoked / expired | `JoinPage.tsx:311` DeadScreen, `joinCopy.ts` |
| J06 | Invite refusals: wrong e-mail, e-mail unproven, rate limited, team full, not linked, unconfirmed | `JoinScreens.tsx:252,283,293,314` |
| J07 | Ask the sender for a new link | `JoinPage.tsx:311` NewLinkRequest |
| J08 | Already on the team: opens straight to done | `redeem_organiser_invite_v1` `already_member`; `arc1-invite-redeem-walk.spec.ts:117` |
| J09 | Public "claim this page" from a public organiser page | `shared/components/PublicClaimCard.tsx`, `pages/OrganiserProfile.tsx`, `shared/publicClaim.ts:37` |
| J10 | Find a page, ask to join its team | `p3/you/AddPageScreen.tsx`; R1: `flows/newpage/NewPageFlow.tsx:51` (`onAskToJoin`) |
| J11 | Finish dancer profile (account gate) | `OrganiserRoutes.tsx:79`; `lib/profileCompletion.ts:121` |
| J12 | Welcome / first run on a page | R1 `switch/Welcome.tsx:13` (`welcome` route `:100`); P3 `you/welcome` `P3Routes.tsx:86` |
| J13 | Finish page details (required-left), go live | R1 `wizard/ProfileWizard.tsx` (`complete`), `go-live` `OrganiserRoutes.tsx:143`; P3 `p3/onboarding/OnboardingFlow.tsx:99` (`start`) |
| J14 | Finish person details | P3 `p3/onboarding/PersonFlow.tsx:54` (`you/details`) |
| J15 | Edit the organiser page (name, photo, contact, city) | R1 `page/index.tsx:62`; P3 `you/page` `P3Routes.tsx:87`; `edit-in-place/*` |
| J16 | Home: next dates, jobs, attention strip | R1 `home/index.tsx`, `jobs/homeJobs.ts`; P3 `p3/screens/HomeScreen.tsx:29` |
| J17 | List my events | R1 `events/index.tsx` (`:128`); P3 `screens/EventsScreen.tsx:9` |
| J18 | Create one-off event | R1 `flows/new/NewFlow.tsx:363` (`:121-126`); P3 `P3Routes.tsx:53,80` |
| J19 | Create weekly event | same (`KIND_FORMAT.weekly_class`, `createModel.ts:21,27`) |
| J20 | Create monthly / course / workshop / festival | **no owner create path found** (R1 kinds are only party and weekly_class, `createModel.ts:19`) |
| J21 | Edit event details (name, description, music, venue, cover, video) | R1 `events/Details.tsx`, `OneEvent.tsx`; P3 `screens/DetailsScreen.tsx:199` |
| J22 | Edit one date (time, venue, name, sessions) | R1 `flows/change/*` (`:102-111`); P3 `screens/DateSheet.tsx:414`, `AllDatesScreen.tsx:69` |
| J23 | Edit sessions / line-up | R1 `events/ProgrammeSeries.tsx` (`:131`), `change/lineup`; P3 `SessionSheet.tsx:47`, `LineupSheet.tsx:19` |
| J24 | Edit prices / tickets | P3 `screens/PricesScreen.tsx:88`; `tickets/ticketsApi.ts`; door `p3/door/DoorScreen.tsx` (flag `organiserTicketing`) |
| J25 | Add a date | R1 `flows/add/AddFlow.tsx` (`:113-115`); P3 `DateSheet.tsx` |
| J26 | Change the repeat rule | P3 `screens/RepeatSheet.tsx:126` (weekly/monthly); R1: not offered (no route) |
| J27 | Copy a date's changes to other dates | R1 `flows/change/Copy.tsx:27` (`:110`); P3: "Make a copy" owner fork unresolved (`p3/CONTRACT.md` s0, A3) |
| J28 | Cancel a date / cancel the event / take a date off | R1 `flows/cancel/*` (`:117-119`), `change/TakeOff.tsx:20`; P3 `CancelEventSheet.tsx:22`, `StatusSheet.tsx:52` |
| J29 | Move a date (time/venue) | R1 `change/Time.tsx:31`, `Venue.tsx:15`; P3 `DateFieldSheets.tsx` |
| J30 | Event history / undo | P3 `screens/HistoryScreen.tsx:95`; undo covers only `series.upsert` (`p3/CONTRACT.md` s0) |
| J31 | Team: view, add, change role, remove | R1/P3 `team/index.tsx:37`, `team/AddSomeone.tsx:24`; rules `shared/teamRules.ts` |
| J32 | Hand over ownership | `flows/handover/ToWhom.tsx:11`, `Confirm.tsx` |
| J33 | Switch page / add another page | `switch/index.tsx:12`, `profile/OrganiserSwitcher.tsx`, `flows/newpage/NewPageFlow.tsx:51`, P3 `you/AddPageScreen.tsx` |
| J34 | Leave a page; sign out; help | `more/index.tsx:45` (`HAND_OVER_FIRST` :19), `more/SignOutSheet.tsx`, `more/help/*` |

## C. Data shapes (prod, re-run 2026-11-02)

Series in `event_series_p5`, templates excluded: **758**. Of these, **653 are archived** (571 of them with empty
`organiser_ids`, admin-only, hidden from organisers). **105 are non-archived** and are the ones an organiser can meet.
Organiser pages: **50** (all `live`); **37 have no owner row**; 1 has no member at all. **45 of 50 have no claim
evidence** (no `organiser_claim_emails` row, 0 such rows exist, and no `contact_email`). Page members (`entity_members`,
type organiser): 45 manager rows, 19 owner rows, **0 contributor rows (any entity type)**. Invites: 16 issued, 6 used,
4 open (0 of them to a page that already has an owner), 5 expired, 1 revoked, 5 e-mail-bound.
Series counts were unchanged from 2026-11-01 (758 / 653 archived / 105 non-archived).

| ID | Shape | Count | Notes |
|---|---|---|---|
| S01 | live recurring, all rules | 45 | split by `recurrence_rule->>'mode'` into S01a-d; 23 have a cancelled date; 5 multi-organiser; 1 has over 100 dates |
| S01a | live recurring, weekly rule | 28 | |
| S01b | live recurring, monthly rule | 6 | live monthly series exist, but no owner create path does (J20) |
| S01c | live recurring, custom rule | 1 | Repeat sheet shows the pattern, no editor (C28b) |
| S01d | live recurring, no rule saved | 10 | Repeat sheet opens with no day (C28b) |
| S02 | ended recurring | 13 | 7 have a cancelled date; 1 multi-organiser |
| S03 | live one-off | 10 | |
| S04 | live festival | 8 | no owner create/edit path found (J20) |
| S05 | live course | 6 | |
| S06 | ended course | 8 | |
| S07 | draft (recurring 8, one-off 4, course 1) | 13 | 12 of 13 have no cover; 1 has zero dates |
| S08 | paused (recurring 1, one-off 1) | 2 | both reachable by organisers |
| S09 | archived with organisers | 82 | 635+12+5+1 archived, minus 571 empty-organiser |
| S10 | empty `organiser_ids` | 571 (all archived) | admin-only by server rule |
| S11 | 100+ dates | 1 | list cap, P3 workspace shows newest 100 (`p3/CONTRACT.md` A2) |
| S12 | series with a cancelled date | 32 | 23+7+1+1 |
| S13 | series with no cover (non-archived) | 12 | all drafts |
| S14 | multi-organiser / co-hosted series | 6 | 5 live + 1 ended |
| S15 | page with no owner | 37 of 50 pages | a lone manager can orphan it by leaving (`teamRules.ts` header) |
| S16 | page with no member | 1 of 50 | only claim/invite can reach it |
| S17 | team at cap (20) | 0 known | `TEAM_CAP` `teamModel.ts:209`; server cap 20 in redeem |
| S18 | invite states: open / used / revoked / expired / e-mail-bound | 4 / 6 / 1 / 5 / 5 | |
| S19 | page with **no claim e-mail** (no claim e-mail row and no `contact_email`) | **45 of 50** | 35 of the 37 ownerless pages are in it: the public claim card can only offer Request access there; only 2 ownerless pages can be claimed by the public card |

Page shapes surveyed in the fix round (2026-11-02, counts from the review, S19 re-run): no photo 2 of 50; no contact of any kind 3 of 50; no claim e-mail 45 of 50 (S19).

## D. GAPs found while inventorying

1. **G-INV-1** J20: no owner create path for monthly, course, workshop or festival. 14 live series (6 courses, 8 festivals) are of these kinds today.
2. **G-INV-2** `redeem_organiser_invite_v1` seats EVERY joiner as `owner`. Intended for ownerless pages (37 of 50); today 0 of the 4 open invites go to a page that already has an owner, but it gives full control (hand over, remove people) to anyone holding a forwarded bearer link on a page that already has an owner. No role choice on the invite.
3. **G-INV-3** R1 has no Repeat-rule screen (J26 is P3 only); P3's rule is weekly+monthly only.
4. **G-INV-4** Undo covers only `series.upsert`.
5. **G-INV-5** Closed except S19: page shapes surveyed 2026-11-02; 45 of 50 pages have no claim e-mail, so the public claim path reaches 2 of 37 ownerless pages (contract C15e, GAP rank 1).
6. **G-INV-6** Prod flag values (`organiserP3`, `organiserSelfServe`, `organiserTicketing`) not verified, so which UI a real person sees is unknown.

## Coverage count

Rows: 8 persons + 34 journeys + 23 shapes (S01-S19, with S01 split into S01a-d) = **65**.
Each row is cited by at least one contract row in `CONTRACT.md` (see the coverage table in CONTRACT section 4), or is a
listed GAP. Rows with no screen (listed, not omitted): **J20** (no create path), **J26 in R1** (no screen), **S17** (no
prod instance; checked by a unit test, C55).
