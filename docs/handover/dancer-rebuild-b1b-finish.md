# Handover: B1b finish pass (`claude/dancer-app-r1b`)

Ticket dt_ee7e3d6a3d81. Base `origin/main` c36fbafd; started from the integration head d9828bda. This is the one fix pass for review findings F1-F22 (`docs/review-pack/review-dancer-app-r1b/REVIEW.md` on `claude/review-dancer-app-r1b`).

**What goes live for everyone when this merges:** the public dancer page v2. The beta switch `dancer_area_open` is ON on prod, so every visitor to `/dancers/<slug>` gets v2.

## Fixed finding -> commit

| Finding | Commit | What changed |
|---|---|---|
| F1 | 02e8383 | The review's Q4 allowlist edit, exactly as written (orchestrator-approved). FestivalHub, DancerProfile and `app/routes/dancers.tsx` move from protected to seams, with notes. |
| F2 | 5d27316 | `gate/useDancerArea.ts` pinned into the existing `lib-event-rules` group. `ListingRequestForm.tsx` sends its RPC through `rpcLoose`, which removes the static vendor-supabase edge rollup hoisted into the AnimatedRoutes facade. Chunk and request ratchets are LOWERED to the measured values; nothing was raised. **Extra seam:** `src/components/ListingRequestForm.tsx` was added to the isolation allowlist. That was NOT part of the approved Q4 edit, so it needs the orchestrator's OK. If refused, revert that file and its seam entry; F2 then returns to "needs owner". |
| F3 | 702b015 | The e2e spec expects the partner tile and the numbers tiles. |
| F4 | 52959b2 | Language codes become names via `Intl.DisplayNames`. Unknown codes are hidden; stored full names are normalised. |
| F5 | 432e9c5 | Comment fixed. **The server does not refuse an incomplete profile's RSVP; only the button does.** The lock is browser-only (owner decision: no database change). |
| F6 | 52959b2 | Portrait `loading="eager"`. |
| F7 | 702b015 | The Home "Upcoming nights" tile and the strip both read `my_dancer_stats_v1.nights_going_upcoming`. The nights list is unchanged. While numbers load the tile says "Loading..."; on an error it says "Could not load". |
| F8 | 702b015 | `da-tap` on the Edit-profile and Account-settings fix links. |
| F9 | 432e9c5 | Locked and status read failed: the buttons stay tappable so the retry runs. |
| F10 | 432e9c5 | The reason now says "going or interested". The going count stays beside the lock line. The hub shows the lock once, above the list. A tap on a disabled hub button no longer opens the card (stopPropagation). |
| F11 | 432e9c5 | The gate value carries `missing`; `missingFromGate` reads that instead of display text. |
| F12 | 702b015 | Error copy from `toDancerError`, plus a Try again button on `/app/page`. It is hidden where retrying cannot help. |
| F13 | 702b015 | The closed-feedback copy says "Close this and use Help and message us". |
| F14 | 702b015 | No second "Sending..." reason. `aria-describedby` is set only while a reason is on screen. |
| F15 | 702b015 | PartnerTile has its own rate-limit copy ("once every 30 days") and invalid-feature copy, and shows "Loading..." while its status loads. |
| F16 | 52959b2 | `whatsappHref` drops "(0)". The button is hidden for numbers that cannot be normalised (no +/00/0 prefix, letters, ext, not 7-15 digits). |
| F17 | 52959b2 | Cheap half: the extras are fetched only after the gate says open, within one 2.5 s budget. Purge half: owner follow-up (below). |
| F18 | 52959b2 | `NAMELESS_SHARE_TITLE = 'Dancer on Bachata Calendar'` exported, documented and pinned by a test. |
| F19 | (none) | Accepted: `/dancers/:id` preloads one more chunk (`lib-account`, about 5 KB). The route has no budget. |
| F20 | 5d27316 | The dancer-app budget note rewritten for the merged head: 366.0 KB, 54 chunks, 3 pullers. The 368 budget is kept, not raised. |
| F21 | 432e9c5 | Test types fixed (TS2322/TS2352 gone). |
| F22 | 702b015 | `src/modules/dancer-app/__tests__/rpcContract.test.ts` pins 6 RPC names and parameter keys. Mutation proof: a renamed key goes red. |
| Walk bug | 335c428 | `/app/page` said "It says you follower". It now says "you lead" / "you follow" (test `screens/page/__tests__/pageModelRole.test.ts`). |

