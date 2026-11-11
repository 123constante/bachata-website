# Handover: ticket-lead-in-site

Done: `ticketingLive` helper; sticky bar hides external link while live (shows only when quiet); `onTicketingLive` -> BentoPage JSON-LD offer url (ours when live); tests RED first then green; docs (organiser.md I8, design record). Hero block / StickyTicketButton have no importers: untouched. FestivalDetail has no in-site sales: untouched.
Left: 390x844 walk on Ritmo's page (not done, no prod browser here), full CI jobs, PR body.
tsc run on HEAD: 0 errors. vitest src/modules/event-page + tickets: 1135 passed. check:mojibake clean.

## Fix round 1 (brief ticket-lead-in-site-fix1)
Done: (1) pending probe renders a placeholder, no flash of her link (probe silent while isPending, 4s timeout fallback); (2) JSON-LD stays client-flipped, trade-off recorded as an open owner decision in the design record; (3) JSON-LD/onTicketingLive table via `ticketOfferUrl` helper; (4) mixed-nights mock filters by occurrenceId, added not-open-night row, ended row; (5) docs I8 + HANDOVER-6 note; (6) test header comment. Pending test confirmed red on old code.
Left: 390x844 walk on Ritmo's page (no prod browser here), PR body update (no gh; owner or tool).

## Fix round 2 (brief ticket-lead-in-site-fix2)
Done: 1a placeholder only while this night's probe is in flight; 1b timeout locks her link for the night (no late swap); 1c probe answer + live flag keyed by night in the bar and in BentoPage (JSON-LD); page-level table test rendering BentoPage + JSON-LD; nightControls test updated for the new onResult(series, night, state, label) signature; design record section.
Red-first: on 0f754c18a the timeout and the night-switch tests fail (2 of 13); the other 11 shape rows pass on both (they guard against regression; 1a's resolved-none path did not reproduce as broken).
Walk: 390x844 local dev against prod data (flag on): Ritmo is a festival page (her link, unchanged); sabor-sundays real (no types: her link); fixture live/sold-out/hang on sabor-sundays. Screenshots in docs/briefs/ticket-lead-in-site-fix2-shots/. Bar buttons >= 44px and contrast >= 4.5; "Tickets elsewhere" 116x25 is pre-existing on main.
PR body updated (per-job CI on b0560a5; 3 jobs were still running when written).
tsc run on b0560a5 code (unchanged since): 0 errors in branch files.
Left / next: owner decision on JSON-LD server-side vs client flip; confirm unit (Europe/London), e2e-smoke, phone-qa (1) on the final head.
