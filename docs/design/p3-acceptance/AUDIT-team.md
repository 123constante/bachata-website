# P3 journey audit: team group (J-e*, J-g*, J-f*, J-i*)

**Brief:** `docs/briefs/p3-audit-journeys.md` (branch `brief/p3-audit-journeys`).
**Contract:** `claude/p3-acceptance-contract-3` (CONTRACT.md, ACCOUNTS.md, PEOPLE-INVENTORY.md).
**Code:** origin/main `472ecde`.
**Method:** no browser, no edits. Each step was traced through the code on main to the RPC, and the live function bodies were read with `pg_get_functiondef` on prod `stsdtacfauprzrdebmzg`. Prod was read with SELECT counts only: no personal data, no writes. Line numbers like "l.582" refer to the live function body.

Severity: blocker / high / medium / low / decision. Findings are numbered A-team-1..29 and grouped by part, so the numbers are not in order.

## Summary

| group | journeys | PASS | FAIL | CANNOT-TELL |
|---|---|---|---|---|
| Person (e) existing page holder | J-e1..J-e8 (8) | 9 | 7 | 3 |
| Person (f) role-first, organiser later | J-f1..J-f4 (4) | 1 | 3 | 1 |
| Person (g) co-organisers and rights | J-g1..J-g6 (6) | 8 | 4 | 2 |
| Person already in the system | J-i1..J-i18 (18) | 23 | 14 | 8 |
| **total** | **36 journeys, 83 steps** | **41** | **28** | **14** |

Counting: each step row or sub-step is counted once. PARTIAL counts as FAIL; "PASS by code, needs walk" counts as PASS.

**Most important:**
1. **A-team-1 (blocker).** No in-app path takes someone who already has a page into P3 Home. Sign-in, claim landing, dancer home and Your areas all end in R1 `/account/o`.
2. **A-team-2 (high).** P3 Home, Events and Stats ignore the page chosen in Switch page and merge all pages.
3. **A-team-9 (high).** J-g1 cannot be walked as written. Owners cannot mint `/invite` tokens; only admins can, and redeeming one makes the person an owner.
4. **A-team-10 (high).** Cross-page isolation HOLDS on the server, with P0001 `permission_denied` rather than 42501, but no test proves it.
5. **A-team-15, 16, 17 (high).** On the joining paths:
   - A deleted account is linked before the restore screen.
   - `/invite` sign-in skips the deletion check and "Already listed?".
   - Sign-up stubs are never retired, so 2 of 4 linked prod accounts have two live profiles.

**Contract corrections** (the lead should fold these into CONTRACT.md):
- **G-17 is stale.** `claim_my_organisers_v1` reads `organiser_claim_emails` and runs on every sign-in. It is unproven only because the table has 0 rows.
- **G-08 is stale.** A failed hand-off read shows ErrorState with Retry.
- **G-31 is resolved.** Matching uses `lower(btrim())` on both sides.
- **G-35 is wrong as written.**
  - Typed code on `/auth` goes through `AuthCallback`, so it runs the same checks as the link.
  - `AuthStepper` is dead code.
  - The real gap is `/invite/:token` (A-team-16).
- **J-g5's "42501" is wrong.** Command and workspace refusals are P0001 `permission_denied`.
- **E19 / J-i11 step 2 premise is wrong.** A persona claimed by someone else returns `no_match`, never `already_linked`.
- **J-g1 cannot be walked as written** (A-team-9).
- **Seed note.** No prod user claims 2+ pages, so A-org-big needs a seed. Contributor seats: 0 in prod.

### Browser walks the lead must do (390x844)
1. **J-e4.3:** open a P-big event by deep link while P-small is chosen. Nothing flips, and the event opens.
2. **J-e5.1:** with an 80+ past-date seed, Next up skips past dates and ended series show Ended.
3. **J-f2:** go offline at `/account/o` with 0 pages. ErrorState with Retry shows, and Retry hands off.
4. **J-f4.1:** reach the dancer-first gate both through `/account/o` and directly at `/account/p3/start`. Count how many times it asks.
5. **J-g1.2:** after a helper is added, Switch page and Home list exactly the one page.
6. **J-g2:** as manager:
   - The page sheet saves.
   - Team controls show their reason next to them.
   - Tickets S31-S34 show the read-only note.
