# join-gaps-1 inventory: gaps 2, 3, 4 (every screen, state and string)

Brief: `brief/join-gaps-1:docs/briefs/join-gaps-1.md` (sha 0a00e16). Source: `docs/walk/invite-recheck/RESULTS.md`
items 2, 3, 4 on `claude/walk-invite-recheck-1`. Line numbers are on this branch after the change.

## Data-source proofs (prod `stsdtacfauprzrdebmzg`, read-only SELECT of function bodies and counts, 2026-11-04)

1. **`redeem_organiser_invite_v1` + profile incomplete = an ERROR, never a reason.** The function does
   `PERFORM public._require_complete_dancer_profile_v1();`, which raises
   `ERRCODE 'P0001', MESSAGE 'profile_incomplete', DETAIL {"missing": [...]}, HINT 'Finish the dancer profile (/finish-profile) before organiser tools.'`.
   No `RETURN ... 'reason', 'profile_incomplete'` exists in the body. The client's `reason` branch is kept as a
   defence (the matrix pins both shapes to the same screen); the walk's mock `on/18` used the reason shape.
   The profile check runs BEFORE the membership read, so a P5 member with an incomplete profile gets this too.
2. **The two sign-up refusals CAN be told apart, by text** (both HTTP 403). `hook_before_user_created_v2` calls
   `hook_before_user_created_allowlist_v1` first; its refusal is `{"error":{"message":"Sign-up is limited to approved organisers.","http_code":403}}`.
   If `dancer_area_open` is NOT on, v2 returns that. If it is on, v2 drops the v1 refusal and checks
   `signup_blocked_domains`: `"Sign-up with this email provider is not accepted. Please use another email address."`, 403.
   **Today `dancer_area_open = true`, so the invite-only refusal does not happen on prod**; it returns the moment the
   flag is turned off. A bare 403 with no text (cannot tell) gets the invite-only words (they blame no provider).
3. **Checklist codes** (`_onboarding_missing_v1(p_user, p_organiser_id)` literals): person `first_name`, `city`,
   `dance_role`, `photo`, `nationality`, `languages`, `instagram`, `teach_answer`, `teach_styles`, `teach_levels`,
   `teach_years`, `dj_answer`, `dj_genres`; page `org_city`, `org_category`, `org_link`, `org_logo`, `contact_confirm`
   (18 codes; 11+ left is reachable). Counts, redeemed invitees by codes left today: 2:1, 3:2, 5:1, 6:2, 8:1, 10:1.
   Open invites: 3, with an email bound: 0, person-bound: 0 (so the hint-null shapes are the common prod case).
   Longest invite email 31 chars, longest organiser name 34.
4. **Found while proving (not in the brief):** `bind_organiser_invite_email_v1` is permanent (`UPDATE ... SET email`,
   then `already_bound` for anything else). The join email step binds an UNBOUND link to the typed address BEFORE
   `signInWithOtp`, so a refused send leaves the link tied to the refused email: "Use another email" then hits
   `already_bound` (a dead end). Fixed on the client side as far as copy goes (that control is not shown; the screen
   says why and offers help); the real fix (bind after a successful send, or unbind on refusal) is an
   **admin-repo / server change: reported, not built.**

## Rows

