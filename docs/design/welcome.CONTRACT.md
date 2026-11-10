# ACCEPTANCE CONTRACT (DRAFT 2): Welcome / find, claim or create your page

Owner: website-50. Lead: website-lead-c3d9. DRAFT 2 written 2026-11-09 after independent review r1 (19 findings, `REVIEW-welcome-contract-r1.md`; each finding verified against Website 893163504 and admin origin/main d3051906, re-checked 2026-11-10 against admin origin/main 6cf7726d (fetched)). Status: DRAFT 3 (2026-11-10): DRAFT 2 re-checked (findings 1-19 table in session notes; edits applied above and marked "re-check"); next = DRAFT 3 recount, then land. Nothing built, nothing dispatched.
Inputs: `docs/design/welcome.INVENTORY.md`, owner answers 2026-11-09 via lead, `CONTRACT-organiser-arc-combined.md` (6.1, C1-C4), `CONTRACT-claim-from-link.md`.
Rule: every slice builds against the WHOLE contract. GAP = behaviour that does not exist on main.

## 0. Review r1 response (every finding, where it lands)
| # | Verdict after checking | Where it lands |
|---|---|---|
| 1 | CONFIRMED, teacher part corrected: DJ detail/list need only active djing role + active + not archived (20261120200000:370-418; list 20261129510000:42). Teacher detail needs first_name OR display_name, avatar_url, based_city_id (20270101100000:77); teacher list adds cities.is_active (20270215010000:109). `_role_required_keys_v1` (20261207120000:79) only exists; its use is NOT VERIFIED | Section 3 rules T1-T4, D10, J4.5, W2 |
| 2 | Website sends zero args (src/lib/claimMyDancerProfile.ts:10-27). The DB with a handle auto-links one `instagram_exact` candidate after email check (20270320110000:583-590), so "never auto-link" is a design rule | D13, J2.8, J2.9, W2 |
| 3 | CONFIRMED: check_my_profile_dedup_v1 supports only instagram, business_name, organisation_name (20261109980000:946-990), no Website caller | J4.8, W2 |
| 4 | Design decision | D8, D9, J3.8, J7.3, J11.3 |
| 5 | PARTLY: the sign-up stub is NOT refused (links and retires the stub); refusal only when the account already holds a different admin profile; claim RPC folds both codes into status already_linked | P15, J2.11 |
| 6 | CONFIRMED: person_roles has id, person_id, role, is_active, created_at, updated_at only (baseline:53047-53055) | D11, J11.1, W2 origin column |
| 7 | PARTLY: removal exists (admin_save_person_v1 roles delete 20261129810000:167; admin_delete_dj_v1 baseline:8914; admin_unlink_role_from_person_v1 baseline:25510, no UI). Missing: reversible unpublish with reason, notice, line-up handling | J11.2, J11.7, S18 |
| 8 | PARTLY: ReportProblemLink (WhatsApp) exists on event and organiser pages only (contactLinks.tsx:46-62); none on teacher/DJ/dancer; no verified badge in code | J12.5, J12.6 |
| 9 | CONFIRMED: unique instagram_normalized; Website maps 23505 to instagram_taken (dancer-app/api/errors.ts:42,117,169) and tells them to message us | J4.9, J12.7 |
| 10 | PARTLY (re-check 2026-11-10): `PUBLIC_LINK_REL='noopener nofollow ugc'` exists (src/lib/organiserLinkLabels.ts:71; used OrganiserGetInTouch.tsx:101, FieldSheet.tsx:334). Teacher/DJ/dancer links still use `noopener noreferrer` (PersonPage.tsx:142, DancerWorld.tsx:61, DjWorld.tsx:158, TeacherWorld.tsx:149, TeacherProfile.tsx:372-543, DancerProfile.tsx:242) | J12.8, D12 |
| 11 | Requirement; 5-minute figure untested | J11.8 |
| 12 | Requirement; unlink restores snapshot_before.fields_before (20270320110000:29, 744-753) and OVERWRITES post-link edits without showing them (verified 2026-11-10); the "show changed fields before restore" step is a GAP | J11.3, J11.9 |
| 13 | CONFIRMED | S19-S21, J2.12, J5.2, D11 |
| 14 | CONFIRMED: 35 bare N/A cells | Section 7 now gives a reason code to every N/A |
| 15 | CONFIRMED | numbers in J2.10, J4.7, J4.10, J7.3, J8.2, J10.3, J10.5, J11.1 |
| 16 | CONFIRMED | Section 12 recount |
| 17 | PARTLY: access requests are a view over entity_decision_audit (target_type organiser, action access_requested/granted/declined) via `_organiser_access_requests_p5` (defined 20261108220000:82; 20270315110000 only reads it). Teacher citation 20270101100000:77 correct | INVENTORY fixed |
| 18 | CONFIRMED | J2.8: two notices, two copy sites |
| 19 | PARTLY: owner sign-off already in D7 and W2; GRANT list was missing | Section 10 W2 GRANT list |

