# Brief: Interim manager seat shows honestly in the organiser area
Brief-version: 2
Branch: claude/interim-seat-p3-labels
Lane: normal, Sonnet. bachata-website, must not touch src/integrations/supabase/types.ts, supabase/**, the calendar density-exclusion files, or any admin RPC.
Serves: a person helping run an ownerless organiser page (interim manager) who today sees owner-style buttons that the database will refuse.

## What main lacks
- The Website ignores `seat_kind` that organiser_ownership_v1 now returns for a caller with a role (admin I1 #1284 applied) -- grep: parseSeatKind
- extends: the Team screen offers "Add someone" to an interim manager, who the database refuses (interim_cannot_add) -- src/modules/organiser/team/index.tsx
- No "Interim manager" label on the caller's own team row -- grep: Interim manager
- No "Share a join link" action that copies the public page link instead of adding a person -- grep: team-share-join-link
- extends: the You tab shows the Get paid (ticket tools) row to an interim manager, who cannot manage tickets -- src/modules/organiser/p3/shell/youTickets.tsx

## Files
src/modules/organiser/shared/ownership.ts
src/modules/organiser/shared/ownershipApi.ts
src/modules/organiser/shared/teamRules.ts
src/modules/organiser/team/index.tsx
src/modules/organiser/p3/shell/youTickets.tsx
src/modules/organiser/shared/__tests__/ownership.matrix.test.tsx
docs/arcs/organiser.md
docs/design/interim-seat-p3-labels.md (new)
INVENTORY.md (new)

Update the "Slices not yet briefed" I5 row in docs/arcs/organiser.md (Status, Blocked by, PR link) in the same PR.

## What to build
0. Write INVENTORY.md first: every field, state and option from the admin app, the current Website and the public page, each with file:line. Build only after it exists and report the coverage count (covered / total) at the end.
1. parseOwnership keeps `seat_kind` (owner, manager, interim, contributor, or null when absent). Unknown values become null; the key being missing (signed out, no role) never throws.
2. Team screen, caller is interim: own row label reads "Interim manager"; "Add someone" is replaced by "Share a join link" (copies or shares the public page URL, confirms "Link copied"), with one line saying the person taps "Ask to join" themselves. Owners and normal managers see no change.
3. You tab, caller is interim: the Get paid row is hidden and one line says "Ticket tools are for the page owner. Message us if you need them." Owners and normal managers see no change.
4. Design record docs/design/interim-seat-p3-labels.md (one design, why, two alternatives in two lines each). Walk at 390x844 for owner, normal manager, interim, signed-out.

## Tests
Table-driven, red first: seat_kind (owner | manager | interim | contributor | null | junk) x screen (Team add, own-row label, You tickets row). Assert no text points at a missing control, the disabled or replaced control states why, and an untouched screen sends no command.

## Done when
Tests green, every CI job step run, 390x844 screenshots attached, INVENTORY coverage count stated, arc row updated, and a Verified / Not verified block in the PR body (Not verified: a real interim seat on prod, since none is granted yet).
