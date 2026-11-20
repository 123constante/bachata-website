# Brief: Editor v2 S1 continuation A (branch claude/editor-v2-s1c, same branch, normal lane, opus)

Read first: `docs/handover/editor-v2-s1c.md` on the branch (what is done, "Left" list), then `docs/briefs/editor-v2-s1.md` (on brief/editor-v2-s1c) for owner decisions 1-6 and the design source `~/.claude/plans/editor-v2/event-editor-v2.html` is NOT available to you: the shots in `docs/design/editor-v2/shots/` and the brief text are your spec. Do not change the look; build only what is listed. Anything else you notice: list it in the handover, never change it.

Admin prerequisite is now LIVE in prod (2 new cancel reasons venue_not_available + no_reason in cancellation_reasons; people_add role `dancing`). Flag VITE_ENABLE_ORGANISER_EDITOR_V2 stays OFF by default.

## Scope (handover "Left" items 1, 2, 4, 7, 9 only)
1. Venue and Picture per night: edit (reuse VenueList / today's upload), through the night's write plan.
2. Night override VALUES: read them (date detail read) so Name/About for this night show the current per-night value. If no read exists, use the existing RPC the admin night screen uses; no migration here (zero migrations in this repo).
4. Sessions: session list, per-night sessions via `organiser_set_occurrence_programme_v1` (teaching/djing/dancing), Cancel / Bring back, the removal warning; plug into write plan order 2.
7. One save bar across event page + night; leaving with unsaved changes asks (unsaved sheet already exists).
9. `npm run lint`, `npm run pre-ship`, prod-shape survey (read-only counts on project stsdtacfauprzrdebmzg, lists over 100 rows), flag-OFF vs main screenshot proof (identical), flag-ON walk at 390x844 incl. the new parts. Add tests for new plan steps. Open the PR (bot, body from ~/.claude/docs/pr-body-template.md, with a "Verified on real data" block and the shots).

## Not in this round
Items 3, 5, 6 of the handover (Music/Repeat/Who runs it, bulk cancel, copy from another date, links, price list, typed-sheet outside tap). Next round.

## Done when
PR open, CI green or only billing-red, flag-ON walk shots in the PR, handover updated with what is left. PARTIAL marker if context gate hits.
