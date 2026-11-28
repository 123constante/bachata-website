# Brief: venue-add W3 FIX (review round 1 on PR #2530)

Owner approved ("build this", 2026-11-28); plan DESIGN-REGISTRY row "VENUE ADD PRO". Continue on branch `feat/venue-add-display` (PR #2530 stays open; push to the same branch). Original brief: `docs/briefs/venue-add-w3-display.md` on branch `brief/venue-add-w3`. Everything stays behind `VITE_ENABLE_VENUE_ADD` (off = today's output exactly).

Size: 5 files, 250 lines (formatVenueAddress.ts, its test, VenueBlock.tsx, VenueFeedbackSheet.tsx, one flag-off render test file).

Independent review returned FAIL. Fix ALL of these, nothing else.

1. BLOCKER `src/lib/formatVenueAddress.ts:29` postcode typed inside the address is always stripped, even when the postcode field is empty: "35-37 Battersea Rise, London SW11 1HG" + postcode null -> "35-37 Battersea Rise, London" (postcode lost). Fix: if the field `normalisePostcode(postcode)` is non-empty, strip any postcode from the address and use the field; if the field is empty, lift the postcode found in the address into the tail. An address that is ONLY a postcode -> "<City> <POSTCODE>".
2. City strip only after a comma (`,\s*<city>\s*$`) or when the whole string equals the city. "Calle de Madrid" + city Madrid must stay "Calle de Madrid, Madrid".
3. Repeat postcode + city stripping until the string stops changing: "x, SW11 1HG, London" + field SW11 1EE -> "x, London SW11 1EE".
4. Test rows for every case above + trailing commas/whitespace + lowercase postcode + null city.
5. BLOCKER `VenueFeedbackSheet.tsx:18` signed-out visitors can never send (submit_feedback_v1 is granted to `authenticated` only and raises `not_signed_in`). Decision: signed out -> the "Something wrong?" control does NOT open the text sheet; it shows a short "Sign in to tell us what is wrong" with a button to the site's existing sign-in route (find the existing auth hook + sign-in path the site already uses; returnTo back to this event page if the site supports it). No text box is shown to signed-out users, so nothing typed can be lost. Signed in: unchanged sheet. Map errors: `not_signed_in` -> sign-in prompt (keep typed text); `invalid_kind`/anything else -> "Could not send. Try again later." (keep typed text).
6. `VenueBlock.tsx:73` button nested inside the tile `<a>` (BentoTile renders a Link when venueId exists). Move the "Something wrong?" control OUTSIDE the tile link (sibling under the tile), keeping the flag-off DOM identical.
7. Use typed `supabase.rpc('submit_feedback_v1', {...})` (or the helper at src/modules/dancer-app/api/rpc.ts:309), not rpcLoose.
8. `'Sending…'` raw unicode ellipsis -> `'Sending…'` (or `&hellip;` in JSX). Grep your files for any other raw unicode punctuation.
9. Add a flag-off render test: VenueBlock and VenueEntity address output identical to main with the flag off (vitest + testing-library, mock the flag).

Run every CI step in .github/workflows that applies (unit tests, lint chain, tsc). Tap targets explicit px (>=44px; html font-size ~13.5px on phones). Files over 2 KB via scripts/safe-edit.py. HTML entities in JSX. Final commit subject carries `[worker-done <ticket>]` as usual; update `docs/briefs/venue-add-w3-display.handover.md`.
