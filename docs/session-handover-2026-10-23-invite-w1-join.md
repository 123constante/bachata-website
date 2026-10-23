# Session handover 2026-10-23: W1 Option B join on /invite (PARTIAL, context gate)

Ticket `dt_7d96daf5d47c`. Branch `claude/invite-w1-join` (off `main` d4bff82). Brief: `brief/invite-journey` `briefs/invite-journey/W1.md` (sha 7b951ef4), with `COMMON.md` and `PLAN.md` section 4 "W1". Supersedes PR #959 (not closed). **Merges only after admin A2 is applied** (`not_linked` outcome, `organiser_invites.person_profile_id`).

Both prototypes were opened and read (join v3 Option B `TYZuWuVfoSLc6MqyHWSB1G`; linking `3gL4uGiZLMX9QgQrNsUQnk`).

## Done (this session)
- `src/modules/admin-organisers/join/`:
  - `joinCopy.ts`: ONE copy module for every screen and every error screen (what to do next, never a raw code).
  - `joinModel.ts`: `deriveJoinStep` (the PLAN section 4 table: checking / dead / email / code / about / join / done / wrong_account, plus unreachable and no_profile), `joinProgress` ("Step n of 3", 2 when complete), `parseJoinPreview` (A2 person keys, see Agreed names), `classifySendError` (blocked domain 403, rate limited, network), `classifyVerifyError`, `interpretBind` (ported from #959), `interpretJoinRedeem` (`not_linked` -> safety stop), `checkTypedEmail`, `JOIN_ROLES`.
  - `joinApi.ts`: `fetchJoinPreview`, `bindInviteEmail` (server binds BEFORE the code is sent), `sendJoinCode` (ONE `signInWithOtp({ shouldCreateUser: true })` path, no `account_exists_by_email`), `verifyJoinCode`, `recordJoinRoles` (Dancer + Organiser via `set_my_role_intent_v1`, first sign-in only), `attemptRedeem` (one in-flight per token), `reportJoinFailure` (step + code, no PII, no token), `stripToken`.
  - `JoinScreens.tsx`: Strip, Progress, PersonCard ("Hi <first>", photo, city, "This is your profile"), OrgCard, EmailStep, CodeStep (8 boxes, `one-time-code`, "Sent to <full email>", change email, resend in 60 s), JoinStepScreen, DoneScreen, WrongAccountScreen, DeadScreen (+ ask <inviter> for a new one), NoProfileScreen, StopScreen (blocked_domain with WhatsApp, rate_limited, network retry, email_unproven, not_linked "We've told <inviter>", already_bound, refused).
  - `AboutStep.tsx`: the four dancer fields inline (CityPicker, DanceRolePicker, AvatarUpload, `saveMyDancerProfile`), only the missing ones; Continue disabled with "Still to add: ...".
  - `JoinPage.tsx`: derives the step from server truth each render; after the code is verified `claimAtSignIn` runs BEFORE any persona read (`useProfileCompletion({ paused })`), then roles, then the completeness decides about/join; person-bound + claim `no_match`/`ambiguous` -> safety stop and one redeem so the server records the `not_linked` attempt; sign-out stays on the page (never a hop to /auth).
- `InviteRedeemPage.tsx` rewritten as the thin preview lookup around `JoinPage`; no DancerProfileGate.
- `DancerProfileGate.tsx`: never redirects `/invite`. `accountRouting.isDancerGatedPath`: `/invite` removed; its test rows updated (88 pass).
- Table test `join/__tests__/joinMachine.table.test.tsx`: 9 rows x 4 persons = 36, green now. **Red first on main's journey: 36/36 failed** (`docs/invite-w1-red-run-main.txt`, main d4bff82).
- `tsc -p tsconfig.app.json --noEmit`: clean on the touched files. eslint on `join/`: 0 errors after fixes (not re-run after the last edit).

## Agreed names (added by W1, for A2 to confirm or change)
Preview keys the client reads when present: `person_profile_id`, `person_first_name`, `person_avatar_url`, `person_city`, `prefill_first_name`, `prefill_city_id`. Absent `person_profile_id` = page invite. Redeem outcome `not_linked` as agreed. Today's prod preview has only `status`, `organiser_name`, `inviter_first_name`, `email_hint` (+ `self_bound`).

## Real data (read-only, prod stsdtacfauprzrdebmzg, counts only)
organiser_invites: 11 rows: open unbound 2, open self-bound 1, expired 1, revoked 2, used 5 (2 of them bound). No `person_profile_id` column yet (A2). redeem attempts: 5, all `redeemed`. dancer_profiles 187, 181 unclaimed, 69 without a photo. Preview function body read: 4 keys + self_bound, never an email.

## Open (NOT done)
1. **Old tests of the replaced journey fail** (expected; they encode the pre-Option-B screens): `routes.matrix` (13), `invitePrefillJourney` (15), `fixup1` (2), `polish` (6), `inviteReasons` (28), `redeemUnproven` (6), `inviteJoiningAs` (7), `invitePreview` (5), `inviteWalkthrough` (9). Rewrite to the new journey or delete where the intent is obsolete; KEEP: masked hint never a full email, no redeem without the Join tap, token stripped on terminal, ask-for-new-link, used-by-me -> done, email_mismatch/email_unproven after Join -> screens. Fold #959's `inviteSelfBoundGate.test.tsx` intent into a gate test (`/invite` never redirected).
2. RTL per-screen tests (email send -> code; verify -> claim BEFORE persona read; roles written; about saves; join redeems; not_linked; blocked domain; rate limited; network retry; email_unproven; wrong_account sign-out); `joinModel` unit tests incl. copy rule (no raw code in any string).
3. `invitePrefillJourney`: the sender's prefill used to arrive via redeem -> /finish-profile; About you now precedes the redeem, so the client reads `prefill_first_name` / `prefill_city_id` from the preview instead (server does not send them yet). Say so in the PR.
4. E2E: extend `tests/e2e/arc1-invite-redeem-walk.spec.ts` (OrganiserFake routes: preview, otp, verify, redeem) and add `tests/e2e-phone/invite-join.phone.spec.ts` at 390x844; `not_linked` case `test.fixme` until A2 is on the E2E project. Screenshots of EVERY screen and error screen -> `docs/design/<pr>/`, design record `docs/design/<pr>.md` (stage 2 = v3 Option B; stages 4 by script, 5 and 6 by the orchestrator).
5. Run every CI job's steps locally (`npm run lint`, `npm run test:unit`, `npm run typecheck`, architecture-guard steps incl. `check:images AUDIT_STRICT=1`, perf-budget build, phone-qa suite), eslint the join folder again, `npm run pre-ship`. Note eslint warning `local/no-bare-avatar-images` on `JoinScreens.tsx` PersonCard `<img>`: route through PersonChip or allow-list.
6. PR body: top line "Merges only after A2 is applied"; "Supersedes #959"; red run pasted; per-CI-job table; Verified / Not verified; Agreed names (above); Phone QA section; Verified on real data section. Automerge label does not apply (code PR).
7. Browser walk at 390x844 with prod-shaped data; Vercel: VERCEL_TOKEN not checked this session.

## Known decisions taken (say if wrong)
- Done screen sends to `/account/o` (PLAN table), not the Arc 1 welcome page the old code used.
- `already_bound` from bind: continue when the fresh hint matches the typed email, else stop "tied to another email".
- Bind RPC missing on the server = continue without binding (the redeem still guards the address).
