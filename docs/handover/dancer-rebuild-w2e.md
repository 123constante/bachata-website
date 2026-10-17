# Dancer rebuild W2e: Options (`/app/options`) handover

Branch `arc/dancer-app-w2e`, from `claude/dancer-app-r1a` (9fc95715). No PR (orchestrator merges). Class: BUILD-visual.

## What shipped
- `screens/options/OptionsScreen.tsx` (real screen, default export kept), `optionsModel.ts` (one pure mapping: rows, disabled reasons, share URL, message-us URL, platform detection, install steps, clipboard).
- Tests: `screens/options/__tests__/OptionsScreen.test.tsx` (40 table-driven tests), `tests/e2e/dancer-app/options.spec.ts` (added BY NAME to `package.json` `test:e2e`).

## BRIEF DEVIATIONS (read these)
1. **`accountSettings.signOut` does not exist** in `src/lib/accountSettings.ts`. The shared path every existing screen uses (DancerHome, AccountSettings, Profile) is `useAuth().signOut()` returning `'signed-out' | 'signed-out-locally' | 'failed'`. Options uses that; failure shows DancerHome's exact copy ("Sign-out did not complete. Check your connection and try again.") with Retry; success navigates to `/`.
2. **No terms/privacy routes exist** (not in `catchallClientPaths.ts` / `siteIa.ts`; `/privacy` is on the known-broken list in `navigateTargetsRoutable.test.ts`). The row renders DISABLED with the reason "The terms and privacy pages are not published on the site yet." Owner: publish the pages, then make it a link.
3. **No "message us" WhatsApp helper exists.** The only direct-chat constant is `WHATSAPP_GET_LISTED_URL` (a prefilled "list my events" message). `messageUsUrl()` re-uses its number by parsing that constant and swaps the message. ORCHESTRATOR: export the number/builder from `src/lib/contactLinks.tsx` and replace the parse (marked in `optionsModel.ts`).
4. **Share URL**: no dedicated helper; it is `SITE_ORIGIN + hrefFor('dancer', profile_id)` (`searchEntities.hrefFor` is the site's one dancer-URL form; `/dancers/:id` redirects to the slug form). `MyDancerEdit` has no slug.
5. **"Browse all events"** goes to `/` (the events feed): the person's city slug is not on `MyDancerEdit` (only the city id and name), and guessing a slug is how dead links happen.
6. **`useMyDancerEdit()`** is not in W1's `api/` yet; the screen runs `useQuery(['my-dancer-edit', userId], fetchMyDancerEdit)` (same key W2-SHARED pins). Swap when W1 exports it.
7. Paused profiles: "Share my page" is disabled with a reason (the public page would not open). Not in the brief; follows "a control that cannot work is disabled with a reason".
8. Teacher/DJ "coming soon" rows appear only for people who have those roles; a pure dancer sees one disabled "Organiser tools" row.
9. `package.json` `test:e2e` edited to add the spec (the README tells screens to); sibling slices will conflict on that one line: take both.

## Verified (sandbox)
| Check | Command | Result |
|---|---|---|
| Unit, this screen | `npx vitest run src/modules/dancer-app/screens/options` | 40/40 pass |
| Red-first mutants | (a) "I run events" for every person; (b) direct `supabase.auth.signOut` | (a) 4 tests red, (b) 3 tests red; both reverted |
| dancer-app + catchall + tests/client | `npx vitest run src/modules/dancer-app tests/catchallClientPaths.test.ts tests/client` | 360 pass, 1 fail: `tests/client/dancerAppApi.test.tsx` fetchGate (W1's file, `api/` untouched by this branch; not investigated) |
| Lint | `npx eslint src/modules/dancer-app/screens/options` | exit 0 |
| Typecheck | `tsc -p tsconfig.app.json --noEmit` | 0 errors in `dancer-app`; ~110 pre-existing errors elsewhere (112 on base incl. none of mine) |
| Build | `npm run build` | exit 0 |
| `npm run pre-ship` | `npm run pre-ship` | FAILED on 2 of its steps, neither from this change: `check:integrity` = `bin/check-integrity.sh: Permission denied` (no exec bit in the sandbox; `bash bin/check-integrity.sh` = ok, 1553 files, 0 issues); `test:unit` = 18 failures in 6 files (`eventViewCompat`, `occurrenceProgram`, `publicEventPageLineup` contract tests need live DB creds; `integrityCouldNotRun`; `reminderBanner.today`; W1's `dancerAppApi` fetchGate). Passed: mojibake, legacy guards, no-social-word, route-boundaries, build:ship, bundle-budget, first-load-requests, chunk-cycles, typecheck ratchet (96 < 106), scoped eslint (0), unit timing. `test:e2e` SKIPPED by pre-ship because of the two failures. |

## Not verified
- **Playwright**: `options.spec.ts` written but NOT RUN to green: in this sandbox the organiser fake does not establish a session (the existing W1 `reachability.spec.ts` `/app/options` test fails identically, redirecting to the sign-in page), so there is nothing to assert against.
- **390x844 screenshots** (`docs/handover/dancer-rebuild-w2e/`): not produced for the same reason. The spec writes them on a run that has a session.
- **Real-data shape survey**: the screen reads only `other_roles` and `is_active`; the 14 named production shapes in `fixtures.ts` (W1's survey) drive the model test. No fresh prod SELECT was run by this worker.
- Real phone, real clipboard permission prompts, real WhatsApp deep link, real sign-out against Supabase.
- Vercel: not used (no token needed).