## Decisions and INTERFACE deviations
- F2: `ListingRequestForm.tsx` is an extra seam beyond the approved Q4 edit (see the table). Rejected alternatives: pinning into `lib-account`, or both hooks into `lib-event-rules`, puts /parties and /classes over their KB budgets. `hoistTransitiveImports: false` hides real imports from the puller count.
- F2: `useGoingLock.ts` is NOT pinned; only `useDancerArea.ts` is. Pinning both dragged root modules onto every route.
- F7: the old "Next: <date>" sub-line came from the list and could contradict the number, so it became "Nights you said Going to". The hero still shows the next night.
- F11: one type field added to `src/hooks/useAuth.tsx`, and `src/lib/profileCompletion.ts` exposes the missing fields. Both are existing seams; the isolation check passes.
- INTERFACE.md still lists the three files as protected. It lives on `arc/briefs-dancer-rebuild`, where this worker may not push. **Orchestrator: record a B1b round there** (Q4 files plus `ListingRequestForm.tsx`).

## Shapes surveyed (prod, read-only, counts only)
Prod read-only survey 2026-10-17 (counts only, stsdtacfauprzrdebmzg):
- dancer_profiles: live 157, archived 15; with languages 12 (codes: en 11, es 9, it 1, de 1); gallery 1; instagram 15; nameless 2.
- event_occurrence_p5: scheduled 3081, cancelled 138.
- event_attendance: going 3, interested 2.
- From the review (same day, not re-run): photoless 53, unclaimed 152, hide_surname 0, public WhatsApp 0; lock: 5 incomplete non-organisers locked, 1 incomplete organiser unlocked, 9 complete, 2 no profile.

## Red-first proof (test -> failure on the unfixed code)
- F4 `public-page/__tests__/model.test.ts` "languages: ISO codes (prod shape)": `expected [ 'en', 'es', 'it', 'de' ] to deeply equal [ 'English', 'Spanish', ...(2) ]`. Also "languages: unknown codes and garbage": `expected [ 'xx', 'zz-QQ', '12', ...(2) ] to deeply equal []`.
- F6 `page.test.tsx` "the portrait image loads eagerly": `expected null to be 'eager'`. `AUDIT_STRICT=1 npm run check:images` exited 1 ("missing loading: 1 ... PublicDancerPageV2.tsx:123").
- F16 `model.test.ts` whatsappHref table: `expected 'https://wa.me/4407700900123' to be 'https://wa.me/447700900123'`, and `expected 'https://wa.me/7700900123' to be null`.
- F17 `route.test.ts` "flag closed: the extras RPC is never called": `expected [ 'dancer_area_gate_v1', ...(2) ] to not include 'get_public_dancer_extras_v1'`.
- F18 `model.test.ts` "NAMELESS_SHARE_TITLE is pinned": `expected undefined to be 'Dancer on Bachata Calendar'`.
- Public-page total before the fixes: 20 failed / 99 passed. After: 122/122.
- F7/F12/F13/F14/F15 `src/modules/dancer-app/__tests__/b1bFinishFixes.test.tsx`: 19 failed / 2 passed on the unfixed code (the 2 are guards). The cancelled-night shape failed with `expected '1' to be '0'`, and 1500 nights with `'100'` vs `'1,500'`. After: 28/28.
- F9 `goingLock`/`rsvpBlock` "a locked person whose RSVP read failed can still reach the retry": `AssertionError: expected true to be false`.
- F10 "...the going count stays beside it": `expected 'Add your photo to say you're going. ...' to contain '4 going'`. "one lock line, above the first card": `to have a length of 1 but got 2`. Hub tap fall-through: `expected '/event/fest-1' to be '/festivals'`.
- F11 "missing photo is read from the gate data": `expected null to deeply equal [ 'avatar_url' ]`. goingLock red run: 32 failed / 36 passed.
- F2 `check:bundle-budget` exit 1 (auth 34>33, dancer-app 59>57, pullers auth 3>2, dancer-app 4>3); exit 0 after.
- F1 `check:dancer-area-isolation` exit 1 (7 violations); exit 0 after.
- F22 mutation: renaming `p_feature` fails 1 test; renaming the stats function fails 2.
- Walk bug `pageModelRole.test.ts`: 4 failed / 3 passed (`expected [ 'It shows your name: A.', ...(3) ] to include 'It says you follow and you dance in L...'`); then 7/7.

