# Design record -- Bristol ambassador shared link landing (`/join/a/:code`)

Brief: `brief/bristol-ambassador-landing:docs/briefs/bristol-ambassador-landing.md` (sha 17033032). Ticket dt_0eddba136eff.

## INVENTORY (what existed before this change, origin/main 5c34c21)

| What | Where | Notes |
|---|---|---|
| `/invite` and `/invite/:token` routes | `src/components/AnimatedRoutes.tsx:291-292` (lazy at `:64`) | organiser-team invite, not an ambassador link |
| Organiser invite landing | `src/modules/admin-organisers/InviteRedeemPage.tsx:17-37` | no-referrer meta + noindex + preview query, hands to `join/JoinPage.tsx` |
| Organiser join flow | `src/modules/admin-organisers/join/JoinPage.tsx` (440 lines) | token-bound organiser onboarding; read only here, NOT reused (token model differs) |
| `/ambassador/*` route | `src/components/AnimatedRoutes.tsx:289` (lazy at `:63`) | A1 pending-review queue |
| Ambassador queue page | `src/modules/ambassador/AmbassadorQueuePage.tsx`, views `QueueViews.tsx:34` (`EmptyState`), buttons `DecisionSheets.tsx:7-10` (44px `BTN*`) | button classes mirrored in the new page |
| Organiser onboarding | `src/modules/organiser/home/onboarding/` (`OnboardingView.tsx`, `citySearch.ts`) | `citySearch.ts` = `search_cities`, filters `is_active` -- never used by the landing |
| City sheet | `src/modules/organiser/edit-in-place/CitySheetBody.tsx:44` | before a search shows the ticked city from `currentName`; a search replaces the list with results only |
| `/join` route | none (`git grep "/join/a"` empty on main) | |
| Breadcrumb ids | `src/lib/breadcrumbs/siteIa.ts:88-90` | added `ambassador.link` ("Your invite") |

## Server truth (re-read on prod `stsdtacfauprzrdebmzg`, 2026-11-06, read-only)

- `get_ambassador_link_public_v1(p_code)` -> `{status:'ok', first_name, city_name, city_slug, is_active:true}` | `{status:'not_found'}`. Code is `lower(btrim())`, empty or >64 chars -> not_found.
- `record_ambassador_link_join_v1(p_code)` -> `{status:'joined'|'already_joined', city_slug, city_name}`. Refusals are RAISEd exceptions: `authentication_required` (no user or anonymous JWT), `link_not_found`, `own_link`. `already_joined` names the city of the FIRST join (one join per user), which may differ from this link's city -- the done screen names the returned city.
- `cities` RLS: `Public read` (`true`) -- inactive Bristol (`bristol-gb`, `is_active=false`) is readable. 0 links, 0 joins, 0 ambassadors today.

## Decisions

1. ONE mapping file `src/modules/ambassador/link/linkLandingModel.ts` (`landingView`) maps viewer x lookup x join -> heading/body/notice/chip/actions. The page draws it.
2. The join RPC is called only from the Join button's tap, guarded by an in-flight ref (double tap = one call). Nothing writes on load.
3. City chip: read from `cities` by the link's `city_slug` (the public RPC returns a slug, not an id), falling back to the RPC's `city_name`. Never a picker; a grep test fails on `search_cities`/`citySearch`/`CitySheetBody` in the module.
4. Anonymous session (known up front from `user.is_anonymous`, or the server's `authentication_required`): signed-out layout plus one sentence "You are browsing as a guest&hellip;".
5. Own link: Join disabled, reason sentence under it. Link switched off between load and tap: not-found state plus one sentence.
   **Own link is reached after ONE server round trip, by design (review M2, fix round 1).** The ambassador sees an enabled Join, taps it, and `record_ambassador_link_join_v1` RAISEs `own_link`; only then is Join disabled with the reason. Why: the public RPC `get_ambassador_link_public_v1` is anon-callable and deliberately knows nothing about the caller, so it cannot say "this is yours" without becoming caller-aware (an admin-repo RPC change, out of scope for this repo, which owns no migrations). The extra tap is harmless: the RAISE writes nothing, it happens once (the button then stays disabled), and only the ambassador ever meets it. Screenshot 10 is that state AFTER the tap. Revisit only if admin adds an `is_own` flag to the public RPC.
6. Malformed code (empty, >64): not-found without calling the server.
7. Sign in / Create account use `buildSignInHref('/join/a/<code>', mode)` so both return here.
8. Contact us = WhatsApp "message us" (`dancerMessageUsUrl`) prefilled with the link URL.
9. noindex + `referrer: no-referrer` meta, same as `/invite`.
10. Done state next step: "Open your organiser area" -> `/app`, exactly as the brief names it. **Owner question:** in this repo `/app` is the dancer area and organiser onboarding sits under `/account`; confirm which one the done button should open.
11. Join refusals, split (review M1, fix round 1): the three known RAISEs map as above; ANY other server answer (another RAISE such as a profile requirement, a PostgREST error with a code, or an unexpected success shape) is the `refused` state: heading "We could not add you to <city>", one calm sentence that does not blame the connection, Contact us (WhatsApp, primary) and Back to the calendar (`/`). No Join button, so no retry loop. "Check your connection, then tap Join again" is kept ONLY for a request that never reached the server (no PostgREST error code, e.g. `Failed to fetch`). Mapping: `joinRefusal` in `linkLandingModel.ts`.
12. Unknown lookup status (review L1, fix round 1): any `status` other than `ok` from the public RPC (e.g. a later `locked`) renders the plain not-found state, never the generic error with Try again. A malformed `ok` (missing city) is still the error state.

## States walked (390x844, mocked RPC, stand-in ACTIVE city "London")

Screenshots in `docs/design/bristol-ambassador-landing/`: 01 loading, 02 signed-out named, 03 signed-out no name, 04 not found, 05 error, 06 signed-in invite, 07 joining (disabled + reason), 08 joined, 09 already joined, 10 own link (after tapping Join; see decision 5), 11 anonymous, 12 join failed (network only), 13 join refused (fix round 1: server RAISE `dancer_profile_required` mocked, Contact us + Back to the calendar, both 44px, no h-scroll, 0 page errors, 1 join call for 1 tap). Every tap target measured 44px; no horizontal scroll; 0 page errors; join RPC calls: 0 on every untapped state, 1 per tap.
