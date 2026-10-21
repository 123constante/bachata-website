# ER-C11 (website-screen): co-organiser UI

Branch `claude/er-c11-organisers` from `claude/er-wave1` (named in your prompt). PLAN.md section CO-ORGANISING is the binding rule set. Read ER-COMMON and ER-INTERFACE section 4.

Rebuild `events/SeriesOrganisers.tsx` and `events/organisersModel.ts` plus a NEW dir `src/modules/organiser/organisers/` (invite model/client, `InvitationsList.tsx` for Home "Invitations" with Accept / Decline, which C12 mounts). Search ANY organiser page -> "Invite an organiser" -> chip "Invited" (x cancels); accepted pages show on the public line only after Accept; owner removes any co-organiser; a co-organiser can only "Leave this event" (confirm sheet); nobody removes the owner; any organiser on the event can invite; block text "Every organiser can edit. Only the owner can end the event."; owner-only controls (End, Stop repeating, Delete draft, Cancel one-off) hidden/disabled WITH a reason for co-organisers; organiser changes save at once, not via Update live event; a version conflict shows "Someone else changed this event" -> Reload (existing `EventConflict`). Build to the pinned RPCs; "server not landed" in the PR.

Tests: table over roles (owner / co / non-member) x controls x invite states; no duplicate organiser/invite. Touches: `events/SeriesOrganisers.tsx`, `events/organisersModel.ts`, `organisers/**`.
