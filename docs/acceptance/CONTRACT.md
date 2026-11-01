# Acceptance Contract: the organiser area (r1)

One whole-area contract: person x journey x shape -> expected screen, who may do it (server rule), how it is checked.
An independent reviewer checks THIS before the owner sees anything. IDs come from [`INVENTORY.md`](INVENTORY.md).
Owner words: 2026-10-30 "I should not have to check everything"; 2026-10-31 most organisers EDIT events, few create,
creates are mostly one-off or recurring; 2026-11-01 "the invite path must be easy with no problems; platform future depends on it".

**Status words.** COVERED = a named test or spec exists whose subject is this row (located by name/file; **not run** in
this slice). GAP = nothing checks it, or nothing builds it. OWNER-PHONE = only the owner's phone can confirm (copy feel,
real e-mail delivery). A COVERED row is only as good as its test: the reviewer opens the test and checks it asserts the
"Expected" cell, not just that it renders.

**Server rules** (live bodies read 2026-11-01):
- `_assert_can_edit_series_p5` / `_occurrence_p5`: admin passes; empty `organiser_ids` -> `permission_denied ... admin-only`;
  else the actor must be `owner` or `manager` of one of the series' organisers. **Contributor is refused (A06).**
- `redeem_organiser_invite_v1`: needs a non-anonymous confirmed login (`sign_in_required`, `unconfirmed_account`); an open
  invite bound to another e-mail -> `email_mismatch` (masked hint), unproven mailbox -> `email_unproven`; complete dancer
  profile required first (unless the invite is bound to the caller's proven e-mail); already a member -> `already_member`
  (no write); 10 failed tries/hour -> `rate_limited`; invalid/used/revoked/expired; page at 20 members -> `team_full`
  (link stays open); person-bound invite on a login that did not land on that profile -> `not_linked`; success seats the joiner as **owner**.
- Team rules by role: `src/modules/organiser/shared/teamRules.ts` header (add: owner/manager; decline, change role, hand over: owner only).

## 1. The contract

Persons: P1 signed-out, P2 no profile, P3 dancer no page, P4 invited joiner, P5 owner, P6 manager, P7 contributor, P8 admin.

### 1a. The invite / join path (highest priority, owner 2026-11-01)

| # | Person | Journey x shape | Expected (plain words) | Who may / server rule | Checked by | Status |
|---|---|---|---|---|---|---|
| C01 | P1 | J01-J04 open invite, sign in by code, join | Card names the inviter; sign in without leaving the page; one tap Join; lands on "you're in". One redeem. | anon preview; redeem seats owner | `tests/e2e/arc1-invite-redeem-walk.spec.ts:52` | COVERED |
| C02 | P1 | J01 person-bound invite | "Hi <name>", never shows an e-mail | same | spec `:96`; `admin-organisers/__tests__/invitePreview.test.tsx` | COVERED |
| C03 | P4 | J08 already on team | Done with no tap, nothing redeemed | `already_member` | spec `:117` | COVERED |
| C04 | P1/P4 | J05 used / revoked / expired link (S18) | Says which, offers "ask <sender> for a new one" | refusal reasons | spec `:124`; `inviteReasons.test.tsx` | COVERED |
| C05 | P1/P4 | J05 unknown / garbled link | Calm "link not valid", no ask button | `invalid` | spec `:136`; `inviteModel.test.ts` | COVERED |
| C06 | P4 | J06 wrong account (e-mail-bound, 5 of 17 invites) | Masked hint, "Not you? sign out", never a plain /auth link | `email_mismatch` | spec `:146` family; `redeemUnproven.test.tsx` | COVERED |
| C07 | P4 | J06 right e-mail but password/OAuth session | Told to sign in with the e-mail link | `email_unproven` | `redeemUnproven.test.tsx` | COVERED |
| C08 | P2 | J03/J11 invited joiner with no dancer profile | Asked the few dancer questions inline, then joins; never bounced to another page | profile gate before redeem | `join/__tests__`; `routes.matrix.test.tsx` | COVERED |
| C09 | P4 | J06 person-bound, claim finds no match | Safety stop, no duplicate person, invite stays open | `not_linked` | spec `:104` | COVERED |
| C10 | P4 | J06 rate limited / team full / unconfirmed | Own screen each; team full offers help, link stays open | `rate_limited`, `team_full`, `unconfirmed_account` | `JoinScreens.tsx:252-314`; `inviteReasons.test.tsx` | COVERED (team_full and unconfirmed assertions not individually confirmed) |
| C11 | P4 | After redeem, first screen on an ownerless page (38/51 pages) | Welcome, then finish details; page shows what is still needed and what they CAN do now | owner role | R1 `switch/__tests__/Welcome.test.tsx`; P3 `welcomeTitle.matrix.test.ts` | COVERED (walk of the full hand-off: GAP) |
| C12 | P4 | Joiner opens an invite to a page that ALREADY has an owner | Joiner becomes a second **owner** (server). Either the sender chose that knowingly, or the invite must offer a role. | redeem always seats owner | none | **GAP** (G-INV-2) |
| C13 | P1 | Invite opened in an in-app browser or second device after the code is e-mailed | Code entered on the same page works; link survives | n/a | none located | **GAP** |
| C14 | P1 | Real e-mail delivery, wording, timing of invite and code | Arrives within a minute, subject makes sense | n/a | owner phone | OWNER-PHONE |
| C15 | P3 | J09 public "claim this page" | Claim card, proves e-mail, becomes owner or is told why not | claim RPC | `PublicClaimCard.test.tsx`, `PublicClaimCard.intent.test.tsx`, `arc1-claim-walk.spec.ts` | COVERED |
| C16 | P3 | J10 ask to join an existing page | Request goes to owners; they see it on Team; asker told what happens next | owner decides | `NewPageFlow.test.tsx`; `Team.test.tsx` | COVERED |
| C17 | P5/P6 | J31 send an invite from the app | Easy: who, which role, link/e-mail, shown as pending | add: owner/manager | admin-side only (`InvitePerson.tsx`); no organiser-side send screen located | **GAP** |

### 1b. Everyday editing (most organisers; 105 non-archived series)

| # | Person | Journey x shape | Expected | Who may / rule | Checked by | Status |
|---|---|---|---|---|---|---|
| C20 | P5/P6 | J16 Home with live weekly series (S01, 45) | Next dates, one primary action, nothing stale | edit: owner/manager | `organiser-home.spec.ts`; `consistency.matrix.test.tsx` | COVERED |
| C21 | P5/P6 | J17 list with all lifecycle x format (S01-S08) | Each series shows ONE status word from one shared mapping | same | `consistency.render.matrix.test.tsx`, `draftOrganiser.matrix.test.tsx` | COVERED |
| C22 | P5/P6 | J21 edit details, live event | Preview + one primary button; note "guests see changes straight away" | same | `organiser-events.spec.ts`; `screens.matrix.test.tsx` | COVERED |
| C23 | P5/P6 | J22/J29 change one date's time / venue | Saved, toast, shows on public page | same | `organiser-date.spec.ts`; `dates.send.test.tsx` | COVERED |
| C24 | P5/P6 | J23 line-up with sessions | Sessions persist after save (re-read, match by content) | same | `sessions.send.test.tsx`; `consistency.dates.matrix.test.tsx` | COVERED |
| C25 | P5/P6 | J24 prices / tickets | Edit, saved; ticket door only when flag on | same | `screens.matrix.test.tsx`; `ticket-door-scanner.spec.ts` | COVERED (price cases not individually confirmed) |
| C26 | P5/P6 | J28 cancel one date, cancel whole event (S12: 32 series already have cancels) | Public reason asked; confirm; cancelled dates stay readable | same | `cancel.flow.test.tsx`; `cancelOneOff.matrix.test.tsx` | COVERED |
| C27 | P5/P6 | J25 add a date | Day then time, shown in list | same | `add.flow.test.tsx` | COVERED |
| C28 | P5/P6 | J26 change repeat rule (weekly -> monthly) | Preview of which dates appear/disappear before saving | owner rule today weekly only (`p3/CONTRACT.md`) | `repeat.send.test.tsx`, `walk-w3c-1-repeat.spec.ts` | COVERED in P3; **GAP** in R1 |
| C29 | P5/P6 | J27 copy changes to other dates | Pick dates; "already the same" shown | same | `flows/change/__tests__` (Copy) | COVERED |
| C30 | P5/P6 | J30 history / undo | See what changed; undo only where the server supports it | undo `series.upsert` only | `history.matrix.test.tsx` | COVERED (history); **GAP** (undo of date/session changes) |
| C31 | P5/P6 | S11 series with 100+ dates (1) | List does not hang; says how many shown; older dates still editable | cap 100 newest | none | **GAP** |
| C32 | P5/P6 | S14 co-hosted (6) | All hosts shown, either host may edit | any owner/manager of any listed organiser | `consistency.matrix.test.tsx` | COVERED (confirm a 2-host fixture) |
| C33 | P5/P6 | S02 ended recurring (13), S06 ended course (8) | Reads "Finished"; edits that make no sense are disabled with a reason | same | `consistency.matrix.test.tsx`; `eventPage.matrix.test.tsx` | COVERED |
| C34 | P5/P6 | S07 draft with no cover (12 of 13) | Shows what is missing and what you CAN do; Go live explains blockers | same | `goLiveWalk.matrix.test.tsx`, `draftOrganiser.matrix.test.tsx`, `walk-p3-golive.spec.ts` | COVERED |
| C35 | P5/P6 | S08 paused (2) | Reads Paused; one action to resume | same | `eventPage.matrix.test.tsx` | COVERED (unconfirmed) |
| C36 | P7 | Open edit screens for a series on their page | Calm "you can see this; owners and managers edit it", controls disabled with that reason; never a raw error | contributor refused | `ownership.matrix.test.tsx`; `NotYoursCard` (`EventPage.tsx:256`) | COVERED |
| C37 | P8 | Series with empty organiser_ids (S10, 571, all archived) | Admin only; organisers never see them in their list | admin-only | none for the organiser list | **GAP** |
| C38 | P5/P6 | J21 edit a festival (S04, 8) or course (S05, 6) | Fields that exist for that kind; nothing offered that cannot work | same | none | **GAP** |

### 1c. Create (few organisers; mostly one-off or recurring)

| # | Person | Journey x shape | Expected | Rule | Checked by | Status |
|---|---|---|---|---|---|---|
| C40 | P5/P6 | J18 one-off | What -> name -> venue -> date -> time -> cover; draft saved each step; resume works | owner/manager of the chosen page | `NewFlow.test.tsx`, `WhichPage.test.tsx`, `organiser-loop.spec.ts` | COVERED |
| C41 | P5/P6 | J19 weekly | Same plus weekday; dates within the 30-upcoming cap | same | `NewFlow.test.tsx` | COVERED |
| C42 | P5/P6 | J18 on a page not yet live/complete | Blocked with a reason and a way to finish the page | `createBlock` `createModel.ts:147` | `CannotCreate.test.tsx` | COVERED |
| C43 | P5/P6 | J20 monthly / course / workshop / festival | Offered, or says plainly "ask the team" | no owner path | none | **GAP** (G-INV-1) |
| C44 | P7 | create event | Disabled with reason | refused | `ownership.matrix.test.tsx` | COVERED |

### 1d. Team, page, accounts

| # | Person | Journey x shape | Expected | Rule | Checked by | Status |
|---|---|---|---|---|---|---|
| C50 | P5 | J31 add/remove/change role | Each refusal says why; Message us when only the team can | `teamRules.ts` | `Team.test.tsx`, `TeamFixPass.test.tsx`, `TeamG3.test.tsx` | COVERED |
| C51 | P6 | J31 add person; cannot change roles | Disabled with "only the owner" | add ok; roles owner-only | same | COVERED |
| C52 | P6 | S15 ownerless page (38/51): hand over / decline | Reason never names an owner the page lacks | `NO_OWNER_REASON` | `Team.test.tsx` | COVERED |
| C53 | P6 | Leave as last manager of an ownerless page | UI refuses with reason (server does not) | UI-only guard | `TeamFixPass.test.tsx` | COVERED (UI); **GAP** (server guard, admin repo) |
| C54 | P5 | J32 hand over | Pick person -> confirm -> done; old owner becomes manager | owner only | `handover.test.tsx` | COVERED |
| C55 | P5 | S17 team at cap 20 | Add disabled with reason | cap 20 | `TeamFixPass.test.tsx` | COVERED |
| C56 | P5/P6 | J15 edit page: name, photo, contact, city | Required-left shown once, one formatter | same | `Page.test.tsx`, `requiredLeft.oneFormatter.test.tsx`, `organiser-profile.spec.ts` | COVERED; shape survey **GAP** (G-INV-5) |
| C57 | P5/P6 | J33 switch page; add another page | "Showing <page>"; new-page flow explains cannot-create cases | n/a | `Switch.test.tsx`, `NewPageFlow.test.tsx`, `CannotCreate.test.tsx` | COVERED |
| C58 | P3 | No page yet opens organiser area | "You don't run a page yet. Find your page to claim it, or ask to join" with Add a page | none | `noPageHome.test.tsx`, `dancerFirst.refusal.test.tsx` | COVERED |
| C59 | P2 | Open any organiser URL | Finish-profile screen, back to the same URL after | account gate | `organiser-onboarding.spec.ts`; `noDancer.matrix.test.tsx` | COVERED |
| C60 | P1 | Open any organiser URL | Sign-in with returnTo | AuthGuard | `auth-magic-link-returnto.spec.ts` | COVERED |
| C61 | P5 | J34 leave as only owner | Explains last_owner, points to hand over first (`HAND_OVER_FIRST`) | server guard on owners | `more/__tests__/More.test.tsx` | COVERED |
| C62 | all | Old bookmarks `/account`, `/account/new` etc. | Land on the right new screen | redirects | `organiser-legacy-redirects.spec.ts` | COVERED |

## 2. GAPs ranked by how many real organisers hit them

Counts are prod 2026-11-01.

| Rank | GAP | Rows | Reach today | Why this rank |
|---|---|---|---|---|
| 1 | Invite always seats the joiner as owner; no role choice (G-INV-2) | C12 | 4 open invites; 13 of 51 pages already have an owner, so an invite to them adds a second owner | the invite path is the growth path (owner 2026-11-01) and this is a permission decision made silently |
| 2 | No organiser-side screen to send an invite | C17 | all 38 ownerless pages and every page wanting a team | owner must confirm invites are admin-issued by design |
| 3 | Festival and course editing unchecked / not creatable (G-INV-1) | C38, C43 | 14 live series (8 festivals, 6 courses) | owners of these hit "edit" with nothing proving it works |
| 4 | Undo covers only series.upsert; R1 has no Repeat screen | C28, C30 | 45 live weekly series, 23 with cancels | edit-heavy users |
| 5 | Last-manager leave guard is UI-only | C53 | 38 ownerless pages | needs an admin-repo change |
| 6 | Series with 100+ dates untested | C31 | 1 live series | one organiser, but a likely hang |
| 7 | Invite on a second device / in-app browser | C13 | unknown | no data on how links are opened |
| 8 | Page shape survey (no photo / no contact) | C56 | unknown | do the survey first |
| 9 | Organiser list showing admin-only series | C37 | 571 archived rows | probably fine (archived), unproven |
| 10 | R1 vs P3 duplicated screens; prod flag values unknown (G-INV-6) | all | everyone | verify flags before the review |

## 3. Screen quality bar (8 rows; every screen above passes all eight)

| # | Rule | How a reviewer checks it |
|---|---|---|
| Q1 | Calm: no red walls, no raw error codes, no jargon | read every refusal string once; none shows `permission_denied`, a UUID or a reason code |
| Q2 | Plain words | a non-technical reader says each screen's purpose in one sentence |
| Q3 | One primary action per screen | exactly one filled button visible without scrolling |
| Q4 | Empty states say what you CAN do | every empty list has a next step as a control that exists |
| Q5 | Disabled controls say why | every disabled control has visible reason text beside it |
| Q6 | No copy pointing at a missing control | every "tap X" names a control present on that screen in that state |
| Q7 | Taps >= 44 px | explicit px, not rem (html font-size is ~13.5px on phones); `organiser-tap-targets.spec.ts` |
| Q8 | No sideways scroll at 390x844 and 320 | `organiser-layout.spec.ts`; walk each row's screen |

## 4. Count

Contract rows C01-C62: **54**. Rows carrying a GAP (whole or in part): **12**. OWNER-PHONE: **1**. The rest (41) are COVERED with no gap noted.
Every inventory row (60) is cited above or listed under INVENTORY "GAPs found": none silently omitted.
Review order: 1a first, then GAP rows by rank, then spot-check five COVERED rows by opening the test and confirming it asserts the Expected cell.