7. **J-g3:** a manager leaves. Done, then Back to You, and the page is gone from Switch.
8. **J-g4:** as the sole owner, More shows Leave disabled with "Hand over first" beside it.
9. **J-g5:** as a member of P-big, `/events/<P-small id>` and its `/dates`, `/details`, `/prices` and `/history` show Not yours, and `/door` shows `not_allowed`.
10. **J-g6:** both co-organisers see S-shared, and the public page names both.
11. **J-i1:** after a same-email sign-up, the teacher slug and line-ups are unchanged, and You shows the existing teacher details.
12. **J-i13:** a teacher+DJ+dancer gets one You area with all role sections.
13. **J-i15:** after the legacy team member links, the public team shows one row.
14. **J-i16:** an empty team search offers invite by email.
15. **J-i18:** a banned account sees refusal copy.
16. **J-i6:** with a seeded ambiguous pair, nothing links and see what shows (today: nothing).

### Not verified
- **No browser walk.** All CANNOT-TELL steps, U8 tap targets and U10 mojibake are open.
- **Not read:**
  - the `ticket-refund` edge function auth;
  - the full body of `organiser_home_v1` (only its `organiser_ids` match);
  - the team-invite add path's persona binding (J-i16 step 2);
  - the public-team trigger's dedupe (J-i15 step 2);
  - `request_organiser_access_v1`'s body.
- **J-e8 write doors** belong to the gate group (`AUDIT-gate.md`).
- **The P3 New event build branch** was not needed for these journeys.

## Part 1: Person (e) and (f): J-e1..J-e8, J-f1..J-f4

### Prod counts (SELECT count only)
- `organiser_claim_emails`: 0 rows.
- Claimed pages (`claimed_by` set): 10.
- `organiser_onboarding_progress`: 0 rows. The onboarding gate flag is false in prod today.
- `entity_members` organiser seats: owner 18, manager 45. 15 pages have an owner seat, 2 pages have 2+ owner seats, and every claimed page has an owner seat.
- 1 user is owner or manager on 2+ pages.
- Largest series: 132 dates. 1 series has more than 100 dates. Most past dates on one series: 79.

