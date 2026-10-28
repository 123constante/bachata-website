# Design record: P3 W4a &mdash; Team, Switch page, Organiser page in P3 (Phase A, design only), 2026-10-27

Brief: `brief/p3-w4a-team-switch-page:docs/briefs/p3-w4a-team-switch-page.md`. Phase A = inventory +
mockups; **nothing is built**. STOP for the owner's pick; a continuation dispatch builds (Phase B).

## Design brief (5 lines)
- **Who:** an organiser on a phone (390x844) inside P3 (cream/terracotta, tabs Home / Events / Stats / You).
- **Job:** keep every Team / Switch / Organiser-page capability that ships today, re-skinned into P3.
- **Where:** the You tab (still a placeholder) becomes their home; the event flyer moves to Events.
- **Rules:** p3.css tokens only (no second token file), px sizes, taps >= 44px, contrast >= 4.5,
  every empty state says what to do, every disabled control says why.
- **Not changed:** behaviour, models, RPCs, existing tests, the public `OrganiserProfile.tsx`.

## Mockups (`mockups/p3-w4a/`, rebuilt by `python3 mockups/p3-w4a/build.py`)
Each file is standalone, inlines `p3.css` verbatim at build time (no second token set), and has a
Light / Dark toggle. Every phone is 390x844.

| File | Placement | For | Against |
|---|---|---|---|
| `A.html` (38 phones) | **You hub**: page card + rows (Switch page [2+ pages only], Organiser page, Team, Account) &rarr; pushed screens, back = You | Every old route maps 1:1 to a P3 route; old screens' tests port almost verbatim; lowest build risk | One more tap to edit the page |
| `B.html` (35 phones) | **Page-first You**: the You tab IS the page editor + a team teaser; page chip in the top bar (2+ pages) opens a Switch **sheet**; Team pushed, a person opens as a sheet | Fewest taps for the commonest job; Switch is a sheet, P3's existing pattern | You tab is long; person-as-sheet changes Person's focus handling (B-S8) |
| `C.html` (35 phones) | **Segments in You**: Page / Team / Account control; page chip opens the Switch sheet | Everything one tab deep | Segment control is a NEW P3 pattern; the densest |

