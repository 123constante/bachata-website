# Arc 1 PR 2 review: #928 (`claude/arc1-pr2-redeem`) and #930 (`claude/arc1-pr2-sender`)

Read-only review, 2026-10-21. Base `main` 817a4dd. Heads: #928 4bd9430, #930 c46ce15.
Sources: brief `arc1-pr2-invite-sender.md`, `arc1-common.md`, `arc1-as-built.md` and
`invite-flows-mockups.html` from admin branch `brief/arc1-organiser-onboarding-2026-10-21` (c5101e1).
The mockup copy is approved wording (common brief: "Do not reword it except to fit a real server value").

## Verdict: FIX FIRST (both PRs)

#928 cannot merge as-is. It conflicts with main, a silent auto-merge creates duplicate copy keys,
and the 2d/2e screens send a signed-in person into a sign-in loop. #930 is close: its code is sound,
but its PR body is the bot placeholder, so two required checks fail, and it has two medium gaps.

## Why the checks fail

**#930, `real-data-verified` (failure) and `phone-qa-section`:** the PR body is still the bot
placeholder ("Opened by the bot for cloud branch ... The session fills in this description.").
- `scripts/check-pr-real-data-verified.mjs` needs `## Verified on real data` with
  `Shapes surveyed:`, `Checks run:` and `NOT verified:` lines. All three are missing.
- `scripts/check-pr-phone-qa.mjs` needs `## Phone QA` with `Sizes checked:` (a WxH),
  `Walked:` and `Not verified:`, because the PR touches `src/**/*.tsx`. That section is missing too.
- Fix: write the body. The worker's content is in `docs/handover/arc1-pr2-sender.md`, and the
  per-job table belongs there as well. No code change is needed. Every other #930 check is green
  (unit x3 TZ, build-smoke, e2e-smoke, phone-qa, integrity, bundle-budget, contract-check).

**#928, merge conflict (`mergeable_state: dirty`):** while a PR conflicts, none of its `pull_request`
workflows queue (the "conflicting-PR trap" in CLAUDE.md). The branch was cut from b098334, before main's
#870 (fb91b8a), and #870 rewrote the same area.
- CONFLICT `src/modules/admin-organisers/InviteRedeemPage.tsx`: main added `interpretRedeemWithMismatch`
  (`redeemMismatch.ts`), the signed-out masked-hint preview (`invitePreview.ts` `fetchInvitePreview`),
  the `mismatch` state and the "Sign out" / "Sign in with the email link" button. #928 rewrote the
  same lines with its own preview query and `RefusedCard`.
- CONFLICT `src/modules/admin-organisers/__tests__/routes.matrix.test.tsx`: both sides edited the
  signed-out "rpc not called" assertion.
- SILENT (auto-merges with no conflict, but is wrong): `src/modules/admin-organisers/inviteModel.ts`.
  Main already has `email_unproven` and `email_mismatch` in `REDEEM_COPY`, below `team_full`, and #928
  adds both keys again (its lines 182-183). After `git merge` the object literal holds **each key twice**
  (merged file lines 182/183 and 192/195). That is a duplicate-property error under `tsc`, and at
  runtime main's later keys win, so #928's mockup wording would never show. Main also exports
  `emailMismatchCopy` and its own `InvitePreview`/`fetchInvitePreview`; #928 adds a second
  `InvitePreview` type and a second `fetchInvitePreview` (`inviteRedeemApi.ts`). The two shapes differ.
- Resolution needed: keep ONE copy of each reason in `REDEEM_COPY`, at the mockup wording (F3). Keep
  ONE preview fetcher and parser, extended to the as-built shape and still passing through
  `safeEmailHint` (F4). Keep main's sign-out escape for the 2d/2e screens (F1). Fold
  `interpretRedeemWithMismatch` into `reasonScreen` so one mapping remains.

## Findings, ranked

