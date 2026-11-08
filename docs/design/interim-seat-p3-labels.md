# Design: interim manager seat in the organiser area

**One design.** `parseOwnership` keeps `seat_kind`. One pure mapping in `teamRules.ts` (`teamAddOffer`, `ownRowLabel`, `ticketsRow`) drives three screens. An interim manager sees "Interim manager" on their own Team row. "Add someone" becomes "Share a join link" (shares or copies `/organisers/:id`, confirms "Link copied") with one line saying the person taps "Ask to join" themselves. The You tab hides Get paid and says "Ticket tools are for the page owner. Message us if you need them."

**Why.** The database refuses interim callers `interim_cannot_add` and ticket tools. Showing the buttons promised something we cannot do. While the seat is unknown (loading, error) nothing is hidden early: null behaves as today.

**Alternative A: disable Add with a reason.** Honest, but leaves a dead control and gives the person no way forward. Rejected.
**Alternative B: hide Add and Get paid silently.** Least code, but the person wonders where the buttons went. Rejected.

Walk at 390x844: owner, normal manager, interim, signed-out (see PR).
