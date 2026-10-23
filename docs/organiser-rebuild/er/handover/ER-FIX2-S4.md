# ER-FIX2-S4 handover: C11 co-organisers (fix pass)

Brief: `arc/briefs-organiser-r1:docs/organiser-rebuild/briefs/ER-FIX-W2.md` (sha `a2e612d`), section S4.
Audit: `claude/audit-er-co-organisers:docs/organiser-rebuild/er/audit/ER-AUDIT-co-organisers.md`.
Ticket `dt_811fc0cf0687`. Branch `claude/er-c11-organisers`.

## Merges (in order, all clean except the first)
1. `origin/main` (a48ccd3): conflicts in Ember UI only (`ui/Chip.tsx`, `ui/DateChip.tsx`, `ui/ember.css`, `__tests__/ember.test.tsx`), resolved to main's side, as S6 did.
2. S1 `claude/er-s1-rules` 79459ca5, S2 `claude/er-c4-sessions` 48eafa56, S3 `claude/er-c5-venue` 4e6d5a65, S6 `claude/er-c9-dates` a907be0d: no conflicts.

## What moved
- `events/SeriesOrganisers.tsx`, `events/organisersModel.ts` and their tests (`fixSw1.matrix`, `sw1.parity`, `parity-matrix` rows) are back to **main's SW1 versions, byte for byte**.
- The rebuilt screen now lives at `organisers/OrganisersScreen.tsx`. The route (`shell/OrganiserRoutes.tsx`) loads `organisers/OrganisersRoute.tsx`, which shows the rebuilt screen only when `useRebuildSwitch(ws.organiserIds)` is on for that event, and main's SW1 screen otherwise.
- The rebuilt screen's model is folded into `organisers/organiserModel.ts`, so there is one organisers model file (audit section 7).

## Findings
| id | outcome | what changed | red-first |
|---|---|---|---|
| F1 | fixed | SW1 kept; rebuilt screen chosen per event by `useRebuildSwitch` (OFF/unset/empty, allowlist without the owner page, allowlist with a co page only, and event still loading all give SW1). Unavailable read shows `FAILURE_TEXT.unavailable` (`org-organisers-unavailable`), not the generic error | yes: 6 F1 rows red |
| F2 | fixed | invite answered `this page is already invited` / `this page already organises the event` resolves (no id) and the list refetches | yes |
| F3 | fixed | cancel answered `this invite is no longer open` resolves; invite/cancel/remove refetch on EVERY settle (`onSettled`) | yes |
| F4 | fixed | respond on a gone invite throws kind `gone`, and Home Invitations shows "This invitation was withdrawn." (`role=status`, not an error); the list refetches on every settle | yes |
| F5 | fixed | `viewerRoleOnEvent(rows, myPageIds, {organiserIds, homeRole})`: with no accepted row, the event read and Home decide. The empty list shows `org-empty` with "Use Invite an organiser below to add a page." when Invite is on | yes |
| F6 | fixed | full control: `controlState` is on for owner and co for every control except owner Leave; `OWNER_ONLY`, `OWNER_ONLY_REASON`, `REMOVE_OWNER_ONLY_REASON`, `removeNote`, `rowCanBeRemoved`, `isMyLeaveRow`, `inviteOff` removed (no importer outside tests, checked with grep); a co can Remove another co; block text rewritten | yes |
| F7 | fixed | the three test files are rewritten over the current truth (owner/co/none x control, retry-success, switch, empty, dead invite), not patched | the rewritten files ran red on the unfixed code: **51 failed / 76 passed**; after the fix 127/127 |
| F8 | fixed | skeleton (`org-organisers-loading`) until `useSeriesRole().loading` is false | yes |
| F9 | fixed | rate limit is `54000` or the word `rate_limited` (prod `_member_rate_check_v1`), not any text containing "rate" | yes |
| F10 | fixed | 20 results back shows "Showing the first 20. Type more of the name." (`SEARCH_LIMIT`, `searchMore`) | yes |
| F11 | fixed | the row button reads "Leave" (`aria-label` keeps "Leave this event"; the sheet keeps the full words) | yes |
| F12 | fixed | "Any organiser on the event can invite you again." | yes |
| C11 handover line | withdrawn | `ER-C11.md` "Pinned interface" no longer tells C12 to hide End/Stop/Delete/Cancel from co-organisers | n/a |

I disagreed with no finding. Audit item 7 (owner page cannot Leave) is kept and parked (see `parked/ER-C11.md`).

