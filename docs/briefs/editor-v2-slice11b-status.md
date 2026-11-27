# Brief: Editor v2 slice 11b, "Pause, end or cancel" card + status sheets on the Every tab

Branch: claude/editor-v2-s1c
Size: 4 files, 380 lines
Repo: 123constante/bachata-website. Flag `organiserEditorV2` stays OFF; zero migrations; no admin change.

The prototype file is NOT reachable from the cloud. Everything needed is embedded below; it is the spec, copy words exactly. Slices 1-11a are on the branch: read `docs/briefs/editor-v2-slice11a-repeats.handover.md` and `10b` first (`EveryBody.tsx` `Line`, `send`, `saveNow`, `V2Sheet`, `RepeatSheetV2.tsx` as the pattern for a sheet + 2nd sheet). DESIGN-REGISTRY rows 61-81 win over this brief. Owner answers (registry "BUILD ANSWERS 2026-11-21"): ended/cancelled CAN go live again; "Pause" stays as in the prototype copy.

## Files (touch only these)
- src/modules/organiser/p3/v2/EndCard.tsx (new): the group + card + slim rows
- src/modules/organiser/p3/v2/StatusSheets.tsx (new): Pause/End sheet, Cancel-the-event sheet
- src/modules/organiser/p3/v2/EveryBody.tsx: mount `EndCard` at the bottom of the Every tab (weekly), sheet state, the save functions. Nothing else.
- src/modules/organiser/p3/v2/copy.ts (add lines) + `__tests__/everyStatus.test.tsx` (new). If 4 files is too few, `copy.ts` and the test count as the 4th and 5th; stay within 5 files / 400 lines.
Do NOT edit editorModel.ts, NightCard, SaveBar, saveNow.ts, anything in `shared/`, `dates/`, `events/`. Files over 2 KB: `scripts/safe-edit.py` / `scripts/safe-write.py`. JSX entities only, explicit px for sizes.

## Prototype (copy exactly)
```
endCard(): status st = Live|Paused|Ended|Cancelled
 endSub = oneOff ? 'Dancers see it as ended.' : (endDate && st==='Live') ? 'Ends after <long date>. Tap to change the date.' : 'No new nights after a date you pick. Past nights stay.'
 <div class=card>
  st!=='Live'          -> row liveAgain  "Make it live again" / "<st> now. Dancers see it as <st lowercase>."   (e.g. "Paused now. Dancers see it as paused.")
  st Live|Ended        -> row pauseAsk(Paused) "Pause the event" / "Dancers see it as paused. You can start it again."
  st Live|Paused       -> row pauseAsk(Ended)  "End the event" / endSub
  weekly:  st==='Cancelled' -> STATIC red row (no chevron, no tap) "Event cancelled" + second line "Reason: <reason>" (only if a reason)
           else row cancelEvent (red, title #B42318) "Cancel the event" / "Dancers see every night as cancelled, with your reason."
 group heading "Pause, end or cancel"; slim rows: min height 52px, padding 8px 16px, 1px #E9E9E9 between rows, title weight 600, 2nd line 13px #696969, chevron
pauseAsk(st): keep = Live:'Keep it live' | Paused:'Keep it paused' | Ended:'Keep it ended' | Cancelled:'Keep it cancelled'
  sheet title st==='Paused' ? 'Pause the event?' : 'End the event?'
  text: Paused: 'Dancers see it as paused. You can start it again any time.' ; Ended weekly: 'No new nights after the date you pick. Past nights stay.' ; Ended one-off: 'Dancers see it as ended.'
  Ended weekly only: date field 'Last night (leave empty to end it today)' (value = current end date)
  buttons: primary (Paused: 'Pause the event' / Ended: danger solid 'End the event') -> statusDo ; secondary <keep> -> close
statusDo(st): last = Ended&&weekly ? field value : ''
  if last && last >= first upcoming date -> save end date only, status STAYS Live, toast 'Ends after <long date>'
  else status = st, toast Paused:'Event paused' / Ended:'Event ended'      (all with Undo)
liveAgain: no sheet; saves at once; status Live, cancel reason cleared; toast 'Event is live again' (Undo); pill 'Live'
cancelEvent sheet 'Cancel the event':
  <p> 'Every upcoming date shows Cancelled and your reason to dancers.'
  if tickets sold (and pay=here): warn box '<n> ticket(s) sold. We will email buyers. Refunds are sorted separately.'  (reuse SoldWarning in CancelNight.tsx if the wording matches, else plain)
  radios 'Venue not available' (checked) | 'No reason' ; hint 'This takes effect straight away.'
  buttons danger solid 'Cancel the event' -> cancelEventDo ; secondary 'Keep the event' -> close
cancelEventDo: status Cancelled, reason = picked ('' for No reason); toast 'Event cancelled' (NO Undo); pill 'Cancelled' on both tabs, every chip tagged Cancelled, static row, row 'Make it live again'
```