### Step verdicts
| step | verdict | evidence |
|---|---|---|
| J-e1.1 auto-claim exists | PASS (wired) | `claim_my_organisers_v1` reads `organiser_claim_emails` ("EXISTS (SELECT 1 FROM public.organiser_claim_emails ce WHERE ce.organiser_id = op.id AND ce.claim_email = v_email)"). It is called on every sign-in from `src/pages/AuthCallback.tsx:218` through `src/lib/claimMyOrganisers.ts:63-89`. It needs a proven mailbox (`_mailbox_proven_p5`) and `op.lifecycle_status = 'live'`. With 0 rows it has never run on real data. **G-17 is stale: `src/` does call it.** |
| J-e1.1 lands on P3 Home | **FAIL** | `claimLandingPath` returns `ORG_PATHS.home` = `/account/o`, which is R1 (`src/lib/claimSignInLanding.tsx:20`, `src/modules/organiser/shell/paths.ts:14`). R1 hands off to P3 only at 0 pages (`src/lib/auth-otp-routing.ts:172-173`). ClaimNotice is drawn only in R1. |
| J-e1.2 non-matching email is not claimed | PASS | Exact match after `lower(btrim())`. A table CHECK `organiser_claim_emails_normalised` keeps the stored value normalised. |
| J-e1.3 never claims a page already owned | PASS | "CONTINUE WHEN EXISTS (... em.member_role = 'owner') OR EXISTS (... op.claimed_by IS NOT NULL AND op.claimed_by <> v_user)" |
| J-e2.1 next sign-in reaches P3 Home | **FAIL** (G-01 confirmed) | `signInLanding` sends organisers to `/account/o[?o=]` (`src/lib/accountRouting.ts:352,405`). |
| J-e3.1 a refused request is explained | **FAIL** | P3 `start` keeps only `r.status === 'open'` (`src/modules/organiser/p3/onboarding/OnboardingFlow.tsx:401`). `declinedRequests` is used only by R1, so the person gets a silent Welcome. |
| J-e4.1 Switch lists both pages | PASS | `src/modules/organiser/switch/index.tsx` lists every page from `organiser_home_v1` |
| J-e4.1 Home, Events and Stats show the chosen page, with its name | **FAIL** | Home and Events merge every page (`src/modules/organiser/p3/data/home.ts:121-126`). Stats calls `organiser_series_stats_v1(p_from,p_to)` with no page argument (`p3/data/stats.ts:63`). None of the three shows a page name. |
| J-e4.2 the choice sticks | PASS (for the screens that read it) | localStorage `org-r1-chosen-page:<userId>` (`switch/useOrganiserChoice.ts:8`) |
| J-e4.3 a deep link to the other page's event | PASS by code; CANNOT-TELL | The event page is not page-scoped and carries no `?o=`. **Walk:** open a P-big event while P-small is chosen. |
| J-e4.4 Switch offers no roles (R2) | PASS | Rows are pages only |
| J-e5.1 Next up skips past dates; ended series show Ended | CANNOT-TELL | **Walk** with a seed of 80+ dates |
| J-e5.2 History Load more | PASS | `HISTORY_PAGE = 50` with a cursor (`p3/data/history.ts:80`, `p3/screens/HistoryScreen.tsx:86`) |
| J-e5.2 All dates Past count | **FAIL** for more than 100 dates | `fetchSeriesWorkspace` sends no `p_limit`/`p_before`, so the list is capped at the newest 100 with no Load more (`p3/data/eventPage.ts:119`). Counts come from the loaded list (`p3/screens/AllDatesScreen.tsx:43`). 1 prod series has 132 dates. |
| J-e6.1 two owners | PASS for owner seats; decision open | Rights come from the `entity_members` role, never `claimed_by` (`organiser/shared/ownership.ts:74-75`, `team/Person.tsx:68`). Server checks: `organiser_profile_update_p5_v1` `_is_entity_member(...ARRAY['owner','manager'])`; transfer and team-set check owner. |
| J-e7.1 the Grace banner says what is left | PARTIAL | `p3/screens/GraceBanner.tsx` shows "N things left" and a Continue link. Its copy contradicts itself ("Finish your details to create and edit events" next to "Until then everything works as usual"). A failed read hides the banner without saying so. |
| J-e7.2 reads never fail when the row is missing | PASS | `organiser_onboarding_status_v1` uses a LEFT JOIN on `organiser_onboarding_progress` |
| J-e8.1 the banner says how long grace lasts | **FAIL** | The banner has no end date: "No grace end date is shown: the server has none yet (plan Q1 open)" (`GraceBanner.tsx:24-26`) |
| J-e8.2-8.5 the gate's write doors | CANNOT-TELL here | The gate group audits these (`AUDIT-gate.md`). All 10 claimed pages will meet the gate. |
| J-f1.1 the dancer home leads to P3 `start` | **FAIL** | "I organise events" opens R1's inline `OrganiserOnboardingPanel` (`src/components/account/DancerHome.tsx:330-352`). The other links go to `/account/o` (:298, :310, :320). |
| J-f2 hand-off read fails | PASS by code (**G-08 stale**) | ErrorState with Retry (`organiser/home/index.tsx:119,169-173`). **Walk:** go offline at `/account/o` with 0 pages. |
| J-f3.1 Your areas, Add Organiser | PASS at 0 pages; FAIL with a page | `AREA_HREF.organiser = '/account/o'` (`src/modules/areas/home/areaStatus.ts:28`). No role is written, so DJ stays. |
| J-f4.1 dancer-first gate shown once, then return | CANNOT-TELL | `/account/p3` is not in `isDancerGatedPath` (`src/lib/accountRouting.ts:118-130`), so the route through `/account/o` can ask twice and a direct `/account/p3/start` skips the gate. **Walk** both routes. |
| J-f4.2 one You area (R2) | **FAIL** | P3 You (`p3/you/youRows.ts`) has no dancer, teacher or DJ sections; they live at `/account/areas`. Name and photo are prefilled (PASS). |

