# Handover: dancer layout C, slice S1 (Home)

Ticket dt_ccf2044290ec. Branch `claude/dancer-layout-c-s1`, PR #1872. Brief: `docs/briefs/dancer-layout-c-s1-home.md` (blob f45c4a5) on `brief/dancer-layout-c-s1`.

No prototype element was left unbuilt. Every Home checklist line is built behind `VITE_ENABLE_DANCER_LAYOUT_C` (default off).

## Done
- New flag `DANCER_LAYOUT_C_ENABLED` (`screens/home/layoutCFlag.ts`). With it ON, C wins over `DANCER_DASH_B_ENABLED`. With it OFF, Home is unchanged (the A/B path; homeOptionA/B/Audit tests are untouched and green).
- `homeCView` (homeFocus.ts) is the Option B mapping split by job. `HomeCView` (homeOptionB.tsx) shares `FocusBody` and `ShareRowView` with B, so there is one copy of each.
- `HomeScreen.tsx`: the alerts are built once. In C they render under the h1 and above Get ready. Rate last night shows only when Going is on and there is a candidate. Your ticket shows only when `flags.publicTicketing && !TICKET_TEASER_ENABLED`.
- `homeTicket.tsx` (new, **a 6th file beyond the brief's five**): a lazy wrapper over the Tickets tab's own `useTicketCard` + `TicketCard`. It keeps the ticket reads off the /app/* first load; the bundle check is green at 379.0 of 381 KB, 46 files.
- `homeLayoutC.test.tsx`: 17 tests covering 11 states, the heads' look, the share reasons, the Go out card, C over B, and flag OFF. 14 are red on the old source. The 3 green ones are the flag-OFF / no_profile "unchanged" pins.

## Checklist coverage (against docs/briefs/dancer-layout-c-spec.md)
- [x] h1 "Hi Ana"
- [x] paused alert + "Show my profile again", above Get ready
- [x] linked notice + Check my profile / Got it, above Get ready
- [x] head "Get ready"
- [x] focus card "N of 4 / to finish your profile", 4-segment bar, "Next: ..." line, CTA
- [x] head "Go out"
- [x] "Rate last night", first in Go out (Going on only)
- [x] "Your ticket" card, second (ticketing on, teaser off)
- [x] "Nothing planned yet" + "Find events this week", or the next-night card
- [x] "N more plans" (only above 0)
- [x] "Your first night out" / "N nights attended", last in Go out, not tappable
- [x] head "Be found"
- [x] "Share my page" (+ disabled reason when incomplete or hidden)
- [x] "Preview my page" (-> /app/page)
- [x] tab bar / routes / shell untouched (S2)

coverage 15 of 15 checklist lines built

## Noticed, not in this brief (NOT changed)
1. Me still has its "My page" row. The brief moves it out in S2.
2. With ticketing on, the Tickets tab still exists (S2 removes it), so the ticket card shows both there and on Home until S2.
3. `useTicketCard` on Home does what it does on the Tickets tab: it moves a stored order id into `?o=` and clears the stored copy. With C on and ticketing on, Home now consumes the post-checkout order id, so the Tickets tab (S1 only) no longer sees it. This is fine once S2 removes the tab, but worth knowing.
4. "Your ticket" shows for everyone while ticketing is on. A person with no tickets gets the card's own "none" line. The prototype says "only when ticketing is on", so this was built as specified. Hiding it for 0 tickets would be a product call.
5. Loading/error: with C on, Home uses Option B's loading and error cards even if the B flag is off (C is built on B). With C off, nothing changes.
6. Copy: the Share subline keeps today's "Send your page to a dance partner." (the prototype says "Send it to a dance partner"). The Preview subline "How it looks and who visited." comes from the prototype's Me row.
7. `npm run typecheck` reports 141 errors repo-wide. `scripts/pre-ship.mjs` pins a baseline of 106. None of the 141 are in this branch's files, so this is pre-existing drift on main.
8. The repo's `.githooks/*` are not executable in this sandbox, so git skipped them (they were not bypassed).

## Next steps
- Owner: set `VITE_ENABLE_DANCER_LAYOUT_C=true` on the Vercel preview env and walk it on a phone.
- S2: tab bar (Home / Nights / Me), the Me settings section, the /app/options and /app/tickets redirects, Sign out into Account settings, the teaser twins re-map.

## TAP TABLE (layout C Home)
| button | destination | prototype/OLD |
|---|---|---|
| Show my profile again (paused alert) | /account settings (APP_ACCOUNT_SETTINGS_PATH) | prototype |
| Check my profile (linked notice) | /app/me | prototype |
| Got it (linked notice) | dismisses the notice in place | prototype |
| Profile focus CTA (e.g. "Add your photo") | next-step editor (homeModel next.path, with focus) | prototype |
| Rate last night | /app/nights?series=... (the rating) | prototype |
| Your ticket: QR / arrows / Try again | in-card (the Tickets tab's own card) | prototype |
| Find events this week | /app/nights | prototype |
| Open the night | the night's event page (href), else /app/nights | prototype |
| N more plans | /app/nights | prototype |
| N nights attended / Your first night out | not tappable | prototype |
| Share my page | /app/page | prototype |
| Preview my page | /app/page | prototype |

No row is OLD.
