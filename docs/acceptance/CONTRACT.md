# Acceptance Contract: the organiser area (r1)

One whole-area contract: person x journey x shape -> expected screen, who may do it (server rule), how it is checked.
An independent reviewer checks THIS before the owner sees anything. IDs come from [`INVENTORY.md`](INVENTORY.md).
Owner words: 2026-10-30 "I should not have to check everything"; 2026-10-31 most organisers EDIT events, few create,
creates are mostly one-off or recurring; 2026-11-01 "the invite path must be easy with no problems; platform future depends on it".

**Status words.** COVERED = a named test whose assertion for this row was READ in the fix round (2026-11-02; the cite
gives `file:line` and the it/test name where it is not obvious; tests were **not run**). GAP = nothing checks it, or nothing builds it. OWNER-PHONE = only the owner's phone can confirm (copy feel,
real e-mail delivery). A COVERED row is only as good as its test: the reviewer opens the test and checks it asserts the
"Expected" cell, not just that it renders.

**Server rules** (live bodies read 2026-11-01; `claim_organiser_v1` and redeem's `already_member`/`link_failed` re-read 2026-11-02):
- `_assert_can_edit_series_p5` / `_occurrence_p5`: admin passes; empty `organiser_ids` -> `permission_denied ... admin-only`;
  else the actor must be `owner` or `manager` of one of the series' organisers. **Contributor is refused (A06).**
- `redeem_organiser_invite_v1`: needs a non-anonymous confirmed login (`sign_in_required`, `unconfirmed_account`); an open
  invite bound to another e-mail -> `email_mismatch` (masked hint), unproven mailbox -> `email_unproven`; complete dancer
  profile required first (unless the invite is bound to the caller's proven e-mail); already a member -> `already_member`
  (no write); 10 failed tries/hour -> `rate_limited`; invalid/used/revoked/expired; page at 20 members -> `team_full`
  (link stays open); person-bound invite on a login that did not land on that profile -> `not_linked`; success seats the joiner as **owner**.
  `already_member` returns `ok` with the caller's CURRENT `member_role` (any role, no write). A person-link step that
  fails for another reason reports `link_failed` (in `claim_status`).
- `claim_organiser_v1` (public "claim this page"): signed in + complete dancer profile; caller already owner -> idempotent
  success; page not `live` -> `not_live`; page has an owner row, or `claimed_by` names someone else ->
  `organiser_already_claimed`; no claim evidence (`organiser_claim_emails.claim_email`, else `contact_email`) ->
  `no_contact_email`; caller's proven mailbox differs -> `email_mismatch` (unproven mailbox -> `mailbox_unproven`); else
  seats the caller as **owner**. Client copy for each code: `shared/selfServeErrors.ts:52-64` (all four `next: request_access`
  except `not_live`).
- Team rules by role: `src/modules/organiser/shared/teamRules.ts` header (add: owner/manager; decline, change role, hand over: owner only).

## 1. The contract

Persons: P1 signed-out, P2 no profile, P3 dancer no page, P4 invited joiner, P5 owner, P6 manager, P7 contributor, P8 admin.

### 1a. The invite / join path (highest priority, owner 2026-11-01)

| # | Person | Journey x shape | Expected (plain words) | Who may / server rule | Checked by | Status |
|---|---|---|---|---|---|---|
| C01 | P1 | J01-J04 open invite, sign in by code, join | Card names the inviter; sign in without leaving the page; one tap Join; lands on "you're in". One redeem. | anon preview; redeem seats owner | `tests/e2e/arc1-invite-redeem-walk.spec.ts:52` | COVERED |
| C02 | P1 | J01 person-bound invite | "Hi <name>", never shows an e-mail | same | spec `:96`; `admin-organisers/__tests__/invitePreview.test.tsx` | COVERED |
| C03 | P4 | J08 already on team | Done with no tap, nothing redeemed | `already_member` | spec `:117` | COVERED |
| C03b | P7 | J08 a **contributor** opens an owner invite to their own page | Told they are already on the team AS a contributor, and how to ask for owner; never a silent "done" | `already_member` with `member_role` contributor, no write | none: `interpretRedeem` (`admin-organisers/inviteModel.ts:239-240`) drops `member_role`; only test is a manager case (`inviteModel.test.ts:136`) | **GAP** (reach today 0 contributors) |
| C04 | P1/P4 | J05, J07 used / revoked / expired link (S18) | Says which, offers "ask <sender> for a new one" | refusal reasons | spec `:124`; `inviteReasons.test.tsx` | COVERED |
| C05 | P1/P4 | J05 unknown / garbled link | Calm "link not valid", no ask button | `invalid` | spec `:136`; `inviteModel.test.ts` | COVERED |
| C06 | P4 | J06 wrong account (e-mail-bound, 5 of 16 invites) | Masked hint, "Not you? sign out", never a plain /auth link | `email_mismatch` | spec `:146` family; `redeemUnproven.test.tsx` | COVERED |
| C07 | P4 | J06 right e-mail but password/OAuth session | Told to sign in with the e-mail link | `email_unproven` | `admin-organisers/__tests__/redeemUnproven.test.tsx:23` "%s: interpreted as a refusal that keeps the link" (mapping; button label not asserted) | COVERED |
| C08 | P2 | J03/J11 invited joiner with no dancer profile | Asked the few dancer questions inline, then joins; never bounced to another page | profile gate before redeem | `admin-organisers/join/__tests__/inviteGate.test.tsx:102` "profile incomplete: About you inline on /invite, never /finish-profile, nothing redeemed"; `joinJourney.test.tsx:386` | COVERED (inline ask); **GAP** (save About you then join, no test) |
| C09 | P4 | J06 person-bound, claim finds no match | Safety stop, no duplicate person, invite stays open | `not_linked` | spec `:104` | COVERED |
| C09b | P4 | J06 e-mail page invite where the person-link step fails (`link_failed`) | Seat outcome stated plainly; told the profile link did not happen and who fixes it | `link_failed` in `claim_status` | none: 0 hits for `link_failed` in `src/` | **GAP** |
| C10 | P4 | J06 rate limited / team full / unconfirmed | Own screen each; team full offers help, link stays open | `rate_limited`, `team_full`, `unconfirmed_account` | `admin-organisers/join/__tests__/joinJourney.test.tsx:494,507,518`; `join/__tests__/refusalMatrix.test.tsx:122` "team_full is the only reason that offers the WhatsApp help link"; copy `inviteReasons.test.tsx:13` | COVERED |
| C11 | P4 | J12 after redeem, first screen on an ownerless page (S15, 37/50 pages) | Welcome, then finish details; page shows what is still needed and what they CAN do now | owner role | R1 `switch/__tests__/Welcome.test.tsx:81` "first page (1d): You manage X, Look around first goes to Home on it" | COVERED (Welcome); **GAP** (move on to finish details; full hand-off walk) |
| C12 | P4 | Joiner opens an invite to a page that ALREADY has an owner (0 of 4 open invites today) | Joiner becomes a second **owner** (server). Either the sender chose that knowingly, or the invite must offer a role. | redeem always seats owner | none | **GAP** (G-INV-2) |
| C13 | P1 | Invite opened in an in-app browser or second device after the code is e-mailed | Code entered on the same page works; link survives | n/a | none located | **GAP** |
| C14 | P1 | Real e-mail delivery, wording, timing of invite and code | Arrives within a minute, subject makes sense | n/a | owner phone | OWNER-PHONE |
| C15 | P3 | J09 public "claim this page", claim e-mail matches | Claim card, proves e-mail, becomes owner | `claim_organiser_v1` success | `PublicClaimCard.intent.test.tsx` (`OUTCOMES` includes `ok`), `arc1-claim-walk.spec.ts:42` "6a: your own page" | COVERED |
| C15a | P3 | J09 refusal `no_contact_email` (S19) | "This listing has no contact email to check against. Request access instead." then the request panel | `no_contact_email` | hint path: `PublicClaimCard.test.tsx:176` "no contact email: says so and offers request access"; refusal copy exists (`selfServe.test.ts:49` "has copy for every code the server raises") | COVERED (hint path); the raw refusal rendering is not asserted |
| C15b | P3 | J09 refusal `not_live` | "not listed publicly yet"; card refetches | `not_live` | `PublicClaimCard.intent.test.tsx:45,137` (outcome `not_live`, treated as stale) | COVERED (reach 0: all 50 pages are live) |
| C15c | P3 | J09 refusal `organiser_already_claimed` | "Someone already manages this organiser"; turns into Request access; page refetches | `organiser_already_claimed` | `PublicClaimCard.test.tsx:106` | COVERED |
| C15d | P3 | J09 refusal `email_mismatch` | "different contact email"; turns into the request panel | `email_mismatch` | `PublicClaimCard.test.tsx:94` | COVERED |
| C15e | P1/P3 | J09 on a page with **no claim e-mail** (S19: 45 of 50 pages; 35 of 37 ownerless, plus S16 the 1 page with no member) | The card must say plainly that claiming is not possible here and what happens instead, and someone must act on the request. **Today:** the card is NOT hidden. Signed out it shows "Is this you?" + sign in (`ownership.ts:83`); signed in, hint `no_email` gives `kind: 'request'` (`ownership.ts:86-88`), so the panel reads "This page lists no contact email to check against. Tell us who you are and the Bachata Calendar team will check." (`PublicClaimCard.tsx:310-317`) with Request access. On these pages a page owner can only appear through an admin acting on that request or an admin-issued invite. | `no_contact_email` | card copy: `PublicClaimCard.test.tsx:176`; nothing checks the request reaches someone who acts, or that the 35 pages have a route to an owner | **GAP** (rank 1; owner decision: add claim e-mails, issue invites, or change the card) |
| C16 | P3 | J10 ask to join an existing page | Request goes to owners; they see it on Team; asker told what happens next | owner decides | `flows/newpage/__tests__/NewPageFlow.test.tsx:143` (one action, Ask to join); `e2e/organiser-onboarding.spec.ts:75` (note sent); `team/__tests__/Team.test.tsx:98` (request card above the list) | COVERED |
| C19 | P4/P5 | J14 finish person details (P3 `PersonFlow`) | Each question empty or filled; one answer sends one command | own profile | `p3/onboarding/__tests__/personScreens.matrix.test.tsx:72` "every screen x empty / filled", `:107` "name: typing then Continue saves only first_name" | COVERED |
| C17 | P5/P6 | J31 send an invite from the app | Easy: who, which role, link/e-mail, shown as pending | add: owner/manager | admin-side only (`InvitePerson.tsx`); no organiser-side send screen located | **GAP** |

### 1b. Everyday editing (most organisers; 105 non-archived series)

| # | Person | Journey x shape | Expected | Who may / rule | Checked by | Status |
|---|---|---|---|---|---|---|
| C20 | P5/P6 | J16 Home with live recurring series (S01, 45: S01a weekly 28, S01b monthly 6, S01c custom 1, S01d no rule 10) | Next dates, one primary action, nothing stale | edit: owner/manager | P3 `p3/screens/__tests__/screens.matrix.test.tsx:102` "Next up is the soonest live date"; R1 `e2e/organiser-home.spec.ts:11` (one primary action; R1 Home deliberately shows jobs, and `:23` asserts NO "next dates") | COVERED (P3 next dates; R1 jobs, one primary action) |
| C21 | P5/P6 | J17 list with all lifecycle x format (S01-S08) | Each series shows ONE status word from one shared mapping | same | `__tests__/consistency.render.matrix.test.tsx:576-578` "G1: the status chip ... is the shared word for every lifecycle_status"; `consistency.matrix.test.tsx:145` | COVERED |
| C22 | P5/P6 | J21 edit details, live event | Preview + one primary button; note "guests see changes straight away" | same | `e2e/organiser-events.spec.ts:133` "details: ?edit=about saves ONE upsert"; note: `__tests__/primitives.test.tsx:192` (PreviewBar) | COVERED (note checked on the bar alone) |
| C23 | P5/P6 | J22/J29 change one date's time / venue | Saved, toast, shows on public page | same | P3 `p3/screens/__tests__/dates.send.test.tsx:152` (time: toast + one `occurrence.set_time`) | COVERED (time); **GAP** (venue change not asserted) |
| C24 | P5/P6 | J23 line-up with sessions | Sessions persist after save (re-read, match by content) | same | `e2e/organiser-date.spec.ts:135` (re-read with new session id still shows the line-up); `p3/screens/__tests__/sessions.send.test.tsx:94` | COVERED |
| C25 | P5/P6 | J24 prices / tickets | Edit, saved; ticket door only when flag on | same | none for prices: `p3/screens/__tests__/screens.matrix.test.tsx` has 0 hits for price/tier; `ticket-door-scanner.spec.ts` is the door only | **GAP** (prices) |
| C26 | P5/P6 | J28 cancel one date, cancel whole event (S12: 32 series already have cancels) | Public reason asked; confirm; cancelled dates stay readable | same | P3 `p3/screens/__tests__/cancelOneOff.matrix.test.tsx:163` "carry on is off until a reason is picked; nothing is sent untouched", `:189` | COVERED (P3); **GAP** (R1 `cancel.flow.test.tsx:119` makes the reason optional: conflict, owner decides) |
| C27 | P5/P6 | J25 add a date | Day then time, shown in list | same | `flows/add/__tests__/add.flow.test.tsx:138` "C8 which day", `:184` "C9 ... Save sends exactly ONE series.add_date" | COVERED |
| C28 | P5/P6 | J26 change repeat rule (weekly -> monthly), S01a | Preview of which dates appear/disappear before saving | owner rule today weekly only (`p3/CONTRACT.md`) | P3 `p3/screens/__tests__/repeat.send.test.tsx:83` "a change asks for one dry run, shows what moves, and Save sends the same rule once"; `e2e/walk-w3c-1-repeat.spec.ts:161` | COVERED in P3; **GAP** in R1 |
| C28b | P5/P6 | J26 Repeat sheet on a custom-rule series (S01c, 1) or one with no rule saved (S01d, 10) | Custom: shows the pattern and why, an OK button, no editor. No rule: opens with no day, says how to start, Save waits for a day | same | P3 `p3/screens/__tests__/repeat.send.test.tsx:231-236` it.each "custom: the pattern and why, an OK button, no editor", `:248` "a recurring event with no rule yet opens with no day, says how to start, and Save waits for a day" | COVERED in P3; **GAP** in R1 (no Repeat screen) |
| C29 | P5/P6 | J27 copy changes to other dates | Pick dates; "already the same" shown | same | `flows/change/__tests__/pdates.flow.test.tsx:329` "P-DATES: copy one date's changes from another (C60)", `:337`, `:564` "N3: nothing to copy reads Nothing to copy and points at the reason" | COVERED (R1) |
| C30 | P5/P6 | J30 history / undo | See what changed; undo only where the server supports it | undo `series.upsert` only | P3 `p3/screens/__tests__/history.matrix.test.tsx:80` "every row once, newest first", `:230` | COVERED (history); **GAP** (undo of date/session changes) |
| C31 | P5/P6 | S11 series with 100+ dates (1) | List does not hang; says how many shown; older dates still editable | cap 100 newest | P3 `p3/screens/__tests__/allDates100.matrix.test.tsx:103` "F-27 All dates screen: says more exist, and what to tap", `:126` "132 dates: server counts before loading, every date after one tap" | COVERED in P3; **GAP** in R1 (R1 date list not checked) |
| C32 | P5/P6 | S14 co-hosted (6) | All hosts shown, either host may edit | any owner/manager of any listed organiser | none: no fixture with 2+ `organiser_ids` found (`consistency.matrix.test.tsx` has none) | **GAP** |
| C33 | P5/P6 | S02 ended recurring (13), S06 ended course (8) | Reads "Finished"; edits that make no sense are disabled with a reason | same | word: R1 `events/__tests__/lifeLabel.matrix.test.tsx:95` "the one mapping, spelled out: lifecycle x format x upcoming"; P3 `p3/screens/__tests__/archivedEvent.test.tsx:88` "an ended event still opens the page tagged Finished". Actions: `lifeLabel.matrix.test.tsx:235` hides Pause/End when idle, but shows no reason | COVERED (word); **GAP** (disabled-with-reason) |
| C34 | P5/P6 | J13, S07 draft / S13 no cover (12 of 13) | Shows what is missing and what you CAN do; Go live explains blockers | same | `shared/__tests__/goLiveWalk.matrix.test.tsx:98` "the Go live flow says every gap in words", `:78`; `e2e/walk-p3-golive.spec.ts:102` | COVERED |
| C35 | P5/P6 | S08 paused (2) | Reads Paused; one action to resume | same | R1 `events/__tests__/lifeLabel.matrix.test.tsx:96,244` (resume control present iff paused); `events/__tests__/s5.events.test.tsx:187` resume sends `series.set_lifecycle` to live | COVERED (R1); P3 not checked |
| C36 | P7 | Open edit screens for a series on their page | Calm "you can see this; owners and managers edit it", controls disabled with that reason; never a raw error | contributor refused | none: `ownership.matrix.test.tsx` is the PUBLIC page claim matrix; `NotYoursCard` (`p3/screens/EventPage.tsx:291`, used `:309` and `HistoryScreen.tsx:41`) has no test | **GAP** (reach today 0 contributors) |
| C37 | P8 | Series with empty organiser_ids (S10, 571, all archived) | Admin only; organisers never see them in their list | admin-only | none for the organiser list | **GAP** |
| C38 | P5/P6 | J21 edit a festival (S04, 8) or course (S05, 6) | Fields that exist for that kind; nothing offered that cannot work | same | none | **GAP** |

### 1c. Create (few organisers; mostly one-off or recurring)

| # | Person | Journey x shape | Expected | Rule | Checked by | Status |
|---|---|---|---|---|---|---|
| C39 | P5/P6 | S03 live one-off (10): cancel it | Greyed reasons say what to do instead; can go until the start | `canCancelOneOff` | P3 `p3/screens/__tests__/cancelOneOff.matrix.test.tsx:108` "the rule x every shape", `:122` "every greyed reason says what to do instead" | COVERED |
| C39b | P5/P6 | S09 archived series with organisers (82) | Reads the same tag as ended; opens without a broken image; no copy claims someone removed it. Restore / edit: what is offered is not decided | same | P3 `archivedEvent.test.tsx:59` "archived and ended read the same tag", `:63`, `:103` | COVERED (reading); **GAP** (restore / edit not specified or checked) |
| C40 | P5/P6 | J18 one-off | What -> name -> venue -> date -> time -> cover; draft saved each step; resume works | owner/manager of the chosen page | `flows/new/__tests__/NewFlow.test.tsx:306` "every step after the name offers Save as draft and leave"; `e2e/organiser-loop.spec.ts:13` (draft shows in My events) | COVERED (draft saved); **GAP** (resume a saved draft) |
| C41 | P5/P6 | J19 weekly | Same plus weekday; dates within the 30-upcoming cap | same | `flows/new/__tests__/NewFlow.test.tsx:239` "C22 a weekly night sends ... ONE recurrence on that weekday" | COVERED (weekday); **GAP** (30-upcoming cap not asserted) |
| C42 | P5/P6 | J18 on a page not yet live/complete | Blocked with a reason and a way to finish the page | `createBlock` `createModel.ts:147` | `flows/newpage/__tests__/CannotCreate.test.tsx:89` "says why in two short lines, with ONE ask and a way Home" | COVERED |
| C43 | P5/P6 | J20 monthly / course / workshop / festival | Offered, or says plainly "ask the team" | no owner path | none | **GAP** (G-INV-1) |
| C44 | P7 | create event | Disabled with reason | refused | none: `ownership.matrix.test.tsx` is the public claim matrix; only `TeamFixPass.test.tsx:163` (contributor on `/team/add`, not create) | **GAP** (reach today 0 contributors) |

### 1d. Team, page, accounts

| # | Person | Journey x shape | Expected | Rule | Checked by | Status |
|---|---|---|---|---|---|---|
| C50 | P5 | J31 add/remove/change role | Each refusal says why; Message us when only the team can | `teamRules.ts` | `team/__tests__/Team.test.tsx:130` add, `:283` remove, `:307` role, refusals `:208`, `:117`; `TeamFixPass.test.tsx:79` | COVERED |
| C51 | P6 | J31 add person; cannot change roles | Disabled with "only the owner" | add ok; roles owner-only | `team/__tests__/Team.test.tsx:298` "a manager viewing another member: role shown, change disabled with the reason, no Remove" | COVERED |
| C52 | P6 | S15 ownerless page (37/50): hand over / decline | Reason never names an owner the page lacks | `NO_OWNER_REASON` | `p3/you/__tests__/you.matrix.test.tsx:313` "hand over as a manager ... owner-only, said plainly", `:597` "F1+F2 sole manager, no owner, a join request: Decline disabled ..." | COVERED |
| C53 | P6 | Leave as last manager of an ownerless page | UI refuses with reason (server does not) | UI-only guard | `you.matrix.test.tsx:626` "F3 sole manager, no owner: Leave is disabled on Team and on your own row, with why and Message us"; `more/__tests__/More.test.tsx:337` (team read fails: Leave stays refused) | COVERED (UI); **GAP** (server guard, admin repo) |
| C54 | P5 | J32 hand over | Pick person -> confirm -> done; old owner becomes manager | owner only | `flows/handover/__tests__/handover.test.tsx:48` (pick), `:72` "Hand over = ONE transfer call ... then Done" (Done says you are a Manager) | COVERED |
| C55 | P5 | S17 team at cap 20 | Add disabled with reason | cap 20 | `team/__tests__/Team.test.tsx:117` "at 20 members Add someone is disabled with the reason, and so is the request card" (uses `TEAM_CAP`) | COVERED |
| C56 | P5/P6 | J15 edit page: name, photo, contact, city (no photo 2/50, no contact 3/50) | Required-left shown once, one formatter | same | `page/__tests__/Page.test.tsx:79,108`; `shared/__tests__/requiredLeft.oneFormatter.test.tsx:41` "required_left %i -> %s on every surface" | COVERED |
| C57 | P5/P6 | J33 switch page; add another page | "Showing <page>"; new-page flow explains cannot-create cases | n/a | `switch/__tests__/Switch.test.tsx:80` "tap = choose: Home opens on that page" | COVERED (switch); **GAP** ("Showing <page>" label: `SHOWING` used by no test) |
| C58 | P3 | No page yet opens organiser area | "You don't run a page yet. Find your page to claim it, or ask to join" with Add a page | none | `p3/you/__tests__/you.matrix.test.tsx:355,726`; redirect `p3/screens/__tests__/noPageHome.test.tsx:16` | COVERED |
| C59 | P2 | Open any organiser URL | Finish-profile screen, back to the same URL after | account gate | none for an organiser URL: `dancerFirst.refusal.test.tsx:76` covers the public page; `noDancer.matrix.test.tsx:97` asserts a contact screen | **GAP** |
| C60 | P1 | Open any organiser URL | Sign-in with returnTo | AuthGuard | `e2e/organiser-onboarding.spec.ts:134` "signed out, /account/o goes to sign-in with the return path" | COVERED |
| C61 | P5 | J34 leave as only owner | Explains last_owner, points to hand over first (`HAND_OVER_FIRST`) | server guard on owners | `more/__tests__/More.test.tsx:111` "the server decides: Leave works, and its last_owner refusal is the copy shown", `:154` | COVERED |
| C62 | all | Old bookmarks `/account`, `/account/new` etc. | Land on the right new screen | redirects | `e2e/organiser-legacy-redirects.spec.ts:20` "${from} lands on the new area", `:27` | COVERED |

## 2. GAPs ranked by how many real organisers hit them

Counts re-run on prod **2026-11-02** (read-only SELECT, counts only). Rank key: **organiser pages reached** (distinct
ids in `organiser_ids`, or pages in the shape), series count beside it. Known counts rank before upper bounds and
unknowns.

| Rank | GAP | Rows | Reach today | Why this rank |
|---|---|---|---|---|
| 1 | Public claim cannot work on pages with no claim e-mail; nothing proves the Request access fallback reaches someone who acts | C15e (S19, S16) | **45 of 50 pages**; 35 of 37 ownerless pages can get an owner only through an admin (only 2 are claimable by the card) | the claim/invite growth path (owner 2026-11-01), and the largest count |
| 2 | No organiser-side screen to send an invite | C17 | 37 ownerless pages (S15), plus every page wanting a team | owner must confirm invites are admin-issued by design |
| 3 | Last-manager leave guard is UI-only | C53 | up to 37 ownerless pages | needs an admin-repo change |
| 4 | Price editing has no test | C25 | at most 42 pages (105 non-archived series); how many carry prices was not counted | upper bound, not a count |
| 5 | R1 has no Repeat screen; undo covers only `series.upsert`; R1 100+ date list unchecked | C28, C28b, C30, C31 | 24 pages (45 live recurring series, 23 with cancels; 1 with 100+ dates) | edit-heavy users |
| 6 | Archived series: restore / edit not specified | C39b | 23 pages (82 archived series with organisers) | organisers may look for old events |
| 7 | Ended series: actions hidden without a reason | C33 | 14 pages (21 ended series) | |
| 8 | Festival / course editing unchecked; monthly, course, workshop, festival not creatable (G-INV-1) | C38, C43 | 12 pages (14 live festival/course series); 6 pages run live monthly series (S01b) | |
| 9 | Co-hosted series: no 2-host test | C32 | 10 pages (6 series) | |
| 10 | `link_failed` on an e-mail page invite not handled | C09b | at most 5 (e-mail-bound invites) | |
| 11 | Invite always seats owner; no role choice (G-INV-2) | C12 | 0 of 4 open invites go to an owned page; 1 used invite historically seated a second owner | still an owner decision, but low count |
| 12 | Contributor screens: already_member silent, edit and create refusals untested | C03b, C36, C44 | **0** (no contributor rows in prod) | server rule kept; no one hits it today |
| 13 | Organiser list showing admin-only series | C37 | 0 organisers (571 archived, admin-only) | probably fine, unproven |
| 14 | Unchecked parts of COVERED rows: join after About you, Welcome to details, venue move, R1 cancel reason optional, resume draft, 30-date cap, "Showing" label, no-profile organiser URL | C08, C11, C23, C26, C40, C41, C57, C59 | each reaches every joiner / creator / editor; not counted separately | test gaps, not missing screens |
| 15 | Invite on a second device / in-app browser | C13 | unknown | no data on how links are opened |
| - | R1 vs P3 duplicated screens; prod flag values unknown (G-INV-6) | all | everyone | a verification step, not a count: check flags before review |

## 3. Screen quality bar (8 rows; every screen above passes all eight)

| # | Rule | How a reviewer checks it |
|---|---|---|
| Q1 | Calm: no red walls, no raw error codes, no jargon | read every refusal string once; none shows `permission_denied`, a UUID or a reason code |
| Q2 | Plain words | **OWNER-PHONE**: a non-technical reader (the owner) says each screen's purpose in one sentence. A judgement, not automated |
| Q3 | One primary action per screen | exactly one filled button visible without scrolling |
| Q4 | Empty states say what you CAN do | every empty list has a next step as a control that exists |
| Q5 | Disabled controls say why | every disabled control has visible reason text beside it |
| Q6 | No copy pointing at a missing control | every "tap X" names a control present on that screen in that state |
| Q7 | Taps >= 44 px | explicit px, not rem (html font-size is ~13.5px on phones); `organiser-tap-targets.spec.ts` |
| Q8 | No sideways scroll at 390x844 and 320 | `organiser-layout.spec.ts`; walk each row's screen |

## 4. Count

**Contract rows: 65** (C01-C62 plus the lettered rows C03b, C09b, C15a-e, C28b, C39, C39b; C19 is new).
- **28** carry a GAP, whole or in part.
- **1** is OWNER-PHONE (C14). Q2 of the quality bar is OWNER-PHONE too.
- **36** are COVERED with no gap noted.
- 28 + 1 + 36 = 65.

Every COVERED cite above was opened in the fix round (2026-11-02), and its it/test name and assertion were read. C01-C06
and C09 were also checked by line by the independent review. Tests were **not run**.

**Inventory coverage: 65 of 65 IDs cited.** 8 persons + 34 journeys + 23 shapes = 65. Each ID maps to at least one row:

| IDs | Rows |
|---|---|
| P1 / P2 / P3 / P4 | C01, C60 / C08, C59 / C15-C15e, C16, C58 / C01-C13 |
| P5 / P6 / P7 / P8 | C20-C35, C50, C54 / C51-C53 / C03b, C36, C44 / C37 |
| J01-J04 | C01, C02, C08 |
| J05 / J06 / J07 / J08 | C04, C05 / C06, C07, C09, C09b, C10 / C04 / C03, C03b |
| J09 / J10 / J11 / J12 / J13 / J14 | C15-C15e / C16 / C08, C59 / C11 / C34 / C19 |
| J15 / J16 / J17 / J18 / J19 / J20 | C56 / C20 / C21 / C40, C42 / C41 / C43 (GAP) |
| J21 / J22 / J23 / J24 / J25 / J26 / J27 | C22, C38 / C23 / C24 / C25 / C27 / C28, C28b / C29 |
| J28 / J29 / J30 / J31 / J32 / J33 / J34 | C26, C39 / C23 / C30 / C17, C50, C51 / C54 / C57 / C61 |
| S01 / S01a / S01b / S01c / S01d | C20 / C28 / C43 / C28b / C28b |
| S02 / S03 / S04 / S05 / S06 / S07 / S08 / S09 / S10 | C33 / C39 / C38 / C38 / C33 / C34 / C35 / C39b / C37 |
| S11 / S12 / S13 / S14 / S15 / S16 / S17 / S18 / S19 | C31 / C26 / C34 / C32 / C11, C52, C53 / C15e / C55 / C04, C06 / C15e |

Review order: 1a first, then the GAP rows by rank, then spot-check five COVERED rows by opening the cited line.
