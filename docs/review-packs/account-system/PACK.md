# Account system: review pack for the merge train

DRAFT for the owner. Three changes ship together:

- **Admin #820** &mdash; the database side (delete = hide, restore, admin erase, guards, funnel counter, Test accounts page).
- **Website #762** &mdash; the new `/privacy` and `/terms` pages.
- **Website #775** &mdash; everything people see: sign-up, sign-in, sign-out, settings, delete, restore.

Your rule, 2026-10-15: *delete = hidden from everyone at once; sign in within 30 days to restore; after 30 days it stays hidden and nothing is erased; a full erase happens only when someone asks, done by an admin by hand.*

Screenshots are in `shots/` next to this file (390x844 phone size). All of them use made-up data on a test build. None is from a real phone.

---

## 1. What changes, before vs after

**Sign-up**
- Before: no mention of Terms or Privacy. Nothing recorded that anyone accepted anything (0 rows of consent in the database).
- After: under the code box, the line &ldquo;By continuing you agree to the Terms and Privacy Policy&rdquo; with two links. When the code is accepted we record the acceptance once. If someone signs up by tapping the e-mailed link instead, that is recorded too.

**Sign-in code box**
- Before: it already remembered the code step for 10 minutes after a reload and already locked after 5 wrong codes. That is unchanged.
- After: the box gets the cursor when it opens; errors are read out by screen readers; the phone offers the e-mailed code. After a right code it shows &ldquo;Checking code&rdquo; and stays locked until you are through, so a slow moment cannot look like a wrong code. We now count the steps people take (no names, no e-mail, no IDs) in a new daily counter.

**Consent at sign-in**
- Before: nothing.
- After: someone with no acceptance of the current text on file sees one card with one button, &ldquo;Accept and continue&rdquo;, once. Today that is all 15 existing accounts. If the check is slow (over 2.5 seconds) or fails, they carry on without it: consent never blocks sign-in.

**Sign-out**
- Before: signing out on your phone also signed you out on your laptop.
- After: &ldquo;Sign out&rdquo; signs out this device only. Settings has a new &ldquo;Sign out of all devices&rdquo;. Every sign-out also clears the saved person data and cached pages on that device (so the next person on a shared phone does not see the last person&rsquo;s e-mail or details).
- If &ldquo;all devices&rdquo; cannot reach the server, this device is signed out and you get a message saying your other devices may still be signed in.

**Settings**
- Before: &ldquo;Deleting your account is permanent&rdquo;, photos gone, cannot be undone.
- After: new wording that matches your rule, the &ldquo;Sign out of all devices&rdquo; button, and a clearer screen when delete is refused (see Delete).

**Delete account**
- Before: it started an erase (and the old edge function deleted photos).
- After: delete **hides** the account from everyone at once and signs you out everywhere. You have 30 days to undo it by signing in. After 30 days it stays hidden and everything is kept; nothing is erased automatically. The screen says: ask us for a full erase.
- Refusals, each with its own words: admin account; sole owner of an organiser (names the organisers); already hidden; too many tries (&ldquo;wait 24 hours&rdquo;).

**Restore**
- Before: not possible (the old grace period could be cancelled with an e-mail link; that door is now closed).
- After: signing in inside 30 days restores automatically: &ldquo;Welcome back, your account is restored&rdquo;, then Continue. This works for **every** way of signing in, including a sign-in that came from an event page (a review found the first version missed that; it is fixed and tested).
- If an admin hid the profile, restore does not undo it: the page says an admin hid it and shows the contact address.

**Deleted card (after 30 days)**
- Before: did not exist.
- After: &ldquo;This account was deleted on [date]&rdquo; with two e-mail buttons: &ldquo;Ask us to restore it&rdquo; and &ldquo;Ask us to erase it&rdquo;. The date is when the person asked for deletion.

**Landing after sign-in**
- Before: sign-in went to the page you came from, or to Continue-as.
- After: a deleted account is always checked first and sent to restore (or the deleted card) before anything else. Everyone else lands as before.