### Findings
| id | journey | sev | what happens | fix (one line) | owner question |
|---|---|---|---|---|---|
| A-team-1 | J-e1, J-e2, J-f1, J-f3 (G-01) | **blocker** | Every in-app path for someone who already has a page ends in R1 `/account/o`: claim landing, sign-in landing, dancer home, Your areas. P3 Home can only be reached by typing the URL. | Point `claimLandingPath` and `signInLanding` at `P3_PATHS.home` while P3 is on (or hand off at any page count), and move ClaimNotice into P3 Home. | Is R1 retired for page holders when the flag goes on? |
| A-team-2 | J-e4 | **high** | Home, Events and Stats merge every page with no page name, while Switch says "Showing X". | Filter `organiser_home_v1` series by the chosen page, show the page name, and give stats a page argument. | Should Home show one page or all pages? |
| A-team-3 | J-e3 | high | A refused access request leads to a silent Welcome in P3 `start`. | Reuse R1's `declinedRequests()` line on the P3 Welcome. | none |
| A-team-4 | J-e5 | medium | All dates is capped at 100 rows with no Load more, and the Past/All counts undercount (1 prod series, 132 dates). | Page with `p_before`/`p_limit` (the server already supports it) and take counts from the server summary. | none |
| A-team-5 | J-e7, J-e8 | medium | The Grace banner has no grace end date and its copy contradicts itself. | Set a server grace end date (plan Q1). Until then say "you can keep editing for now". | How long is grace? |
| A-team-6 | J-e1 (G-17) | medium | Auto-claim is wired but unproven (0 rows), and pages that are not `live` never auto-claim. | Seed one row and walk it; correct G-17. | Should draft pages auto-claim? |
| A-team-7 | J-f4 (G-25) | medium | P3 `start` sits outside the dancer-first gate, so the gate can ask twice or not at all. | Pick one gate: add `/account/p3` to `isDancerGatedPath`, or make P3's person screens the gate and say so. | Is a dancer profile required before P3 onboarding? |
| A-team-8 | J-f4 (R2) | medium | Role sections live at `/account/areas`, apart from P3 You. | Add role sections or links to P3 You. | Where does the one "You" live? |


## Part 2: Co-organisers and rights: J-g1..J-g6, owner / manager / contributor / other / anon

### Role model (server)
- Rights come from `entity_members.member_role`: `owner`, `manager` or `contributor`. `claimed_by` mirrors the owner seat.
- `organiser_team_members` (Leader/Member) is the public team list only. The server says it "never grants edit rights" (`_assert_can_edit_series_p5`).
- Several pages on one series: `event_series_p5.organiser_ids uuid[]`, where the first element is the primary page.

### Rights matrix (server rule / what the screen shows)
| screen or write | server check | owner | manager | contributor | other page's organiser | anon |
|---|---|---|---|---|---|---|
| Event page, All dates, Details, Prices (`admin_event_workspace_p5`) | `_assert_can_edit_series_p5`: owner or manager of the series | edit | edit | **Not yours on its own page's event** | Not yours (`EventPage.tsx:256,274`) | /auth |
| `series_command_p5` / `occurrence_command_p5`, W0 kinds (`series.upsert`, `add_date`, `remove_date`, `occurrence.set_time`) | `apply_aggregate_write_p5` l.582: `v_series_orgs && get_current_user_organiser_ids()`, which includes `contributor` | allowed | allowed | **allowed by the server** (A-team-11) | P0001 `permission_denied: caller does not own series` | refused |
| Same RPCs, owner/manager kinds (lifecycle, cancel, override, skip, recurrence, stop/end, move, program, apply_forward, group chat, session forward) | l.31-39, l.634: owner or manager | allowed | allowed | refused | refused | refused |
| `series.set_organisers` (Organisers screen) | l.642: owner or manager of any listed page | edit | server allows; UI **disabled** "Only the owner can change who runs this event." (`organisersModel.ts:13,35`) | refused | refused | refused |
| Session programme (`organiser_set_occurrence_programme_v1`) | owner or manager of the series | allowed | allowed | refused | refused | refused |
| History (`organiser_series_history_v1`) | `_organiser_series_reader_v1`: 42501 `not_a_member` | read | read | read | Not yours (`HistoryScreen.tsx:41`) | 42501 |
| Page name, photo, about (`organiser_profile_update_p5_v1`) | owner or manager (l.48) | edit | edit | server refuses; **the screen still shows edit** (no role check in `page/index.tsx`, `useOwnPage.tsx`) | n/a | /auth |
| Contact (`confirm_organiser_contact_v1`) | owner or manager | edit | edit (contract: read-only with reason) | refused | n/a | 42501 |
| Finish onboarding (`complete_organiser_onboarding_v1`) | owner only | edit | refused | refused | n/a | n/a |
| Team add (`organiser_team_add_member_by_profile_v1`) | `_organiser_team_add_gate_p5`: owner or manager | edit | edit | disabled with reason | refused | n/a |
| Role change, remove (`organiser_team_set_member_v1`, `remove_organiser_member_v1`) | `owner_only` | edit | disabled with reason (`TEAM_REASONS.roles`) | disabled | refused | n/a |
| Hand over (`organiser_transfer_ownership_v1`) | owner only; the old owner becomes manager | edit | disabled with reason | disabled | refused | n/a |
| Decline a join request (`resolve_organiser_access_request_v1`) | owner only | edit | disabled with reason | disabled | refused | n/a |
| Public team toggle (`organiser_team_set_public_v1`) | owner or manager | edit | edit | refused | refused | n/a |
| Ticket types (`ticket_type_upsert_v1`, `ticket_type_set_status_v1`) | `_ticket_can_manage_organiser_v1` (owner or manager); create also needs `v_org = ANY(s.organiser_ids)` | edit | edit | read-only | `not_authorised` | `not_authorised` |
| Door list, check-in (`ticket_door_list_v1`, `ticket_check_in_v1`) | `_is_entity_owner_or_editor` (includes contributor) | allowed | allowed | allowed | `not_allowed` | 42501 |
| Refund (`ticket-refund` edge function) | **CANNOT-TELL** (edge function code not read) | ? | ? | ? | ? | ? |