## Real-rule mapping (server is the authority; read, do not invent)
- Pause / Make it live again: ONE `series.set_lifecycle {to:'paused'|'live'}` via `lifecycleCommand` (`shared/seriesCommands.ts`). `before` for Undo = `{ to: <old lifecycle_status> }` (inverseOf handles `series.set_lifecycle`; if the old state is `ended`/`cancelled` and inverseOf cannot restore it, say so in the handover).
- End the event: read `events/eventSteps.ts`, `flows/event/EventStep.tsx` and `events/eventModel.ts` (`endRunCommand`, `stopRepeatingCommand`, `weeklyUntilCommand`, `todaySession`) for how the existing editor ends a weekly event today and which command each branch uses. With a later last night: the same command the old editor uses for "ends after <date>" (set_recurrence until_date via `dayChangeCommand`/`weeklyUntilCommand` or stop_repeating); with no date: `series.end_run` (`endRunCommand`; if today holds a live date it needs `today_session`: reuse the old editor's handling, same words). One-off: end = the old one-off ending command in the same files.
- Cancel the event (weekly): look for the real command (`series.cancel_*`, `occurrence.cancel` per upcoming night, or the cancel flow in `flows/cancel/`). Use what the OLD editor uses; reason strings per `shared/cancelLabel.ts`. If NO server command can cancel a whole weekly event, or `ended`/`cancelled` -> live has no allowed transition, DO NOT invent one: build everything else, leave that row's tap un-wired, and list it under "Not buildable" with the exact missing command; the orchestrator will tell the owner.
- Sold tickets count for the warning: use the same source the night cancel sheet uses (`soldCount`); 0 when unknown.
- Hide "Cancel the event" and the cancelled static row for one-off events (O-screen has its own, not this slice).

## Checklist (every item built; tick in handover)
- [ ] E-18 heading "Pause, end or cancel" ; E-19 card slim rows (52px / 8px 16px / 1px #E9E9E9 / bold 600 / 13px #696969 / chevron)
- [ ] E-20 Pause row (Live or Ended) ; E-21 End row (Live or Paused) ; E-22 End 2nd line with end date when Live
- [ ] E-23 Make it live again (not Live) with "<Status> now. Dancers see it as <status>." ; E-24 red Cancel row ; E-25 static red "Event cancelled" / "Reason: <reason>"
- [ ] SH-STATUS-01..07 ; SH-CANCELE-01..07 (as prototype above)
- [ ] pill + chips + tab state update after each action (they come from the refetched workspace)

## Tap table (put in `docs/briefs/editor-v2-slice11b-status.handover.md`; columns button | destination | prototype/OLD; any OLD = not done)
| 29 | Make it live again | card | no sheet; pill "Live"; toast "Event is live again" + Undo |
| 30 | Pause the event | card | Sheet "Pause the event?" |
| 31 | End the event | card | Sheet "End the event?" |
| 32 | Cancel the event | card (weekly) | Sheet "Cancel the event" |
| 82 | Pause the event | sheet Pause the event? | closes; pill "Paused"; toast "Event paused" + Undo |
| 83 | End the event | sheet End the event? | later date: stays Live, toast "Ends after <date>"; no date: pill "Ended", toast "Event ended"; both + Undo |
| 84 | Keep it live / paused / ended / cancelled | status sheets | closes |
| 85 | Cancel the event | sheet Cancel the event | closes; pill "Cancelled"; toast "Event cancelled" (no Undo) |
| 86 | Keep the event | sheet Cancel the event | closes |
Tests: render EveryBody for each status (Live/Paused/Ended/Cancelled) and assert rows + second lines exactly; each sheet's text/buttons; the exact command kind + payload per action and `before`; toasts; "Keep" paths send nothing; cancel has no Undo; end with a later date keeps status.

## Handover
Write the handover file named above: built, filled tap table, deviations, not-buildable (exact), files + line counts, tests run (`npx vitest run src/modules/organiser/p3/v2`, tsc `-p tsconfig.app.json`, eslint on your files; pre-existing errors in eventPage.proto.test.ts tsc and V2Sheet.tsx eslint are not yours). Push to `claude/editor-v2-s1c` per the dispatch rules; open no PR.
