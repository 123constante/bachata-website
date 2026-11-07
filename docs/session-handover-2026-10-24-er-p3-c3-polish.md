# Handover 2026-10-24: ER P3 C3 polish (R-C3-polish)

Branch `claude/er-p3-mock-c3`, base 276ada3. Mockup only (`docs/organiser-rebuild/p3/mockups/C3.html`, `C3.md`,
`selfcheck/C3-probes.mjs`, `selfcheck/C3-sweep.mjs`). No product code, no PR.

## Per item

| Item | Status | What |
|---|---|---|
| W1 header ignores forward change | fixed | `startPhrase(list, fb, long, e)`: with the event it reads sessions as they apply to the NEXT live date (base + `from` segments with d <= that date). A later segment that changes a start time is appended in the long form: "Every Friday · Party 9pm, class from 8pm (8:30pm from Fri 30 Oct)". Short rows (Events, Home, Stats, hero) show the next date's time: after "From Fri 30 Oct on", tonight's 8pm is what they still say, as the brief asks. The wizard review passes no event, so it is unchanged. |
| W2 sheet button promises | fixed | `sessSaveLabel()`: "Save" when the "Which dates?" step follows; "Save for all dates" only when nothing follows (e.g. an event with no later dates). Used by the sheet draw and both input handlers. |
| W3 duplicate start line | fixed | Line 3 is "Ends 1am the next day" only. |
| B1 lookalike names | fixed | "Sofie Lane" -> "Lena Ortiz"; "Marco & Sofia" -> "Marco & Elena" (HTML, C3.md, probes). "Sofia Ramos" stays. |
| B2 one line-up flow | fixed | See door list. `openLineup(k, di, scope, target)` is the one entry. |
| B3 Pause -> Hide | fixed | See string sweep. Internal ids (`data-sheet="pause"`, `status:'paused'`, `.tag.paused`) kept: never shown. |

## B2: line-up doors (before -> after)

| Door | Before | After |
|---|---|---|
| Event page row "Line-up · N people" | `lineupscope` sheet (or straight in with one date) | Row title "Change line-up" (sub: "N people: names"); `lineupscope`, pre-set **Every date** |
| Date sheet "Change line-up" | a different sheet (`scope`, same title) | `lineupscope`, pre-set **Just Fri 30 Oct** |
| Session sheet "Change line-up" (from event) | straight to the line-up screen | `lineupscope`, pre-set Every date, then opens on that session |
| Session sheet "Change line-up" (from a date) | straight to the line-up screen | `lineupscope`, pre-set Just that date, then opens on that session |
| Home "Next up" button "Line-up" | straight in, next date only | label "Change line-up"; `lineupscope`, pre-set Just the next date |
| Home Needs-you "Add the teachers..." (course) | straight in | `lineupscope`, pre-set Every date |
| Pick dates > "Change the line-up on these dates" | straight in, picked dates | label "Change line-up"; **still goes straight in**: the dates were already chosen, a "which dates?" sheet would contradict the picks |
| Preview block "Line-up" | heading only, not a door | unchanged |

No door removed (none duplicated another on the same screen). Skip: an event with one live date (or a one-off, or no
dates) goes straight in, nothing to choose. Sheet options: "Just <date>" / "Every date" (or "This and later ones" when
opened from a later date). Probe `R-pol-lineup` checks five doors open the same sheet with the right pre-set and label.

## B3: every "Pause" string (sweep)

Changed: status chip/group heading "Paused" -> "Hidden" (Events list, Home); Status row sub "Pause or end it" -> "Hide or
end it" (and "Turn it back on, or end it" -> "Show it again, or end it"); Status sheet action "Pause this event" -> "Hide
from the calendar", sub -> "Dancers can't see it until you show it again. Dates kept."; confirm sheet "Pause <name>?" ->
"Hide <name>?", button "Pause it" -> "Hide it"; state "Paused · dancers can't see it" -> "Hidden · dancers can't see it";
"Turn back on" (page bar, Home card, status sheet, greyed finished row) -> "Show it again"; toast "Paused..." ->
"Hidden. Dancers can't see it now."; undo toast "is live again" -> "is showing again"; "pause it any time" (all-dates note,
wizard note) -> "hide it any time"; "Pause hides it" (delete note) -> "Hide keeps it off the calendar"; hidden-card line
"turn it back on" -> "show it again". C3.md: tour, fix table, status list. Probe `R-pol-hide` walks event, status
sheet, hide sheet, toast, hidden page, Home, Events, show-again toast: 0 "pause" in any.

## Probes

110 / 110 (104 + 6 `R-pol-*`: w1, w2, w3, names, lineup, hide). Red-first: against `git show 276ada3:...C3.html` all 6 fail.
Changed on purpose: F13, #8c, #8d (new Hide wording); every probe that tapped a Home or course line-up button now also
taps "Next" on the sheet (`data-lineup-go`) because those doors open the sheet first; the R-fwd line-up probe uses
`data-lineup-go` for the same reason (date-sheet door now opens `lineupscope`; move/cancel still use `data-scope-go`).
Sweep: 117 states + 6 keyboard states, 714 runs, 0 contrast / taps / overflow / under-bar / K1 / theme / toast / keyboard,
0 console errors. New sweep states: shLineupHome, shLineupDate, hiddenEv, fwdHeader.

## Screenshots looked at

390x844 light + dark: Fridays header after "From Fri 30 Oct on" (light seen, dark taken), line-up first sheet from the
event, date and Home doors (event light, date dark seen), Hide sheet, Hidden event page (dark seen), date sheet for
30 Oct (light seen: "Lena Ortiz", "Marco & Elena"). 1280x800 dark: event page. Not every light/dark pair was opened by
me; the sweep covers contrast for all.

## Not done / notes

Home "All your events" vs "This week" untouched; Stats untouched. After "From Fri 30 Oct on" the Events/Home rows still
say 8pm (next date's time, per the brief): the doubt "did it save?" is answered on the event header only.