### Prod counts
- **`entity_members` organiser seats:** owner 18 rows on 15 pages, manager 45 rows on 45 pages, contributor 0.
- **Team list (`organiser_team_members`):** Leader active 57 on 48 pages, Member active 5 on 5 pages.
- **Seat shapes:**
  - 2 pages have 2+ owner seats.
  - 9 pages have 2+ people with owner or manager.
  - 36 pages have a manager and no owner.
  - 6 pages have a sole owner and nobody else.
  - 9 single-owner pages have live series.
- **Users on 2+ pages:** 1 (on 49 pages, probably the staff account). Users claiming 2+ pages: 0. A-org-big (one person holding 2 claimed pages) has no prod example, so it needs a seed.
- **Series on 2+ pages:** 6 (5 live, 1 ended). Every page listed on the 5 live ones has an owner or manager.
- **Open organiser invites:** 2.

### Step verdicts
| step | verdict | evidence / browser walk |
|---|---|---|
| J-g1.1 owner invites from Team, link opens `/invite/<token>` | **FAIL** | Only an admin can mint a token (`admin_issue_organiser_invite_v1`: `IF NOT public._self_serve_is_admin() THEN RAISE EXCEPTION 'not_authorised'`). Team's "Share an invite link" shares a plain sign-up URL (`teamPickerModel.ts:218`), and the owner then adds the person by profile. |
| J-g1.1 accept lands on P3 Home | **FAIL** (G-09 still open) | `JoinScreens.tsx:168` goes to `acceptedInviteLanding`, which returns `P3_PATHS.youWelcome` (`paths.ts:69`) while the copy says "Open your organiser home". It falls back to R1 when there is no organiser id. |
| J-g1.2 helper sees P-big only | CANNOT-TELL | **Walk:** after the add, Switch page and Home list exactly one page |
| J-g2 page name, photo | PASS on the server (manager edits); waits on the decision | **Walk:** as manager, Save works |
| J-g2 contact | **FAIL** | The manager can edit; the contract wants read-only with a reason |
| J-g2 team | PASS | Disabled with reasons (`teamRules`). **Walk:** the reason sits next to the control (U4). |
| J-g2 events | PASS | The manager edits. Organisers is disabled for managers, which is stricter than the server (A-team-14). |
| J-g2 tickets | PASS by code | **Walk:** the read-only note on S31-S34. Refund auth not read. |
| J-g3 leave | PASS by code | More (`organiser/more/index.tsx:79-84`) asks "Leave X? You can ask to join again later.", then calls `remove_organiser_member_v1` and lands on Done with "Back to You". **Walk:** the page is gone from Switch. |
| J-g4 last owner leaves | PASS (hand over first) / G-23 open | Server: `IF v_owner_count <= 1 THEN RAISE EXCEPTION 'last_owner'`. UI: Leave is disabled with "Hand over first" (`more/index.tsx:19,68`). Nothing says what happens to the live events. |
| J-g5 deep links show Not yours | CANNOT-TELL | **Walk:** `/events/<B>`, `/dates`, `/details`, `/prices` and `/history` each show Not yours; `/door` shows `not_allowed` |
| J-g5 direct RPC writes are refused | PASS by code (**P0001 `permission_denied`, not 42501**) | Commands: `ELSIF NOT COALESCE(v_series_orgs && public.get_current_user_organiser_ids(), false) THEN RAISE EXCEPTION 'permission_denied: caller does not own series %'`. An occurrence id resolves its own `series_id` (l.571). History/stats give 42501, tickets `not_authorised`, door `not_allowed`, and creating a series under B needs owner or manager of B (l.605). |
| J-g6 both see the series, both can edit | PASS by code | `organiser_home_v1` matches `= ANY(s.organiser_ids)`. The owner decided on 2026-10-22 that there are no levels between co-organisers. **Walk:** the public page lists both organisers. |
| J-g6 a co-organiser leaves the event | **FAIL** | `series_leave_v1` exists (it refuses the primary page), but no client code calls it |

