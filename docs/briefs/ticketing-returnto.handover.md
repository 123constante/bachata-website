# Handover: ticketing returnTo

Done: ticket sign-in links (My tickets signed-out state, checkout guest note) now pass returnTo=/account/my-tickets; shouldHonorReturnTo honours exactly /account/my-tickets and /app/tickets on a sign-up with organiserSelfServe OFF. AuthCallback calls the same function (no twin). The checkout guest-note test, which pinned the old return-to-event behaviour, was updated.
Left: nothing. Next: lead's one read-only auth review before merge.
tsc run on HEAD: 0 errors in branch files.
