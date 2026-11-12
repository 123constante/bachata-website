# Brief: organiser dashboard option A, apply Opus critique fixes (admin #1544, parent #1531)
Lane normal, Opus. Docs/design only. Find the option-A organiser mockups under docs/design. Apply ALL fixes below, re-run design checks, re-shoot 390x844 for: no-events, upcoming, selling, huge, all-zero, cancelled. Screenshots in the PR.

1 Light theme (contract + owner): bg #F7F6F3, card #FFFFFF, line #E4E1DA, text #1A1916, mute #5F5B54; gold text/links dark gold ~#8A6414 (>=4.5:1), bright gold only as button fill with ink text; light chip bgs and borders.
2 One gold primary per screen once a night exists: "Share this night" (WhatsApp with night link). Share my page / Copy / WhatsApp / Caption secondary.
3 Going is NOT a headline tile: one line in the card ("3 going"); zero = hint with action.
4 No "N more" link to #: max 4 tiles (Tickets sold if >0, Opens, Ticket link taps, Share taps); other positive types in one muted line ("4 WhatsApp taps · 7 directions taps"). Detail view, if kept, labelled "Night details".
5 Label "People who opened" + note "counted once per person per day" (tiles and later-night rows).
6 Cancelled: primary "Share the cancellation" (prefilled WhatsApp text); Undo = quiet text link with confirm "Put this night back on the calendar?"; consider compact notice and give main card to next live night.
7 Huge state: Ticket link taps must differ from Tickets sold (mock 2 different numbers); add mapping test that they come from different sources.
8 No-events copy: city unknown = "dancers near you"; known = step "Add a photo".
Minor: WhatsApp button padding ~6px at 390; use 2+1 rows or icon + label under.
Passing: 6,013/63,576 fit; long names clamp 2 lines; no zero printed; ratings always shown; city avg only London; taps >=44.
