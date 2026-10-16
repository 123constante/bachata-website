# Handover: Website slice 3a + 3d (sign-out, settings, delete = hide, restore)

Branch `claude/account-grid-3ad`, from `claude/account-grid` @ b58f39d (Website PR #775). No PR opened (per brief:
the orchestrator merges this branch into `claude/account-grid`). Brief: `arc/briefs-dancer-rebuild`
`briefs/account-grid-3ad-delete-settings.md` (sha d510b08).

## Done

**3a, sign-out**
- D6: `useAuth().signOut()` is now **this device only** (`supabase.auth.signOut({ scope: 'local' })`). Before, it was
  the supabase-js default, `global`. `signOut({ everywhere: true })` is the global revoke. It keeps the existing
  "global failed, clear locally" fallback (`signed-out-locally`).
- D1: every successful sign-out also clears the react-query cache (`QueryClientContext`, so a provider rendered
  without a QueryClient does not throw), next to `clearPersonScopedStorage()`.
- Settings > Sign out: a new "Sign out of all devices" control (`settings-signout-all`).

**3d, delete = hide**
- `src/lib/accountDeletion.ts` (PINNED for slice 3b): `deletionLanding(status) -> 'restore' | 'deleted-card' | null`,
  `fetchDeletionStatus()`, `restoreAccount()`, `parseDeletionStatus`, `classifyRestore`, `DELETION_STATUS_KEY`, types.
  It holds no copy, because `lib/accountRouting` (first load on every page) imports it.
- `src/lib/accountDeletionCopy.ts`: every message (`restoreMessage`, `deleteRefusalMessage`), `formatDeletedOn`
  (London date) and `ACCOUNT_CONTACT_EMAIL`.
- `accountSettings.ts`: `ok:true` now means **hidden** (`{kind:'hidden'}`), never erased. Refusals are read by code
  only: `admin_account` / `sole_organiser_owner` (+ blockers) / `already_archived` / `rate_limited`. Anything else
  is `failed`, which shows the generic retry message. `DELETE_REFUSAL_CODES` lives here (see the perf note below).
