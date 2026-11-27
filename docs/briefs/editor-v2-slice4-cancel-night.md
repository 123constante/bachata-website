# Brief: Editor v2 slice 4, Cancel and bring back a night

Branch: claude/editor-v2-s1c
Size: 4 files, 260 lines
Repo: 123constante/bachata-website. Flag `organiserEditorV2` stays OFF; zero migrations; no admin change.

The prototype file is NOT reachable from the cloud. Everything you need from it is embedded below (CSS, markup, copy). The embedded snippets are the spec: copy sizes, colours and words exactly. Slices 1-3 are on the branch: read `docs/briefs/editor-v2-slice3-night-card.handover.md` first (NightCard, Facts, DatesSheet, V2Sheet, V2Toast, `useSaveNow`). DESIGN-REGISTRY rows 61-81 win over this brief.

## Files (touch only these)
- src/modules/organiser/p3/v2/CancelNight.tsx (new): `CancelNightSheet` and `BringBackSheet` (both use `V2Sheet`), plus `NightCancelArea` (the button + line under the facts)
- src/modules/organiser/p3/v2/NightCard.tsx: render `NightCancelArea` as the last child inside `.fb-list`; add props `onCancelNight(reason)`, `onBringBack()`
- src/modules/organiser/p3/v2/copy.ts: add the lines below
- src/modules/organiser/p3/v2/__tests__/cancelNight.test.tsx (new)
Plus minimum wiring in `v2/EditorV2.tsx` (max 15 lines: pass the two handlers, which call `saveNow`) and CSS appended under `.ev2` in `v2/v2.css` (max 30 lines). Do NOT edit SaveBar, EventPageV2, NightV2, screens/*, R4*, saveNow.ts, editorModel.ts. Files over 2 KB: `scripts/safe-edit.py` / `scripts/safe-write.py`. JSX entities only, explicit px for sizes (phone html font is 13.5px), full weekday names.

## Build
1. Cancel step = existing `cancelCommand(reason)` / `uncancelCommand()` from `src/modules/organiser/shared/seriesCommands.ts` (`occurrence.cancel`), run through slice-1 `saveNow` with `{ noUndo: true }` (prototype: both toasts have NO Undo). The inverse already exists in `editorModel.inverseOf`; do not use it here. A one-off event (single date) uses the existing `series.cancel_one_off` path exactly as `eventPage.ts` line ~286 does today (read it; reuse, do not reinvent). Toasts: "Cancelled <full date>" and "Brought back <full date>" (full date = `fullDate(date.occurrence_date)` without year, as the card does).
2. The night is "cancelled" when `date.lifecycle_status === 'cancelled'`. Whole event cancelled = `ws.series.lifecycle_status === 'cancelled'`: show only the line "The whole event is cancelled. Reason: <reason>." and NO button (N-30). Reason of the event: from the series cancellation reason if the workspace has it, else omit the " Reason: ..." part.
3. Reasons radios: prototype shows two radios, "Venue not available" (checked) and "No reason". The saved reason must be a label from `useCancelReasons()` (screens/CancelEventSheet.tsx, never hard-code a list beyond these two). Rule: "Venue not available" sends the label from the reasons list that matches it case-insensitively; if none matches, send the first label and say so in the handover. "No reason" sends `cancelCommand('')`; if the command builder or server refuses an empty reason, DO NOT change the prototype: report it as a blocker in the handover with the exact refusal text and keep the radio.
4. Warning box (SH-CANCELN-03) shows only when tickets are sold on this night and the event takes payment here: the slice-3 NightCard has no ticket data yet. Read sold count from the workspace if it is there (`ws` date row or `fetchDateDetail`); if it is not there, render the box component and its test with a `soldCount` prop, wire `0` and say in the handover that slice 15 (money/tickets) supplies it. Do not invent a number.
5. Button disabled (never hidden) while `busy` or the editor has unsaved changes is NOT in the prototype: the prototype acts at once. Do not add that rule. While the call runs, disable both sheet buttons.
6. After cancel: chip tag "Cancelled" and pill "Cancelled" already come from slice 3 (`pill x`, DatesSheet tag). Verify they appear; fix only in the files you own.

## Embedded prototype (spec)
```
fact area bottom of .fb-list (S.status==='Cancelled' = whole event):
  whole event cancelled -> <div class="why">The whole event is cancelled. Reason: {reason}.</div>   (no button)
  night cancelled       -> <div><button class="btn sec" data-act="bringBack">Bring this night back</button><div class="why">Cancelled. Reason: {reason}.</div></div>   (" Reason: x." omitted when no reason)
  else                  -> <div><button class="btn dan fcan" data-act="cancelNight">Cancel this night</button><div class="why">Dancers see it as cancelled.</div></div>
sheet Cancel: title 'Cancel '+longDate+'?' ; body in order:
  <p class="txt">Dancers see this night as cancelled, with your reason.</p>
  {sold ? <p class="warn">{n} ticket(s) sold. We will email buyers. Refunds are sorted separately.</p>}   (plural: "1 ticket", "2 tickets")
  <div><label class="radio"><input type="radio" name="reason" value="Venue not available" checked> Venue not available</label><label class="radio"><input type="radio" name="reason" value=""> No reason</label></div>
  <p class="hint">This takes effect straight away.</p>
  <button class="btn dan solid">Cancel this night</button>   <button class="btn sec">Keep this night</button> (closes sheet, changes nothing)
sheet Bring back: title 'Bring '+longDate+' back?' ; <p class="txt">Dancers see this night again.</p><button class="btn pri">Bring it back</button><button class="btn sec">Keep it cancelled</button>
after either action: sheet closes, card re-renders, toast with NO Undo.
CSS:
.btn{min-height:48px;border-radius:8px;display:grid;place-items:center;font-weight:600;width:100%;border:1px solid transparent;padding:6px 12px;text-align:center}
.btn.pri{background:var(--p-acc);color:#FFF}
.btn.dan{background:#FFF;color:var(--p-danger);border-color:var(--p-line)}
.btn.dan.solid{background:var(--p-danger);color:#FFF;border-color:var(--p-danger)}
.btn.dan.fcan{border:1.5px solid var(--p-danger);border-bottom-width:4px}
.btn.sec{background:#FFF;color:var(--p-fg);border-color:#CFCFCF}
.why{font-size:13px;color:var(--p-mut2);text-align:center;margin-top:6px}
.hint{font-size:13px;color:var(--p-mut2);margin:0}
.warn{font-size:14px;color:#8A4B00;background:#FFF6E0;border-radius:8px;padding:10px 12px;margin:0}
.txt{margin:0;font-size:15px;color:var(--p-mut)}
.radio{display:flex;align-items:center;gap:10px;min-height:48px;font-size:16px}
.radio input{width:22px;height:22px;accent-color:var(--p-acc)}
```
Colour tokens: `--p-danger` #B42318, `--p-acc` the editor accent already in `v2.css`, `--p-mut2` #696969. Reuse the v2.css tokens/classes slice 2 and 3 already define; add only what is missing, scoped under `.ev2`. Sheet body spacing is the V2Sheet's own 14px gap.

Copy exactly: "Cancel this night" / "Dancers see it as cancelled." / "Bring this night back" / "Cancelled." / " Reason: <reason>." / "The whole event is cancelled." / "Cancel <date>?" / "Dancers see this night as cancelled, with your reason." / "<n> tickets sold. We will email buyers. Refunds are sorted separately." / "Venue not available" / "No reason" / "This takes effect straight away." / "Keep this night" / "Cancelled <date>" / "Bring <date> back?" / "Dancers see this night again." / "Bring it back" / "Keep it cancelled" / "Brought back <date>".

## Prototype checklist (every line is built; any tap that leaves the prototype = not done)
- [ ] N-27 button "Cancel this night": white, #B42318 text, border 1.5px #B42318 with 4px bottom; opens sheet "Cancel <date>?"
- [ ] N-28 line under it "Dancers see it as cancelled." 13px #696969 centred, 6px above
- [ ] N-29 cancelled night: button "Bring this night back" (secondary) instead; line "Cancelled. Reason: <reason>."
- [ ] N-30 whole event cancelled: no button; line "The whole event is cancelled. Reason: <reason>."
- [ ] SH-CANCELN-01..08 as embedded above (title, text, sold warning, two radios, hint, danger-solid button + toast no Undo, Keep button closes, after-cancel state)
- [ ] SH-BRING-01..04 as embedded above
- [ ] G-toast: both toasts show no Undo link

## Tap table (put the filled table in the handover `docs/briefs/editor-v2-slice4-cancel-night.handover.md`; columns: button | destination | prototype/OLD; any OLD = not done)
| # | Button | Where | Result |
| 13 | Cancel this night | under the facts | Sheet "Cancel <date>?" |
| 14 | Bring this night back | under the facts, cancelled night | Sheet "Bring <date> back?" |
| 70 | Cancel this night | sheet | closes; night cancelled with picked reason; toast "Cancelled <date>", no Undo |
| 71 | Keep this night | sheet | closes, nothing saved |
| 72 | Bring it back | sheet | closes; night live; toast "Brought back <date>", no Undo |
| 73 | Keep it cancelled | sheet | closes |

## Tests (cancelNight.test.tsx, vitest)
Button states for live / cancelled night / cancelled event; sheet copy exact; radio default "Venue not available"; "No reason" sends empty reason; keep buttons save nothing; toasts have no Undo; one-off uses the one-off command; sold warning plural; handlers disabled while a call runs.

## Handover
Write `docs/briefs/editor-v2-slice4-cancel-night.handover.md`: what was built, the filled tap table, every blocker or assumption (reason label match, empty reason refusal, sold count source), files and line counts. Open no PR; push to `claude/editor-v2-s1c` as the dispatch rules say.