| # | Gap | Where (file:line) | What it carries | Change |
|---|-----|-------------------|-----------------|--------|
| 1 | 2 | `src/modules/admin-organisers/join/joinModel.ts:242` | `interpretJoinRedeem`: error message contains `profile_incomplete` -> `profile_incomplete` | left as is (proof 1: the prod shape) |
| 2 | 2 | `joinModel.ts:256` | same, as `reason` | left as is: cannot happen on prod, kept as defence, matrix row pins it |
| 3 | 2 | `joinModel.ts:286` (`redeemAction`) | `profile_incomplete -> refetch_completion` | left as is; the page now acts on the re-read |
| 4 | 2 | `joinModel.ts:268` `afterProfileRefusal` (new) | re-read complete -> `profile_stale` stop; error -> network; else follow the step | **new** |
| 5 | 2 | `JoinPage.tsx:235` (`applyRedeem` `refetch_completion`) | was `await completion.refetch()` and nothing else: the identical card when the read still said complete (`on/18`) | **changed**: stale stop, or About with the notice |
| 6 | 2 | `JoinPage.tsx:386` + `joinCopy.ts:67` `about.refusedNotice` | "A few details are missing. Finish them, then join." on About; About's Continue is the one button; saving lands on the Join card | **new** |
| 7 | 2 | `JoinScreens.tsx:301` + `joinCopy.ts:139` `profileStale` | "We couldn't join you yet" / "Your details look finished, but we couldn't confirm them yet. Wait a moment, then try again." + Try again (redeems again) + Go to Bachata Calendar | **new** |
| 8 | 2 | `JoinPage.tsx` `retry` | Try again on `profile_stale` redeems again | **changed** |
| 9 | 2 | `JoinScreens.tsx` `JoinStepScreen` / `joinCopy.ts` `join.*` | the Join card itself | left as is: the refusal now leaves the card (About or the stop) |
| 10 | 2 | `src/modules/admin-organisers/inviteModel.ts:206` | legacy invite reason copy "Finish your dancer profile first" | left as is: already has words; not the join flow |
| 11 | 3 | `joinModel.ts:187` `classifySendError` | ALL 403s -> `blocked_domain` | **changed**: "limited to approved organisers" -> `invite_only`; "not accepted"/"email provider" -> `blocked_domain`; bare 403 -> `invite_only` |
| 12 | 3 | `joinModel.ts:162-167` `JoinStop` | new `invite_only`, `locked` on both, `profile_stale` | **new** |
| 13 | 3 | `joinCopy.ts:119` `blockedDomain.*` | "Sign-up with this email provider isn't accepted..." | left as is (brief: keeps its words); now only for the real blocked domain |
| 14 | 3 | `joinCopy.ts:127` `inviteOnly.*` | "We can't create an account for this email yet" / "Sign-up isn't open to this email yet." / "Use the email the invite was sent to" / WhatsApp | **new** |
| 15 | 3 | `joinCopy.ts:62` `inviteSentTo` | "This invite was sent to d***@ritmo.example." (the preview's masked `email_hint`) | **new**, shown on the email step (`JoinPage.tsx:365`) and the invite-only stop |
| 16 | 3 | `joinCopy.ts:137` `locked` + `JoinScreens.tsx:279,292` | proof 4: after a bind, "Use another email" cannot work, so it is not shown; the screen says the link is tied and offers help + home | **new** |
| 17 | 3 | `JoinPage.tsx:185-211` `send` | tracks `locked` (bind answered `bound`) and carries it on the two 403 stops | **changed** |
| 18 | 3 | `src/lib/auth-otp-routing.ts:67-68` `SIGNUP_INVITE_ONLY_TITLE/_DESCRIPTION` | the /auth sign-up wall copy (`Auth.tsx:357-358`, `AuthStepper.tsx:320-325`) | left as is: a different journey (no invite, no hint); the join heading matches its title in meaning |
| 19 | 3 | `auth-otp-routing.ts:71` `isSignupAllowlistRefusal` | any 403 on create = allowlist | left as is (shared by /auth); the join flow now reads the text first |
| 20 | 3 | admin app: organiser invite creation + the email the invitee gets | the invited address the hint masks | **not inventoried**: `bachata-admin-11april` is not reachable from this session (add_repo: no access). Not verified. |
| 21 | 4 | `src/modules/organiser/p3/onboarding/graceModel.ts:12` `timePromise` (new) | THE time promise: 1-3 "a minute or two"; 4-6 "about three minutes"; 7-10 "about five minutes"; 11+ "about ten minutes"; >3 adds "You can stop and come back."; unknown count claims no time | **new** |
| 22 | 4 | `graceModel.ts:24` `graceBody` (was `GRACE_BODY`, line 10) -> `GraceBanner.tsx:66` | Home banner | **changed** |
| 23 | 4 | `graceModel.ts:26` `gateBody` (was `gateModel.ts:11` `GATE_COPY.body`) -> `GateSheet.tsx:50` | gate sheet, for the rows it lists | **changed** |
| 24 | 4 | `graceModel.ts:29` `welcomeLine` -> `OnboardingFlow.tsx:625` (was 619/621), count passed at `:360` | onboarding welcome line ("About five minutes, once only.") | **changed** (#1304 merged before this branch was cut: `8c60541`) |
| 25 | 4 | `joinCopy.ts` `about.lead` "Four things, then you're in." | a count, not a time | left as is: About asks at most the four fields |

## Coverage

25 rows found; 17 covered by a change, 7 left as is with a reason, 1 (row 20, the admin app) not reachable and listed
as Not verified. None silently omitted.

Matrix: `src/modules/admin-organisers/join/__tests__/joinGaps.matrix.test.tsx` (gaps 2, 3: 18 rows, 11 red on the
unfixed code, 7 pinning unchanged behaviour) and `src/modules/organiser/p3/onboarding/__tests__/timePromise.matrix.test.ts`
(gap 4: 3 screens x 10 counts, J3 x unknown skipped because the banner never shows without a count).
