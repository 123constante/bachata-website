# Acceptance contract: Organiser Guest list tab, Option B (admin #1557)

Docs only. Comment-ready for `123constante/bachata-admin#1557`. Children: **#1559** (admin, schema, first) then
**#1561** (website, behind `organiserDash`). Design: `docs/design/profile-dash/organiser-guest-list-option-b.html`
(Names / Door / Settings), inventory `organiser-guest-list-inventory.md`. Schema authority is `bachata-admin`;
this repo owns no migrations.

## 1. Prod shape survey (read-only SELECT counts, 2026-11-12, `stsdtacfauprzrdebmzg`, no personal data)

| Fact | Count |
|---|---|
| Series with `has_guestlist` on | 6 (5 of them carry a non-zero price key = "paid", 1 free) |
| Entries active / soft-deleted / erased / waitlist | 591 / 2 / 2 / 0 |
| `is_permanent` ("Every week") entries | 58 |
| Nights with more than 100 entries | 0 (max 63; 140 is a stress shape only) |
| Organiser-scoped guest-list RPCs | **0** (8 `admin_*` guest-list RPCs only) |
| RLS on `event_guest_list_entries` | enabled |
| Refunded | n/a: guest-list entries have no payment or refund state. "Refunded/cancelled" maps to a cancelled night (10 cancelled nights of 239) |

## 2. Contract: person x journey x data shape

Legend: OK = works; READ = view only, with the reason on screen; REFUSED = no list, no names, no count in the
response (server-side, not just hidden UI).

