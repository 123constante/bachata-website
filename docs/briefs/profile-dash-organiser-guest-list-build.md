# Brief: organiser Guest list inside each night, Option B (Names / Door / Settings)
Owner pick 2026-11-12: Option B. Design: docs/design/profile-dash/organiser-guest-list.md + organiser-guest-list-option-b.html (merged, PR #1585). Inventory: organiser-guest-list-inventory.md. Non-money. Behind `organiserDash`.
## Acceptance contract (person x journey x data shape)
- Organiser owner/manager x switch the list on for ONE night, add/remove names, set places + closing time x 0 names, median 9, 63-name night, full, closed, past, cancelled.
- Organiser (owner/manager) at the door x Door view: not-yet-arrived first, check in/undo, QR scan x 63 names.
- Contributor x view only with the reason shown x any shape.
- Signed-in dancer x sign up (button says "Your name will be visible on this list"), one entry per account, remove me x full / closed.
- Public names stay (owner choice); first name only as today.
## Phases (each = one branch, one PR; Website slice cannot start until its admin GAP merged and applied)
1. Admin (careful, GAPs C1-C8, see design doc "Careful lane"): occurrence-level switch/places/closing resolver; user_id + unique(user,night) on entries (decide the 593 anonymous rows); remove_my_guest_list_entry_v1 beside the token erase path; checked_in_at/by + organiser_check_in_guest_v1/undo; added_by; organiser-scoped list/add/remove/restore/config RPCs gated by team role (page past 100 rows); self sign-up link; QR scan RPC. C9 (team-only names) is NOT built.
2. Website read-only: night sheet row + Names view from the organiser RPC, all shapes, contributor view-only.
3. Website writes: switch, add/remove, settings, share link. Untouched save sends nothing.
4. Website Door view + QR.
## Checks
Table-driven tests screen x shape (empty, normal, huge, full, closed, door, past, cancelled, contributor, loading, error); no disabled control without a reason; 390x844 walk; PR CI table; Verified/Not verified; independent review (ACL + privacy) on phases 1 and 3.
## Open (default drawn, owner may override): contributor cannot check in; organiser-added names do not count against places; waiting list dropped.
