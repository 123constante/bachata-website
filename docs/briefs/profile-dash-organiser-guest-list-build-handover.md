# Handover: organiser guest list inside each night (Option B, phases 2-4 in one slice)

Brief: `docs/briefs/profile-dash-organiser-guest-list-build.md` (branch `brief/profile-dash-organiser-guest-list-build`).
Ticket dt_5543a3168fd8. Non-money. Behind `organiserDash`; every RPC call behind `organiserGuestListLive` (default OFF).

## Done
- Night sheet (Events tab) has a Guest list row (`guestlist/GuestListSheet.tsx`, `GuestListRow`).
  - Flag OFF: "Coming soon" card plus "Tell us what you need" (support email, else WhatsApp, else hidden). No RPC is called.
  - Flag ON: resolves the night's occurrence id on the event's own read (pages older dates too), then Names / Door / Settings.
- Names: read from `organiser_guest_list_night_v1` (50 at a time, search), add (this night / every week), remove with Undo (`restore`).
- Door: "41 of 63 in", not-yet-in first, Check in / Undo, Scan a QR code (existing `useScanner`, token read from a bare uuid or a link).
- Settings: switch for one night, places, closing time. Untouched Save is disabled with its reason and sends nothing.
- Contributor: view only, the reason is on screen once, every control disabled.
- States: loading, error ("Nothing was changed"), refused (reason in words), empty, off, full, closed, past, cancelled.
- RPCs are cast locally in `guestlist/guestListApi.ts` (generated types NOT edited; they do not have the #1577 functions yet).
- Pure model + words: `guestlist/guestListModel.ts`. Tests: `guestlist/__tests__/` (screen x shape matrix, parsing, sends).
- `scripts/onboarding-write-doors.json`: 5 write-shaped guest-list RPC names listed in `not_event_writes` (team-role gated inside the RPC, not event edits).

## Left / next
- Admin #1577 must be applied; then set `VITE_ENABLE_ORGANISER_GUEST_LIST_LIVE=true` and re-run the walk against the real RPCs.
- Dancer-facing sign-up (`submit_my_guest_list_entry_v1` etc.) and the "Share sign-up link" sheet are NOT built here (brief phase 3 lists a share link; it needs the public per-night route, which does not exist yet).
- Door does not open by itself on the night (Night has no "is today" flag); Names is always first.
- The camera box reuses the ticket door's words ("To scan tickets..."); give it guest-list copy.
- Removed-name Undo row lives only in the open sheet (closing it forgets it).
- ACL / privacy review is posted by the lead as a PR comment.