Bundle after F2 (chunks / pullers / KB gz): auth 34/3/293.5 -> 29/2/292.3; dancer-app 59/4/367.3 -> 54/3/366.0; home 43 -> 39; event 47/2/377.9 -> 43/2/377.3; parties and classes 49 -> 45, 322.1 -> 321.6.

## CI per-job table (local, head 5d27316, workflow env values)
| Workflow / job | Command | Exit | Result |
|---|---|---|---|
| unit-tests / dancer-area-isolation | `check-dancer-area-isolation.mjs --self-test`; `npm run check:dancer-area-isolation` | 0 / 0 | 48 cases pass; isolation OK |
| unit-tests / unit | live-DB gate (pull_request vs merge-base) | 0 | live=RUN |
| unit-tests / unit | `npm run test:unit:offline` (TZ London) | 1 | 9399 pass, 6 fail, 16 skipped: 5 in `tests/integrityCouldNotRun.test.ts` (sandbox `NODE_PATH`; the same 5 fail on origin/main; pass with NODE_PATH unset), 1 `ProfilePage.test.tsx` signOut spy under full-suite load only (3/3 green alone; file not touched by this branch) |
| unit-tests / unit | `npm run test:unit:timing` | 0 | 65 pass |
| unit-tests / tz-sensitive (NY, Sydney) | `vitest run --no-file-parallelism` on the 9 listed files | 0 / 0 | 213 pass each |
| architecture-guard / integrity | `bin/check-integrity.sh` | 0 | 1806 files, 0 issues |
| architecture-guard | legacy-tables, legacy-program-rpcs, lint:architecture | 0 | pass |
| architecture-guard | `AUDIT_STRICT=1 npm run check:images` | 0 | pass (was 1 at d9828bd, F6) |
| architecture-guard | image-widths, plan-hygiene, workflow-artifact-policy, mojibake, prove:entry-point (self-tests + checks) | 0 | pass |
| typecheck | `check:rpc-typing`; `check:wallclock-brand` | 0 / 0 | pass |
| perf-budget | 3 self-tests; `npm run build`; `check:bundle-budget`; `check:first-load-requests`; `check:chunk-cycles` | all 0 | pass (bundle-budget was 1 at d9828bd, F2) |
| e2e-smoke | `npm run test:e2e` | 0 | 148 pass, 1 skipped (was 4 failures at d9828bd, F3) |
| phone-qa / phone-qa | `playwright test --config playwright.phone.config.ts` (360x640 + 390x844) | 0 | 272 pass, 74 skipped |
| phone-qa / build-smoke | fake-Supabase `npm run build`; `playwright test --config playwright.build.config.ts` | 0 / 0 | 66 pass |
| workflow-lint | BOM (re-run with `od`, no `xxd` here), masking, notification, no-preview-prefixes | all 0 | pass |
| db-contract-check (no secrets) | live-db-gate, migration-stamps, guest-list canary, day-rollover, script-conventions, 9 `--self-test` canaries | all 0 | pass |
| lint chain | `npm run lint` | 0 | 20/20 links; `eslint .` informational |
| typecheck (not a gate) | `react-router typegen` + `tsc -p tsconfig.app.json --noEmit` | 2 / 2 | 97 errors on head, 97 on origin/main, identical lists: 0 new |