**Continue-as and invite card**
- Mostly **unchanged**. The Continue-as list, the invite card (&ldquo;You are joining as [name]&rdquo;, &ldquo;Not you? Sign out&rdquo;) and the setup screens were already built. What is new: one shared check (&ldquo;account gate&rdquo;) that puts deleted accounts first, so Continue-as never opens an area for a hidden account.

**/privacy and /terms**
- Before: the links would 404.
- After (#762): two real pages. Operated by Bachata Calendar, no postal address, contact support@bachatacalendar.co.uk, Instagram as optional second channel. Deletion wording matches your rule. Version 2026-10-16. Footer links to both.

---

## 2. Tour (what to look at)

Delete and restore (`shots/3ad/`)
- `01-delete-screen.png` &mdash; the &ldquo;What happens&rdquo; list: hidden now, signed out everywhere, 30 days to undo, ask us for a full erase.
- `02-deleted-page.png` &mdash; page after deleting; check it says you are signed out and can come back.
- `03-refused-sole-owner.png` &mdash; names the organiser blocking the delete.
- `04-refused-rate-limited.png` &mdash; &ldquo;wait 24 hours&rdquo; wording.
- `05-restored-banner.png` &mdash; &ldquo;Welcome back, your account is restored&rdquo; and Continue.
- `06-admin-archived.png` &mdash; &ldquo;An admin has hidden this profile&rdquo; with a contact link, no Continue.
- `07-deleted-card.png` &mdash; date and the two e-mail buttons.
- `08-settings-signout-all.png` &mdash; the new &ldquo;Sign out of all devices&rdquo; button.

Sign-in and sign-up (`shots/3c/`)
- `1-code.png` &mdash; code box with the cursor in it.
- `2-wrong-x5-locked.png` &mdash; after 5 wrong codes: &ldquo;Send a new code&rdquo;.
- `3-signup-consent-line.png` &mdash; the Terms and Privacy line with both links.
- `4-accept-card.png` &mdash; the one-button accept card.

Landing and Continue-as (`shots/3b/`) &mdash; mostly existing screens, shown for completeness
- `04-continue-as-list.png` &mdash; the list of sides to continue as.
- `05-invite-card-signed-in.png`, `06-invite-card-signed-out.png` &mdash; invite card, both states.
- `01-welcome-setup-resume-at-role.png`, `02-resume-after-closed-tab-photo.png` &mdash; setup resumes where you stopped.
- `03-end-card-finished-dancer.png` &mdash; end card (see Decision 5).

Legal pages (`shots/legal/`)
- `terms-390x844.png`, `privacy-390x844.png` &mdash; full pages; check the contact line and no leftover placeholder text.
- `privacy-deletion-390x844.png` &mdash; the changed section: hidden, 30 days, erase on request.

Admin Test accounts page (#820) (`shots/admin-test-accounts/`)
- `list.png`, `list-success-notice.png`, `list-error-notice.png`, `list-failed.png`, `empty.png` &mdash; text is now readable on the light admin background (it measured 1.04 before the fix, lowest 6.91 after; 4.5 is the bar).

**No screenshot exists for:**
- the &ldquo;other devices may still be signed in&rdquo; message after a failed &ldquo;all devices&rdquo; sign-out (tested as a call the page makes, not as pixels);
- the sign-up that lands from the e-mailed link (records consent silently, nothing to see);
- the &ldquo;Checking code&rdquo; state;
- a sign-in from an event page that is sent to restore first (the walk asserts the address, no picture);
- the Settings home line and the ownership screen after the wording change;
- the funnel counter (no screen; admins read it through a database function).

---

## 3. Decisions made for you

You did not click these. Each was decided by the orchestrator or a worker, with the reason. Say so if you want any changed.

1. **Contact address: support@bachatacalendar.co.uk.** One mailbox for restore and erase requests and for /privacy. A first draft used `privacy@`, which no page named; a review caught it. It is one constant in the code and one test pins it.
2. **The `erase_requested_at` field is not dropped yet.** It is always empty, so it does no harm. Removing it touches the dancer-app area, and the repo&rsquo;s isolation check forbids mixing that with this change (35 violations measured). It goes in a later dancer-app-only change.
3. **The colour-contrast test runs locally or on a worker only, with no new CI job.** No CI job today installs a browser; adding one is a new workflow. The test is real (5 of 5 pass) but nothing in GitHub runs it. #820 only keeps it out of the migration proof job.
4. **Success notice on the Test accounts page is neutral slate, not green.** The admin theme turns green into orange, so green was not reused; it matches the Beta access page&rsquo;s plain style. A judgement call.
5. **100% dancers go straight on; 70&ndash;99% see the end card.** Your list said a finished dancer &ldquo;sees the end card&rdquo;. The existing app does that only below 100% and the tests pin it. We read your intent as &ldquo;a finished dancer is never sent back into setup&rdquo;. Showing the end card at 100% would need a dancer-app-only change.
6. **A comment update in `notes.tsx` is deferred** to a dancer-app-only PR. The file was put back exactly as on main so this change stays out of the dancer area. Comment only; no behaviour.
7. **Consent time limit 2.5 seconds.** If the consent check or save is slower, the person carries on. A review showed that waiting with no limit could leave someone stuck on a dead code box.
8. **Terms version `2026-10-16`.** Same as #762&rsquo;s pages. An earlier draft said 2026-10-15, which would have recorded a version of the text that was never published. The test comparing the two versions skips until #762 is merged.
9. **The accept card stays behind the dancer-area gate.** The save (`accept_terms_v1`) is refused for people not allowed into the area. So when the area is closed to someone, the card is hidden (otherwise it would show every time and save nothing). Today the area is open, so everyone sees it once. Moving consent out of the gate would be an admin change.
10. **One extra read per page for signed-in people:** the shell checks &ldquo;is this account deleted?&rdquo; once on load, cached for 30 seconds. It guards the restore flow. Page-weight budgets stayed green with nothing raised.

Also logged without your click (smaller):
- A failed &ldquo;is this account deleted?&rdquo; read lets sign-in carry on rather than blocking it.
- A failed consent read counts as &ldquo;accepted&rdquo; so no one is walled out.
- If the server answers delete with OK but without saying &ldquo;hidden&rdquo; (an older version during the switch-over), the page treats it as hidden.
- Wrong vs expired codes are counted separately by the error code Supabase sends; the vague &ldquo;expired or invalid&rdquo; message counts as wrong.
- Admin hold wins: if an admin hides a profile someone deleted, their restore does nothing (R1 S2, logged as an owner decision in #820).

---

## 4. What it touches on prod

### #820 (Admin, database)

Nothing is applied yet. 21 migration files, in order (each one is new; none edits an earlier one):

1. `140000 account_delete_hide` &mdash; adds the hide-and-restore engine. Table `account_erase_requests` gets a `restored_at` column and its due date can now be empty. Three new member functions: delete (hide), restore, status.
2. `150000 account_erase_grace_retire` &mdash; **switches off** the old 30-day auto-erase: unschedules cron `account-erase-due` and closes five old erase functions to signed-in people. Table and functions stay.
3. `160000 admin_account_erase` &mdash; new admin-only full erase, writes an audit row. For formal GDPR requests only.
4. `170000 check_people_hidden_readers` &mdash; new safety check: public pages never show hidden people. Also adds the missing hidden-filter to `get_public_vendor_detail_v1`.
5. `180000 signup_blocked_domains_seed` &mdash; **writes data**: 12 disposable-mail domains into the sign-up blocklist (plus one audit row each). Does nothing while the area is open to everyone.
6. `190000 auth_funnel_daily` &mdash; new counter table (empty, locked down) and two functions: anyone can add 1 to an allowed step; only admins can read.
7. `200000 check_auth_funnel_contract` &mdash; safety check for the counter.
8. `210000 account_delete_hide_review_fixes` &mdash; restore never undoes an admin hide; delete covers every profile the account owns.
9. `220000 account_erase_runner_closed` &mdash; closes the back door so only the admin erase can erase.
10. `230000 organiser_home_hidden_teammate` &mdash; a team member who deleted their account no longer shows in the organiser&rsquo;s team list.
11. `240000 hidden_readers_guard_review_fixes` &mdash; tightens the safety check; hides teacher/DJ sample names from the public.
12. `250000 auth_funnel_bound` &mdash; caps the counter at about 121 rows per day.
13. `260000 admin_list_test_accounts` and 14. `270000 admin_reset_test_account` &mdash; the Test accounts page: list and one-tap full erase, **only** for addresses ending `@test.bachatacalendar.com`.
15. `310000 account_delete_hide_takeover` &mdash; fixes a case where an admin hide could be undone; double-tap safety; rate limit 3 per day.
16. `320000`, 17. `330000`, 18. `340000`, 19. `350000`, 20. `360000`, 21. `370000` &mdash; further tightening of the two safety checks, the counter cap, the admin erase permissions (service role closed), and the Test accounts page (refuses where the erase would refuse; locks the row).

**Rows changed by the apply (data writes): the 12 blocklist domains and up to 12 audit rows.** None of the 12 are on prod today and none of the 21 accounts uses one. Everything else is structure and permissions. Prod today: 0 delete requests, 15 hidden people (all admin hides, which restore will never touch), 21 sign-in accounts.

**Before you apply (from the #820 body, a hard gate):** deploy the new `account-erase` edge function, then undeploy `account-erase-due` and `organiser-signup`, then merge. The OLD function deletes photos and only then calls an erase that #820 closes, so the order matters. The Website change must ship in the same window, because the live site still says &ldquo;permanent&rdquo; and treats OK as erased.

**Who notices:**
- People: nothing until #775 is live; then the delete wording and restore flow.
- Admins: a new &ldquo;Test accounts&rdquo; item in the sidebar.
- Sign-up bots: 12 disposable domains are refused when the area is open.
- Anyone calling the five old erase functions directly: refused.

**How to undo each (honest):**
- Before apply: close the PR.
- After apply: **undo is a new migration**, not a revert. It would re-grant the five old doors, reschedule `account-erase-due`, revoke the new member functions and the admin erase, drop the two safety checks and the counter, and delete the 12 domains (audit rows stay).
- Hidden accounts: an admin un-hides with `admin_unarchive_person_v1`, which also ends the self-delete.
- Test accounts page: a follow-up migration drops its three functions and the screen is reverted. **An account already reset cannot be brought back.** It was a test account by design.
- Edge functions: redeploy from the earlier commit (commands in the #820 body).
- **Not undoable:** an admin full erase of a real account.

### #762 and #775 (Website)
Website only. No data and no migrations. `/privacy` and `/terms` are static text. Undo = revert on Vercel. #775 calls database functions that only exist after #820 is applied; until then the calls are quietly ignored (the funnel counter) or the pages show &ldquo;Try again&rdquo; (delete/restore).

---

## 5. Verified / Not verified

**GitHub checks**
- #820: all green at `f7b5a16`.
- #762: all green at `a993804`.
- #775 at `d9ac066`: all green **except** `unit (Europe/London, full)`. Its 2 failing files (organiser DatePage, levelsByType) **also fail on main (`070c320`)** when re-run on 2026-10-16. It is date drift on main, not this PR.

**Verified, from the handovers**
- Red-first: each review fix was run on the unfixed code and failed, then passed. Examples: sign-in-with-returnTo restore, 16 failed before and 66 passed after; consent timeouts, 4 failed before; the deletion wiring, 5 failed on the mutant.
- Mutation proofs: break one thing on purpose and the test must turn red. Done for the contract reader (renaming `restore_until` in a copy of the SQL fails 2 tests; the old test stayed green), the sign-in deletion wiring (5 of 7 fail), and the gate&rsquo;s order (2 of 44 fail). Restored after each.
- Commands (all exit 0): `npm run build`, `check:bundle-budget`, `check:first-load-requests`, `check:chunk-cycles` (no budget raised), `check:journey-grid` (87 rows), `check:dancer-area-isolation`, `bash bin/check-integrity.sh`, production-build browser walks at 390x844 (delete 7/7, consent 3/3, public journeys 33) with a fake backend.
- The lint chain reads red only on a missing run-permission on one script in the worker&rsquo;s copy; CI fixes that. Typecheck shows 96 errors, none in changed files (base 96).
- Local unit run: the same 59 failures as main (organiser dates, levelsByType, and contract tests that need a live database).
- #820: migrations proven on a local replay with each file&rsquo;s self-check; red-first database tests (6 of 6 failed before, passed after); Test accounts screen tests 13 of 23 failed before, 23 of 23 after; contrast 5 of 5 pass.
- **#820 real-data check:** ran on a **local replay of the migrations with a synthetic seed shaped like prod** (counts from a read-only prod survey on 2026-10-15). It was **not** a Supabase branch (creating one timed out). Cases 1&ndash;9 passed: delete, restore at 5 and 45 days, admin hide, sole owner, admin refused, double delete, admin erase and audit row, Test accounts list and reset, and zero writes from the read functions. The first report said &ldquo;Not verified&rdquo; because of the contrast problem on the Test accounts page; that was fixed afterwards (f7b5a16).
- #762: legal tests 10 of 10 (also in 3 timezones), build, 390x844 walk.

**Not verified**
- A real phone keyboard.
- Real e-mail code delivery.
- Live deletion on prod (needs #820 applied).
- The Vercel preview walk (the orchestrator does it).
- Real data for the Website screens: shapes come from the SQL source; no live call was made.
- Whether the live consent save works for everyone, until #820 is on prod.
- Legal wording sign-off (yours).
- Several admin jobs that need prod passwords (ledger sync, replay against a prod copy).
- A fresh review of the last #820 migration (`370000`), and the Test accounts screen in a signed-in browser.

---

## 6. Merge order

1. You approve **and apply #820** (after the edge-function steps in section 4).
2. The orchestrator checks prod: the new functions exist, cron is off, 12 domains seeded, nothing else changed.
3. Merge **#762** (/privacy and /terms).
4. Merge **#775** (the account screens).
5. The orchestrator checks the live site.

**Why #762 and #775 ship together:** #775 puts &ldquo;Terms&rdquo; and &ldquo;Privacy Policy&rdquo; links on sign-up and sign-in. Those pages only exist in #762; without it both links 404. #762 also holds the shared version number (2026-10-16) that #775 records. Merging #775 alone would send new sign-ups to dead links. Merging #762 first is safe by itself.

**Why #820 first:** #775&rsquo;s delete, restore and consent buttons call database functions that do not exist until #820 is applied.

---

## 7. Phone checklist (DRAFT: the orchestrator walks each step first)

Use a **test account** (an address ending `@test.bachatacalendar.com`) so an admin can wipe it after. Do not use your real account.

1. **/privacy and /terms** &mdash; open both from the footer. See: real text, contact support@bachatacalendar.co.uk, &ldquo;hidden&rdquo; and &ldquo;30 days&rdquo; in the deletion part, no sideways scroll.
2. **/auth, Sign up** &mdash; enter the test address, tap send. See: &ldquo;By continuing you agree to the Terms and Privacy Policy&rdquo; with working links. Type the e-mailed code; it should say &ldquo;Checking code&rdquo; and then take you through.
3. **/account/settings** &mdash; tap &ldquo;Sign out of all devices&rdquo;. See: you land on the home page signed out. (Optionally first sign in on a second device: it should be signed out too.)
4. **Delete** &mdash; sign in again, go to Settings, then Delete account. Read &ldquo;What happens&rdquo;, confirm. See: a &ldquo;deleted&rdquo; page, and you are signed out. Open the home page: your profile should not appear in public lists.
5. **Restore** &mdash; at /auth sign in with the same address. See: &ldquo;Welcome back, your account is restored.&rdquo; Tap Continue. Your profile is visible again.
6. **Wipe the test account** &mdash; in admin, Test accounts, Reset, confirm. See: &ldquo;That address can now sign up as a new account.&rdquo;

---

## Appendix (developers)

**Website #775** (`claude/account-grid`, head `d9ac066`; base of these slices `b58f39d`)
- Slice 3a+3d (sign-out, settings, delete, restore): `1e2dfb0` partial, round-1 fixes `0520f11`, merged `d18a91b`. 36 files at `0520f11`; 1856 lines added.
- Slice 3c (auth screens, consent, funnel): `dd1fe33`, round-1 fixes `41d0472`, merged `3b671e9`. 23 files (all of 3c); 836 lines added.
- Merge handover: `c30e9d3` (4 snapshot diffs were found, then fixed in 3b).
- Slice 3b (gate, deleted-first landing): `9eedb90`, merged `81f16b0`; review fixes `3125138`; handover `d1a2c7d`; cleanup `d9ac066`. 21 files from `c30e9d3` to head.
- Whole branch since `b58f39d`: 71 files, +3282 / &minus;316.
- Perf: `accountDeletion` rides in the `accountRouting` chunk, so no extra first-load requests; no budget raised.
- Contract: `src/lib/__tests__/accountDeletion.contract.test.ts` reads the #820 SQL when an admin checkout is present (`ADMIN_REPO_DIR` or a sibling checkout) and otherwise runs on `fixtures/account-820-contract.json`. CI has no admin checkout, so the SQL-drift half is skipped there.

**Website #762** (`claude/site-legal-pages`, head `a993804`): `f3ec01f` pages and constants (14 files), `db7b328` owner values (6), `a993804` deletion wording (8), `cea39ee` PR body. Code files: `Privacy.tsx`, `Terms.tsx`, `legal/LegalShell.tsx`, `lib/legalVersions.ts`, routes, footer, tests.

**Admin #820** (`claude/account-system-db`, head `f7b5a16`): 21 migrations `20261122140000`&ndash;`20261122370000` (`380000` reserved, unused); edge function `account-erase` rewritten; `account-erase-due` function deleted from the repo; Test accounts screen; real-data report in `claude/account-system-db-verify` (`d6209f5`), `docs/review-packs/account-system-db/VERIFY-REAL-DATA.md`.

**Open items NOT in this train**
- Drop `erase_requested_at` from the dancer-app types (needs a dancer-app-only PR); the `notes.tsx` comment update goes with it.
- Un-skip the terms-version parity test and add a test that /privacy shows the contact constant (after #762 merges).
- A live contract script (`scripts/check-*.mjs`) for the three delete/restore functions once #820 is on prod.
- Make the SQL-drift test bite in CI (check out the admin repo in the unit job).
- Move `accept_terms_v1` out of the dancer-area gate, and a narrow `my_terms_accepted_v1` read (admin).
- `/auth` opened by an already-signed-in session to a hidden account follows its returnTo without the deleted check (not a fresh sign-in).
- Dancer-app: show the end card at 100% (if you want it).
- `AuthStepper` (profile-entry code box) has no consent line or counter.
- Admin: the PR body recorded `migration-version-fresh` red (superseded slice PRs #817&ndash;#819 outranking #820); you report #820 green at `f7b5a16`, so confirm those were closed. Also pending: pre-existing reds in the admin repo (`check_event_truth_v1` wiring, script-convention rules R5/R6), a fresh review of `370000`, DB hook v2 and bot protection (D9, D10), and the owner tasks (DMARC, inbound MX, auth e-mail rate limit).
- `/code-review` was not run by any worker (you type it).
