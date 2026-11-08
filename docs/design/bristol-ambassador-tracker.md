# Design record -- Bristol ambassador link card

## INVENTORY (before this change, main 5c34c21)
- `/ambassador` is `src/modules/ambassador/AmbassadorQueuePage.tsx` (route `/ambassador/*`, `src/components/AnimatedRoutes.tsx:289`). `Queue()` renders a `<header>` ("Pending review", line ~214) then `{body}` (line ~225): loading / no-access / caught-up / `QueueList`.
- No link card, copy, share, switch or joined counts. `git grep get_ambassador_link_tracker_v1` found nothing.
- Data hooks live in `ambassadorApi.ts` (`fetchCityScopes` / `scopesKey`, `fetchQueue` / `queueKey`).

## Decisions
- Counts only (owner change 2026-11-06, admin #1277 removed `joiners`): "Joined N" and "Set <city> N". No names list, no "A new member", no "Show all".
- Card sits between the header and the queue body, hidden while reviewing one item. It renders nothing while loading, on a read error, or when the person has no link, so the queue is never blocked by it.
- One mapping, `link/trackerModel.ts`: `live` / `is_active` / `admin_locked` / counts to labels, buttons and disabled reasons.
  - on: Copy link, Share (only if `navigator.share`), Switch off.
  - off: note "Your link is off. Nobody can join with it", Copy, Switch on. If `admin_locked` and the viewer is not an admin, Switch on is disabled with "An admin switched this link off. Ask an admin to turn it back on." (admin `useAuth().isAdmin` is exempt, as on the server).
  - not live (`is_active` true, `live` false): "This link no longer works. Ask us", no copy, no switch.
- Switch asks first with an inline sentence and Confirm/Cancel (no `window.confirm`); one RPC, then the tracker is refetched. Server refusals (`admin_locked`, `not_authorised`) become sentences.
- URL is `<origin>/join/a/<code>`. All tap targets `min-h-[44px]` in px (html font-size trap).
- Admin with several links: one card each, titled "Your <City> link (<first name>)".
