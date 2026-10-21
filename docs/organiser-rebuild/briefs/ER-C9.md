# ER-C9 (website-screen): one date and bulk

Branch `claude/er-c9-dates` from `claude/er-wave1` (named in your prompt). Rules 8, 9; D1 gaps "One date"; D1 APPROVED (one date saves at once with ONE "Save this date"). Read ER-COMMON.

`src/modules/organiser/dates/**`: the date sheet holds time shift (shift ALL its sessions), venue for this date only, this date's sessions and line-up (C4 card), add a session to this date only, copy changes from another date, one-off move to another day; tag "Own changes"/"Own times"; cancel a date WITH a reason from the SERVER list (Venue closed / Teacher unavailable / Bank holiday / Low signups / Other), no free text, stays visible as Cancelled; REMOVE "Take this date off"; one-off says "Cancel the event"; bulk cancel/move keeps working as today (move = time AND venue). Edits on a date never touch the series' "Update live event".

Tests: table over date shapes (own changes, cancelled, past, one-off, in a festival); reason required; bulk; untouched save sends nothing. Touches only `src/modules/organiser/dates/**`.