## Pinned interface (additions only; nothing renamed)
`@/modules/organiser/organisers`: `viewerRoleOnEvent`, `EventStanding`, `emptyText`, `OWNER_CANNOT_LEAVE`, `LEAVE_ROW_LABEL`, `SEARCH_LIMIT`, `searchMore`, plus the screen helpers that moved over (`INVITE_LABEL`, `LEAVE_LABEL`, `LEAVE_CONFIRM`, `ROLE_WORD`, `controlFor`, `rowAction`, ...). `OrganiserFailure` adds `'gone'`. `InvitationsView` adds an optional `notice` prop. Removed (superseded, no importer): the owner-only exports listed under F6. S5 mounts `organisers/OrganisersRoute` (or the screen through it).

## Shapes (prod, read-only SELECT, 2026-10-23, counts only)
- `event_series_p5`: 747 series. Organiser links (`event_series_organiser_p5`): **571 with none, 170 with one, 6 with two** (182 links). The C11 "0 links across 120 series" read was against the wrong table (`event_series`), not RLS: do not use it.
- `series_organiser_invites` exists (0 rows). All 7 co-organiser RPCs are present on prod.
- Server texts read from `pg_proc`: `invalid_payload: this page is already invited`, `invalid_payload: this page already organises the event`, `invalid_payload: this invite is no longer open` (cancel and respond), rate check `54000 rate_limited`.
- Live organiser pages: 47 (search cap of 20 is reachable with a common word).
- Covered by tests: no-link (rows = []), one link (owner only), two links (owner + co), plus invited rows, ended/archived, Home loading, unavailable read.
- Not checked: invites in real use (0 rows on prod), course/festival formats (the screen does not read format).

## CI per job (sandbox)
| Job / step | Command | Result |
|---|---|---|
| architecture-guard: integrity | `bash bin/check-integrity.sh` | 0 |
| architecture-guard: legacy tables / program RPCs | `npm run check:legacy-tables`, `check:legacy-program-rpcs` | 0, 0 |
| architecture-guard: runtime architecture | `npm run lint:architecture` | 0 |
| architecture-guard: images | `AUDIT_STRICT=1 npm run check:images` | 0 |
| architecture-guard: mojibake | `check:mojibake:self-test && check:mojibake` | 0 |
| architecture-guard: entry point | `prove:entry-point:self-test && prove:entry-point` | 0 |
| typecheck | `check:rpc-typing`, `check:wallclock-brand` | 0, 0 |
| unit-tests: dancer isolation | `check:dancer-area-isolation` | 0 |
| lint chain | `npm run lint` | 0 |
| build | `npm run build` | 0 |
| unit-tests | `npm run test:unit` | 1: 16 failed / 13018 passed. The same 16 fail on `origin/main` in this sandbox (checked in a main worktree): the known main-red `datesCard.consistency` 'Home lists none, the workspace holds 2 coming + 1 past' (date-relative fixture, not fixed here), 4 live-DB contract files (no DB secrets here) and `integrityCouldNotRun` (sandbox tooling). None in this slice |
| organiser suite | `npx vitest run src/modules/organiser` | 4542 passed, 1 failed (the known main-red above) |
| eslint / tsc on touched files | `npx eslint src/modules/organiser/organisers ...`, `tsc -p tsconfig.app.json` filtered | 0 problems, 0 errors |
| e2e-smoke | `npm run test:e2e` | 1: 155 passed, 3 failed, 7 skipped. The 3 (`account-settings.spec.ts` x2, `organiser-onboarding.spec.ts` header Sign in link) also fail on `origin/main` in this sandbox (main run: same 3 plus one more), outside this slice. No organisers spec is in the gate |

## Verified
- Red-first: the rewritten tests ran against the unfixed code (51 red), then went green after the fix (127/127).
- Real server texts and real shape counts from prod (SELECT only), used in the tests.
- With the switch OFF, main's SW1 screen is the one mounted (route test). The SW1 files are identical to main's.

## Not verified
- Browser walk at 390x844 with prod-shaped data: not done. The rebuilt screen needs a signed-in organiser and an allowlisted event; no preview or Vercel login opened.
- End-to-end calls against the real RPCs (no writes allowed; invites table empty on prod).
- Whether the server lets the event's own team invite on a no-link event (parked, default taken).
- Contrast of `--danger` on the Ember card.

## Next
- S5 (event page): mount the organisers screen through `organisers/OrganisersRoute` (the route already does).
- S5: owner click F-C5-5 (binding): a NEW draft venue must store address = 'Area, POSTCODE' (what the sheet shows), not ward/district. This slice touches no venue file, so it is not fixed here.
- C12: mount `<InvitationsList />` on Home. Do NOT hide or disable End / Stop repeating / Delete draft / Cancel one-off for co-organisers (decision 4).
