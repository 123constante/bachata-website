# ER-C11 handover: co-organiser UI

Branch `claude/er-c11-organisers` from `claude/er-wave1`. Server NOT landed (AD1, admin PR 907): prod has no `series_organiser_invites` and none of the pinned RPCs (checked read-only).

## Pinned interface for later slices
`import { InvitationsList, ... } from '@/modules/organiser/organisers'`
- `<InvitationsList />` for Home "Invitations" (C12 mounts it; renders nothing when empty or the server is absent). Accept / Decline call `series_invite_respond_v1`.
- `controlState(role: 'owner'|'co'|'none', control, closedText?)` is the ONE role x control table (invite, cancelInvite, removeOrganiser, leave, end, stopRepeating, deleteDraft, cancelOneOff).
- **WITHDRAWN by ER-FIX2-S4 (owner decision 4, 2026-10-22):** the earlier line here told C12/integrators to hide or disable End, Stop repeating, Delete draft and Cancel one-off for co-organisers. Do NOT do that: everyone on an event has full control. `OWNER_ONLY` and `OWNER_ONLY_REASON` no longer exist. See `ER-FIX2-S4.md`.
- `useSeriesOrganisers(seriesId)` (series_organisers_v1), `viewerRole(rows, myPageIds)`, `publicLine(rows)` ("By owner, co" accepted only; the public page is not wired here).
- Client: `inviteOrganiser`, `cancelInvite`, `respondToInvite`, `leaveEvent`, `removeOrganiserPage`, `searchOrganiserPages`; `OrganiserApiError(kind)`.

## Done
Screen `events/SeriesOrganisers.tsx` rebuilt: block text, rows (Owner / Co-organiser / Invited with x), owner Remove on co rows, co "Leave this event" with confirm sheet, "Invite an organiser" search of any live page (linked/invited pages not offered), no Save (each change saves at once), version conflict -> `EventConflict`, failures in words, Invite off with reason for non-member and ended/archived. The old set_organisers/Link a page path, its gate and its tests are removed; parity-matrix row SW1-organisers updated.

## Left
Mount InvitationsList on Home (C12); wire owner-only controls elsewhere to `controlState`; public line on the event page; the not-yet-supported server pieces below.

## Verified on real data
- Prod survey (read-only, counts): `event_series_organiser_p5` links = 0 rows across 120 series (the table exists; no linked organisers visible to this read), `series_organiser_invites` table absent, 0 of the pinned co-organiser RPCs present. So every shape is tested with fixtures only: owner / co / non-member x all controls x invited/accepted/ended/live, duplicate organiser and invite, parse of bad payloads.
- Tests: 3 new files, 90 tests in `organisers/__tests__`; full `src/modules/organiser` suite 129 files, 3719 passed, 2 skipped.

## Phone QA (390x844)
NOT done: server not landed and the screen needs the new RPCs, so there is no prod-shaped page to walk. Tap targets are explicit px (44px buttons; asserted in a test that no button is under 44px).

## CI steps (sandbox)
| Command | Exit |
|---|---|
| `npm run build` | 0 |
| `npx vitest run src/modules/organiser` | 0 (129 files) |
| `npx eslint` on touched files | 0 errors, 0 warnings |
| `npm run lint:architecture` | 0 (after fixing a legacy-field comment) |
| `npm run lint` | `check:integrity` exit 126 (script lacks exec bit in this checkout); `bash bin/check-integrity.sh` exit 0; other links pass; trailing eslint skipped by the chain |
| `npx tsc --noEmit -p tsconfig.app.json` | no errors in touched files (pre-existing in TeamPicker / NewPageFlow tests) |

## Not verified
End-to-end against the real RPCs (server not landed); phone walk and screenshots; the extra DB write permissions (co edit rights) which are server-side.
