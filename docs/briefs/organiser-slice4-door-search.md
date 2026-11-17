# Brief: organiser slice 4, Door Search (Scan | Search switch)
Lane: normal. Branch feat/organiser-slice4-door. One PR. No migrations, no DB/RPC change. Use ONLY the existing v3 door functions already wired in src/modules/organiser/p3/door/data.ts (ticket_door_list_v3 and the three ticket_check_in_*_v3).
Design (owner-picked, DESIGN-REGISTRY "round 4 screens 16-17", binding): door staff screen has NO organiser header and NO tab bar. Own header = night name + "Door". Two-part switch "Scan | Search", selected part orange text + 2px orange underline (#C2410C).
Today (src/modules/organiser/p3/door/DoorScreen.tsx): header "Door" with "Event" back link; tabs "Scan" and "Tonight's list (N)"; list tab already has a first-name search box and In / Not in rows.
Build the smallest change:
1. Rename the second tab to "Search" (keep the count out of the label; show it inside the tab body if useful). Keep data-testids stable where tests use them; update tests that assert the old label.
2. Header shows the night name (from data already loaded; if not available, series title) next to "Door". Fall back to plain "Door" when no name.
3. Search tab: first-name search (already built), result rows show name, quantity, In / Not in. Check in from a row stays gated by the existing ticketDoorCode flag; flag OFF = read only, copy unchanged.
4. Style: orange active state per design, 52px tap targets, explicit px sizes (site html font-size is ~13.5px on phones).
5. Put the change behind the existing organiserShellV2 / organiserP3 flags (no new flag unless needed). Live stays unchanged with flags off.
Do NOT touch: v3 SQL, ticket_types, RPC signatures, p3/tickets/*.
Checks: unit tests for tab label, header name, empty search, no-match state with a next step. Run the affected vitest files and tsc. PR body needs a "Verified on real data" block with an honest "Not verified" (no 390x844 walk from cloud: the owner window runs it).
