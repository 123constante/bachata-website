# Walk: PR #1278 save toasts at 390x844

Branch under test: `claude/p3-save-copy-drafts-v2` @ 45b8b6f. Spec: `tests/e2e/walk-p3-save-copy-r1.spec.ts` (Chromium, 390x844, organiser fake with mocked network, no prod access). Raw data: `results.json`. No `src` edits.

Per cell: one field changed (Details: name; Prices: one price row "Entry" 10; Session: add a party "Late social"), Save tapped, toast read from the DOM and screenshotted. "One date" = one-off, no recurrence; "several" = weekly Fridays 16 Oct to 27 Nov.

## Verdict

**0 wording findings. 0 unreadable or hidden toasts.** All 18 toasts match saveWords.ts byte for byte, sit inside the viewport above the tab bar, are the topmost element, are not clipped, and cause no sideways scroll.

## Table (lifecycle x dates x screen)

| Lifecycle | Dates | Screen | Toast text (as shown) | Words match | Readable (in view, not covered, not clipped) | Save button | Result |
|---|---|---|---|---|---|---|---|
| draft | one | details | Saved as a draft. Dancers do not see it yet. | yes | yes | "Save" 44px | PASS ([picture](draft-one-details.png)) |
| draft | one | prices | Saved as a draft. Dancers do not see it yet. | yes | yes | "Save" 44px | PASS ([picture](draft-one-prices.png)) |
| draft | one | session | Session added to every date as a draft. Dancers do not see it yet. | yes | yes | "Add this session" 44px | PASS ([picture](draft-one-session.png)) |
| draft | several | details | Saved for all dates as a draft. Dancers do not see it yet. A date with its own pictures keeps them. | yes | yes | "Save for all dates" 44px | PASS ([picture](draft-several-details.png)) |
| draft | several | prices | Prices saved as a draft. Dancers do not see them yet. | yes | yes | "Save for all dates" 44px | PASS ([picture](draft-several-prices.png)) |
| draft | several | session | Session added to every date as a draft. Dancers do not see it yet. | yes | yes | "Add this session" 44px | PASS ([picture](draft-several-session.png)) |
| live | one | details | Saved. Dancers see it now. | yes | yes | "Save" 44px | PASS ([picture](live-one-details.png)) |
| live | one | prices | Saved. Dancers see it now. | yes | yes | "Save" 44px | PASS ([picture](live-one-prices.png)) |
| live | one | session | Session added to every date. Dancers see it now. | yes | yes | "Add this session" 44px | PASS ([picture](live-one-session.png)) |
| live | several | details | Saved for all dates. Dancers see it now. A date with its own pictures keeps them. | yes | yes | "Save for all dates" 44px | PASS ([picture](live-several-details.png)) |
| live | several | prices | Prices saved. Dancers see them now. | yes | yes | "Save for all dates" 44px | PASS ([picture](live-several-prices.png)) |
| live | several | session | Session added to every date. Dancers see it now. | yes | yes | "Add this session" 44px | PASS ([picture](live-several-session.png)) |
| paused | one | details | Saved. It is hidden from the calendar. | yes | yes | "Save" 44px | PASS ([picture](paused-one-details.png)) |
| paused | one | prices | Saved. It is hidden from the calendar. | yes | yes | "Save" 44px | PASS ([picture](paused-one-prices.png)) |
| paused | one | session | Session added to every date. It is hidden from the calendar. | yes | yes | "Add this session" 44px | PASS ([picture](paused-one-session.png)) |
| paused | several | details | Saved for all dates. It is hidden from the calendar. A date with its own pictures keeps them. | yes | yes | "Save for all dates" 44px | PASS ([picture](paused-several-details.png)) |
| paused | several | prices | Prices saved. The event is hidden from the calendar. | yes | yes | "Save for all dates" 44px | PASS ([picture](paused-several-prices.png)) |
| paused | several | session | Session added to every date. It is hidden from the calendar. | yes | yes | "Add this session" 44px | PASS ([picture](paused-several-session.png)) |

## Measures

- Tap targets: the toast has no button in any of these 18 cases (no Undo), so there is nothing to tap in it. The Save / Add this session button is 44px tall in every case.
- Toast height 44px (one line) or 47px (two lines); long Details toast ("Saved for all dates ... keeps them.") wraps to two lines, fully visible.
- Sideways scroll: 0px in all 18.
- Toast over the sticky tray or a sheet: never (the save screens return to the event page before the toast shows, so no tray is open).
- The toast sits directly above the bottom tab bar and covers the bottom of the page content for its 8s life (e.g. the "Sessions" heading in draft-several-details.png). Readable, not a finding.

## Console errors

18 entries over the 18 cells, two kinds, all from the fake, none from save copy:
- `Query error: progress_bad_shape` (parseProfileProgress): 26 occurrences. The fake does not return the profile-progress shape the real RPC does. Likely a fixture gap, not an app defect; Not verified against prod.
- React hydration warning "Extra attributes from the server: nonce" (dev SSR): 18 occurrences, dev-only.

## Not verified

- Real server saves (mocked network only, by brief).
- The undo button on toasts (none appeared after these saves).
- Session sheet scope "Just this date" (toasts addedDate / savedDate) and editing an existing session; only "add to every date" was walked.
- After adding a session in the fake, the list showed a row titled "No name yet" (see paused-several-session.png) rather than "Late social". Cannot tell whether the fake does not persist the title or the app mislabels it; worth a look in a real-data walk. Not counted as a finding about save copy.
- Ended / archived / cancelled lifecycles (quiet words) were not walked.
