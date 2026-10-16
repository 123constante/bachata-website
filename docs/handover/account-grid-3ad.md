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