- Copy: the delete screen ("What happens": hidden now, signed out everywhere, 30 days to undo, ask us for a full
  erase), the ownership screen, the settings home line and `/account/deleted` (the brief's sentence). None of the
  forbidden words remain. Tests assert that on every screen.
- Delete success: `signOut({ everywhere: true })`, then `queryClient.clear()`, then `/account/deleted`.
- Restore: `signInLanding` makes ONE `deletionLanding()` call, before `returnTo`. Without that, a sign-in meant to undo
  a delete would land on a page and leave the account hidden. Both non-null landings go to the new
  `/account/restore` page:
  - pending: `restoreAccount()` runs once, then "Welcome back, your account is restored." and Continue.
  - `admin_archived`: "An admin has hidden this profile ... Contact us", with a mailto link and no Continue.
  - expired (or `restore_window_closed`): the card "This account was deleted on <date>", with "Ask us to restore it"
    and "Ask us to erase it", both mailto links.
  - none: "Nothing needed restoring".
  - a failed read: Try again.
  `ContinueAsPage` reads the status (`retry: false`). If the read fails, the facts get `null` and sign-in carries on
  as before. `/account/restore` is open past the dancer gate (a hidden account has no live profile), and is listed
  in the routes, `catchallClientPaths` and `siteIa` (`accountRestore`).
- Journey grid: `ac.delete.{hide,restore-30,after-30,refused-sole-owner,admin-erase}` are BUILT, with R (build walk)
  and U refs. The `end`/`action` texts now match the owner decision (kept, never auto-erased). JOURNEY-GRID.md rows
  updated to match. `check:journey-grid` reports OK.

**Perf note.** At first, `accountDeletion` was its own chunk (+3 first-load requests on /faq, /parties and the
landing pages, then +1 on /app). The fix: a static `rpcLoose` import, the copy moved to `accountDeletionCopy`, and
`DELETE_REFUSAL_CODES` moved into `accountSettings`. Now `accountDeletion` rides in the `accountRouting` chunk, and
`check:bundle-budget`, `check:first-load-requests` and `check:chunk-cycles` are green with NO budget raised.

## Contract (admin #820, branch `claude/account-system-db`, not applied to prod)
Pinned by `src/lib/__tests__/accountDeletion.contract.test.ts`, which cites each file and line:
- status keys `state` / `requested_at` / `restore_until`: `20261122140000_account_delete_hide_v1.sql:41-59`
- restore codes: `20261122210000_account_delete_hide_review_fixes_v1.sql:151,155,159,166`
- delete refusals: `20261122310000_account_delete_hide_takeover_v1.sql:123-191`
- edge function: `supabase/functions/account-erase/handler.ts:25-33,50,77`

The brief says "expired (deleted_at)". The SQL has no `deleted_at`: the date is `requested_at`, and that is what the
deleted card shows.

## Red-first (tests against the unfixed base b58f39d, same 9 test files copied in)
- Base: `Test Files 9 failed (9) / Tests 70 failed | 268 passed (338)`. The three new files (lib, contract, restore
  screen) fail to load there because their modules do not exist. Among the failures: `accountSettings.test.ts >
  409 sole_organiser_owner + blockers` (old `blocked` kind), the 5 sign-out scope / query-cache tests, the 11
  delete-copy / refusal / all-devices tests, and the 44 deletion-landing rows.
- This branch: `Test Files 9 passed (9) / Tests 409 passed (409)`.

## CI steps run locally (command, exit code)
| Command | Exit | Note |
|---|---|---|
| `bash bin/check-integrity.sh` | 0 | `npm run lint` shows this link as exit 126 only because the script has no exec bit in this checkout (CI runs `chmod +x` first) |
| `npm run lint` (chain) | 1 | 17/18 links green; the one red is the exec-bit 126 above; eslint skipped by the chain |
| `npx eslint <changed files>` | 0 | 0 errors; 3 warnings in useAuth.tsx that were already there |
| `npm run typecheck` | 2 | 96 errors, none in a changed file. Already there: base tsc shows 100. CI typecheck.yml does not run tsc |
| `npm run check:rpc-typing`, `check:wallclock-brand` | 0 | |
| `check:legacy-tables`, `check:legacy-program-rpcs`, `lint:architecture`, `check:mojibake(:self-test)` | 0 | |
| `AUDIT_STRICT=1 npm run check:images`, `check:image-widths(:self-test)` | 0 | |
| `check:plan-hygiene:self-test`, `check:workflow-artifact-policy`, `prove:entry-point` | 0 | |
| `check:journey-grid`, `check:journey-grid:self-test` | 0 | 85 rows, the 5 `ac.delete.*` rows covered |
| `check:dancer-area-isolation` (+ self-test) | 0 | after reverting the dancer-app type edit (see Left 1) |
| `node scripts/check-script-conventions.mjs`, `check-migration-stamps.mjs` | 0 | |
| `npm run build` | 0 | |
| `check:bundle-budget`, `check:first-load-requests`, `check:chunk-cycles` | 0 / 0 / 0 | measured on a plain `npm run build` after the perf fix. A later re-run read `build/` as left by the Playwright build-qa build (fake Supabase env) and showed 1 / 1. That re-run is NOT conclusive: re-run on a fresh `npm run build` (Next steps 1) |
| `npm run test:unit` | 1 | 6 files / 59 tests red, IDENTICAL on base b58f39d (organiser dates, contract tests that need a live DB, integrityCouldNotRun); everything else green, all touched suites green |
| `npx playwright test -c playwright.build.config.ts` (full) | 1 | 57/59; the 2 `public-journeys` failures pass when re-run alone (load flake) |
| `account-delete.build.spec.ts` (new) | 0 | 7/7, screenshots regenerated from the final code |
| `npm run test:e2e` | 1 | 143 passed. The account-settings failures were real (a tap target, old copy); fixed and now green (21/23 of account-settings + dancer-home). The 2 left are in `dancer-home`, and the base fails 3 there |

## Screenshots (390x844, PRODUCTION build, mocked RPCs)
`docs/handover/shots-3ad/` holds 01 delete screen, 02 deleted page, 03 refused (sole owner), 04 refused (rate
limited), 05 restored banner, 06 admin-archived, 07 deleted card, and 08 settings with "Sign out of all devices".
They come from `tests/e2e-build/account-delete.build.spec.ts`.

## Next steps
1. `npm run build && npm run check:bundle-budget && npm run check:first-load-requests` on this head, so the perf result is confirmed on the final code.
2. `/code-review` (the owner types it), then the merge into `claude/account-grid`.
3. Settle Left 1 and Left 2.

## Left / needs orchestrator or owner
1. **`erase_requested_at` NOT dropped from the dancer-app types (brief item).** Touching `src/modules/dancer-app/`
   makes this a "dancer-area PR" for `check:dancer-area-isolation`. In that mode `AccountSettings.tsx` and
   `accountSettings.ts` are PROTECTED: 35 violations, measured. The brief requires changing both, so the two items
   cannot ship in one PR under the guard. Next step: a separate dancer-app-only change removes the field from
   `api/types.ts`, `api/rpc.ts` (`str(data.erase_requested_at)`) and `api/fixtures.ts` (the `eraseRequested` fixture
   and its line in `tests/client/dancerAppApi.test.tsx`). The field is always null today, so leaving it is harmless.
2. **NEEDS OWNER: the contact address.** No `/privacy` page exists (`/privacy` is not a route), and the repo names
   no mailbox. `ACCOUNT_CONTACT_EMAIL = "privacy@bachatacalendar.co.uk"` in `src/lib/accountDeletionCopy.ts` is a
   placeholder on the site's domain. Confirm the mailbox exists (or change that one constant) before #820's
   step 0 gate is called met.
3. Deploy order: #820's hard gate ships the new `account-erase` in the same window as this Website change. In that
   window an old erasing deploy answers `{ok:true}` without `hidden`. The client treats it as hidden: the account is
   gone from view either way, and "failed" would invite a retry that can only fail.
4. "Sign out of all devices" when the global revoke fails but the local sign-out works (`signed-out-locally`): this
   device is signed out and the page goes to `/`, but nothing tells the person their other devices may still be
   signed in. Same behaviour as the existing sign-out; a known gap.
5. `/code-review` was not run (the owner types it). No review stamp exists. Review rounds are the orchestrator's.
6. No live DB contract script (`scripts/check-*.mjs`) for the three RPCs yet: #820 is not applied, so it would be
   red. Add one once #820 is on prod.

## Verified
- Unit: the new lib, contract and restore-screen tests, plus the updated settings, sign-out, Continue-as, routing
  and regression snapshot tests, are all green. Red-first output is quoted above.
- Production build plus the 7 build walks at 390x844 (mocked RPCs), with screenshots.
- Journey grid green, isolation guard green, perf budgets green with no allowance raised.

## Not verified
- Real data: #820 is not applied to any DB this worker can reach (Supabase is read-only, and the brief gives the
  real-DB check to the orchestrator once #820 is on a branch DB). The status / restore / delete shapes are the SQL's,
  read from source, not from a live call.
- GitHub Actions: no PR, so no checks ran. The local table below is the fallback.
- Phone test, axe: not run (no axe job applies to these routes in `.github/workflows`).
- `check:doc-weight`, `check:og`, `check:seo`, `synthetic:ssr` and lighthouse need a preview deploy or
  `GITHUB_REPOSITORY`. The DB contract-check scripts need live DB secrets. None of these ran.

## Round 1 fixes (review `docs/review-packs/account-grid/REVIEW-3AD.md` on `claude/account-grid-3ad-review`)
Worker ticket dt_0e3e1bac7782. Started from head 1e2dfb03 (as the brief expected). The Left list above is
superseded where this section says so (Left 2 and Left 4 are fixed here).

### What changed, per finding
- **B1 (returnTo sign-in never restored).** The deletion check moved OUT of `signInLanding` and INTO the sign-in
  callback: `pages/AuthCallback.tsx` calls `signInDeletionTarget()` (new, `lib/accountDeletion.ts`) right after the
  self-claim, before any returnTo (link or stashed) is followed and before the profile read. Every real sign-in
  (magic link, and the code step, which hands over to `/auth/callback`) passes through there. A deleted account
  goes to `/account/restore?returnTo=<sanitised>`; the restore page's Continue now goes to that returnTo (else
  `/account/continue`). A failed status read carries on as before. `ACCOUNT_RESTORE_PATH` now lives in
  `lib/accountDeletion.ts`.
