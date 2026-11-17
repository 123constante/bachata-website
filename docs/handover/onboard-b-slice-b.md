# Handover: buyer onboarding slice B (Website, branch claude/onboard-b)

Brief: `brief/onboard-b:docs/briefs/onboard-b-slice-b.md` (sha 8fd468c6). Flag: `VITE_ENABLE_BUYER_ONBOARDING` (`src/lib/buyerOnboardingFlag.ts`), OFF by default. Rollback = flag off. Ticket dt_3911d541166b.

## Done
- Item 1 (DB) was already applied by the admin worker: `set_my_buyer_roles_v1(p_roles text[])` live on prod (SECURITY DEFINER, EXECUTE authenticated + postgres only), `buyer_roles` returned by `_my_dancer_edit_shape_v1`. Nothing applied from here.
- Item 2: `shell/roleStep.tsx` = the first step of the shell's "What are you?" sheet (flag ON + a person + not view-only). Multi-pick, Save / Skip, resumable (saved roles pressed). `api/rpc.ts` `saveMyBuyerRoles` (same set sends nothing). Errors `invalid_roles` / `too_many_roles` / `unknown_role` in `api/errors.ts`. Fake backend gained `setMyBuyerRoles` (server order of refusals).
- Item 3: `TicketsScreen` card "Set up your organiser page" -> `/account/o` (existing flow) when Organiser picked and `other_roles` lacks `organising`.
- Item 4: roles read only from `my_dancer_edit_v1`; privacy rows in the test.
- Test: `src/modules/dancer-app/__tests__/buyerRoles.matrix.test.tsx` (40 rows).
- Walk 390x844 via a throwaway Vite harness (real routes + shell, fake backend): all taps 44px, no scroll, no page errors.

## Not verified
- Real signed-in phone session with the flag ON.
- e2e suites; full unit suite (only dancer-app + tickets).
- Organiser attendee view showing roles: the admin RPCs (`ticket_orders_for_organiser_v1`, `ticket_order_statuses_for_organiser_v1`) carry buyer_roles, but no Website screen renders them yet; not in this slice's Website scope.

## Left / next steps
- Slice C (reminder email) waits for its prototype round (brief).
- If the owner wants roles on the organiser's attendee list, a small follow-up reads them from the organiser order RPCs.
- 390x844 walk on a real phone with the flag ON (orchestrator / owner).

## Status
- PR: #1769 (body has Verified on real data + Phone QA; both body checks exit 0).
- Code head 4d629fd; tsc run on 4d629fd: 0 errors in branch files (tsc -p tsconfig.app.json, 157 repo-wide, none in branch files).
