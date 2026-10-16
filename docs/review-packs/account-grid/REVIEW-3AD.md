# Review: Website slice 3a + 3d (sign-out, settings, delete = hide, restore)

Reviewed: `claude/account-grid-3ad` head `1e2dfb03` against base `claude/account-grid` `b58f39d`
(`git diff b58f39d 1e2dfb03`, 37 files). Read-only review; no code changed.
Brief: `arc/briefs-dancer-rebuild` `briefs/account-grid-3ad-review.md` (sha 95cffd9).
Contract source: admin `claude/account-system-db` @ `cf35254` (PR #820).

**VERDICT: 2 blocking** (plus 4 should, 4 notes).

---

## Blocking

### B1. A sign-in that carries a returnTo never restores the account
- Where: `src/pages/AuthCallback.tsx:143-147` (a pending returnTo navigates straight to it),
  `src/pages/Auth.tsx:85,107` (an explicit `?returnTo=` is the post-sign-in target),
  `src/components/account/profiles/ContinueAsPage.tsx:29` (the ONLY caller of `signInLanding`, always with
  `returnTo = null`). The restore check lives only in `signInLanding` (`src/lib/accountRouting.ts:343-344`).
- Failure scenario: a person deletes their account, then within 30 days taps "Sign in" on an event page (or any
  page that sends `returnTo`). The sign-in lands on that page; `/account/continue` is never visited, so
  `deletionLanding()` never runs and `my_account_restore_v1` is never called. The account stays hidden although
  the copy on `/account/deleted` and the delete screen promises "Sign in within 30 days to undo". Worse, the
  next account page they open meets the dancer gate with no live dancer profile and is sent to onboarding,
  inviting them to build a second profile while the first is hidden. After 30 days the restore is lost for good
  (`restore_window_closed`). The handover's "Before returnTo" claim, and the test at
  `src/lib/__tests__/accountSidesRouting.test.ts:314` (`signInLanding(..., '/event/e1')` -> restore), only hold
  for a caller that does not exist: no code path passes a non-null returnTo to `signInLanding`.
- Fix: route EVERY sign-in through `/account/continue`, carrying the destination:
  `AuthCallback` (pending returnTo branch) and `Auth.tsx` (explicit returnTo) navigate to
  `/account/continue?returnTo=<sanitised>`; `ContinueAsScreen` reads `sanitizeReturnTo(searchParams.get('returnTo'))`
  and passes it to `signInLanding`, which already puts the deletion check before returnTo. Add a component test
  that renders the callback with a pending returnTo and a `pending` status and asserts the restore page is reached
  (red on this head). If touching `Auth*.tsx` is out of this slice's lane, it must land before the merge into
  `claude/account-grid`, not as a 3b follow-up: the copy shipped here makes the promise.

### B2. "Sign out of all devices" falsely reassures when the global revoke failed (handover Left 4)
- Where: `src/pages/AccountSettings.tsx` `SignOutEverywhere` (the `signed-out-locally` branch just
  `navigate("/")`, comment "nothing at '/' can say so yet"); same outcome ignored after delete in `Delete.erase()`
  (`await signOut({ everywhere: true })`, result discarded) while the delete screen says "you are signed out on
  every device".
- Failure scenario: a person whose phone was stolen taps "Sign out of all devices" on a flaky connection. The
  global call errors (supabase-js keeps the session on a network error), `useAuth` falls back to a local sign-out
  and returns `signed-out-locally`; the page goes to `/` with no message. The person believes the stolen phone is
  signed out; it is not. After a delete, the other devices also stay signed in to a hidden account.
- Fix: on `signed-out-locally`, do not navigate silently. Navigate to `/` with a router state (or a one-shot
  toast) reading "This device is signed out, but we couldn't reach the server to sign out your other devices.
  Sign in and try again." For the delete flow, pass the same notice to `/account/deleted` and show it there. Add
  a test per path asserting the words appear for `signed-out-locally` and not for `signed-out`.

## Should

### S1. Contact address is the placeholder, not the orchestrator's decision
- Where: `src/lib/accountDeletionCopy.ts:10` -- `export const ACCOUNT_CONTACT_EMAIL = "privacy@bachatacalendar.co.uk";`
  (and the "NEEDS OWNER" comment just above it).
- Failure scenario: every delete, deleted-card, admin-archived and refusal message, and both mailto actions, send
  people to a mailbox that `/privacy` (Website PR #762) does not name; requests for restore or erase may go nowhere.
- Fix: change that one constant to `"support@bachatacalendar.co.uk"`, drop the NEEDS OWNER note, and add a test
  pinning it (and, once #762 is merged, a test that the /privacy page names the same constant).

### S2. More than the one permitted edit in `src/lib/accountRouting.ts`, and edits in another slice's files
- Where: `accountRouting.ts` gains the import (line ~20), `ACCOUNT_RESTORE_PATH` (34), the
  `isDancerGatedPath` exemption (107), `SidesFacts.deletion` (~267-272) besides the `signInLanding` lines
  (343-344). `ContinueAsPage.tsx` and `profiles/__tests__/profiles.test.tsx` (the Switch-profile / sides work of
  #764, the area slice 3b owns) are also edited.
- Failure scenario: slice 3b rewrites the same functions; a textual merge conflict, or a silent loss of the
  `/account/restore` gate exemption, would send a hidden account to onboarding (the B1 harm by another road).
- Fix: tell the 3b worker explicitly that these five touch points exist and must survive; add a test in
  `accountRouting.test.tsx` that `isDancerGatedPath('/account/restore') === false` (if not already pinned) so a
  lost exemption goes red.

### S3. The "contract" test cannot catch an SQL-side rename
- Where: `src/lib/__tests__/accountDeletion.contract.test.ts:36-70` asserts against literal copies of the SQL
  shapes written in the test itself; lines 27-33 only `toContain` the RPC names in the client source.
- Failure scenario: #820 (or a later admin migration) renames `restore_until` or a code; this test stays green,
  because both sides of each assertion live in this repo. The brief asked for "a renamed key fails CI".
- Fix: the honest cross-repo pin is a live `scripts/check-*.mjs` in `db-contract-check.yml` that calls the three
  RPCs (as a test account) and asserts the key set and code set; queue it for the moment #820 is applied
  (handover Left 6). Until then, retitle the test "client parses the #820 shapes" so nobody reads it as a guard.

### S4. Rate-limit copy names the wrong window
- Where: `src/lib/accountDeletionCopy.ts:40` "Please wait until tomorrow and try again." The SQL is
  `_member_rate_check_v1('account_delete', 3, interval '1 day')` (`20261122310000_account_delete_hide_takeover_v1.sql:175`): a rolling 24 hours.
- Failure scenario: a person blocked at 23:00 tries at 00:30 "tomorrow" and is refused again.
- Fix: "You've tried this several times. Please wait 24 hours and try again."

## Notes
- N1. `erase_requested_at` is still in the dancer-app types (handover Left 1). Harmless (always null); the
  isolation-guard reasoning is sound. A separate dancer-app-only change should drop it.
- N2. The deleted card (`AccountRestore.tsx:28-45`) offers two mailto actions only; every later sign-in lands
  there again. The global header still lets the person browse, but a "Back to the calendar" link like the
  admin-archived branch has (line 63) would make the way out explicit.
- N3. `restoreAccount()` folds an RPC error into `failed` (Try again), including `not_signed_in` after a session
  expiry. Retry then fails again; acceptable because the page sits behind `AuthGuard`.
- N4. Deploy order (handover Left 3): an old `account-erase` answering `{ok:true}` with no `hidden` is read as
  hidden. Correct for the person; leave it.

---

## Checked and fine
- Status keys `state` / `requested_at` / `restore_until` and states none|pending|expired match
  `20261122140000_account_delete_hide_v1.sql:41-59` (last definition of `_account_deletion_status_v1`;
  `my_account_deletion_status_v1` at 227-243 returns it). The brief's "deleted_at" does not exist; using
  `requested_at` for the deleted card is correct.
- Restore codes `no_self_delete` / `restore_window_closed` / `admin_archived` / `restored:true, code NULL` match
  `20261122210000_account_delete_hide_review_fixes_v1.sql:151,155,159,166` (last definition of `my_account_restore_v1`).
- Delete refusals: `admin_account` (42501), `sole_organiser_owner` (P0001, DETAIL = refusal jsonb),
  `already_archived` (55000), `rate_limited` (54000 via `_member_rate_check_v1`) in
  `20261122310000_account_delete_hide_takeover_v1.sql:123-191` (last definition of `my_account_delete_v1`).
- Edge function `supabase/functions/account-erase/handler.ts:25-33` maps them to 403/409/409/429; `:48` sends any
  other message as `delete_failed` (client: generic retry); `:50` blockers only on `sole_organiser_owner`;
  `:77` `{ok:true, hidden:true, deletion}`. Client `classifyErase` (`src/lib/accountSettings.ts`) reads exactly these.
- Blocker keys `entity_id` / `name` (`EraseBlocker`) match `_account_erase_refusal_v1`
  (`20261120170000_account_lifecycle_rpcs_v1.sql:152`); `my_account_erase_check_v1` keys `can_erase` / `blockers` /
  `code` match lines 319-338.
- Every status x code shape maps to a screen with its own words: none -> carries on; pending -> restore ->
  "Welcome back..."; expired / `restore_window_closed` -> deleted card with date; `admin_archived` -> contact +
  back to calendar; `no_self_delete` -> "Nothing needed restoring"; network error -> Try again; failed status
  read -> sign-in carries on (ContinueAs) / Try again (restore page).
- No forbidden copy: grep of the changed screens and copy module for erased / permanent / cannot be undone /
  photos are gone finds none in person-facing text (the one "not permanent" is the hide-profile line, true).
- D1: `forgetPerson()` clears `clearPersonScopedStorage()` (localStorage + sessionStorage keys and prefixes) and
  `queryClient.clear()` on every successful sign-out path, local, global and the local fallback; tested at
  `personScopedStorage.test.tsx` for all three outcomes.
- D6: ordinary sign-out is `scope: 'local'`; "Sign out of all devices" is `scope: 'global'`; tested.
- Delete button disabled until DELETE is typed, with a stated reason; nothing is sent untouched.
- Refusal and empty states each say why and what to do (add an owner, contact us, wait, retry).
- Tests are table-driven over the shapes, assert behaviour (outcome kinds and visible words), and the handover's
  red-first run on b58f39d is credible: the new modules do not exist there. 8 touched suites re-run here:
  `Test Files 8 passed (8) / Tests 329 passed (329)`.
- Routes, `catchallClientPaths`, `siteIa` (`accountRestore`) and `buildBreadcrumbs` usage on the new page are present.
- HTML entities used for punctuation in JSX (`&rsquo;`, `&hellip;`); no raw Unicode punctuation added.