### Findings
| id | journey | sev | what happens | evidence | fix | owner question |
|---|---|---|---|---|---|---|
| A-team-9 | J-g1 | high | An owner cannot send an `/invite/<token>`. Only an admin can mint one, and redeeming it makes the person an **owner** (`_organiser_member_set_p5(..., 'owner', 'invite', ...)`). The contract's J-g1 cannot be walked as written. | `admin_issue_organiser_invite_v1`, `redeem_organiser_invite_v1` | Rewrite J-g1 as "share sign-up link, then add as Manager", or build an owner-minted invite that grants manager | Should owners mint invite tokens, and with which role? |
| A-team-10 | J-g5 (G-22) | high | Isolation holds on the server, but no test proves it, and the code is P0001 `permission_denied`, not 42501 | quotes above | Add an RPC test as A-org-member against P-small ids, asserting `permission_denied`; fix the contract wording | none |
| A-team-11 | J-g2 | medium (latent: 0 contributors in prod) | A contributor may send the W0 kinds (`series.upsert`, `add_date`, `remove_date`, `set_time`) but cannot read the workspace, so they see Not yours on their own page's event | `apply_aggregate_write_p5` l.29 "W0 kinds keep their W0 rule", l.582; `get_current_user_organiser_ids` includes `contributor` | Admin repo: move the W0 kinds into the owner/manager kinds | none |
| A-team-12 | J-g2 | medium | The page editor has no role check: a manager edits contact (the contract wants read-only), and a contributor sees edit that the server refuses | `page/index.tsx`, `useOwnPage.tsx` | Gate each row by role, with the reason next to it | Should a manager edit name and photo? |
| A-team-13 | J-g4 (G-23), J-g6 | medium | The last owner is blocked, but nothing says what happens to the live events (9 single-owner pages have live series). A contributor cannot leave on their own. A co-organiser cannot leave an event because `series_leave_v1` has no caller. | `remove_organiser_member_v1`; grep | Add copy beside the disabled Leave; add Leave event on Organisers for a non-primary page | What happens to live events when the last person leaves? |
| A-team-14 | J-g6, J-g2 | low | Organisers is disabled for managers, although the server allows them | `organisersModel.ts:35` vs l.637-645 | Line up the UI and the server | Should managers change who runs an event? |
| A-team-27 | J-g3, J-g4 | low | The server lets the last manager of a page with no owner leave (36 such pages); only the UI stops it | `remove_organiser_member_v1` checks only `v_target_role='owner'` | Admin repo: refuse removing the last owner-or-manager | none |
| A-team-28 | J-e6 (G-18) | decision | "Second owner" already happens: 2 pages have 2+ owner seats, from a hand-over or an admin invite redeem. A manager (the team list's "Leader") sees no hand-over and no reason why. | counts | Show "Only an owner can..." next to the hidden controls | What is a second owner? |
| A-team-29 | J-g1 | low | Accept lands on You/Welcome while the copy says "organiser home" (G-09) | `paths.ts:69` | Point at `P3_PATHS.home`, or change the copy | none |

## Part 3: Person already in the system: J-i1..J-i18

### Server facts (from the live RPC bodies)
- **Email match.** `claim_my_dancer_profile_v1`, `claim_my_organisers_v1` and `redeem_organiser_invite_v1` match on `NULLIF(lower(btrim(u.email)),'')`. **G-31 is resolved.**
- **Proven mailbox.** `_mailbox_proven_p5` needs an email-family sign-in method and `email_confirmed_at IS NOT NULL`.
- **Rows that can match.** Only `claimed_by IS NULL AND archived_at IS NULL`. Under the lock, `_account_link_refusal_v1` refuses `profile_archived`, `profile_claimed` and `person_claimed`. There is no `merged_into_id` guard; it is safe today only because 0 live, unclaimed profiles sit on a merged person.
- **`already_linked`.** It means only that this account already has a persona. A persona claimed by someone else is filtered out and returns `no_match`, so **the premise of contract E19 / J-i11 step 2 is wrong.**
- **No deletion or erase check** inside the claim.
- **Legacy team rows grant nothing.** Rights RPCs (`organiser_home_v1`, `organiser_team_v1`, `_organiser_team_caller_p5`, `_organiser_member_set_p5`, `request_organiser_access_v1`) read `entity_members` only. `organiser_team_members` is read only by `src/.../publicTeamApi.ts:18`.
- **Team search (E24).** `organiser_team_search_people_v1` returns account holders only (CROSS JOIN LATERAL to auth.users, `account_problem IS NULL`).
- **`profile_claims`.** No SQL function or `src/` code writes or approves it.

### Sign-in paths (code)
- **Link.** `AuthCallback.tsx` runs the dancer claim at :197, the deletion check at :207, the organiser claim at :218 and "Already listed?" at :238.
- **Typed code on `/auth`.** It runs `MagicLinkConfirmation.tsx:145`, then `Auth.tsx` `handleCodeVerified` (:393), then `continueToCallback`, which navigates to `/auth/callback`. These are the same steps as the link. **G-35 is wrong as written.**
- **`AuthStepper` is dead.** Its hosts `ProfileEntryFlow` and `CreateVideographerProfile` have no importer and no route.
- **`/invite/:token` is the real divergent path.** `JoinPage.tsx:210` verifies the code in-page and claims, with no deletion check and no "Already listed?" step.

### Prod counts
| what | count |
|---|---|
| persons | 203 (8 with `auth_user_id`, 2 merged) |
| auth.users | 44 (5 unconfirmed) |
| `organiser_claim_emails` | 0 |
| `person_account_links` | 0 |
| `profile_claims` | 5, all pending, all orphaned, oldest 323 days |
| active `organiser_team_members` | 62 |
| active team rows whose person has no `auth_user_id` | 49 |
| active team rows with no account by persona claim | 42 |
| `entity_members` holders with no person row | 10 |
| linked accounts with a live sign-up stub beside their persona | 2 of 4 (stub blocker `stub_has_content` on all 4) |
| D2 (live listed row matching an account email) | 1 account; email unconfirmed, never signed in, so not a failed link |

### Step verdicts
| journey | verdicts | notes / browser walk |
|---|---|---|
| J-i1 | 1 PASS, 2 CANNOT-TELL, 3 CANNOT-TELL, 4 PASS; one-persona rule **FAIL** | Sign-up blanks only fill empty fields (`AuthCallback` ~:346-389). The stub stays live (A-team-17). **Walk:** same slug and line-ups. |
| J-i2 | 1 PASS, 2 CANNOT-TELL, 3 **FAIL** | After an admin link the stub always has content and is never retired (G-28, G-34) |
| J-i3 | 1 PASS, 2 PASS, 3 PASS | `lower(btrim)` on both sides; `Auth.tsx:209` also trims |
| J-i4 | 1 PASS, 2 **FAIL**, 3 **FAIL** | G-28 and G-29 confirmed |
| J-i5 | 1 **FAIL**, 2 as described, 3 PASS on `/auth` | G-32 confirmed. G-35 holds only for `/invite`. |
| J-i6 | 1 PASS (server), 2 **FAIL** | G-33: `ambiguous` is silent. No prod pair exists today, so the walk needs a seed. |
| J-i7 | 1 **FAIL**, 2 **FAIL** | Sign-up mode does no existence lookup (`Auth.tsx:284`), so the person is signed in with no "already had one" line. Ticked roles are dropped because `isFirstSignIn` is false. No second user row is created. |
| J-i8 | 1 PASS, 2 PASS, 3 PASS (on `/auth`) | `/invite` skips the deletion check and "Already listed?" (A-team-16) |
| J-i9 | 1 PASS (server), 2 **FAIL** | No merge path (G-34) |
| J-i10 | 1 PASS, 2 PASS | `claim_organiser_v1` raises `organiser_already_claimed`; the copy offers request access (`selfServeErrors.ts:53`) |
| J-i11 | 1 **FAIL**, 2 **FAIL** | Silent skip (G-37). Step 2 returns `no_match`, not `already_linked`. |
| J-i12 | 1 PASS, 2 **FAIL** | G-30 confirmed |
| J-i13 | 1 CANNOT-TELL, 2 CANNOT-TELL, 3 PASS | The claim ignores which roles were ticked. **Walk:** one You area showing all role sections. |
| J-i14 | 1 PASS, 2 PASS by data only | No rule guards merged rows |
| J-i15 | 1 **FAIL**, 2 CANNOT-TELL; must-be-impossible PASS | A legacy row never grants rights (G-39). **Walk:** public team shows one row. |
| J-i16 | 1 PASS, 2 CANNOT-TELL | **Walk:** an empty search offers invite by email (U3) |
| J-i17 | 1 PASS | `not_linked` creates no seat; `JoinPage.tsx:221,241` shows "Paused" (`joinCopy.ts:93`) |
| J-i18 | 1 **FAIL**, 2 CANNOT-TELL, 3 PASS (Info) | G-36 confirmed. **Walk:** banned-account copy. |

Gap check: **confirmed** G-28, G-29, G-30, G-32, G-33, G-34, G-36, G-37, G-39, G-40, G-41. **Wrong:** G-31 (resolved), G-35 (re-scope to `/invite`). **Partly right:** G-38 (safe by data only), D2 wording, E19 `already_linked`.

### Findings
| id | journey | sev | what happens | evidence | fix | owner question |
|---|---|---|---|---|---|---|
| A-team-15 | J-i18 | high | A deleted account's sign-in links a persona and retires the stub BEFORE the restore screen | `AuthCallback.tsx:197` vs `:207`; no erase check in the claim | Move `signInDeletionTarget` above `claimAtSignIn`, or refuse in `_account_link_refusal_v1` | Should a restored account still auto-link? |
| A-team-16 | J-i5, J-i8, J-i18 | high | `/invite/:token` code sign-in runs the claim with no deletion check and no "Already listed?" | `JoinPage.tsx:210` | Send it through the shared post-sign-in step | none |
| A-team-17 | J-i1, J-i2, J-i9 | high | The one-persona rule fails: sign-up always fills the stub, so it is never retired (2 of 4 linked prod accounts) | `_stub_retire_blocker_v1` returns `stub_has_content` | Treat sign-up-only fields as empty, or merge them into the persona and archive the stub | Is a sign-up name/city "content"? |
| A-team-18 | J-i15 | high | 49 (or 42) legacy team members get no "you are on X's team" line; the legacy and P3 lists are not mapped | rights RPCs read `entity_members` only | On link, show the legacy rows as a pending invite | Should a legacy role carry over? |
| A-team-19 | J-i4 | high | Listed dancers, and teachers who tick only Dancer, never see "Already listed?" | `auth-otp-routing.ts:288,316` | Drop the Teacher/DJ condition | none |
| A-team-20 | J-i12 | high (data) | 5 orphaned pending `profile_claims`; nothing can approve them | no writer in SQL or `src/` | Close or migrate the 5 rows; decide the queue | Does a human claim queue exist? |
| A-team-21 | J-i7 | medium | Signing up with an existing email silently signs in and drops the ticked roles | `Auth.tsx:284,316` | Look the email up in sign-up mode too, and show "you already have an account" | Offer to add the new roles? |
| A-team-22 | J-i11 | medium | An owned page or claimed persona is skipped silently | `claim_my_organisers_v1` `CONTINUE WHEN` | Return the skipped list and offer ask-to-join | none |
| A-team-23 | J-i6 | medium | `ambiguous` shows nothing | `auth-otp-routing.ts:316` | Show the step for `ambiguous` | none |
| A-team-24 | n/a | low | 7 team rows: persona claimed but `person.auth_user_id` empty, so two "has account" definitions disagree (49 vs 42) | count | Pin one definition; check the backfill | none |
| A-team-25 | J-i14 | low | No `merged_into_id` guard in the classifier | `_dancer_profile_link_matches_v1` | Add `NOT EXISTS merged` | none |
| A-team-26 | n/a | low | `AuthStepper`, `ProfileEntryFlow` and `CreateVideographerProfile` are dead code, and comments still call AuthStepper live (`claimMyDancerProfile.ts:92`, `claimSignInLanding.tsx:10`) | grep | Delete, or fix the comments | none |
