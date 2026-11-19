# Brief: organiser R4 slice (a), door invite link (accept page + LINK card + Share)

Repo: Website. Branch `feat/organiser-r4-door-link` off main. One PR. Behind flag `organiserR4` (default off); the accept page itself is live for any valid link (a link must work for a door person whatever the flag).
Lane: careful (permissions: grants a door seat). Model: opus.

## Owner facts (binding)
- Door staff get ONE simple screen (Scan | Search), no organiser header, no tab bar. Link is for one night; access ends 12 hours after the night; names only, never money.
- Sign in THEN accept (owner click 2026-11-18): a signed-out visitor opening the link signs in (existing "Continue with GitHub"/Google flow, never password forms) and returns to the same link, which then accepts. Boards: Round 4 canvas screens 13-15 (Door invite link = R4DoorInvite) and 16-17 (door staff). Board copies: `C:\Users\ecual\.claude\plans\organiser-design-r4c\`.
- Look: white + #C2410C, 390x844, plain words, one main action per screen, no emoji.

## What exists (backend, prod, authenticated only)
- `ticket_door_seat_invite_v1(p_event_series_id uuid, p_occurrence_id uuid)` -> `{result, token, expires_at}`; result: ok | not_allowed | organiser_ambiguous | occurrence_not_live | occurrence_ended. Raw token is returned ONCE, only a hash is stored.
- `ticket_door_seat_accept_v1(p_token text)` -> `{result, event_series_id, expires_at}`; result: ok | unknown_invite | invite_ended | invite_used | seat_revoked | profile_incomplete. Single use; repeat by same person idempotent. Needs a complete dancer profile (profile_incomplete -> send them through the existing profile completion, then back to the link).
- `my_door_seats_v1()`, `ticket_door_seat_revoke_v1(p_seat_id)`, `ticket_door_seat_invite_revoke_v1(p_token)` exist.
- Website today: `src/modules/organiser/p3/r4/R4DoorInvite.tsx` + `r4DoorInviteModel.ts` render the page with "Copy door invite link" OFF ("no page for door staff to open the link"), LINK card and Share hidden. Door screen: `src/modules/organiser/p3/door/DoorScreen.tsx`. Copy the sign-in-then-return pattern of the existing organiser invite redeem page (`redeem_organiser_invite_v1` / `organiser_invite_preview_v1`).

## Build
1. Accept page, route e.g. `/door/join/:token` (pick the route style the site uses; token in the path, never logged, strip from history after use). States, plain words: signed out (Sign in to open the door for <event>, <night>), accepting, ok (go to the door screen), invite_ended / unknown_invite ("This link has stopped working. Ask the organiser for a new one."), invite_used, seat_revoked, profile_incomplete, error with retry. After ok, land on the door route for that event/night.
2. Door route for a seat-only person: confirm a door-seat holder (no organiser role) reaches the door screen with only Scan | Search and no organiser chrome; fix routing/guard if not. Do not widen access beyond the seat's night.
3. R4DoorInvite: "Copy door invite link" calls `ticket_door_seat_invite_v1` for the chosen night, builds the full URL, copies it; LINK card shows the link + expiry ("Access ends ..."), Share button (navigator.share, fall back to copy). Errors map to plain words (occurrence_ended, not_allowed, organiser_ambiguous). Remove the "not ready yet" copy. Mint only on tap, never on page load.
4. Tests: model + page matrix (each result state, signed-out return), flag off leaves old behaviour for the R4 page.

## Checks
- `npm run typecheck`-equivalent, unit tests for touched files green; run-ci label as usual; 390x844 walk of: LINK card, accept ok, ended link, signed-out. Measured numbers in the PR.
- A REAL round trip on a test organiser: mint -> accept as a second test account -> door screen shows. Use walk test accounts only, never a real organiser.

## Not in this slice
Money per night, Undo, Team Invited rows (separate slices). No migration (backend is live). No flag flip, no deleting old screens.

## Handover
PR body: what changed, checks at head, Not verified. End with the `[worker-done <ticket>]` marker.
