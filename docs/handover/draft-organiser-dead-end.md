# Draft organiser dead end: Send for review, own profile, New event copy

Branch `claude/draft-organiser-send-for-review`. Fixes dead end 1-3 of
`docs/audits/organiser-login-first-run-2026-10-09.md` (step 7a): a new organiser who chose
"create a new organiser" stayed `draft` forever because nothing in the UI could send it, its own
Profile said "not available", and New event refused with no next step.

Class: BUILD-visual. No migration, no admin-repo change, no admin moderation UI change.

## RPC used

`submit_organiser_profile_v1(p_organiser_id uuid)` (admin migration `20261109110000`, D6), already
wrapped by `submitOrganiserProfile` / `useSendForReview`. It admits draft and rejected ->
`pending_review` for an owner or manager (the creator is the owner: `create_organiser_profile_v1`
writes the owner member row), writes the `submitted` audit row, and is EXECUTE for `authenticated`
only (prod ACL re-read 2026-10-09: anon false, authenticated true). Nothing was missing; no
migration needed. `admin_list_pending_review_v1` lists `pending_review`, so a sent organiser now
reaches the queue.

## What changed

- `src/modules/organiser/shared/organiserStatus.ts` (new): THE lifecycle -> copy mapping (label,
  tone, status line, next step, can-send, send label, New event refusal). The Profile
  `reviewStatus`, `createBlock` (New event) and the new Home card are all views of it. The
  caller-less `organiserStatusView` copy in `homeModel.ts` is deleted, so there is one copy, not
  three.
- Home (`home/OrganiserStatusCard.tsx`, `home/index.tsx`): every non-live organiser gets a status
  card: "Draft: not visible to the public yet." + what to do + **Send for review** (the screen's
  primary while no organiser is live; ghost when a live one keeps New event the primary). After the
  send the card reads "Waiting for review: not visible to the public yet." plus how long the team
  takes. A refusal shows the RPC's own copy (e.g. "already in review"). New event is **disabled
  with its reason** (`aria-describedby`) while no organiser is live, and the empty state no longer
  says "Add your first event" to someone who cannot.
- New event (`events/NewEventPage.tsx`): the refusal comes from the shared mapping; pending reads
  "Your organiser is waiting for approval. ..."; draft/changes-needed get "Go to Home to send it for
  review"; Create is described by the reason.
- Profile (`profile/index.tsx`, `modules/profile/organiserPublicProfile.ts`): the organiser area
  now reads its own organiser through `fetchOwnOrganiserEntity` (same columns, NO
  `is_active is not false` filter, own cache key `['own-organiser-entity', id]`). The public
  `fetchOrganiserEntity` and its `['entity', id]` key are unchanged. Visibility of a non-live row is
  RLS alone (`organiser_profiles_ss_select`: live OR admin OR owner/manager OR city ambassador).
  `notDeactivatedFilter.ts` census updated. The "may have been switched off" copy is now accurate.
- `selfServeErrors.ts`: the server's "needs a live organiser" refusal now also says to send it for
  review.

## Verified on real data

- Shapes surveyed: prod `stsdtacfauprzrdebmzg` read-only, counts only: organiser_profiles 45, all
  `live` (is_active true 4 / null 41), 0 draft / pending_review / rejected / paused; organiser
  entity_members 3 (all owner, all on live organisers); `organiser_profiles_ss_select` qual read;
  `submit_organiser_profile_v1` EXECUTE anon=false / authenticated=true; authenticated column
  SELECT grants cover every `ORGANISER_PUBLIC_COLS` column read. E2E `srrpvuxldthwumzrngla`: 2 draft
  organisers (is_active=false, both with an owner), 8 live. The draft shape (is_active=false) is the
  one only the E2E walk produced; prod will meet it on the first self-serve create.
- Checks run: (1) `src/modules/organiser/__tests__/draftOrganiser.matrix.test.tsx`, Home x New
  event x Profile x {draft, pending_review, rejected, live, paused} x {creator (owner), member
  (manager), stranger}, plus the public read keeping its is_active filter; mocked at the Supabase
  client with the E2E row shape. Against the UNFIXED screens (tracked files stashed): 31 failed / 29
  passed across it and `shared/__tests__/organiserStatus.test.ts`; fixed: 60/60.
  `src/modules/organiser` 61 files / 1683+ tests green. (2) E2E RLS as roles (read-only txns): the
  draft owner reads own draft 1 row via the own read, 0 via the public filter; a stranger and anon
  see 0 non-live organisers. (3) Browser walk on E2E at 390x844 (dev server, self-serve flag on) as
  the fixture owner of "W1 Probe New Org 1004" (draft): Home status line + disabled New event with
  reason -> New event page refusal + Go-to-Home -> Profile opens (tag Draft) -> Send for review ->
  "Waiting for review" + confirmation -> reload still pending (server state) -> New event says
  "Your organiser is waiting for approval" -> Profile "Waiting for review"; anon and the owner's
  public-filter read of that id return []. No Supabase 4xx. (4) CI steps run locally:
  check:rpc-typing, check:wallclock-brand, bin/check-integrity.sh, check:legacy-tables,
  check:legacy-program-rpcs, lint:architecture, check:images (AUDIT_STRICT=1),
  check:mojibake:self-test, prove:entry-point, `npm run lint` (16/16 links green), unit suite with
  the offline stub (TZ=Europe/London): only 17 failures, all in untouched `tests/*.contract.test.ts`
  live-DB suites and `tests/integrityCouldNotRun.test.ts`, failing identically with this change
  stashed. `tsc` (not a CI step) 95 errors before and after, none in touched files. e2e-smoke
  (`npm run test:e2e` with the workflow's exact mocked env): 75 passed, 1 skipped, 1 failed, the
  failure being `organiser-events.spec.ts` pinning the OLD refusal copy ("is not public yet");
  the spec now asserts the new copy and the Go-to-Home control, and the organiser specs (events,
  home, loop, profile) re-ran 21/21 green. `npm run pre-ship`: every check PASS (build, bundle
  budget, first-load requests, typecheck ratchet 95 < 106) except test:unit (the same 17
  pre-existing offline failures above) and the scoped eslint ratchet, which flagged two files this
  branch does not touch (`CityPicker16px.test.tsx`, `organiserProfileUpdate.test.ts`, both
  byte-identical to origin/main) because it compared against a stale local origin/main; eslint on
  every touched file is clean. pre-ship therefore skipped its own e2e step (run separately above).
  `/code-review` was NOT run (it needs the owner to type it).
- NOT verified: a real phone; prod (no draft organiser exists there to look at, and prod is
  read-only); the admin moderation UI picking up the sent organiser (the RPC's audit row and
  `pending_review` state were confirmed; the queue RPC filters on that state); a manager (not owner)
  pressing Send in a browser (unit-tested; the RPC admits manager); the "Missing: City" blocker on
  Home with real data (create requires a city, so no row has none); the perf-budget build jobs and
  Lighthouse (no network to the deploy).

## E2E fixture state this work left

- E2E user `w1-probe-1004@bachata-e2e.test` was given a known password (to sign in for the walk)
  and its organiser "W1 Probe New Org 1004" is now `pending_review` (sent through the real RPC); it
  will appear in the E2E admin queue.

## Notes for the reviewer

- Home now shows one status card per non-live organiser above the dates; for an owner with a live
  organiser plus a draft, New event stays enabled (it defaults to the live one) and Send for review
  is a ghost button so the screen keeps one primary.
- Withdraw (pending -> draft) is still impossible by design (D6 handover: trigger has no owner
  arm); the copy never offers it.
