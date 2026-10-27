# S4 Add organiser, Organisers list, Needs you (website screens)

PARKED: needs admin PR #1007 (`claude/organiser-add-db`, head ed89c6b) applied on prod first. Do not merge before.

## Brief
Brief `docs/briefs/s4-screens.md` (branch `brief/s4-screens`): three admin phone screens over the S4 RPCs
`admin_add_organiser_v1`, `admin_list_organisers_front_door_v1`, `admin_send_organiser_invite_v1`,
`admin_set_run_by_us_v1`, `admin_needs_you_v1`, `admin_resolve_claim_v1`. The client is written against the
contract in admin `docs/db-contracts.md` (S4) and the migration headers; nothing here calls prod.

## Layout and why
One page, `/admin/organisers/front-door`, with three tabs (Add, Organisers, Needs you). A tab strip keeps it to one
route, one admin gate and one registration, and every tab is one thumb tap away at 390 px. The existing
`/admin/organisers` page gets one full-width entry button with the Needs you count (no badge while the count is
unknown or failed, never a wrong number). The existing list and its rows are not touched: the front-door list is a
new screen beside it (add, not replace).
- Add: name, contact person, City picker, a "Run by us (no email)" switch (turns the email box off, empties it and
  says why in words), submit. Result card in plain words with links to the organiser and to the list.
- Organisers: filter chips All / Run by us / Invited / Joined / Live with counts; each row has Send invite and a
  Run by us switch; a disabled control always prints its reason under it.
- Needs you: grouped by reason with the server's `detail`; Approve / Decline only on email-mismatch claims
  (`approve_drafts_only` is never offered); other reasons get an "Open the page" link. Empty state says what to do next.
Existing tokens and the module's button classes only (44 px minimum tap height, `min-h-[44px]`; 24 px switches).

## Mapping modules (table-driven tests)
`addOrganiserModel.ts`, `frontDoorListModel.ts`, `needsYouModel.ts` hold every state -> text/control decision;
`frontDoorApi.ts` holds the typed RPC boundary and defensive parsers. Tests: `__tests__/frontDoor.models.test.ts`
(result x email, every error code, chip x invite state x requested, send codes, reasons x 0/1/50 items) and
`__tests__/frontDoor.screens.test.tsx` (untouched form sends nothing, double tap sends once, Run by us sends no
email, coded error under its field, already-exists link, send / toggle / resolve).

## Checks
Unit tests, typecheck, eslint on the module, build: see the PR body table. Browser walk at 390x844 and 360: see the
PR body (Not verified if no screenshots are attached).

Browser walk: done on the phone fake at 390x844 and 360x640, every screen x every shape, with findings and fixes:
[`1033.md`](1033.md).
