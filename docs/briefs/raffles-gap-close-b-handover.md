# Handover: /raffles Spotlight C gap-close B

Branch `claude/raffles-gap-close-b`. Built behind `flags.raffleV2 && flags.raffleRedesign`; no new flag.

## Done (every checklist line)
- Night card: "Enter" pill unchanged; entered = ghost button (tick + "You're in", inset accent ring) + 84px seal over the poster (`rd-seal`, 0.7s pop; reduced motion = none).
- "Entered" = the board's existing `joined` state (`isRafflePoolJoined` / `markRafflePoolJoined`); no new storage.
- Tapping an entered card button: 18-piece burst (power 6) from the button, no dialog. Repo's `triggerMicroConfetti` cannot do power/spread, so a small canvas burst lives in RaffleRedesignA (no dependency). Reduced motion = none.
- Dialog (`redesign` only, plus new optional `nightName` prop for the for-line): eyebrow, h2, for-line (picked / not picked), label, placeholder, note, submit, both error lines, shake + refocus, done state (88px tick disc, drawn tick, "You're in!", text, Done).
- Party: `rd-party` on the board root for 4500ms (beams 1.1s, brighter gradient); 7 bursts 260ms apart, 46 pieces, x 15-85%, y 12-52%, power 9-13.
- Entries orb counts n -> n+1 over 500ms (reduced motion = jump). Shown +1 only while the board's pool count still equals the count at entry, so a refetch cannot double count.

## Deviations / noticed, left as today
- Redesign dialog uses the shared `PhoneInput` directly (lazy, tone raffle) instead of `RafflePhoneInput`, because the wrapper cannot pass `placeholder`/`error` and is outside the touch list. Same field, same chunk.
- Redesign: the submit button is enabled while the number is invalid (so the error lines can show); non-redesign unchanged.
- Redesign success no longer shows the toast, the old confetti or the 2.5s auto-close; the Done button closes.
- Privacy line and Cancel button stay in the sheet as today (prototype has neither; not in the brief).
- Old `.rd-card-in` CSS rule is now unused.
- `ack` states (already in / already won) keep today's card.

## TAP TABLE
| button | destination | prototype/OLD |
|---|---|---|
| Enter (card, not entered) | entry sheet with "You picked <night>" | prototype |
| You're in (card, entered) | 18-piece confetti burst, no dialog | prototype |
| Enter the raffle (sticky bar) | entry sheet, no night | prototype |
| Enter the raffle (sheet submit) | done state; party, confetti, orb +1 | prototype |
| Done (sheet) | closes sheet, focus returns to trigger | prototype |
| Cancel (sheet) | closes sheet | OLD (kept, not in brief) |

tsc: `tsc -p tsconfig.app.json` run; 0 errors in branch files.
