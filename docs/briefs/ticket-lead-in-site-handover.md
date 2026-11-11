# Handover: ticket-lead-in-site

Done: `ticketingLive` helper; sticky bar hides external link while live (shows only when quiet); `onTicketingLive` -> BentoPage JSON-LD offer url (ours when live); tests RED first then green; docs (organiser.md I8, design record). Hero block / StickyTicketButton have no importers: untouched. FestivalDetail has no in-site sales: untouched.
Left: 390x844 walk on Ritmo's page (not done, no prod browser here), full CI jobs, PR body.
tsc run on HEAD: 0 errors. vitest src/modules/event-page + tickets: 1135 passed. check:mojibake clean.
