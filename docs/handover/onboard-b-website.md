# Handover: buyer onboarding slice B, Website half (branch claude/onboard-b-website)

Brief: `brief/onboard-b-website:docs/briefs/onboard-b-website-worker.md` (+ `brief/onboard-b:docs/briefs/onboard-b-slice-b.md` items 2-4). Flag: `VITE_ENABLE_BUYER_ONBOARDING` (`src/lib/buyerOnboardingFlag.ts`), OFF by default. Rollback = flag off.

## Done
- Item 1 "What are you?": `src/modules/dancer-app/screens/finish/FinishProfileCard.tsx`, the "Finish your profile" card on `/account/my-tickets` (drawn when the tickets read is ready or empty). Dancer / Organiser / Teacher / DJ toggle buttons (aria-pressed), multi-pick. Skip sends nothing and hides the card for this visit (it comes back next visit). Resume: saved roles show as a done line with Change; Change pre-ticks them. Save is disabled with a reason when nothing is picked and nothing is saved; an unchanged pick sends no command. A failed profile read hides the card (My tickets still works). Lazy chunk, loaded only with the flag ON.
- RPC: `saveMyBuyerRoles(roles, saved)` in `api/rpc.ts` -> `set_my_buyer_roles_v1(p_roles)` through the dancer-app backend slot (`DancerBackend.setMyBuyerRoles`). `my_dancer_edit_v1`'s `buyer_roles` parsed into `MyDancerEdit.buyer_roles` (unknown values dropped + warned, de-duped, stored order).
- Errors: `invalid_roles`, `too_many_roles`, `unknown_role` added to the ONE list (`api/types.ts` codes, `api/errors.ts` COPY/FIELD); `not_signed_in` and `no_profile` reuse existing copy.
- Item 2 organiser card: shown after an Organiser pick is saved, unless the person already organises (`other_roles` has `organising`). Links to the existing organiser start: `newOrganiserLanding(p3Live)` (`/account/p3/start` with P3 live, else `/account/o`). No new screens.
- Item 3 flag: `MyTicketsView` gets an optional `profileCard` prop; flag OFF the page passes nothing and the chunk is never imported.
- Item 4: fake backend `setMyBuyerRoles` mirrors the server order of refusals. Matrix test `src/modules/dancer-app/__tests__/buyerRoles.matrix.test.tsx` (43 rows: error map, read shapes, save no-op rules, every error code on the card, skip, resume, organiser link both P3 states, flag on/off page).
- Guard: `scripts/onboarding-write-doors.json` gains `set_my_buyer_roles_v1` under not_event_writes.

## Real data
- Prod (stsdtacfauprzrdebmzg, read-only): dancer_profiles 218 rows; non-empty buyer_roles **0**; NULL 0; `{}` 218. `set_my_buyer_roles_v1(p_roles text[]) -> text[]` present; raises not_signed_in / invalid_roles / too_many_roles / unknown_role / no_profile (as mapped). `_my_dancer_edit_shape_v1` includes buyer_roles.

## Not verified
- A real signed-in session on a phone with the flag ON (walk used a mocked session and mocked RPCs on the local dev server).
- The P3-live organiser link in a browser (unit-tested; local walk had P3 off, so `/account/o`).
- e2e suites not run.

## Left / next steps
- Organiser attendee UI showing buyer_roles: out of scope (brief).
- C reminder email: own prototype round.