**Recommendation: A** (parity is the owner's hard rule, and A changes only the shell). B is the
better long-run UX if the owner wants it; C is not recommended.

Shared in all three: the event flyer (`cover/:seriesId`) goes to the event page under **Events**
(W2a), not You; Welcome stays a one-off landing screen.

## Inventory (read-only, `main` @ 4c683ce)
Roles as STORED: team `owner | manager | contributor` (`shared/teamModel.ts` `ROLE_LABEL`);
`HomeOrganiser.role` is `owner | manager`. The brief's "admin" = Manager, "member" = Contributor.

| Area | Route (R1, `/account/o/...`) | File | States | Actions (who) | Data / RPC |
|---|---|---|---|---|---|
| Team | `team` | `team/index.tsx` | loading; failed+retry; no organiser (empty); list; full (20) | choose organiser chip (2+ pages); open person; Add someone (owner, manager; disabled+reason when full; hidden for contributor &rarr; **P3: disabled + reason**); Leave link (non-owner &rarr; More) | `useTeamContext` (organiser_home_v1 + organiser_team_v1), incoming access requests |
| Team &middot; join request | (card on `team`) | `flows/fix/JoinRequest.tsx` | message; blocked when full; error | Add / Decline (owner, manager) | add by requester user id, decline |
| Team &middot; public toggle | (card on `team`) | `team/PublicToggle.tsx` | on / off; no dancer profile (disabled + `PROFILE_REQUIRED_NOTE`); read failed; error | own row only | `organiser_team_set_public_v1`, public row read |
| Person | `team/:userId` | `team/Person.tsx` | loading; failed; not on team; owner view; manager/contributor view; self; remove confirm | Make Manager (owner, contributor with email); Hand over (owner, `canReceiveOwnership`); Remove + inline confirm (owner, not self, not owner) &rarr; Done "Add them back"; Change role disabled + `OWNER_ONLY_ROLE`; Leave (self, non-owner) | `setTeamMember`, `removeOrganiserMember` |
| Add someone | `team/add` (`?name=`) | `team/AddSomeone.tsx` | loading; failed; no page; read-only (contributor); search (min letters); no results; search error; dancer wall 3-col + Show more; short wall; full; add error | tap face = add as Manager or share named invite; Share an invite link (share sheet / clipboard / announce fallback) | `browseApi`, add-by-profile RPC, `addErrorMessage` |
| Hand over | `handover` | `flows/handover/ToWhom.tsx` | loading; failed; owner-only; no one can take over (empty + Add someone); list | choose a confirmed Manager | team read |
| Hand over confirm | `handover/:userId` | `flows/handover/Confirm.tsx` | loading; failed; owner-only; missing; warning; unconfirmed-email error | Hand over / Keep it &rarr; Done | `organiser_transfer_ownership_v1`, `handOverWarning` |
| Switch | `switch` | `switch/index.tsx` | loading; offline; failed+retry; list (name, role, Live) | tap = remember choice + Home `?o=`; Add a page (`home?add=1`, invite-only per INVITE_REQUIRED_COPY) | organiser_home_v1, localStorage `org-r1-chosen-page:<user>` |
| Welcome | `welcome?o=` | `switch/Welcome.tsx`, `welcomeModel.ts` | loading; 1d (first page); 7c (another page); Home failed; not a member &rarr; redirect Home | Add an event / Look around first (1d); Go to Home | `joinedWelcome` |
| Organiser page | `page` | `page/index.tsx`, `useOwnPage.tsx`, `profileForm.ts` | loading; failed+retry; no page (empty); not available; facts; Required-to-publish line (wizard) | tap-to-edit slots: photo, name, meta (city), about, links, contact (phone + show flags), team; ONE Save, untouched save sends nothing; Live chip; Team link | `fetchOrganiserEntity`, organiser_profile_update_p5_v1, my_profile_progress_v1 |
| Event flyer | `cover/:seriesId` | `flows/fix/CoverFlow.tsx` | locked while profiles unfinished (SeriesLockGate); pick | choose photo &rarr; one `series.upsert {default_cover_image_url}` &rarr; Done "Flyer added" | event upload |
| `profile/` | (no route) | `profile/*.ts(x)` | &mdash; | re-exports (`OrganiserSwitcher`, `profileForm`, `useOrganiserChoice`) | &mdash; |

Outside scope but touched by placement: Leave (and its sole-owner reason) lives in `more/index.tsx`;
all mockups reach it as "Account and help" (A, B) or the Account segment (C), never removed.

### Facts that shaped the mockups
- **P3 Home/Events/Stats already show ALL the person's pages merged** (`p3/data/home.ts`), so in P3
  Switch only decides which page Team and Organiser page edit. Welcome 7c's "Switch any time from
  Home" becomes "...from You" (wording change, model unchanged otherwise).
- **"Pending invites" have no stored list**: invites are share links (`inviteShare`), and the
  only pending thing the server holds is an INCOMING join request. The mockups show join requests
  (count badge, blocked-when-full); an outgoing-invite list would be new behaviour, not parity.
- **A new page is invite-only** (owner decision 2026-10-20, `INVITE_REQUIRED_COPY`): the no-page
  empty states say so and offer "Message us", not a self-serve create.
- Contributor on Team: today Add is HIDDEN; CLAUDE.md wants a control that cannot work disabled with
  a reason, so the mockups show it disabled with "Only an owner or a manager adds people."
  Flagged as a deliberate change for the owner.

## Shapes covered (every file)
single vs multi-page (3 pages, one long name) &middot; owner / manager / contributor &middot; empty team
(just you) &middot; team of 12 &middot; full team (20) &middot; long names &middot; no page yet &middot; draft vs
published page &middot; incoming join request (and blocked when full) &middot; no dancer profile &middot;
loading &middot; load error / offline &middot; action error (add refusal, unconfirmed email) &middot;
remove confirm &middot; not on team any more &middot; Welcome 1d / 7c / Home-failed.

## Checks run on the mockups (Playwright, file://)
| Check | Result |
|---|---|
| Sideways scroll inside any phone (A 38, B 35, C 35) | 0 (first cut: the 3-col wall overflowed; fixed with `minmax(0,1fr)`) |
| Buttons/links under 44x44 inside phones | 0 (first cut: C's segment buttons were 40px; fixed) |
| Colours | p3.css tokens only (already contrast-tested in `p3Theme.contrast.test.ts`); the mockup adds no colour inside phones |

## Phase B plan (after the pick)
Shape survey on prod (read-only counts: pages per login, team sizes, role mix, pending requests,
pages with no profile/photo/about); table-driven matrix screen x shape; reuse the existing models,
RPC wrappers, error strings and tests (the screens re-skin, the hooks do not change); walk 390x844
as the walk test account; independent critique; R1 routes unchanged while `organiserP3` is off.

## Not verified (Phase A)
- No prod shape survey yet (Phase B step 1; Phase A reads no data).
- Mockup copy is draft; Phase B uses the existing single strings (`selfServeErrors.ts`, `teamModel.ts`).
- Dark theme only eyeballed through the toggle, not walked per phone.