- **B2 (false "signed out everywhere").** `signed-out-locally` on "Sign out of all devices" now raises a toast with
  `OTHER_DEVICES_NOT_SIGNED_OUT` ("This device is signed out, but we couldn't reach the server to sign out your
  other devices. Sign in and try again.") before going to `/` (the page ends there: AuthGuard). The delete flow
  passes `{ otherDevicesSignedIn: true }` to `/account/deleted` for any outcome but `signed-out` (including a
  thrown sign-out) and that page shows the same words.
- **S1.** `ACCOUNT_CONTACT_EMAIL = "support@bachatacalendar.co.uk"`, the NEEDS OWNER note dropped; a test pins it
  and that no other source file spells a `@bachatacalendar.co.uk` mailbox. (#762's /privacy page is not on this
  branch, so the "/privacy names the same constant" test is queued: see Left R1-3.)
- **S2.** `src/lib/accountRouting.ts`, `ContinueAsPage.tsx`, `profiles.test.tsx`, `accountRouting.test.tsx` and
  `accountSidesRouting.test.ts` are back to base b58f39d byte-for-byte: ZERO edits in slice 3b's files (the brief
  allowed one, in signInLanding; B1's fix made it unnecessary). A test pins that accountRouting and Continue-as do
  not import `lib/accountDeletion`, that AuthCallback runs the check, and that `/account/restore` is not behind
  `DancerProfileGate`.
- **S3.** `accountDeletion.contract.test.ts` now READS the key names, states, restore codes, refusal codes and the
  rate window from the admin SQL: the last `CREATE OR REPLACE FUNCTION` of each function across the admin
  migrations (from `ADMIN_REPO_DIR`, else a sibling `../bachata-admin` or `../bachata-admin-11april`). The parsed
  facts are pinned in `src/lib/__tests__/fixtures/account-820-contract.json`; with an admin checkout present a
  rename in the SQL OR drift from that JSON goes red. Without one (this repo's CI), the drift test is skipped and
  the client half runs on the JSON (honest limit; Left R1-2).
- **S4.** "You've tried this several times. Please wait 24 hours and try again." (`_member_rate_check_v1(...,
  interval '1 day')` is rolling). The contract test also ties the copy to the window parsed from the SQL.
- Notes N1-N4: unchanged (N2's "Back to the calendar" on the deleted card not added: outside the findings).

### Red on 1e2dfb03, green after
New/changed test files copied onto a 1e2dfb03 worktree (`AuthCallbackDeletion.test.tsx`,
`accountReviewRound1.test.ts`, `AccountSettings.test.tsx`):
```
1e2dfb03:  Test Files  3 failed (3)       Tests  16 failed | 50 passed (66)
  B1: 6 x "AuthCallback: a deleted account restores before anything else" (pending|expired x link returnTo|stashed|none)
      + "/account/restore?returnTo=%2Fevent%2Fe1 -> Continue to /event/e1"
  B2: settings signed-out-locally; delete signed-out-locally; delete failed
  S1: is support@bachatacalendar.co.uk
  S2: accountRouting / ContinueAsPage do not import lib/accountDeletion; the sign-in callback runs the check
  S4: names 24 hours, never tomorrow; refused rate_limited at the last moment (AccountSettings)
this head: Test Files  3 passed (3)        Tests  66 passed (66)
```
S3 (mutation: `'restore_until'` renamed to `'restore_by'` in a copy of `20261122140000_account_delete_hide_v1.sql`):
```
NEW test vs mutant SQL (ADMIN_REPO_DIR=mutant):   Tests  2 failed | 11 passed (13)
OLD 1e2dfb03 test vs mutant SQL:                  Tests  13 passed (13)      <- the reviewer's point
NEW test vs real SQL (bachata-admin claude/account-system-db @ f7b5a16): Tests 13 passed (13)
NEW test, no admin checkout (CI shape):           Tests  12 passed | 1 skipped (13)
```

### Commands run on this head (round 1)
| Command | Exit | Note |
|---|---|---|
| `npm run build` (production) | 0 | |
| `npm run check:bundle-budget` | 0 | all routes within budget, none raised (auth 292.1/310 KB) |
| `npm run check:first-load-requests` | 0 | |
| `npm run check:chunk-cycles` | 0 | |
| `npm run lint` (chain) | 0 | after `chmod +x bin/check-integrity.sh` (CI does the same; mode not committed); eslint link informational |
| `npx eslint <10 changed files>` | 1 | 1 error `AuthCallback.tsx:78 no-explicit-any` (`session: any`, identical on base b58f39d:77) + 2 old warnings; nothing new |
| `npm run typecheck` | 2 | 96 errors, none in a changed file; same 96 as 1e2dfb03 (base b58f39d: 100) |
| `npx vitest run --pool=forks` (whole tree, incl. EdgeTtl) | 1 | 79 failed: 20 were the `accountSettings.today` snapshot (address + rate copy only, updated: 22 snapshots, diff checked line by line); the other 59 in 6 files = the base's known set (DatePage 8, levelsByType 36, eventViewCompat 5, integrityCouldNotRun 5, occurrenceProgram 2, publicEventPageLineup 3) |
| `npm run check:journey-grid` | 0 | 85 rows |
| e2e: see below | | |
| `npx playwright test -c playwright.build.config.ts tests/e2e-build/account-delete.build.spec.ts` | 0 | 7/7 on the PRODUCTION build. The 3 restore walks now sign in through `/auth/callback?mode=signin&returnTo=%2Fparties` and assert `/account/restore?returnTo=%2Fparties` (B1 end to end); screenshots 01-08 regenerated (the cards now show support@) |
| `npx playwright test tests/e2e/dancer-home.spec.ts tests/e2e/account-settings.spec.ts` (head) | 1 | 21 passed, 2 failed: `dancer-home:93` (unfinished dancer, gated Finish screen) and `dancer-home:168` (unfinished organiser at /account/o). account-settings all green |
| same, on base b58f39d (worktree) | 1 | 22 passed, 1 failed: `dancer-home:168`. So :168 is inherited |
| `dancer-home.spec.ts:93` alone, head / base | 0 / 1 | head 2/2 passed; base failed both viewports. :93 is timing-flaky on BOTH (load), not this change. The "3 failures on base" in the brief did not reproduce as 3 this run: 1 in the full run, 2 when :93 is run alone |

Also: the account-related unit suites (`src/pages/__tests__`, `src/lib/__tests__/account*`, `src/components/account`,
the settings snapshot) re-run after the snapshot update: 683/684, the one red `DancerFirstGate.matrix` row passes
alone (114/114) and in the whole-tree run; it went red only while Playwright was loading the machine.

### Left after round 1 (for the orchestrator / slice 3b)
- **R1-1 (slice 3b).** `src/lib/accountRouting.ts` and the Continue-as page carry NO deletion logic now (base
  b58f39d). The deletion check lives in `pages/AuthCallback.tsx` (`signInDeletionTarget`, lib/accountDeletion).
  3b must NOT re-add it to `signInLanding` (a second copy), and must keep `/account/restore` out of
  `DancerProfileGate` (pinned by `accountReviewRound1.test.ts`). `isDancerGatedPath('/account/restore')` is `true`
  at base; it is reached only by FinishProfile's returnTo, which never carries /account/restore today. If 3b ever
  gates by path, add the exemption there.
- **R1-2 (S3, CI).** This repo's CI has no admin checkout, so there the SQL-drift test is skipped and the client
  half runs on `fixtures/account-820-contract.json`. Two ways to make it bite in CI: check out
  `123constante/bachata-admin` in the unit job with the existing `ADMIN_READ_TOKEN` secret and set
  `ADMIN_REPO_DIR`; and (the reviewer's) a live `scripts/check-*.mjs` in `db-contract-check.yml` calling the three
  RPCs once #820 is applied. Neither is in this PR.
- **R1-3 (S1).** When #762 (/privacy) merges into this line, add a test that the /privacy page renders
  `ACCOUNT_CONTACT_EMAIL`. Not possible here: the page is not on this branch.
- **R1-4.** `/auth` opened by an ALREADY signed-in session (another device that stayed signed in to a hidden
  account) follows its returnTo without the check: that is not a sign-in. Every fresh sign-in goes through the
  callback.
- **R1-5.** After a delete whose sign-out returned `failed` (rare: local sign-out also failed), `/account/deleted`
  shows the notice, but its first line still says "you're signed out". Acceptable; noted.
- Review round 2 is the orchestrator's (user-facing change: two rounds). `/code-review` not run by this worker.

### Verified (round 1)
- Each finding's failure reproduced red on 1e2dfb03 and green here (outputs above), including the S3 mutation.
- Production build + bundle budget + first-load requests + chunk cycles green on this head.
- B1 end to end on the production build (callback with returnTo -> restore -> Continue target), 390x844.
- S3 parsed against the real #820 SQL (bachata-admin `claude/account-system-db` @ f7b5a16).

### Not verified (round 1)
- Real data: #820 is still not on a DB this worker can reach; shapes come from the SQL source. No Supabase query run.
- GitHub Actions: no PR (brief), so no checks ran; the table above is the local fallback.
- The toast on "/" after a `signed-out-locally` (B2, settings path) is asserted as the call the page makes, not as
  pixels in a browser (the settings e2e mocks a successful global sign-out).
- Phone test: not run.