### People
- **Owner / manager** (organiser team role that can change): full.
- **Contributor** (team member, view only): sees the list, cannot switch, add, remove, check in or edit settings. Reason said once on screen. (Open question Q1: check-in.)
- **Non-organiser** (signed-in dancer, other organiser's team, anon): REFUSED by the RPC. The error is the same for "not found" and "not yours" (no existence leak). The website shows nothing, not a hidden tab.

### Journeys x people
| Journey | Owner/manager | Contributor | Non-organiser |
|---|---|---|---|
| Open Guest list from a night (Events row, night sheet) | OK | READ | REFUSED |
| Search names, 50 at a time | OK | OK | REFUSED |
| See per-person status (added by / when, Every week, In) | OK | OK | REFUSED |
| Per-night switch, places, closing time, price/note | OK | disabled with reason | REFUSED |
| Add a name, remove (+Undo), Every week vs this night | OK | disabled with reason | REFUSED |
| Door: check in / undo, scan QR, "n of N in" | OK | disabled (Q1) | REFUSED |
| Share sign-up link (stops at close or when full) | OK | disabled | REFUSED |
| Export "Download names" (Tickets' CSV is renamed, G7) | OK | OK (Q5) | REFUSED |

### Data shapes (each shape x each journey must be a vitest matrix row; none may be only a fixture)
| Shape | Required behaviour |
|---|---|
| Switch off | "No guest list on this night" + **Turn on for this night**; no count shown |
| On, no names (0) | Empty state offers Add a name and Share link |
| Few (1 to 9, median 9) | Names view; Door opens on the night |
| Many (63, real max) | Door: not-yet-in first, search always on, header "41 of 63 in" |
| Over 100 (stress, 140) | RPC pages (limit/offset or cursor); UI shows "50 of 140 shown"; count is the server count, not `rows.length` |
| Full (places reached) | Banner; dancers blocked; organiser can still add (Q3) |
| Closed (past cutoff) | Dancers see closed; organiser can still add |
| Past night | Read-only, "14 of 18 came", with the reason |
| Cancelled night | Names kept, read-only, "nobody was emailed, tell them yourself" |
| Free vs paid series | Settings shows price rows only when prices exist; free series shows none |
| Every-week names (58 in 4 series) | Show on every night of the series; remove asks this night / every week |
| Erased / soft-deleted | Never listed; erased does not count |
| Loading / error | Add disabled with reason; error says nothing was changed + Try again |
| Untouched save | Sends no command |
All at 390x844 (px tap targets of at least 44, the site html font-size is about 13.5px).

## 3. GAPs G0 to G7

| GAP | What is missing | Owner repo | Money / RLS full review? |
|---|---|---|---|
| **G0** admin screens and close-notify behaviour unread | Documentation only: read admin repo screens, `guest_list_close_notify` before copy promises | admin | No |
| **G1** no organiser guest-list UI at all | UI: switch, list, add/remove, check-in, settings (the whole build) | website (#1561) | No, but consumes RPCs that are RLS |
| **G2** anonymous free-text sign-up, no user key | Schema: `user_id` on entries, unique (user, night), submit RPC requiring `auth.uid()`, plan for 593 legacy rows; plus `remove_my_guest_list_entry_v1` | admin | **Yes: RLS/auth** |
| **G3** phone reveal RPC exists, no phone column | None: keep admin-only; ensure organiser RPCs never return phone | admin | **Yes: privacy** (assert, do not build) |
| **G4** retention window unknown | Product/schema fact; do not promise a deletion period in copy | admin (fact) | No |
| **G5** standing (VIP) names are admin-wide | Not building; organisers use Every-week names; needs organiser-path add for `is_permanent` | admin | **Yes: RLS** (organiser writes permanent rows) |
| **G6** waiting list flag on, 0 entries, no UI | Nothing now; do not draw; ensure organiser RPCs ignore or reject waitlist | admin | No |
| **G7** "Download guest list" on Tickets is the ticket buyers CSV | UI copy: rename Tickets' export; add "Download names" | website | No (but export of names is personal data: RLS-gated RPC) |

Careful-lane items (admin, from design C1 to C9) that carry G1 to G7 and need full review: **C1** per-night switch
and places (resolver must not flip the 6 live series), **C2/C3** auth and remove-me, **C4** `checked_in_at/by` +
check-in RPCs, **C6** organiser-scoped RPCs gated by team role (the central RLS item, every RPC pages past 100),
**C8** QR scan RPC, **C9** team-only names (if chosen). None of this touches money: there is no payment on
guest-list entries. All are RLS-sensitive, so full review applies to C2, C3, C4, C6, C8, C9.

## 4. Ordered slices (smallest first)

1. **Contract tests first (admin):** RLS/role matrix test (owner / manager / contributor / outsider / anon) against a read-only organiser list RPC. No UI.
2. **Admin: read-only `organiser_list_guest_list_entries_v1`** with paging and server count; refuses outsiders.
3. **Website: Names view read-only** behind `organiserDash`, from the night sheet; all data shapes, contributor view; no writes.
4. **Admin: organiser add / soft-delete / restore** (names only, this night).
5. **Website: add, remove, Undo.**
6. **Admin: per-night switch + places + closing time resolver (C1)**, guarded so the 6 live series are unchanged.
7. **Website: Settings view + switch.**
8. **Admin: check-in columns and RPCs (C4)**; **website: Door view.**
9. **Admin: Every-week organiser add (G5) and "Download names"**; website export and Tickets rename (G7).
10. **Later, separate decisions:** signed-in sign-up and remove-me (C2/C3), share link (C7), QR (C8), team-only names (C9).

Each slice: its own PR, real-data verification block, `/code-review` before commit.

## 5. Open product questions for the owner (click answers)

1. Can a contributor check people in at the door? **[ ] No, view only  [ ] Yes, check-in only**
2. Public names: **[ ] First name only (as today)  [ ] Add noindex too  [ ] Team-only variant  [ ] Keep as drawn**
3. Do organiser-added names count against the places? **[ ] No (drawn)  [ ] Yes**
4. Waiting list: **[ ] Drop the flag  [ ] Draw in a later round**
5. Can a contributor download the names? **[ ] No  [ ] Yes**
6. Ship order: **[ ] Names read-only first (slices 1 to 3)  [ ] Wait for the full build**
7. The 593 anonymous legacy entries when one-entry-per-account lands: **[ ] Keep as guest rows  [ ] Purge after the night**

## Not verified
No admin repo code read (RPC bodies and RLS policies were not inspected; only existence/counts from the prod catalog). No phone walk. Counts are live SELECTs; "paid" is inferred from non-zero price keys.
