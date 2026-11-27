# Brief W3 -- Ambassador tracker + link card (Website, normal lane, sonnet)

Brief-version: 2
Context cap 30%. Push an early checkpoint commit as soon as the card renders; push again before every pause. Supabase READ-ONLY. Never `gh api`, never `--no-verify`, never merge/approve. If PARTIAL, subject ends PARTIAL and the handover lists what is left. Bristol stays INACTIVE: no activation, no city set, no flag flip, no prod data write.

- **Repo:** 123constante/bachata-website. **Branch:** `claude/bristol-ambassador-tracker`. **Lane/model:** normal (UI on existing RPCs), sonnet.
- **BLOCKED:** needs admin-migration:ambassador_shared_link_v1 applied (admin PR #1277).

## Goal
The ambassador and the owner see the one link, copy or share it, switch it off or on, and see who joined. Owner 2026-10-29: tracker visible to ambassador + owner; link permanent; owner or ambassador can switch it off. "Invited" is NOT shown (nothing records a send).

## RPCs (admin PR #1277)
- `get_ambassador_link_tracker_v1()` (authenticated): `{links:[{link_id, code, city_name, city_slug, is_active, live, ambassador_first_name, joined, city_set, joiners:[{first_name, joined_at, city_set}]}]}`. An ambassador sees their own link; an admin sees all.
- `set_ambassador_link_active_v1(p_link_id uuid, p_active boolean)` returns `{link_id, is_active}`.

## Do
1. Add a "Your Bristol link" card above the queue in `src/modules/ambassador/AmbassadorQueuePage.tsx` (route `/ambassador/*`, `src/components/AnimatedRoutes.tsx:289`). Data hooks in `src/modules/ambassador/ambassadorApi.ts` (follow `fetchCityScopes` / `scopesKey`). New files in `src/modules/ambassador/link/`: `trackerModel.ts` (one mapping: live / is_active / counts to labels) and `LinkCard.tsx`.
2. Link URL = `<origin>/join/a/<code>` (route from brief bristol-ambassador-landing; the card works even if that page is not merged yet). Buttons: Copy link; Share (only when `navigator.share` exists); Switch off / Switch on with a confirm sentence. No paste-ready message (owner did not choose one).
3. Show "Joined N", "Set Bristol N" and a names list (first name + date). Empty: "Nobody has joined yet. Send your link to the first organiser." Switched off: note "Your link is off. Nobody can join with it" + Switch on. `live=false` while `is_active=true` (ambassador row removed): "This link no longer works. Ask us", no switch.
4. A null first name shows "A new member". More than 50 joiners collapse behind "Show all".

## Tests
Table-driven: {0, 1, 60 joiners} x {active, switched off, not live} x {ambassador, admin with 2 links}: every label, button and disabled reason; copy writes the exact URL; an untouched card sends no write; switching calls the RPC once and refreshes; null first name. Existing `queue.matrix.test.tsx` stays green.

## Walk and design
390x844, no sideways scroll, taps at least 44px. Design record `docs/design/bristol-ambassador-tracker.md` with INVENTORY first (current `/ambassador` page, file:line).

## Done
Bot-authored PR, every CI job step run, Verified / Not verified, handover `docs/handover/bristol-ambassador-tracker.md`.

## What main lacks
- extends: AmbassadorQueuePage.tsx has the pending queue only: no link card, no copy/share, no switch, no joined counts (git grep get_ambassador_link_tracker_v1 finds nothing). -- src/modules/ambassador/AmbassadorQueuePage.tsx
- No tracker read exists on main for the link card: nothing calls the tracker RPC -- grep: get_ambassador_link_tracker_v1

## Files
`src/modules/ambassador/AmbassadorQueuePage.tsx`, `src/modules/ambassador/ambassadorApi.ts`, new `src/modules/ambassador/link/*`, tests under `src/modules/ambassador/link/__tests__/`.
