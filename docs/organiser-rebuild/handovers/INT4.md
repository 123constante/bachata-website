# INT4 handover -- FIX-SW1 + main into `claude/org-r1-integrate`, matched to the final AW1 contract

Brief: `docs/organiser-rebuild/briefs/INT4.md` (branch `arc/briefs-organiser-r1`, sha 8900448). Ticket dt_8fa87a629059.
Branch `claude/org-r1-integrate` (PR #809). Start head 7d9751c1. `AW1_APPLIED` and `A1_APPLIED` NOT flipped.

## 1. Merges

| step | result |
|---|---|
| `git merge --ff-only origin/claude/org-r1-parity-sw1-fix` (57ec84cc) | **fast-forward**, clean |
| `git merge origin/main` (fddd4f4) | merge commit 1130f4f, ONE conflict: `perf-budgets.json` |
| `git grep -n "<<<<<<<"` | no conflict markers. The only hits are two binary PNGs and two older handovers that quote the command. |
| after all commits: `git merge-base --is-ancestor origin/main HEAD` and `git merge-tree --write-tree origin/main HEAD` | main is an ancestor; the merge tree is clean |

### `perf-budgets.json` resolution

Measured with the perf-budget.yml env (placeholder `VITE_SUPABASE_*`), `npm run build` + `npm run check:bundle-budget`, on the merged tree.

| key | main | integration | kept | why |
|---|---|---|---|---|
| dancer-app `maxFirstLoadGzipKB` | 368 (B1b raise) | 364 | **368** | main changed it. Measured 366.4 KB. |
| chunkRatchet (all 9 routes) | tightened by 4 each by B1b F2 (39/43/29/54/45/45/26/26/26) | 43/47/33/58/49/49/30/30/30 | **main's**, except dancer-app **55** | Every other route measured exactly at main's number. dancer-app measured 55 = main's 54 + the S9 door split (shared `label-*.js` / `city-picker-*.js` chunk, already recorded in the S9 note). |
| pullerRatchet dancer-app | 3 | 4 | **4** | Measured 4. The 4th puller is the split-out `city-picker-*.js` (EditScreen -> city-picker -> static client edge). This is the same S9 cost the integration branch had already bought. **OWNER DECISION still open, per the S9 note:** the alternative is a door-local copy of EmailCodeProof, which the S9 brief forbids. |
| notes | B1b rows | S9 door row | both | The S9 row was appended with this re-measurement. |

`check:bundle-budget` exits 0 on the merged tree.

## 2. AW1 contract (admin PR #838, branch `claude/org-r1-parity-aw1`, head 0abbf14; AW1.md, AW1-fix.md, AW1-fix2.md read)

| item | finding | red-first | fix |
|---|---|---|---|
| a. set_program payload | **Matches.** Stored ids are sent on days, sections and items. No id key on new rows. No id on people. Stored `profile_type` is sent as stored. | new `events/__tests__/int4.aw1.contract.test.ts` passed on the first run. It is a confirmation, not a fix. | none |
| a'. profile_type for a person picked from SEARCH | `organiser_search_people_v1` returns no `profile_type` (prod signature read 2026-10-19: `id, display_name, dj_name, photo_url, city_name, country_code, roles[]`). The type therefore comes from the list the organiser chose ("Search DJs" -> dj, "Search teachers" -> teacher). That is the only chosen type the screen has. RECENT and stored people use their own type. | n/a | Decision: kept. Listed under Needs admin work. |
| b. new refusal copy | **Mismatch.** The three AW1 texts and the three id texts hit the `permission_denied` catch-all or GENERIC. | `selfServe.test.ts` "AW1 programme and organiser refusals": **6 failed / 30 skipped** before the fix | The one shared `COMMAND_COPY` in `shared/selfServeErrors.ts` can now build a message from the match (the session title is clamped to 80 characters). Session delete: "The session "X" has changes on some dates, so only an admin can remove it. Keep it, or ask the Bachata Calendar team to remove it." Id-less or stale ids: "This programme changed since you opened it. Reload the page, then make your change and save again." Organiser consent: "You can only add organiser pages you run. To add another page, ask the Bachata Calendar team." The test table also asserts that no raw code leaks. Now 36/36. |
| b'. the copy promised a delete the server now refuses | **Mismatch.** The Differs card ("Removing a session takes its date changes with it") and the remove confirm ("Any date where you changed this session loses that change too") both described the OLD behaviour. The final AW1 refuses an owner or manager. Found on the walk. | `fixSw1.matrix.test.tsx`: 2 failed (the copy still matched `loses that change`; the source still had `takes its date changes with it`) | One sentence, `CHANGED_SESSION_REMOVE` (programmeSeriesModel), used on both the card and the confirm: "A session you changed on one of those dates can only be removed by the Bachata Calendar team." The SW1 render test that pinned the old copy is updated to the new contract. |
| c. co-organiser picker | **Mismatch.** It searched ANY live organiser page. | `sw1.parity.test.tsx` "Organisers: the add picker offers only pages the viewer runs": **3 failed** (no `org-add-result` / `org-add-empty`) | Link a page now lists only the viewer's own LIVE pages that are not yet linked. The source is `organiser_home_v1` (already loaded by `useSeriesRole`, owner and manager rows) through the pure `addablePages`, and the search is removed. The sheet says `ADD_ONLY_YOURS`, or `ADD_NONE_LEFT` when nothing is left. No new RPC field was needed. `searchLiveOrganisers` is deleted and the parity-matrix row now pins `org-add-note` + `addablePages`. Prod: 5 users run 1 page and 1 user runs 3, so no search is needed. |
| d. cast `profile_type` | **Matches.** `parseRecentPeople` reads `profile_type` and keeps one row per (profile_id, profile_type). A row with no type is dropped, never guessed. `recentFor` puts each type only in its role's list. The `cast` array is not read: the Cast screen builds from the programme tree. | contract test, green | none |
| e. untouched save | **Holds.** A stored tree with ids (the shape of a series with overrides) gives `programCommand` null, so zero commands are sent. | contract test, green | none |

### Other fix

- `consistency.render.matrix.test.tsx` A-S1 (2 tests) had **never passed**: red at 57ec84c too. The fixture took off `day(10)`, but the shared fixture also LISTS a scheduled date on that day, and `takenOffView` rightly never offers a listed date. TAKEN is now `day(24)` (a Friday rule date with no listing). Only the test changed.

## Needs admin work

1. `organiser_search_people_v1` should return `profile_type` per row. That lets a search pick carry the profile's own type instead of the type of the list it was found in (item a').
2. The Website cannot tell WHICH session has per-date changes: the workspace gives only per-date counts. A per-item flag (for example `has_overrides` on program items) would let the editor disable Remove on exactly those sessions with the reason, instead of explaining it on the card and the confirm and relying on the server refusal (b').

## 3. Matrices

`npx vitest run src/modules/organiser`: **112 files, 3517 pass, 2 skipped, 0 fail**. `parity-matrix.test.ts` has 0 `it.todo` (no `it.todo` anywhere in the module). The SW1 rows are green.

## 4. Walk, 390x844, production build, route-mocked fake (`tests/e2e/walk-int4.spec.ts`, throwaway, NOT in the gate list)

Gate off: the shipped build (`VITE_ENABLE_ORGANISER_SELF_SERVE=true npm run build`) gave 3 passed, 1 skipped (the gate-on-only test). Gate on: a throwaway build with `AW1_APPLIED=true` (reverted, never committed) gave 4 passed. Shots are in `docs/organiser-rebuild/walk-INT4/` (`-off` / `-on`):

- 01-programme-empty: a series with 0 items, empty state.
- 02-programme-one: 1 class.
- 03-programme-many-override: 2 classes + a party ending next day + an empty stored section; "Differs on 2 dates" card with the new removal sentence.
- 04-programme-ended: the ended lock reason; nothing editable.
- 05-programme-draft: a draft opens like a live one.
- 06-programme-festival: "Festival days are edited with the platform team for now." (admin-only); read-only day tree.
- 07-details-cast-music: Details with the cast line and music chips.
- 08-organisers: the linked organiser list (gate off: the off reason).
- 09-organisers-add-sheet-on: Link a page offers only "Ritmo Sundays" (a page the viewer manages), never "Salsa Crew" (a stranger page), with the note.
- 10-session-sheet-on: the line-up sheet for a class.

Defect found on the walk and fixed red-first: b' above.

## 5. CI, every job step run in the sandbox

Run on 828e5d3 (the tip before this doc). The later commits only add the handover doc and the e2e fix below.

| job | command | exit |
|---|---|---|
| typecheck | `npm run check:rpc-typing`; `npm run check:wallclock-brand` | 0, 0 |
| (extra) | `npm run typecheck` | 2: 97 errors, the same as the base. The only organiser hit is `edit-in-place/__tests__/TeamPicker.test.tsx(297,36)`, which is pre-existing and not touched by INT4. |
| architecture-guard | `chmod +x bin/*.sh`; `bin/check-integrity.sh`; `check:legacy-tables`; `check:legacy-program-rpcs`; `lint:architecture` | 0 each |
| architecture-guard | `AUDIT_STRICT=1 npm run check:images`; image-widths (+self-test); plan-hygiene self-test; workflow-artifact-policy (+self-test); mojibake self-test + git-grep scan; prove:entry-point (+self-test) | 0 each; scan empty |
| lint | `npm run lint` | 0 (20 of 20 links) |
| unit (London) | `TZ=Europe/London LIVE_DB=false env -u NODE_PATH npm run test:unit:offline` | 0: 407 files, 9847 pass, 18 skip |
| unit | `npm run test:unit:timing` | 0 (65) |
| unit | tz list, New York + Sydney | 0 / 0 (213 each) |
| unit | dancer-area-isolation self-test + check | 0 / 0 |
| organiser module | `npx vitest run src/modules/organiser` | 0: 112 files, 3517 pass, 2 skip |
| perf-budget | 3 self-tests; `npm run build` (perf-budget.yml env); `check:bundle-budget`; `check:first-load-requests`; `check:chunk-cycles` | 0 each. dancer-app 366.4/368 KB, 55 chunks, 4 pullers; event 377.1/381 KB, 43 chunks, 2 pullers; no chunk cycle |
| e2e-smoke | `CI=true npm run test:e2e` (job env) | 0: 156 pass, **2 flaky**, 1 skip. See the e2e note. |
| phone-qa | `CI=true npx playwright test --config playwright.phone.config.ts`; build-smoke (`playwright.build.config.ts`) | 0 (272 pass, 74 skip); 0 (66 pass) |
| workflow-lint | BOM, masking, notification (+self-test), no-preview-prefixes (+self-test) | 0 each |
| ci-budget-guard | `node scripts/check-ci-budget.mjs --self-test` | 0 |
| db-contract-check (offline) | `ci-live-db-gate.mjs --self-test`; `check-migration-stamps.mjs`; `check-guest-list-contract.mjs --self-test` | 0 each |
| misc | `npm run check:mojibake`; `check:pr-mergeable:self-test`; `check-pr-phone-qa.mjs --self-test`; `check:seo:self-test`; `check:og:self-test` | 0 each |
| NOT RUN | lighthouse, doc-weight, `check:og`/`check:seo`/`synthetic:ssr` (need a deploy); types-drift (`SUPABASE_ACCESS_TOKEN`); live DB contract checks (secrets); `check:pr-mergeable` live sweep and ci-budget measure (GitHub tokens); real-data-verified and phone-qa-section guards (read the PR on GitHub; their self-tests ran) | n/a |

**e2e note.** In the first full run, `dancer-home.spec.ts:188` (organiser with a finished dancer profile: the Switch-profile sheet opens the dancer profile) was flaky. On its own, with `--retries=0`, it failed **3/6 on the branch and passed 6/6 on main**, so it is a branch regression.

- **Root cause:** `shell/OrganiserRoutes.tsx` `ShellFallback`, the loading frame, rendered a full `OrganiserShell` with a live Switch-profile button. The frame is thrown away when the page chunk arrives, so a sheet opened from it vanished mid-tap. The bug exists on main too, but there the button is live for about 40 ms. On the branch the R1 account gate (`useAccountGate` waits on `my_account_deletion_status_v1`) widened that to about 250 ms (c712d1a).
- **Fix:** the loading frame draws a 44 px spacer instead of the button, so the header shape is unchanged.
- **Red then green:** 3/6 failed before the fix; 8/8 (and 10/10 in a scratch worktree) passed after.
- **Final full gate on the fixed tree:** `CI=true npm run test:e2e` exits 0: 157 pass, 1 flaky, 1 skip. The remaining flaky test is `dancer-home.spec.ts:168` (unfinished organiser at /account/o: the gate redirect). The same spec's gate-redirect `toHaveURL` also failed or flaked on **main** in 3 repeats (1 failed, 1 flaky), so it is pre-existing and not fixed here. `npm run lint` exits 0, the organiser suite passes 112 files / 3517 tests, and `check:mojibake` exits 0 on the final tree.

## Verified

- The merges and the `perf-budgets.json` numbers, measured.
- Each AW1 mismatch has a red then a green run (b, b', c); a, d and e are confirmed by tests.
- Prod read-only SELECTs (2026-10-19): the search RPC signature, and organiser pages per user (1 page: 5 users; 3 pages: 1 user).
- The 390x844 walk, gate off and on, on a production build.
- The CI steps in section 5, and the e2e regression fix (red, then green).

## Not verified

- The real AW1 server refusing or accepting these payloads end to end. AW1 is not on prod; `organiser_series_cast_v1` is absent there.
- Lighthouse / doc-weight (need a preview deploy), types-drift (needs `SUPABASE_ACCESS_TOKEN`), and the live-DB contract checks (need secrets).
- GitHub's own runs of #809's gates after this push. They were not observed from here, because `gh api` is not allowed.
- Vercel preview: no Vercel token in this sandbox (**needs owner: Vercel token**).

## Decisions

1. perf-budgets: main's tightened ratchets, plus +1 chunk and +1 puller on dancer-app for the S9 split. Measured, not projected.
2. The picker uses data already on screen (`organiser_home_v1`) rather than a new RPC field. The search is gone because the most pages any organiser runs is 3.
3. Copy for a session with per-date changes: told on the card and in the confirm. The Remove control is not disabled, because the Website has no per-item override flag (Needs admin work 2). The server refusal maps to the session-named copy.
4. A search-picked person's type comes from the list chosen (Needs admin work 1). This is not a role derivation from an existing person: `setPersonRole` still never changes the type.

## Is #809 mergeable against main?

After this push, yes by git: `origin/main` (fddd4f4) is an ancestor of the head, and `git merge-tree` against it is clean. That means #809's `pull_request` gates can queue again. Whether they ran green on GitHub was not observed from this sandbox.