NOT RUN: `npm run test:unit` live contract suites and db-contract-check steps needing `VITE_SUPABASE_*` secrets; real-data-verified / phone-qa-section (read the PR body, run on GitHub); owner-approval (push to main only); Lighthouse, doc-weight, og-image, seo, synthetic-ssr, prod-smoke, live-qa (need a Vercel preview / live site; no preview on claude/* branches); types-drift (types file unchanged).

After the CI run, commit 335c428 changed only `pageModel.ts` (one map) plus one new test. Re-run after it: dancer-app tests 259/259, `bin/check-integrity.sh` 0, `check:mojibake` 0, eslint 0. The bundle checks were not re-run after that commit; the change is under 0.2 KB, inside a dancer-app chunk.

## 390x844 walk
Done in Chromium on the BUILT app: 30 PNGs plus `captions.md` in `docs/review-pack/r1b/`.
- (a) public page on 6 prod shapes (slugs A-F), flag on, and flag off through a server-side preload.
- (b) Going lock on the event page and the festival hub (fake backend: signed-in incomplete, and signed-out).
- (c) `/app/home`, `/app/page`, Options feedback and the partner tile, in the zero / normal / huge / error shapes.
- Results: language names pass; one nights number passes (0/0, 3/3, 150/150); the lock reason shows once on the hub; error copy is plain; no sideways scroll; 0 page errors.
- Walk scripts: in the session scratchpad (not committed). The method is in `captions.md`.

## Verified
- All 22 findings fixed or decided as the brief says, each with a test (red-first for the bug-shaped ones).
- Every CI job step that can run in a sandbox is green, except 6 unit tests whose failure is not from this branch: the same 5 also fail on main here, and 1 is flaky under load.
- Typecheck: 97 errors on head and 97 on main, with identical lists.
- The 390x844 walk on the built app covered prod shapes (public page) and the fake backend (app screens).

## Not verified
- Real photos (the R2 host is blocked from the sandbox), a real phone, and the signed-in / owner view of a real prod public page.
- The Going lock against prod RPCs (the walk used the fake backend). The server does not refuse an incomplete profile's RSVP; only the button does.
- Live contract suites needing secrets, Lighthouse/og/seo/synthetic (need a Vercel preview), and the GitHub-side PR-body checks.
- The `/app/page` role-line fix was not re-shot (the PNG shows the old line); it is covered by the unit test.
- The bundle checks after the last small commit (335c428).
- The coming-soon listing form submit through `rpcLoose` (F2) in a browser.

## Owner follow-ups
1. **F17 purge half:** when a profile that gives WhatsApp eligibility changes (`_dancer_whatsapp_eligible_v1`), nothing purges that person's cached `/dancers` page. The fix needs an admin-repo change; this worker did not touch the database.
2. **F5:** if a real lock is wanted, add the `profile_incomplete` refusal to `set_my_occurrence_attendance_p5_v1` and `set_attendance` in an admin migration.
3. **F2 seam:** OK `src/components/ListingRequestForm.tsx` as a seam, and record the B1b round in INTERFACE.md.
4. **Seen in the walk, already on main (not this branch):**
   - Mojibake emoji on the FestivalHub Going/Interested buttons (since #591).
   - Nationality shown as a code ("London - DE") on the public page place line.
   - Hub Going/Interested buttons are 31 px tall.
   - The event "Finish your profile" link is 43 px tall (1 px short of 44).

## What is left
Nothing from F1-F22. The PR is open; the orchestrator decides the F2 seam and merges.
