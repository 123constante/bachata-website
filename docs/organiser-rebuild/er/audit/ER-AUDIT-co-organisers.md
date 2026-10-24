# ER-AUDIT: co-organisers (`claude/er-c11-organisers`, card ER-C11)

Audited head `32b7164` (slice commit on top of `claude/er-wave1` merges `4c6d1f5`).
Brief: `arc/briefs-organiser-r1:docs/organiser-rebuild/briefs/ER-AUDIT.md` (sha `000dac1`).
Read-only: no source edited; this file is the only change. Ticket `dt_92cb2c233127`.

Slice files (all paths `src/modules/organiser/...`):
`organisers/organiserModel.ts`, `organisers/organiserApi.ts`, `organisers/InvitationsList.tsx`,
`organisers/index.ts`, `events/SeriesOrganisers.tsx`, `events/organisersModel.ts`,
`organisers/__tests__/organisers.{model,api,screen}.test.*`.

## Verdicts

| Slice part | Verdict | Why (one paragraph) |
|---|---|---|
| Role model + client (`organisers/organiserModel.ts`, `organisers/organiserApi.ts`) | **FIX** | The shape is right: one pure role x control table, parsers that drop bad rows and dedupe pages/invites, a thin RPC client with the AS BUILT names and keys. But the table encodes the overturned design: `OWNER_ONLY` (`organiserModel.ts:96`) disables Remove, End, Stop repeating, Delete draft and Cancel one-off for co-organisers with "Only the owner can do this." (owner decision 2026-10-22: everyone on an event has full control). The error mapper turns the two retry answers the owner says are SUCCESS into errors (`organiserApi.ts:35`, `already` -> `refused`; `this invite is no longer open` -> `failed`). Both are local edits to one function each, so FIX, not REBUILD; the tests that pin the old behaviour must be rewritten with them. |
| Event organisers screen (`events/SeriesOrganisers.tsx`, `events/organisersModel.ts`) | **FIX** | Behaviour is close to the plan (invite search of any live page, Invited chip with x, Leave confirm sheet, no Save, failures in words, 44px targets). Three things make it unshippable as is: (1) it REPLACES main's working SW1 screen on the same route with no rebuild-switch check, so while the server is not landed every organiser who opens "Organisers" gets an error page (`OrganiserRoutes.tsx:135`, `SeriesOrganisers.tsx:136-142`); (2) the block text, the remove note and the Leave copy say "only the owner" (`organiserModel.ts:31`, `organisersModel.ts:18,38-39`); (3) an event with no organisers (the common prod shape) renders an empty card with no empty state although `NO_ORGANISERS` exists unused. |
| Home Invitations (`organisers/InvitationsList.tsx`) | **FIX** | Unmounted (C12's job; acceptable). When an invite was cancelled under the invitee (inviter left or was removed, or the inviter cancelled it), Accept/Decline fails with "That did not save. Try again." and the list is NOT refreshed on error, so the dead invite stays answerable forever (`InvitationsList.tsx:46`). Owner decision: the screen must not offer to answer an invite that is gone. Small fix. |

## 1. Mounted?

| Screen | Route | Reached from | Behind `VITE_ORGANISER_REBUILD`? |
|---|---|---|---|
| `SeriesOrganisers` (rebuilt) | `/account/o/events/:seriesId/organisers` (`shell/OrganiserRoutes.tsx:135`) | Event Details "Organisers" row (`events/Details.tsx:200`) | **NO.** The route and the import (`OrganiserRoutes.tsx:33`) are the same ones main uses for the SW1 screen; the slice overwrote the SW1 file in place and never reads `useRebuildSwitch()`. With the switch OFF (default) everyone gets the rebuilt screen. |
| `InvitationsList` | none | nothing imports it (only `organisers/index.ts`) | Unmounted; card says C12 mounts it on Home. |

Unmounted-by-design exports with no importer outside tests: `publicLine`, `isMyLeaveRow`, `rowCanBeRemoved` (only via `isMyLeaveRow`), `inviteOff` (`events/organisersModel.ts:22`), `OWNER_ONLY_REASON`, `NO_ORGANISERS`.

## 2. Plan rules owned (PLAN.md section CO-ORGANISING, unnumbered bullets; no rule 1-65 is specific to this family beyond rule 2 "every job a path from Home")

| Plan bullet | Status | Where |
|---|---|---|
| Search ANY organiser page -> "Invite an organiser" -> chip "Invited" (x cancels) | PASS | `SeriesOrganisers.tsx:22-46,101-107`; `organiserApi.ts:63-69` |
| Invited page sees it on Home under "Invitations" (Accept / Decline) | NOT BUILT (unmounted) / FAIL on dead invite | `InvitationsList.tsx:34-52` |
| Shows on their page only after Accept; public line "By owner, co" accepted only | NOT BUILT (helper only) | `organiserModel.ts:123-126`, no caller |
| Rights = full editing for co-organisers | Not this slice's screens; the shared table it publishes says the opposite for end/stop/delete/cancel-one-off/remove | `organiserModel.ts:96-113` |
| "Only the OWNER's team can End ..." + block text | **SUPERSEDED** by owner decision 2026-10-22 (full control). Slice implements the superseded rule -> FAIL against current truth | `organiserModel.ts:31-33,96`; `organisersModel.ts:18,38` |
| Owner removes any co; co can only Leave (confirm sheet); nobody removes the owner | Leave sheet PASS (`SeriesOrganisers.tsx:48-59`); "co can only leave" is now a FAIL (co must be able to remove too); owner row never removable PASS (`organisersModel.ts:31`) | |
| ANY organiser on the event can invite | PASS (`organiserModel.ts:105`) | |
| Same time -> "Someone else changed this event" -> Reload | Wired (`SeriesOrganisers.tsx:79,95`) but dead: AS BUILT says organiser changes do NOT bump `series.version`, so `version_conflict` never comes from these RPCs | harmless |
| Organiser changes save at once, not via Update live event | PASS (no Save; each RPC fires on tap) | `SeriesOrganisers.tsx:82-93` |

## 3. Server as built (ER-INTERFACE "AS BUILT by ER-AD1")

| RPC | Name/args | Result read | Status |
|---|---|---|---|
| `series_organisers_v1(p_series_id)` | match `organiserApi.ts:46` | `organisers[].page_id,name,role,status,invite_id` (`organiserModel.ts:40-55`) | PASS |
| `my_organiser_invites_v1()` | match `:49` | `invites[].invite_id,series_id,series_name,invited_page_id,invited_page_name,invited_by_name`; `invited_by_page_id` and `created_at` ignored (fine) | PASS |
| `series_invite_organiser_v1(p_series_id,p_page_id)` | match `:52` | `invite_id` | PASS; "already invited" retry -> error (**F2**) |
| `series_invite_cancel_v1(p_invite_id)` | match `:55` | result `{invite_id,status}` ignored | PASS; "no longer open" retry -> error (**F3**) |
| `series_invite_respond_v1(p_invite_id,p_accept)` | match `:56` | ignored | PASS; gone invite stays listed (**F4**) |
| `series_leave_v1`, `series_remove_organiser_v1` (`p_series_id,p_page_id`) | match `:57-58` | `{series_id, organiser_ids}` ignored; list refetched instead | PASS |
| Refusal `permission_denied: <kind> is for the owner organiser's team only` | mapped to "That was not allowed. Reload and try again." | | PASS as mapping; the server text itself contradicts the 2026-10-22 decision -> admin must drop owner-only for remove/cancel/stop (see Full control) |
| Invites to ended/archived refused | Invite disabled with `eventLock` text (`organisersModel.ts:26`) | | PASS |
| Rate limit 20/day | `text.includes('rate')` -> "You have sent a lot of invites today" | | PASS, but substring is loose (**F9**) |

Server truth could not be re-read: the admin repo is not reachable from this sandbox (`git ls-remote` asks for credentials). Judged against ER-INTERFACE AS BUILT only; no AD2 section exists there for this family.

## 4. Shapes

Supabase MCP needs authorisation in this session, so no SELECT was run (see Not verified). Shapes below are from the brief's counts and the slice's own handover.

| Shape | Screen behaviour | OK? |
|---|---|---|
| No-organiser event (brief: 571) | `rows=[]`: block text + empty `Card` + Invite. Viewer role computes `none` (they are on no row) -> Invite OFF "You are not an organiser of this event." even for the page's own team. | **FAIL** (F5): no empty state, and the event's own team is told they are not on it |
| Two-organiser event (brief: 6) | owner + co rows, actions per role | PASS against old rules; FAIL against full control (co sees no Remove) |
| Invited row without `invite_id` | no x shown (`organisersModel.ts:32`) | PASS, but no reason given (minor) |
| Ended / archived | Invite off with lock text; Remove/Leave/Cancel stay | PASS (parked Q in handover is a fair default) |
| Draft without occurrence, course (15), festival (12), >100 rows | Screen does not depend on format or dates; organiser lists are tiny; search capped at 20 with no "more" hint | PASS / minor (F10) |
| Home still loading (`useSeriesRole` -> `myPages=[]`) | role `none` for the first paint -> Invite flashes disabled with "You are not an organiser" | minor (F8) |
| Server not landed (today) | `PGRST202` -> `unavailable`, but the page-level read failure goes to generic `ErrorState`, not `FAILURE_TEXT.unavailable` | **FAIL** (F1, with the switch issue) |

Note: the C11 handover reports `event_series_organiser_p5` = 0 links across 120 series, while the brief cites 6 two-organiser events and 571 no-organiser events. The handover's read was probably RLS-limited; its "0 links" must not be relied on.

## 5. Tests

Ran on the slice head (node_modules from main):
- `npx vitest run src/modules/organiser/organisers` -> 3 files, **90 passed**.
- `npx vitest run src/modules/organiser/organisers src/modules/organiser/events src/modules/organiser/__tests__/parity-matrix.test.ts` -> 20 files, **1038 passed**.
- `npx eslint` on the six slice source files -> 0 problems. `npm run lint:architecture` -> passed.
- Raw Unicode punctuation scan of slice files -> none.

Quality: the model test is a real table (role x control x invite state) and can fail. But it is a table over the WRONG truth: `organisers.model.test.ts:60,92` and `organisers.api.test.ts:46` (`'page already linked' -> 'refused'`) pin owner-only and retry-as-error, so a correct implementation of the 2026-10-22 decisions FAILS these tests. No test covers: retry answers as success, a respond on a cancelled invite, the no-organiser shape, the switch-OFF path. The 44px "no button under 44px" assertion is real. Not vacuous, but must be rewritten, not patched.

## 6. Design

From code only (no phone walk possible: server not landed, and no screenshots exist).
- Tap targets: Remove/Leave `h-[44px]` (`SeriesOrganisers.tsx:61`); Accept/Decline `size="sm"` = 44px (`ui/Buttons.tsx:32`); Invited x 44px (`ui/PersonRow.tsx:65`). PASS.
- Density: `p-3`, `gap-3`, `text-[14px]`/`[13px]` explicit px. PASS. No 3-col grid applies (lists).
- Remove and "Leave this event" are both `--danger` text buttons next to a `PersonRow`; "Leave this event" (16 chars at 14px semibold) beside a long page name at 390px wide will squeeze the name (`min-w-0 flex-1` truncates it). Not seen; risk of clipped names (minor, F11).
- No `docs/design/` record was added for this screen. Contrast of `--danger` on Ember card not checked.

## 7. Dead code / duplication

- `organisers/organiserModel.ts` vs `events/organisersModel.ts`: two "organisers model" files with near-identical names; the screen model re-exports `BLOCK_TEXT` and wraps `controlState` twice (`inviteOff` unused, `controlFor`). Fold into one.
- `isMyLeaveRow`/`rowCanBeRemoved` duplicate `rowAction` logic and are unused.
- `EventConflict` branch is dead for these RPCs (AS BUILT: no version bump).
- No `sections/` files touched.

## Findings

| id | sev | file:line | what | failing scenario | fix in words |
|---|---|---|---|---|---|
| F1 | blocker | `shell/OrganiserRoutes.tsx:135`, `events/SeriesOrganisers.tsx:132-147` | Rebuilt screen replaces main's SW1 screen with no rebuild-switch check | Merge with switch OFF and server not landed: every organiser tapping "Organisers" on Details sees an error page instead of today's working list | Keep main's SW1 screen file; put the rebuilt one in `organisers/` and choose it in the route by `useRebuildSwitch()`; show `FAILURE_TEXT.unavailable` (not generic error) when the read is `unavailable` |
| F2 | blocker | `organisers/organiserApi.ts:35` | `already invited` / `already linked` -> `refused` -> "That was not allowed" | Organiser double-taps or retries after a timeout: the invite exists but the screen shows an error | Map `already invited`/`already linked` on invite to success (refetch the list) |
| F3 | blocker | `organisers/organiserApi.ts:30-37`, `SeriesOrganisers.tsx:87` | Cancel answered `invalid_payload: this invite is no longer open` -> `failed` -> "That did not save. Try again." | Cancel retried, or the invite was accepted/cancelled meanwhile: error shown, row may stay | Treat that text as success for cancel; always refetch the organisers list on cancel settle |
| F4 | major | `organisers/InvitationsList.tsx:46` | On respond failure the list is not refreshed; a gone invite stays with Accept/Decline | Inviter leaves or is removed (server cancels their pending invites), invitee taps Accept: "That did not save. Try again." forever | On `no longer open` show "This invitation was withdrawn" (not an error) and invalidate `invitationsQueryKey`; invalidate on every settle |
| F5 | major | `events/SeriesOrganisers.tsx:63-124`, `organisers/organiserModel.ts:35,75-79` | No-organiser event: empty card, no empty state; viewer role `none` disables Invite for the event's own team | Any of the ~571 no-organiser events: page's owner opens Organisers and reads "You are not an organiser of this event." | When `rows=[]`, decide the role from the event read (`ws.organiserIds` / `useSeriesRole`), render `NO_ORGANISERS` with what to do |
| F6 | major | `organisers/organiserModel.ts:31-33,96-113`; `events/organisersModel.ts:18,30-39` | Owner-only table and copy (see Full control) | Co-organiser cannot remove a co, sees "Only the owner can end the event." | Collapse the table: every accepted organiser `on` for every control; drop `OWNER_ONLY`, owner-only reasons and the remove note; rewrite the block text |
| F7 | major | `organisers/__tests__/organisers.model.test.ts:60,92`, `organisers.api.test.ts:46`, `organisers.screen.test.tsx:82` | Tests pin superseded behaviour | A correct fix of F2/F6 turns them red | Rewrite the table over owner/co/none x control x invite state with full control and retry-success rows; add switch-OFF, empty, and dead-invite rows; run them against the unfixed code first |
| F8 | minor | `events/SeriesOrganisers.tsx:67-69` | Role computed from Home data that may still be loading | First paint shows Invite disabled with "not an organiser" | Show skeleton until `useSeriesRole().loading` is false |
| F9 | minor | `organisers/organiserApi.ts:34` | `text.includes('rate')` matches any message containing "rate" (e.g. "separate", "generate") | A future refusal text with those words reads as the invite rate limit | Match the server's error code/prefix (`rate_limited`) |
| F10 | minor | `organisers/organiserApi.ts:66` | Search capped at 20 rows with no hint | Common word ("Bachata") with >20 pages: wanted page silently missing | Say "Showing the first 20. Type more of the name." when 20 come back |
| F11 | minor | `events/SeriesOrganisers.tsx:61,110` | Long "Leave this event" button beside page name | 390px: long page names truncate hard | Use "Leave" on the row (sheet title keeps the full words) or stack under the name |
| F12 | minor | `events/organisersModel.ts:18` | `LEAVE_CONFIRM` "The owner can invite you again." | Contradicts "any organiser can invite" | "Any organiser on the event can invite you again." |

## Full control (every place that says or enforces owner-only)

1. `organisers/organiserModel.ts:31` `BLOCK_TEXT` "Every organiser can edit. Only the owner can end the event." (rendered `SeriesOrganisers.tsx:99`).
2. `organisers/organiserModel.ts:32` `OWNER_ONLY_REASON` "Only the owner can do this." (exported as the reason the integrating slice should show on End / Stop repeating / Delete draft / Cancel one-off; handover tells later slices to wire it).
3. `organisers/organiserModel.ts:33` `REMOVE_OWNER_ONLY_REASON` "Only the owner can remove an organiser." -> shown via `removeNote` (`events/organisersModel.ts:38-39`, `SeriesOrganisers.tsx:115`).
4. `organisers/organiserModel.ts:96` `OWNER_ONLY = ['removeOrganiser','end','stopRepeating','deleteDraft','cancelOneOff']` and `:108-111` disabling them for `co`.
5. `events/organisersModel.ts:33-34` `rowAction`: only `owner` gets Remove; a co sees nothing on other co rows (hidden control).
6. `events/organisersModel.ts:18` "The owner can invite you again."
7. `organisers/organiserModel.ts:107` "The owner cannot leave." (owner Leave disabled). Not named by the decision; the server also refuses it (AS BUILT). Keep only if the owner confirms; flagging for completeness.
8. Handover `docs/organiser-rebuild/er/handover/ER-C11.md` "Pinned interface" tells C12/integrators to hide/disable End, Stop repeating, Delete draft, Cancel one-off for co-organisers via `controlState`: that instruction must be withdrawn so no later slice spreads it.
9. Server side (not this repo): AS BUILT owner-team-only refusals for end run, stop repeating, set organisers, delete draft, cancel one-off, remove organiser. The screen cannot give full control until admin drops those checks; the orchestrator should pair the Website fix with an admin change.

## If REBUILD were chosen instead (not recommended): what a fresh worker must be told
- Full control, not the card's owner-only bullets; retries are success; dead invites disappear.
- Do not overwrite main's SW1 screen; mount the new screen behind `useRebuildSwitch()`.
- The no-organiser event is the majority prod shape; derive the viewer's standing from the event read when the organiser list is empty.
- One organisers model file, not two.

## Verified
- Read the slice diff, card ER-C11, ER-INTERFACE (incl. AS BUILT), PLAN.md CO-ORGANISING, the C11 handover and parked list.
- Traced route -> component: `OrganiserRoutes.tsx:33,135` -> `events/SeriesOrganisers.tsx`; `InvitationsList` has no importer; switch not read.
- Family tests: 90/90 (organisers), 1038/1038 (organisers + events + parity-matrix). eslint 0 problems on slice files; `lint:architecture` passed; no raw Unicode punctuation.
- Tap-target sizes from code (44px).

## Not verified
- **Prod shape survey:** Supabase MCP needs authorisation in this session; no SELECT run. Shape counts are the brief's (6 two-organiser, 571 no-organiser, course 15, festival 12), not re-measured.
- **Admin server truth:** admin repo not reachable from this sandbox; AD1/AD2 handovers not read; ER-INTERFACE AS BUILT used instead. Exact server error texts for "already invited" / "no longer open" taken from the audit brief.
- Phone walk at 390x844, screenshots, contrast: not possible (server not landed; no Vercel preview opened).
- Full `npm run lint` chain and `npm run build` on the slice head: not run (only the pieces above).