### F1 (HIGH, #928): screens 2d and 2e loop a signed-in person back to the same screen
`src/modules/admin-organisers/InviteRedeemPage.tsx:148` and `inviteModel.ts:182-183` (`action: 'sign_in'`).
Scenario: Ana is signed in as a@x.com and opens a link bound to j@y.com. She taps Join and the server
answers `email_mismatch`. She taps "Sign in with that email", which links to `/auth?returnTo=/invite/T`.
`Auth.tsx:116-120` sends any signed-in user straight to `returnTo`, so she lands on "Join Salsa Norte"
again, then the same refusal, with no way out. `email_unproven` (2e) does the same. Main (#870) had a
`notYou()` sign-out button for these two reasons, and #928 dropped it. Mockup 2e's button is
"Email me a sign-in link". Fix: sign out first (the shared `signOut`), then go to the sign-in page for
this invite. For 2e, send the email link.

### F2 (HIGH, #928): duplicate `REDEEM_COPY` keys after the merge (see "Why the checks fail")
`inviteModel.ts:182-183` vs main's `email_unproven` / `email_mismatch`. Scenario: an orchestrator
merges #928 into main. git reports no conflict on this file, `tsc` errors, and at runtime the 2d/2e
copy is main's older wording.

### F3 (MEDIUM, #928): copy differs from the approved mockups
| Screen | Mockup (approved) | #928 | Where |
|---|---|---|---|
| 2a expired body | "Links last 7 days." | "Links last 7 days. Ask the admin who sent it for a new link." (repeats the button) | `inviteModel.ts:187` |
| 2b used body | "If that was not you, ask for a new one." | "A link works once. If that was not you, Ask the admin who sent it for a new link." (capital A mid-sentence) | `inviteModel.ts:185` |
| 2c withdrawn body | (none) | "Ask the admin who sent it for a new link." | `inviteModel.ts:186` |
| 2d body (hint) | "It was sent to j\*\*\*@gmail.com." | adds " Sign in with that email, or ask for a new link." | `inviteModel.ts:258` |
| 2e body | "This link is for your email, but you signed in another way." | adds "Sign in with an email link or code, then open this link again." | `inviteModel.ts:183` |
| 2e button | "Email me a sign-in link" | "Sign in" | `InviteRedeemPage.tsx:148` |
| 3b title / line | "Sign-up is invite-only for now" / "Tell us about your events and we will get back to you." | "Request access", no line | `RequestAccess.tsx:51` |
| 3b button | "Request access" | "Send request" | `RequestAccess.tsx:79` |
| 3c | title "Request sent", "We will email you when you are in.", button "Back to Bachata Calendar" | one line "Request sent. We will email you when you are in." + "Back" | `inviteModel.ts` `accessResultCopy`, `RequestAccess.tsx:53` |
| 9b (callbackErrorCopy expired) | "That sign-in link has run out" / "Enter your email and we will send a new one." / "Send a new link" | "That link expired or was already used. Enter your email for a new one." | `src/lib/auth-otp-routing.ts:87-88` |
| 4a resend | "Send a new code in 24s" | "Resend code in 24s" | `MagicLinkConfirmation.tsx:263` |

Matches the mockups: 1a ("Salsa Norte invited you" / "Sign in, then you manage its events."), titles
2a-2f, "Ask Marta for a new one" when the inviter is known (falls back to "Request a new link"),
2d "Sign in with that email", 4b/4c/4d wording and the 3-try countdown, and 2f with no ask button.

### F4 (MEDIUM, #928): email hint no longer goes through the masking guard (ACL / D36)
`inviteModel.ts:237` (`parsePreview`: `emailHint: str(r.email_hint)`) and `:214`
(`invite_email_hint`). Main runs both through `safeEmailHint`, which drops anything that still
reads as a full address. Scenario: a server regression returns `email_hint: "jane@gmail.com"`.
#928 prints the full address on the 2d screen to whoever holds a forwarded link, and it also
treats the link as bound (`InviteRedeemPage.tsx:110`). Server masking is the primary control;
this is the defence in depth that main already had. Fix: keep `safeEmailHint` in the one parser.

### F5 (MEDIUM, #928, plausible; verify on a real code): "wrong" may always read as "run out"
`MagicLinkConfirmation.tsx:147`: `isExpired = errorCode === 'otp_expired' || ...`. Supabase Auth
(GoTrue) answers a WRONG email OTP with code `otp_expired` and the message "Token has expired or is
invalid", the same as a truly expired one. Under this branch a wrong code would then show "This
code has run out", never count a try, and disable the input. The 3-try soft limit and the
"N tries left" wording (decision 8) would never appear. The unit test mocks the error shape, so it
cannot catch this. Fix: verify one wrong code against the real project. If the codes collide, track
expiry on the client (the time the code was sent vs the OTP lifetime) instead of trusting `error.code`.

### F6 (MEDIUM, #930): a request's "Send a new link" makes an UNBOUND link by default
`AdminOrganisersPage.tsx:295-301` (`sendNewLink`) opens the link form empty. `InviteRequests`
shows `r.inviteEmail` but does not pass it. Scenario: Marta's bound link to j@y.com runs out and
j taps "Request a new link". The admin taps "Send a new link" and then "Make link". The new link
is unbound, so whoever has the forwarded copy can use it, which undoes owner decision 2. Fix:
pass `inviteEmail` into the form as its starting email.

### F7 (MEDIUM, #930): first name and city are offered on an unbound link, where they can never arrive
`AdminOrganisersPage.tsx:184-190`. As built (F4 prefill timing), prefill reaches the client only on a
bound link. Scenario: the admin leaves the email empty and types "Jo" and "Leeds". The link
stores both, and the newcomer still sees empty fields. Fix: disable both fields while the email is
empty, with the reason shown ("Add their email to pre-fill these"), per the rule that a disabled
control states why.

### F8 (LOW, #930): 5b and 5f wording drift
- 5b third choice hint: mockup "We email the link to one address." vs "A ready message for one
  address." (`senderModel.ts:87`). The change is justified, because `admin_invite_person_v1` sends no
  email, but it is an owner call. Ask the owner rather than ship it silently.
- 5f: mockup "Owner: Marta. Joined 21 Oct." vs "Has an owner. Joined 21 Oct." (`senderModel.ts:27`).
  The owner's name is not loaded here. Acceptable if no RPC returns it. Say so in the PR body.

### F9 (LOW, #928): raw Unicode and a disabled control with no reason
- `RequestAccess.tsx:79` has `'Sending'` + a raw ellipsis (a raw U+2026). CLAUDE.md asks for entities or the `\u2026` escape,
  as `MagicLinkConfirmation.tsx:263` does.
- `RequestAccess.tsx:78` keeps Send disabled while the email is empty, and nothing says why.

## Checklist asked for

| Item | #928 | #930 |
|---|---|---|
| Copy = approved mockup wording | NO (F3) | mostly; 5b/5f drift (F8) |
| One shared reason-to-copy mapping | inside the branch yes (`reasonScreen`); after the merge NO, two maps + two preview parsers (F2) | yes: `SENDER_LABEL`, `ISSUE_REFUSAL`, `RESOLVE_REFUSAL`; status still from `accessStatus` |
| ok/reason switch, 3 issue refusals | n/a | yes: `parseIssueResult`, shown under email / first name / city; raised errors -> `adminErrorMessage` |
| Prefill timing (F4 as-built) | bound link skips `DancerProfileGate`, prefill stored on redeem (sessionStorage, person-scoped), unbound keeps the gate. Matches the as-built note. | form offers prefill on unbound links too (F7) |
| ACL / enumeration, no email shown | full-address guard lost (F4); request-access answer never reveals the allow-list (OK) | admin-only lists show full emails (OK, admin) |
| Forwarded link | bound + other account -> 2d, then the loop (F1); signed out -> 1a, then the invite-only wall -> Request access (OK) | request -> new link drops the binding (F6) |
| Sender button x status | n/a | 5a Invite / 5d Copy new link + Withdraw / 5e Send a new link / 5f Add another person, table-tested (`senderModel.test.ts`) |
| Disabled controls state why | Request-access Send: no (F9) | yes (loading, load-failed, form blocked); F7 missing |
| Empty states | n/a | both request lists say what to do |
| Invite: 3 choices | n/a | yes (link / existing account / by email) |

## Verified / Not verified (this review)
- Verified: read both diffs against `origin/main`; ran `git merge-tree` and a real `git merge` of
  #928 into main in a scratch worktree (2 conflicts + the silent duplicate keys); read the CI scripts
  for both failing body checks and #930's check runs; compared copy line by line with the mockups.
- NOT verified: nothing was executed (no vitest, tsc, build or browser walk); F5 needs one real wrong
  code against Supabase Auth; prod shapes were not surveyed (PR 1's RPCs are not on prod).
