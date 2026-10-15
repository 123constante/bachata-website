# Account-journey matrix: every entry x who x what, gap analysis

Brief: `briefs/journey-matrix-gaps.md` (sha 03023251) on `arc/briefs-dancer-rebuild`. Read-only analysis of
`claude/dancer-app-routing` @ 028a8b7 (PR #764). Nothing in `src/` or `tests/` changed.

**Sources of truth.**
- END screens come from `src/lib/accountRouting.ts` (`signInLanding`, `profileSides`, `dancerGate`,
  `oldDancerHomeRedirect`, `onboardingEnd`), `src/pages/Auth.tsx`, `src/pages/AuthCallback.tsx`, the gate
  components, and the owner decisions in `docs/journeys/public-entry-journeys.md` ("Decisions made by the
  worker", items 1-7), `HANDOVER.md` and `WALK.md` in this folder.
- Where the code has no answer, or disagrees with a decision, the row says **DECISION NEEDED** and gives
  Claude's default. No new rule is invented.

**COVERED BY keys.**
- `J:<id>`: a row of `tests/journeys/publicEntryJourneys.ts`. Each such row is walked by
  `publicEntryJourneys.test.ts` (routing model) AND `tests/e2e-build/public-journeys.build.spec.ts` (production
  build, 390x844).
- `R:<test>`: a test in `tests/e2e-build/dancer-app-routing.build.spec.ts`.
- `U:<file>`: a unit test file that pins the decision, but no journey row and no build walk.
- **MISSING**: nothing pins the END.
- **PARTIAL**: one link of the chain is pinned, the end-to-end path is not.

## Prod shapes (Supabase prod `stsdtacfauprzrdebmzg`, read-only, counts only, 2026-10-15)

There are 20 accounts; 10 of them signed in during the last 30 days. "Finished" below is approximated as
first name + city + role + photo on the account's live persona (`_dancer_profile_id_for_account_v1`), which is
what `profile_complete_v1` checks. The handover's own survey, using `profile_complete_v1` itself, counted 2
unfinished organiser-intent accounts where this count finds 1, so treat +-1 as noise.

| WHO bucket | Accounts | Notes |
|---|---|---|
| W0 no account | every new visitor | The biggest bucket by far: everyone the launch links reach |
| W1 account, nothing finished (no live dancer row, not admin) | 0 | Possible only via an archived stub |
| W2 unfinished dancer, no organiser | 7 | 1 of the 7 has organiser intent (`user_type` = organiser) |
| W3 finished dancer, no organiser | 7 | 2 of the 7 have organiser intent. 1 of the 14 W2+W3 holds the open request (W7) |
| W4 organiser only (no dancer row, not admin) | 0 | |
| W5 dancer + 1 organiser | 4 | 2 of them are admins. 1 has an UNFINISHED dancer profile |
| W6 dancer + 2+ organisers | 0 | Still walked (R: two-orgs) |
| W7 open organiser access request | 1 | Has a dancer row and no organiser |
| W8 team member of someone else's organiser | 1-2 | `entity_members` holds only `owner` rows. 1 organiser has 2 owners, and 2 invites were redeemed |
| W9 admin only (no dancer row) | 2 | |
| W10 admin + dancer | 2 | Both also run 1 organiser, so they are counted in W5 too. Admin + dancer with no organiser: 0 |
| W11 erase grace / erased then re-sign-up | 0 | `account_erase_requests` has 0 rows |

Other counts:
- `dancer_invites`: 0 ever issued.
- `organiser_invites`: 4 issued, 2 used, 1 still open.
- `dancer_area_access`: 1 row.
- Organiser access requests: 1 open, 1 granted, 1 declined.

## Pruned combinations (one line each)

| Pruned | Reason |
|---|---|
| ENTRY footer/legal links, every WHO and DO | The footer (`lib/contactLinks.tsx`, `GlobalFooter.tsx`) has no legal link and none to `/auth` or `/account`, and it is hidden on `/auth*`. A footer visitor reaches an account only through the header Sign in, whose rows are below |
| ENTRY home banner as its own entry | The journey row `dancer-link-new` says the banner IS the dancer link. Only the href itself needs pinning, as row M60 |
| WHO W0 x every "already signed in" or "switch" DO | A person with no account has no session and no sides |
| WHO W1/W4 x organiser link, dancer link, claim, team invite (beyond M44-M46) | 0 accounts in prod, and the gate treats `no_profile` exactly like `incomplete` (`dancerGate`). They reduce to the W2 rows |
| WHO W8 as separate rows for every entry | Redeeming an invite makes the person an `owner` (`entity_members` holds only owner rows). `organiser_home_v1` counts owner or manager the same way, so W8 routes exactly as W5/W6. One check row is kept (M33) |
| WHO W10 x every entry as a separate row | `profileSides` gives an admin no side of its own (agent survey, `accountRouting.ts`). Admin + dancer routes as W3 or W5 by organiser count. One row is kept (M41) |
| WHO W11 "erase grace period" x every DO | The site has no grace period: erase is immediate (`account-erase` edge fn, then `/account/deleted`, signed out). `erase_requested_at` is only parsed and is always null (`dancer-app/api/rpc.ts`, fixtures note "kept for B2"). Only "erased, then signs up again" remains (M50) |
| DO "magic link vs code" for every entry except the organiser link and one second-device row | Both finish in `/auth/callback` with the same `mode` and `returnTo` (`Auth.tsx:314-320`), so the routing is identical. `J:organiser-link-magic-link` proves it once |
| DO "wrong code" / "expired link" for every entry | The error is entry-independent (`MagicLinkConfirmation.tsx:57-60`; `AuthCallback.tsx:279-295` keeps returnTo). Kept once for the organiser link (J) and once for the dancer link and header sign-in (M05, M14) |
| DO "switch profile" for people with ONE side (W2/W3 with no organiser, W7) | The sheet lists one side, ticked. The only remaining question is that the sheet opens, which R covers |
| ENTRY dancer invite e-mail x every WHO | No route, URL or code for it exists in this repo, and 0 invites were ever issued. It reduces to the DECISION row M70 |

## Kept rows

Legend:
- ENTRY: OL = organiser link `/auth?mode=signup&userType=organiser&returnTo=/account/o`; DL = dancer link /
  home banner `/auth?mode=signup&userType=dancer`; SI = header Sign in `/auth?mode=signin`; TI = team invite
  `/invite/<token>`; CL = claim link `/organisers/<slug>` "Sign in to claim" (`?claim=1`); DI = dancer invite
  e-mail; DP = deep link or bookmark.
- People = prod accounts in that WHO bucket. "new" = every new visitor.

### Organiser link (OL)

| ID | WHO | DOES | Expected END (screen + state) | COVERED BY | People |
|---|---|---|---|---|---|
| M01 | W0 | straight through | `/account/o` claim-your-page; dancer complete, no organiser | J:organiser-link-new | new |
| M02 | W0 | reload mid-onboarding | same as M01 | J:organiser-link-new-reload | new |
| M03 | W0 | close tab mid-onboarding, later header Sign in | Onboarding resumes with `returnTo=/account/o`, then same as M01 | J:organiser-link-new-closed-tab | new |
| M04 | W0 | close tab on "You're in", later Sign in | `/account/o` (review F2 option b) | J:organiser-link-closed-tab-after-required | new |
| M05 | W0 | magic link, same browser | same as M01 | J:organiser-link-magic-link | new |
| M06 | W0 | magic link opened on a SECOND device (phone mail app) | Device 2: same as M01. The client sets no `flowType`, so the implicit flow works cross-device and returnTo + `mode=signup` ride the link URL. Device 1 stays on the code step, and its code is consumed: "wrong or expired" | MISSING | new |
| M07 | W0 | wrong code first | Inline error, code step stays; then same as M01 | J:organiser-link-wrong-code | new |
| M08 | W0 | expired link | `/auth?mode=signin&callbackError=expired&returnTo=/account/o`; signs in again, then same as M01. NOTE: `userType` is not kept, so intent survives only through the stored `user_metadata` | J:organiser-link-expired-link | new |
| M09 | W0 | hostile returnTo | Off-site value dropped; same as M01 | J:organiser-link-hostile-returnto | new |
| M10 | W0 | browser Back on each onboarding card | Back stays inside the closed area. It never re-shows the sign-up form with a session (decision 3: a signed-in visitor on `/auth` is sent on), and never a blank page. **DECISION NEEDED**: should Back from the claim screen re-open the "You're in" card? Claude's default: no, because the end navigates with replace (`OnboardingScreen.tsx:34`) | MISSING | new |
| M11 | W3 | sign in from the switched form | `/account/o` claim screen, dancer profile unchanged | J:organiser-link-existing-dancer | 7 |
| M12 | W3 | already signed in | `/account/o`, no form shown | J:organiser-link-signed-in | 7 |
| M13 | W2 | already signed in, or signs in via the form | `/account/o` gate, then `/finish-profile?returnTo=/account/o`, then `/app/welcome?returnTo=...`, then `/account/o` | PARTIAL: U `publicEntryJourneys.test.ts` ("the gate's /finish-profile?returnTo=...") pins the hop, but no row starts from an EXISTING unfinished account | 7 |
| M14 | W5 / W8 | signed in, opens the OL | `/account/o` organiser Home (NOT the claim screen: they run one) | MISSING | 4 |
| M15 | W6 | signed in, opens the OL | `/account/o` Home, every organiser shown, nothing ticked until one is opened | MISSING | 0 |
| M16 | W7 | signed in, opens the OL | `/account/o` showing the open request (accountHome = organiser) | MISSING | 1 |
| M17 | W9 | signed in, opens the OL | Admin with no dancer row: `/account/o` gate, `no_profile`, so the Finish screen, then onboarding with returnTo, then the claim screen. **DECISION NEEDED**: should an admin-only account be forced to make a dancer profile to open the organiser area? Claude's default: yes, because the code says so (the gate has no admin arm) | MISSING | 2 |

### Dancer link / home banner (DL)

| ID | WHO | DOES | Expected END | COVERED BY | People |
|---|---|---|---|---|---|
| M20 | W0 | straight through | `/app/home`, dancer complete | J:dancer-link-new | new |
| M21 | W0 | reload | same | J:dancer-link-new-reload | new |
| M22 | W0 | close tab mid-onboarding, later Sign in | `/app/welcome` resumes at the first missing card, then `/app/home` (no organiser intent, so no returnTo) | PARTIAL: J:signin-unfinished-dancer is the same end state, but it is not entered from the DL | new |
| M23 | W0 | wrong code / expired link | Inline error. Expired: `/auth?mode=signin&callbackError=expired`; signs in again; the stub is incomplete, so `/app/welcome`, then `/app/home` | PARTIAL: U `AuthCallbackNotice.test.tsx` (notice only) | new |
| M24 | W0 | Back on each card | as M10, ending `/app/home` | MISSING | new |
| M25 | W3 / W5 | signed in, opens the DL | `/auth` sends a signed-in visitor on: no returnTo, so `/account/continue`. W3: `/app/home`. W5: "Continue as..." | PARTIAL: U Auth decision 3 (no row from the DL) | 11 |
| M26 | W3 | signed out, existing e-mail on the sign-UP form | The form switches to sign in (as M11); then `/app/home` | MISSING | 7 |

### Header Sign in (SI)

| ID | WHO | DOES | Expected END | COVERED BY | People |
|---|---|---|---|---|---|
| M30 | W0 | new e-mail on the sign-IN form | `otp_disabled` (422): the form offers to switch to sign up, then as M20 | U `tests/regression/today/auth.today.test.tsx` ("otp_disabled switch"), `AuthOtpDisabled.test.tsx`. Not walked | new |
| M31 | W2 | signs in | `/app/welcome` at the first missing card, then `/app/home` | J:signin-unfinished-dancer | 7 |
| M32 | W3 | signs in | `/app/home`, no chooser | J:signin-dancer; R:dancer-only | 7 |
| M33 | W5 / W8 | signs in | `/account/continue` "Continue as..." (organiser first, then dancer); Back does not return to `/auth` | J:signin-both; R:org+dancer | 4 (+1-2 W8) |
| M34 | W6 | signs in | "Continue as..." with 3 buttons; each organiser carries `?o=` | R:two-orgs+dancer | 0 |
| M35 | W5, dancer UNFINISHED | signs in | "Continue as...": organiser goes to `/account/o`, then the gate sends them to `/finish-profile?returnTo=/account/o`, then onboarding, then `/account/o` Home; dancer goes to `/app/welcome` | MISSING (a real prod account has this shape) | 1 |
| M36 | W7 | signs in | One side (dancer) goes to `/app/home`; Options links to the request. The organiser-intent F2 exception does NOT fire (`openRequestCount` > 0) | PARTIAL: U `publicEntryJourneys.test.ts` "organiser intent" block; no walk | 1 |
| M37 | W3 with organiser intent, no organiser, no request | signs in | `/account/o` claim screen (F2 b) | J:organiser-link-closed-tab-after-required | 2 |
| M38 | W9 | signs in | No side, so `/` (site home) | R:admin-only | 2 |
| M39 | any | magic link instead of code | identical to the code row (shared callback) | J:organiser-link-magic-link (representative) | - |
| M40 | W3 | wrong code / expired link | Inline error / expired notice, then as M32 | PARTIAL: U `AuthCallbackNotice.test.tsx` | 7 |
| M41 | W10 (admin + dancer, no organiser) | signs in | `/app/home` (admin adds no side) | U `accountSidesRouting.test.ts` (no-admin-arm, implicit). MISSING as a row | 0 |
| M42 | W5 | switch sheet, dancer app to organiser and back | `/account/o` Home, ticked; then back to `/app/home`, Dancer ticked | R:switch sheet in the dancer app; R:switch sheet in the organiser area | 4 |
| M43 | W6 | switch sheet in the organiser area, from organiser B | B ticked (`?o=`); tapping A goes to `/account/o?o=A` with A ticked | PARTIAL: U `accountSidesRouting.test.ts` (switcher ticks); R covers only 1 organiser | 0 |

### People with no live dancer row (W1 / W4) and erased accounts (W11)

| ID | WHO | DOES | Expected END | COVERED BY | People |
|---|---|---|---|---|---|
| M44 | W1 | signs in | No side, so `/` (same as admin-only). **DECISION NEEDED**: a non-admin with no dancer profile lands on the site home with no way in except the account icon. Claude's default: the landing should send them to `/app/welcome` (create the profile), because an archived stub is the only way into this state | MISSING | 0 |
| M45 | W1 / W9 | opens `/app/home` | `DancerAreaGate`: not allowed or a read error goes to `/account`, which (gate `no_profile`) shows the Finish screen | PARTIAL: `tests/e2e/dancer-app/reachability.spec.ts` "gate error: fails closed to /account" | 2 |
| M46 | W4 | signs in | One side (the organiser), so `/account/o`; the gate (`no_profile`) shows the Finish screen | MISSING | 0 |
| M50 | W11 erased, re-signs up with the same e-mail | DL or OL | **DECISION NEEDED**: no code handles it. Claude's default: treated as W0 (new stub, new `user_id`), with nothing restored | MISSING | 0 |
| M51 | W11 erase grace | - | Pruned: the site has no grace period (see Pruned) | - | 0 |

### Team invite e-mail (TI)

| ID | WHO | DOES | Expected END | COVERED BY | People |
|---|---|---|---|---|---|
| M52 | W0 | sign up from the invite | `/invite/<token>` redeem card, then redeemed, then `/account/o` | J:team-invite-new (ends on the card) | new |
| M53 | W3 | signed out, Sign in on the card | `/auth?mode=signin&returnTo=/invite/<t>`, then the card, then `/account/o` Home of the joined organiser | MISSING | 7 |
| M54 | W2 | signed in | Gate: `/finish-profile?returnTo=/invite/<t>`, then onboarding ("Next: join the team"), then the card | PARTIAL: U `inviteWalkthrough.test.tsx` ("profile_incomplete"); label pinned in `publicEntryJourneys.test.ts` | 7 |
| M55 | W5 / W8 | already a member | `already_member`, so `/account/o`, with no message | U `inviteModel.test.ts` (interpretRedeem) | 4 |
| M56 | any | used / revoked / expired token | A terminal card with a Home link; the token is stripped from the URL | U `inviteModel.test.ts`, `inviteWalkthrough.test.tsx` | 1 open invite |
| M57 | W3 signed in as person B, invite was sent to person A | opens A's invite | **DECISION NEEDED**: the token is bearer-style, so B joins A's team silently (no e-mail check in the client). Claude's default: keep bearer, but the card names the signed-in e-mail ("Joining as b@...") before redeeming | MISSING | 7 |
| M58 | W0 | magic link on a second device | Device 2 ends on the card; returnTo is in the link URL | MISSING | new |

### Claim link (CL)

| ID | WHO | DOES | Expected END | COVERED BY | People |
|---|---|---|---|---|---|
| M59 | W0 | sign up from "Sign in to claim" | `/organisers/<slug>?claim=1` claim card; dancer complete | J:claim-link-new | new |
| M61 | W3, e-mail matches | signs in | Claim runs once, marker removed, "This is your page", link to `/account/o` | U `PublicClaimCard.intent.test.tsx` ("fires once") | 7 |
| M62 | W3, e-mail differs | signs in | Marker dropped; the request panel only, no auto action | U `PublicClaimCard.intent.test.tsx` | 7 |
| M63 | W2 | signs in | `/finish-profile?returnTo=<page>?claim=1`, then onboarding ("Continue"), then the page | PARTIAL: U `accountRouting` `isDancerGatedTarget`; no walk | 7 |
| M64 | W5 | already organiser elsewhere | The claim runs (no client check). This matches the "person with roles" decision | U `PublicClaimCard.intent.test.tsx` | 4 |
| M65 | any | page already claimed / managed | Badge only, marker consumed, no card | U `PublicClaimCard.intent.test.tsx` ("managed organiser with the marker") | - |

### Deep links, old bookmarks, cross-person and cross-tab (DP)

| ID | WHO | DOES | Expected END | COVERED BY | People |
|---|---|---|---|---|---|
| M60 | W0 | home banner href | The banner's href equals `DANCER_LINK` | MISSING: no test pins the banner URL to the journey row | new |
| M66 | W0 | signed out, opens `/account/o` | Sign up via returnTo, then onboarding, then claim screen | J:deep-link-account-o-signed-out | new |
| M67 | W3 | signed out, opens `/app/nights` | Sign in, then `/app/nights` | J:deep-link-app-signed-out; `reachability.spec.ts` | 7 |
| M68 | W3 | old bookmark `/account/dancer` | `/app/home` | R:the old /account/dancer URL | 7 |
| M69 | W3 | old bookmark `/finish-profile` (finished) | `/app/home` (`oldDancerHomeRedirect`) | U `accountSidesRouting.test.ts`; MISSING walk | 7 |
| M71 | W3 | old bookmark `/app/welcome` (already finished) | **DECISION NEEDED**: the code has no redirect off a finished onboarding that is reached directly. Claude's default: show the end card ("Go to Home"), never re-ask the cards | MISSING | 7 |
| M72 | W3 | old e-mail `/account?from=...` / `?claim=` (legacy) | `accountHome` = organiser, so `/account/o`, then the claim screen | U `accountRouting.test.tsx`; `tests/e2e/organiser-legacy-redirects.spec.ts` | 7 |
| M73 | W2 | signed in, opens `/account/o` bookmark | Gate, then onboarding with returnTo, then `/account/o` | PARTIAL: U (gate hop) | 7 |
| M74 | W5 | old bookmark `/account` | `/account/o` Home (accountHome = organiser) | U `accountRouting.test.tsx` | 4 |
| M75 | any | Uppercase or trailing-slash deep link (`/APP/Home/`) | Same as the lowercase path (router is case-insensitive; the gate path is case-folded) | U `accountRouting` (`isDancerGatedPath` case-folded); MISSING walk | - |
| M76 | A (W5) signs out, B (W0) signs up on the same browser | sheet Sign out, then DL | B ends as M20. **No A data on B's screens.** BUT sign-out clears no storage: `auth_form_state_v1` pre-fills B's sign-up form with A's e-mail, name and city; `finish_profile_skipped` (sessionStorage) suppresses B's Finish hop; a stale `pending_profile_role` can turn B's callback into a sign-up when `mode` is missing. **DECISION NEEDED**: Claude's default: sign-out clears every person-scoped local and session key (list in agent survey: `auth_form_state_v1`, `auth_last_email`, `pending_profile_role`, `profile_entry_role`, `auth_pending_return_to`, `profile_last_active_role`, `finish_profile_*`). Query caches are uid-keyed, so they do not leak | MISSING (privacy) | every shared device |
| M77 | A (W3) signs out, B (W5) signs in, same browser | | "Continue as..." shows only B's sides (uid-keyed queries) | MISSING | - |
| M78 | W5 | second tab: signs out in tab 1 | Tab 2: auth-js syncs the session. Guarded pages re-render, so AuthGuard sends them to `/auth?returnTo=<page>`. No explicit handler; a page with no guard keeps stale signed-in UI until navigation | MISSING | 4 |
| M79 | W3 | second device: signs in while signed in elsewhere | Both sessions live; the same END as M32 on each | MISSING (low risk) | 7 |
| M80 | W2 | second tab: finishes onboarding in tab 1, tab 2 still on `/app/welcome` | **DECISION NEEDED**: tab 2 keeps the stale card until it saves. Claude's default: acceptable; the save is idempotent and the gate cache resets on `complete` change (`useMyDancerEdit.ts`) | MISSING | 7 |
| M81 | W9 | opens `/app/*` | `DancerAreaGate` (server), then `/account`, then the Finish screen | PARTIAL (M45) | 2 |

### Dancer invite e-mail (DI)

| ID | WHO | DOES | Expected END | COVERED BY | People |
|---|---|---|---|---|---|
| M70 | W0 / W2 (a profile created by admin for the person) | opens the invite e-mail | **DECISION NEEDED**: this repo has no URL, route or code for `dancer-invite-send` (no match for `dancer-invite`, `dancer_invite` or `invite-send`; the edge fn lives in the admin repo). The only related mechanism is `claim_my_dancer_profile_v1`, which self-claims by confirmed e-mail at sign-in (`AuthCallback.tsx:87`). Claude's default: the e-mail links to `/auth?mode=signup&userType=dancer` (or sign in), the self-claim attaches the admin-made profile, then as M20/M31. The admin worker must confirm the URL the edge fn sends | MISSING (0 invites issued so far) | 0 |

## DECISION NEEDED (summary, with Claude's defaults)

1. **M76 sign-out leaves person-scoped storage.** This is a privacy issue on shared phones. Default: clear the keys on
   every sign-out path.
2. **M57 team invite opened by a different signed-in person.** Default: bearer stays, and the card names who
   is joining.
3. **M70 dancer invite e-mail URL.** It is not in this repo. Default: the DL plus the e-mail self-claim. The
   admin repo must confirm.
4. **M44 non-admin with no live dancer row signs in and lands on `/`.** Default: send them to onboarding.
5. **M17 admin-only opening the organiser area is forced through the dancer setup.** Default: yes, as the code says.
6. **M71 a finished dancer opening `/app/welcome` directly.** Default: the end card, never re-asking.
7. **M10/M24 Back from an onboarding end.** Default: replace, so Back does not re-open "You're in".
8. **M50 erased account re-signs up.** Default: brand-new person. M51: the site has no grace period. The
   brief assumed one, so the owner should confirm that none is planned before B2.
9. **M80 two tabs mid-onboarding.** Default: acceptable as is.

## MISSING rows ranked by real people affected

The rank weighs people affected first (new visitors > 7 > 4 > 1 > 0), then harm (privacy or stranded >
wrong screen > cosmetic).

| Rank | Row | Why |
|---|---|---|
| 1 | M76 sign-out then a different person | Every shared device. A privacy leak of e-mail, name and city into the next person's form |
| 2 | M06 / M58 magic link on a second device | Every new visitor who reads mail on their phone and signed up on desktop |
| 3 | M10 / M24 Back during onboarding | Every new visitor; the most common phone gesture |
| 4 | M60 banner href pinned to `DANCER_LINK` | Every banner tap; a silent drift breaks all dancer rows |
| 5 | M13 / M73 existing unfinished dancer opens the OL or `/account/o` | 7 accounts; 1 has organiser intent |
| 6 | M53 existing dancer joins a team from the invite | 7 potential; 1 invite is open now |
| 7 | M57 invite opened by the wrong signed-in person | 7 potential; wrong team membership |
| 8 | M71 finished dancer on an old `/app/welcome` bookmark | 7 |
| 9 | M26 existing dancer uses the DL sign-up form | 7 |
| 10 | M69 finished dancer on an old `/finish-profile` bookmark (walk) | 7 |
| 11 | M80 two tabs mid-onboarding | 7 |
| 12 | M14 organiser opens the OL again (must reach Home, not claim) | 4 |
| 13 | M78 sign-out in another tab | 4 |
| 14 | M77 A out, B (organiser) in | shared devices |
| 15 | M35 organiser with an UNFINISHED dancer profile signs in | 1, a real prod account |
| 16 | M16 / M36 open-request person signs in or opens the OL | 1 |
| 17 | M17 / M45 / M81 admin-only opens the organiser area or `/app` | 2 (admins, internal) |
| 18 | M15 / M34 / M43 two organisers (walk exists for the chooser only) | 0 |
| 19 | M41 admin + dancer with no organiser | 0 |
| 20 | M44 / M46 / M50 no live dancer row / erased then re-sign-up | 0 |
| 21 | M70 dancer invite e-mail | 0 issued; blocked on the URL decision |

## Proposed follow-up (ONE worker)

### New `publicEntryJourneys` rows

Each row is walked by both existing harnesses: the routing model and the production build at 390x844. The
`Person` type needs one new field, `userType` (it already exists). Most rows need a `midway`.

| Row id | entry | person | midway | END |
|---|---|---|---|---|
| `dancer-link-back-each-card` | DL | NEW | `back-each-step` (new) | `/app/home`; Back never shows `/auth` with a session, and no blank page |
| `organiser-link-back-each-card` | OL | NEW, organiser | `back-each-step` | `/account/o` claim screen |
| `organiser-link-magic-link-other-device` | OL | NEW, organiser | `magic-link-other-context` (new: a second Playwright context) | Context 2: `/account/o` claim screen. Context 1: code says wrong/expired |
| `organiser-link-unfinished-dancer-signed-in` | OL | `{signedIn:true, dancer:'incomplete', organisers:0, userType:'dancer'}` | - | `/account/o` claim screen |
| `organiser-link-organiser-signed-in` | OL | `{signedIn:true, dancer:'complete', organisers:1}` | - | `/account/o` Home (not the claim screen) |
| `organiser-link-open-request-signed-in` | OL | `{..., organisers:0, openRequests:1}` | - | `/account/o` open-request screen |
| `dancer-link-existing-dancer` | DL | `{signedIn:false, dancer:'complete', organisers:0}` | - | `/app/home` |
| `signin-unfinished-dancer-with-organiser` | SI | `{dancer:'incomplete', organisers:1}` | - | `/account/continue`; then Organiser, the gate and onboarding, ending on `/account/o` Home |
| `signin-open-request` | SI | `{dancer:'complete', organisers:0, userType:'organiser', openRequests:1}` | - | `/app/home` (no F2 jump) |
| `team-invite-existing-dancer` | `/auth?mode=signin&returnTo=/invite/<t>` | `{dancer:'complete', organisers:0}` | - | `/account/o` Home of the joined organiser |
| `team-invite-unfinished-dancer` | same | `{dancer:'incomplete'}` | - | the card, with the end button "Next: join the team" |
| `bookmark-app-welcome-finished` | `/app/welcome` signed in | complete | - | DECISION 6 default: the end card |
| `bookmark-finish-profile-finished` | `/finish-profile` signed in | complete | - | `/app/home` |

### New build-walk specs

These go in `tests/e2e-build/account-edges.build.spec.ts` (new), using the `OrganiserFake` the routing spec uses.

| Spec name | END |
|---|---|
| `home banner href equals DANCER_LINK` | The banner's `href` is the journey row's entry |
| `sign out then a different person signs up: no trace of A` | `/app/home` for B; B's `/auth` form is empty. **Red until DECISION 1 is implemented**: ship it as the red-first test with the fix, or mark it `test.fail` only if the owner defers the fix |
| `sign out in tab 1 sends tab 2's guarded page to /auth` | Tab 2 ends at `/auth?mode=signin&returnTo=/app/home` |
| `two organisers: the switch sheet ticks the ?o= organiser and switches between them` | `/account/o?o=A` with A ticked |
| `admin-only opens /app/home` | `/account`, then the Finish screen (pins today's behaviour) |
| `two tabs mid-onboarding: tab 2 save after tab 1 finished` | Tab 2 ends at `/app/home`, no error |

### Size and scope

That is 13 rows and 6 specs, about one worker-day, with no `src/` change except where an owner answer to
decisions 1, 2, 4 or 6 asks for one. DECISION 1 (sign-out storage) is the only fix with a privacy edge and
should be its own small PR. Decisions 2 and 3 need the admin repo.

## Verified / Not verified

**Verified:**
- Every END was read from code on 028a8b7.
- The agent survey of `Auth.tsx`, `AuthCallback.tsx`, the gates, the invite and claim modules, the footer and
  sign-out, with file:line refs, is quoted in the rows.
- Prod bucket counts come from read-only SELECTs.

**Not verified:**
- No test or walk was run. This is an analysis; nothing in `src/` or `tests/` changed.
- The completeness counts approximate `profile_complete_v1` (+-1 against the handover's count).
- The Back-button and two-tab ENDs are the code's reading, not observed.
- The dancer-invite URL lives in the admin repo, which was not read.
