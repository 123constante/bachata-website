# Handover: ticket-lead-in-site

Done: `ticketingLive` helper; sticky bar hides external link while live (shows only when quiet); `onTicketingLive` -> BentoPage JSON-LD offer url (ours when live); tests RED first then green; docs (organiser.md I8, design record). Hero block / StickyTicketButton have no importers: untouched. FestivalDetail has no in-site sales: untouched.
Left: 390x844 walk on Ritmo's page (not done, no prod browser here), full CI jobs, PR body.
tsc run on HEAD: 0 errors. vitest src/modules/event-page + tickets: 1135 passed. check:mojibake clean.

## Fix round 1 (brief ticket-lead-in-site-fix1)
Done: (1) pending probe renders a placeholder, no flash of her link (probe silent while isPending, 4s timeout fallback); (2) JSON-LD stays client-flipped, trade-off recorded as an open owner decision in the design record; (3) JSON-LD/onTicketingLive table via `ticketOfferUrl` helper; (4) mixed-nights mock filters by occurrenceId, added not-open-night row, ended row; (5) docs I8 + HANDOVER-6 note; (6) test header comment. Pending test confirmed red on old code.
Left: 390x844 walk on Ritmo's page (no prod browser here), PR body update (no gh; owner or tool).