## 1. Scope
Four page kinds: dancer (own profile), organiser, teacher, DJ. Entry: Welcome after sign-in, public page claim card, Add a profile card, sign-in claim, invite link. Out of scope: events, tickets, door, team roles, stats (other lanes; link-only touches).

## 2. Owner decisions (binding)
- D1 A person CAN create a brand-new teacher or DJ page, or claim an existing one.
- D2 A new teacher/DJ page goes live without team approval; the team can fix or remove it afterwards (admin path in section 6 J11).
- D3 A page with no contact email: "Ask to join, the team replies" is the ONLY route.
- D4 One person can hold dancer, organiser, teacher and DJ pages; Add a profile offers the missing ones (merged #1512).
- D5 Organiser claim goes live without review; organiser creation stays behind the invite door and dancer-first profile; flag `organiserP3` stays the gate.
- D6 Gate `organiser_onboarding_gate` ON and strict (2026-11-02).
- D7 Any DB/permission change: careful lane + owner sign-off on GRANT/REVOKE/RLS.
- D8 (lead default) Managers do not refund. D9 (lead default) No ownership transfer: Ask to join on an owned page never grants owner.
- D10 (owner 2026-11-09) A teacher or DJ page is public ONLY with a name and a photo. Until then the person sees what is missing. Teacher keeps today's extra rule (city). DJ needs a DB change (W2).
- D11 (owner 2026-11-09) After the team removes a self-created page, the person must ask the team first before creating it again.
- D12 (owner 2026-11-09) A new self-created teacher/DJ page is hidden from search engines and from "new" lists for 7 days, still reachable by its own link. FEASIBILITY (re-check 2026-11-10): head SEO on teacher/DJ pages is route-owned (DJProfile.tsx:179-183, TeacherProfile.tsx:199; useSeo inert), so the noindex must be set in the route loader / served HTML plus app/routes/sitemap.tsx, not a client hook. Required in W2/W3.
- D13 (lead default) An Instagram match NEVER auto-links. It becomes Ask to join with the handle as evidence. Windows: 7 days (new), 30 days (re-ask).

## 3. Model: what a "page" is
- Organiser page = `organiser_profiles` + `entity_members` (owner/manager) [+ interim seat].
- Teacher page and DJ page = a ROLE on the person's own `dancer_profiles` row (`person_roles` teaching/djing + `teacher_role_details` / `dj_role_details`; person_roles has NO origin column today). Two meanings of "create": T-self = add the role to my own profile (exists: `save_my_role_v1`); T-claim = an admin-made profile is me, claim it (no self-serve route today).
- Public rules TODAY (file:line above): T1 DJ detail and list: active djing role, active, not archived. T2 Teacher detail: first_name OR display_name, avatar_url, based_city_id. T3 Teacher list: T2 + active city. T4 `_role_required_keys_v1` gates event go-live only (not verified).
- Public rules REQUIRED (D10, W2): DJ detail/list also need a name (dj_name, else display_name, else first_name) and avatar_url; teacher unchanged. Until met, the role area lists each missing item in order, each a link. Duo or couple acts with display_name only are valid (S19).

## 4. Person types (rows)
| ID | Person | Shape on prod |
|---|---|---|
| P1 | Signed-out visitor on a public page or claim link | - |
| P2 | New account, sign-up stub only (no profile data) | stub row |
| P3 | Dancer, profile incomplete (gate) | |
| P4 | Dancer, complete, no other role | |
| P5 | Organiser owner of 1 page | 20 owner seats |
| P6 | Organiser member/manager of 2+ pages | 43 manager seats |
| P7 | Teacher (active role) | 126 |
| P8 | DJ (active role) | 43 |
| P9 | Multi-role person (3-4 roles) | |
| P10 | Admin with no dancer row | passes Welcome (2026-10-28) |
| P11 | Invited person (token, single use, 7 days, person-bound) | |
| P12 | Person already LISTED by admin (unclaimed dancer/teacher/DJ profile matching email) | 170 unclaimed |
| P13 | Person with a pending or declined Ask to join | |
| P14 | Person whose sign-up chose Teacher or DJ | |
| P15 | Person with a different admin-made profile already linked to their account who finds ANOTHER admin-made profile of themselves | |
| P16 | Duo/couple act (display_name only) where the second partner arrives | |

## 5. Data shapes
Survey 2026-11-09, prod `stsdtacfauprzrdebmzg`, SELECT counts only.
| ID | Shape | Count |
|---|---|---|
| S1 | Organiser live, claimed (claimed_by), team present | 17 |
| S2 | Organiser live, NOT claimed, team present | 30 |
| S3 | Organiser live, not claimed, no team, no contact email, no claim email | 3 |
| S4 | Organiser live, not claimed, no team, claim email on file | 1 |
| S5 | Organiser with contact email, unclaimed | 3 |
| S6 | Organiser with no contact email at all (Ask to join only, D3) | 45 of 51 |
| S7 | Dancer profile unclaimed, not archived | 170 |
| S8 | Dancer profile archived | 29 |
| S9 | Dancer profile claimed | 13 |
| S10 | Teacher role active / inactive | 126 / 10 |
| S11 | DJ role active / inactive | 43 / 4 |
| S12 | Interim seat rows | 0 |
| S13 | Search results over 8 | seed test |
| S14 | Organiser name taken | seed test |
| S15 | Same Instagram on two profiles | seed test |
| S16 | Pending-review organiser (ambassador city) | seed test |
| S17 | Flag organiserP3 OFF / ON | |
| S18 | Self-created DJ already on a line-up | seed test |
| S19 | Duo act (display_name only) | seed test |
| S20 | Claim outcomes email_unproven / not_applicable (20270320110000:556,568,579) plus `ambiguous` (email_ambiguous / instagram_ambiguous, ~:576,586) and `no_match` with reason `name_city` (~:600): six statuses, each needs a screen cell | |
| S21 | Role declined earlier (set_my_role_declined_v1) then wants it | |
| S22 | Role removed by the team, person wants to re-create (D11) | seed test |
Not surveyed: access-request counts (read from `entity_decision_audit`, target_type organiser), invites by state, teacher/DJ roles lacking photo/city/name. A scripted count of these is the first act of W1.

## 6. Journeys (cells)
Legend: R = required, GAP = not on main. Every cell is testable.

### J1 Find
| Cell | Who | Required |
|---|---|---|
| J1.1 | signed in | Needs 2+ chars (else says so). Result hint words exactly `CLAIM_COPY` in `claimStates.ts:46-54` (six rows: Yours / Has a team / Email on file is yours / Has an email on file / NO_EMAIL_COPY / Ask to join); one shared table |
| J1.2 | signed in | Searching skeleton; error with Retry (offline wording differs); no match offers Create |
| J1.3 | signed in, S13 | 9+ results: "Showing the first 8" plus how to narrow |
| J1.4 | P7, P8, P12, P14 | GAP: find an existing TEACHER or DJ profile. Search by name; hint Yours / Already claimed / Claimable by email / Ask to join |
| J1.5 | P1 | sign-in first; returns to the same place |

### J2 Claim
| Cell | Who x shape | Required |
|---|---|---|
| J2.1 | organiser, email matches, mailbox proven | "Claim it" -> owner/Leader at once (D5), Home confirms |
| J2.2 | mailbox not proven | email code first; resend after 30 s; wrong code says so |
| J2.3 | S2 (team present) | Ask to join, never Claim; never grants owner (D9) |
| J2.4 | S6 | Ask to join only (D3); says the team replies; no promised time |
| J2.5 | email differs | Ask to join; copy says the email does not match |
| J2.6 | claimed while screen open | screen refreshes to truth, offers Ask to join |
| J2.7 | P3 | gate sheet lists missing fields; Finish your profile; claim disabled WITH reason; returns to Welcome |
| J2.8 | P12 teacher/DJ/dancer, email matches at sign-in | auto-link by email only (zero-arg `claim_my_dancer_profile_v1`, as today). Two notices exist and both stay: dancer `dancer-app/screens/onboarding/notes.tsx:17`, organiser `ClaimNotice.tsx` + toast `claimSignInLanding.tsx:34`; both "Not you" links go to WhatsApp today (GAP: an in-app "This isn't me" button that raises an admin row). One shared copy table for both |
| J2.9 | P12, Instagram match only | NEVER auto-links (D13). Screen: "We found a page with that Instagram. Ask to join it" -> Ask to join with the handle as evidence. Website never sends `p_instagram` |
| J2.10 | all claim RPCs | GAP: limit 10 claim attempts per account per hour; refusal code `claim_rate_limited`; screen says "Too many tries. Try again in an hour or ask the team" |
| J2.11 | P15 | Claim/link refused (`already_linked`): screen "You already have a profile. Ask the team to join them" -> Ask to merge request (admin sees via person_merge_candidates_v1). Never a second live page |
| J2.12 | S20 | `email_unproven` -> email-code step; `not_applicable` -> says why and offers Ask to join |
| J2.13 | P16 | The second partner of a duo gets Ask to join, not a second claim |

### J3 Ask to join
| Cell | Required |
|---|---|
| J3.1 | Note 500 chars max. DECIDED (owner 2026-11-10): the note is REQUIRED everywhere, min 3 chars (REQUEST_NOTE_MIN, as #1516 on the public card); OrganiserSheet.tsx:233 "(optional)" changes to match (W1 follow-up); counter; over-limit disables with reason |
| J3.2 | Sent: "Asked <date>"; button replaced; no duplicate (request_already_open) |
| J3.3 | 10 open requests: `request_limit_reached` worded |
| J3.4 | Declined: who/when, note, "ask again from <date>" (30 days); no Ask button before then |
| J3.5 | Approved: Home with confirmation; request card gone |
| J3.6 | Teacher/DJ/dancer profile Ask to join: GAP (same build as J2.9) |
| J3.7 | S3 page with no team and no claim email: request goes to the team; admin sees it in `AccessRequestsPanel`; the screen says so |
| J3.8 | Ask to join an owned page grants manager at most, never owner (D9) |

### J4 Create
| Cell | Who | Required |
|---|---|---|
| J4.1 | P4 organiser | Name then city. Only if the door admits AND dancer profile complete. Else CannotCreate: "New pages are by invite", Ask us to open it, then "We are checking" |
| J4.2 | S14 | offers Ask to join that page, or find it; never creates a duplicate |
| J4.3 | organiser | 4th create in 24 h refused (`draft_limit_reached`), Back to Home |
| J4.4 | S16 | LiveScreen says pending review; decided by the city ambassador, or the team if the ambassador is a party |
| J4.5 | P4 teacher/DJ T-self | Add role = intent + role with the minimum. Page becomes public only per D10; until then the screen lists missing items in order, each a link |
| J4.6 | P2, P3 | role cannot save without a persona (`no_profile`): sends to Finish profile first, returns to the role step |
| J4.7 | teacher/DJ | once D10 is met the public URL answers 200 within 60 s and the screen shows "View your public page" (hidden from search and "new" lists for 7 days, D12) |
| J4.8 | teacher/DJ | GAP: before creating, a dedup read on (first name or dj_name + city) and (Instagram) returning only "an existing page" + id; a match offers Is this you? Claim / Ask to join, never a second page. `check_my_profile_dedup_v1` cannot do this (instagram/business/organisation only) |
| J4.9 | S15 | real owner of a squatted handle hitting `instagram_taken`: screen says "Ask the team" and the attempt (account, handle) is written for the admin; admin list shows the handle |
| J4.10 | teacher/DJ | one teacher role and one DJ role per account (structural). Admin list highlights 3+ self-created roles from one email domain in 24 h (no auto-block) |
| J4.11 | dancer | Dancer4: name, city, lead/follow, photo; one question per screen; disabled reason; save failure retry; city not found = request a city |
| J4.12 | P10 | passes through Welcome as the server allows |
| J4.13 | S22 (D11) | A removed self-created role cannot be re-added by the person: screen says "The team removed this page. Ask them to let you add it again" with Ask to join/Message us; admin can lift the block |

### J5 Add a profile (merged #1512)
| Cell | Required |
|---|---|
| J5.1 | Card lists ONLY missing roles in order organiser, teacher, DJ, dancer; null while loading, on error, or when none missing |
| J5.2 | Not now hides per user, Undo toast 8 s, survives reload. A role the person DECLINED earlier (S21) still shows, because the card is their own choice to re-add |
| J5.3 | A pending organiser request counts as held |
| J5.4 | Teacher/DJ Add -> DoYouSheet -> J4.5-J4.8 including dedup |
| J5.5 | Organiser Add opens find (J1) first; create only from there |
| J5.6 | P9 holds all four: card absent, no empty shell |

### J6 Finish profile (gate)
J6.1 gate lists exactly the missing fields, each a link; Instagram refusals worded (#1272). J6.2 after Finish profile the person returns to the step they came from with the claim/ask intent kept. J6.3 teacher/DJ answers required (D6); no copy points at a control not on screen. J6.4 untouched Save sends nothing.

### J7 Declined, ask again
J7.1 inside 30 days no button, date shown. J7.2 after 30 days the button returns. J7.3 declined page later claimed by someone else: card says the page now has a team and offers Ask to join; owner never granted (D9).

### J8 Public link
| Cell | Required |
|---|---|
| J8.1 | P1 on organiser page: Is this you? -> Sign in to claim -> back, marker spent once, claim runs or proof opens |
| J8.2 | GAP: teacher/DJ/dancer public pages get the same card, rendered client-side, NO new fields in `get_public_*`; states Sign in / Claim (email match) / Ask to join |
| J8.3 | ?claim=1 survives /auth, code and /auth/callback via returnTo |
| J8.4 | wrong person: "Not me" |
| J8.5 | marker with stale/hidden kind: dropped, page shown as is |

### J9 Invite
J9.1 valid: preview, bind email, redeem, Home as member. J9.2 spent/expired/revoked: worded, offers Ask to join. J9.3 signed out: sign-in then back to the token. J9.4 token for another person: refused, no leak of who. J9.5 roles written dancer + organiser; P14 teacher/DJ intent kept.

### J10 Interruption
J10.1 sign out mid-flow: SignOutLine always there; no half-created page. J10.2 back on every step. J10.3 reload resumes at the same step: OnboardingFlow by `?o=&at=`; golive by phase; Dancer4 at the first unanswered question. J10.4 8 s stuck message; claim at sign-in times out at 4 s and never strands the person (claim again later from Welcome). J10.5 two tabs: the second action on an already-done step refreshes to truth (e.g. already asked -> "Asked"), never a duplicate row.

### J11 After the fact (admin and person)
| Cell | Required |
|---|---|
| J11.1 | Admin lists roles self-created in the last 7 and 30 days (origin recorded, W2), with time, city, Instagram, public yes/no |
| J11.2 | One-action reversible unpublish (role is_active=false) with a reason; reappears on undo. Removal routes that exist (admin_save_person_v1 roles delete; admin_delete_dj_v1; admin_unlink_role_from_person_v1, no UI) get UI |
| J11.3 | Admin undo of a wrong claim: unlink shows fields changed since the claim and can restore; restores stub (admin_unlink_account_from_dancer_profile_v1 per header, to be re-verified in test) |
| J11.4 | Interim seats: admin screen (GAP, chip only today) |
| J11.5 | The person sees "The team took this page down" with the reason class, no blame, and a way to ask why |
| J11.6 | Duplicates: `person_merge_candidates_v1` name_city surfaces a self-created page against a same-name, same-city admin profile. NOT VERIFIED until a seeded test shows it (the function is role-blind and archived handling was not read) |
| J11.7 | S18: unpublishing/removing a DJ who is on a line-up warns the admin with the event names and keeps the line-up row showing the DJ as unlisted (no deleted event) |
| J11.8 | Removal takes the page down: public URL not-found within 5 minutes; absent from `get_public_teachers_list_v1`, `list_public_djs_v1` and line-up pickers |
| J11.9 | Self-created page in line-up pickers marked "new" for 7 days (D12); lead may record otherwise |

### J12 Abuse
| Cell | Required |
|---|---|
| J12.1 | Dedup by name+city and Instagram (J4.8) |
| J12.2 | Organiser create cap 3/24 h; admin highlight (J4.10) |
| J12.3 | Claim limits (J2.10) |
| J12.4 | No email/phone shown publicly unless consented (contact consent in the public RPCs) |
| J12.5 | Impersonation: names are not unique, so there is a "Report this page" control on teacher/DJ/dancer public pages that writes an admin row (account if signed in, page, reason class, free text up to 500); signed out is sent to sign in. GAP (today WhatsApp ReportProblemLink exists on event and organiser pages only) |
| J12.6 | No verified badge on self-created pages. The only badge on teacher/DJ pages is AmbassadorBadge (#1474, TeacherProfile.tsx:~330, DJProfile.tsx:~402; needs claimed_by + city ambassador, so an ambassador who self-creates a page shows it). Test asserts no OTHER badge |
| J12.7 | Instagram squatting (J4.9) |
| J12.8 | Outbound links on teacher/DJ/dancer pages carry `rel="nofollow ugc noopener"`: reuse `PUBLIC_LINK_REL` (organiserLinkLabels.ts:71); they use `noopener noreferrer` today |

## 7. Matrix: person x journey (R or N/A with a reason code)
Codes: a signed-out, no account; b no persona yet (no profile data); c nothing missing so the journey cannot start; d admin acts outside self-serve; e person arrives already redeemed as target person; f flow only concerns organiser pages and this person has none; g invite flow only; h cell reached through another row (named); i nothing to ask yet (the person has no pending request or ask-to-join target).
| | J1 | J2 | J3 | J4 | J5 | J6 | J7 | J8 | J9 | J10 | J11 | J12 |
|---|---|---|---|---|---|---|---|---|---|---|---|---|
| P1 | N/A a | R via J8 | N/A a | N/A a | N/A a | N/A a | N/A a | R | R | R | N/A a | R J12.5 |
| P2 | R | R (J6 first) | R | R (J4.6) | N/A b | R | N/A i | R | R | R | R J11.5 | R |
| P3 | R | R (gate) | R | R (gate) | R | R | R | R | R | R | R J11.5 | R |
| P4 | R | R | R | R | R | N/A c | R | R | R | R | R J11.5 | R |
| P5 | R | R | R | R | R | R | R | R | R | R | R J11.5 | R |
| P6 | R | R | R | R | R | R | R | R | R | R | R J11.5 | R |
| P7 | R | R | R | R | R | R | R | R | R | R | R J11.5 | R |
| P8 | R | R | R | R | R | R | R | R | R | R | R J11.5 | R |
| P9 | R | R | R | R (nothing missing) | N/A c | R | R | R | R | R | R J11.5 | R |
| P10 | R | R | R | R | R | N/A d | N/A d | R | N/A d | R | R admin | R |
| P11 | N/A e | N/A e | N/A e | N/A e | N/A h (via P4 after redeem) | R | N/A e | N/A h (via P1) | R | R | N/A e | N/A e |
| P12 | R | R | R | R (J4.8 match) | R | R | R | R | N/A i | R | R J11.3 | R |
| P13 | R | R | R | R | R | R | R | R | R | R | R J11.5 | R |
| P14 | R | R | R | R | R | R | R (declined organiser request possible) | R | R | R | R J11.5 | R |
| P15 | R | R J2.11 | R | R | R | R | R | R | R | R | R J11.3 | R |
| P16 | R | R J2.13 | R | R | R | R | R | R | R | R | R J11.5 | R |

## 8. Defects not to re-introduce
Silent refusals (Simon, 2026-11-02): every refusal code maps to words. Copy pointing at a control not on screen; "Dancers see it now" on a draft; "claim in one tap". Empty states that do not say what the person can do. Disabled button with no reason. Untouched save sending a command. Rem tap sizes (html about 13.5px on phones): explicit px, taps >= 44 px. Unicode punctuation in JSX source: HTML entities only. Two copies of one mapping (hint table; claim notices): one shared table.

## 9. Gates (every slice)
Shape survey at slice start; table-driven consistency test per screen x shape (red first for fixes); every CI job step run; browser walk at 390x844 as the right person per row; screenshots in the PR; design record `docs/design/<pr>.md`; Verified / Not verified block; independent review before the owner sees anything. DB changes are careful lane: replay proof, independent review, prod read-before matching a written prediction; owner sign-off on every GRANT/REVOKE/RLS.

## 10. Slices
| Slice | Content | Lane | Needs |
|---|---|---|---|
| W0 | This contract + inventory reviewed and merged (docs) | docs | re-check pass |
| W1 | Website only: refusal words, shared hint and claim-notice tables, `rel` on outbound links, J1-J3, J6, J7, J10 tests for existing rows; scripted counts for the Not surveyed list | normal | W0 |
| W2 | DB: (1) `person_roles.origin` (+ created-by account) and a removal block (D11); (2) DJ visibility rule name+photo in `get_public_dj_v1` and `list_public_djs_v1` (D10); (3) new-page 7-day hide in public lists and sitemap (D12); (4) dedup read RPC; (5) claim rate limit inside the existing claim RPCs (J2.10); (6) report-a-page table + RPC (J12.5); (7) admin list/unpublish RPCs (J11.1-J11.2) | careful, migration | owner sign-off on the GRANT list below |
| W3 | Website: teacher/DJ create-or-claim entry (J1.4, J4.5-J4.9, J4.13, J5.4) (#1511 has merged; chooser and X1 account entry now exist) | normal | W2 |
| W4 | Ask to join for teacher/DJ/dancer profiles; claim and report cards on public pages (J2.9, J2.11, J3.6, J8.2, J12.5) | careful | W2 |
| W5 | Admin: roles list/unpublish/undo, interim seats screen, notice to person (J11) | careful (admin repo) | W2 |
| W6 | Whole-arc walk at 390x844 per person row by an independent reviewer | review | W1-W5 |

W2 GRANT list for the owner (proposed, no change made): `teacher_dj_dedup_read_v1` authenticated + service_role; `report_page_v1` authenticated + service_role; `admin_list_self_created_roles_v1` and `admin_set_role_active_v1` authenticated + service_role with an in-function admin check; the report table and the removal-block table: RLS on, no policies, service_role only; `person_roles.origin` column: no GRANT change; get_public_dj_v1 / list_public_djs_v1 keep their current grants. No anon grants added.

## 11. Verified / Not verified
Verified: inventory by file:line from Website 893163504 and admin origin/main d3051906 (re-checked 2026-11-10 against Website 4bebd9463 and admin origin/main 6cf7726d, fetched; no named RPC changed); prod counts in section 5; review r1 claims checked 2026-11-09.
Not verified: `_role_required_keys_v1` use; admin unlink restores fields; person_merge_candidates_v1 on self-created pages; 5-minute removal figure; Not-surveyed counts; behaviour of any cell in a real browser (nothing walked); exact words of every refusal.

## 12. Coverage
Behaviour cells: J1 5, J2 13, J3 8, J4 13, J5 6, J6 4, J7 3, J8 5, J9 5, J10 5, J11 9, J12 8 = 84. Matrix 16 persons x 12 journeys = 192 cells, every N/A carries a reason code. GAP cells: J1.4, J2.8 (in-app Not me), J2.10, J2.11 (merge request), J3.6, J3.7 (verify panel wording), J4.8, J4.9, J4.10, J4.13, J8.2, J11.1, J11.2, J11.4, J11.5, J11.7, J12.5, J12.8 (18), plus added by the 2026-11-10 re-check: J2.9, J4.7/D12, J11.3 (changed-fields view), J11.8, J11.9, J12.6 (test) = 24 GAP cells (DRAFT 3 recount 2026-11-10). P2/J7 and P12/J9 re-coded to the new code i. J11.6 stays NOT VERIFIED. Shapes S1-S22 map to journeys; S13-S16, S18-S19, S22 need seeded accounts, not prod.
