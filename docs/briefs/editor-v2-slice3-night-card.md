# Brief: Editor v2 slice 3, This-night card (flyer block, name, pill, four facts, tags, Back to usual, All dates)

Branch: claude/editor-v2-s1c
Size: 5 files, 390 lines
Repo: 123constante/bachata-website. Flag `organiserEditorV2` stays OFF; zero migrations; no admin change.

The prototype file is NOT reachable from the cloud. Everything you need from it is embedded below (CSS, markup, copy). The embedded snippets are the spec: copy sizes, colours and words exactly. Slice 1 (save engine) and slice 2 (shell: `v2/EditorV2.tsx`, `v2/V2Sheet.tsx`, `v2/v2.css`) are already on the branch; read `docs/briefs/editor-v2-slice1-save-engine.handover.md` and `docs/briefs/editor-v2-slice2-shell.handover.md` first. DESIGN-REGISTRY rows 61-81 win over this brief.

## Files (touch only these)
- src/modules/organiser/p3/v2/NightCard.tsx (new): flyer block, name row, status pill, facts, cancelled line
- src/modules/organiser/p3/v2/Facts.tsx (new): `Fact` raised button, tag "Only this night", "Back to usual", `priceLabel()`
- src/modules/organiser/p3/v2/DatesSheet.tsx (new): sheet "All dates" using `V2Sheet`
- src/modules/organiser/p3/v2/copy.ts: add the lines below
- src/modules/organiser/p3/v2/__tests__/nightCard.test.tsx (new)
Plus the minimum wiring in `v2/EditorV2.tsx` and `v2/v2.css` (they are the slot owners; max 25 lines in EditorV2, CSS appended under `.ev2`). Do NOT edit SaveBar.tsx, EventPageV2.tsx, NightV2.tsx, screens/*, R4*, saveNow.ts. Files over 2 KB: `scripts/safe-edit.py` / `scripts/safe-write.py`. JSX entities only (`&rsaquo;` `&middot;` `&hellip;`), explicit px for sizes (phone html font is 13.5px), full weekday names, no migrations.

## Build
1. `EditorV2.tsx`: in the "This night" slot (`data-ev2-slot="night"`) render `<NightCard ... />` for the picked night. The `onMoreDates` prop (now wired inside EditorV2) opens `DatesSheet`. Picking a row in it sets `?night=<id>`, closes the sheet, switches tab to "This night", scrolls the page to top.
2. `NightCard`: one `.card` (white, 1px #E9E9E9, radius 8px) holding, in order: flyer block, then `.fb-list` with name row, When fact, Where fact, Price fact, Description fact, then the cancelled/cancel area is NOT in this slice (slice 4). Above the card the label (N-10).
3. Facts open nothing yet except where a later slice builds the sheet: When (slice 7), Where (8), Price (14), Description (8), Flyer and photos pill (9). In this slice the fact buttons and the pill take an optional `onOpen` prop that is `undefined`: the button renders fully (raised, "Change ›") and a tap does nothing. Never link to an old page. Say so in the handover; those tap rows belong to the later slices.
4. "Only this night" tag + "Back to usual" button appear only on a fact this night changed. Changed state comes from the existing `nightFieldState` / `dateTagOf` in `editorModel.ts` and the saved override keys of the picked date (`has_override`, `override_keys`). Facts map: When = sessions, Where = `venue_id`, Price = `door_price`/`prices` when the date has such override keys, Description = `description`, flyer = `cover_image_url`. "Back to usual" calls the existing slice-1 `saveNow` with the inverse step that clears that key; toast "Back to usual for <full date>" with Undo (slice-1 toast). If an override key for a fact does not exist in `override_keys` yet, the fact never shows the tag (do not invent).
5. Price label: pure function `priceLabel(input)` in Facts.tsx, five modes. Inputs you can read from the workspace today: door price / ticket link on the series and the picked date; ticket count and Stripe state may not be in the read: if not, pass mode `none` ("Add a ticket") and write that in the handover (slice 12 supplies `payMode.ts`). Output exactly as the prototype function below.
6. `DatesSheet`: title "All dates", hint, 12 rows (first 12 coming nights; if there are more than 100 dates the read holds the newest 100: show what the workspace has, still max 12 rows).

## Prototype source (embedded)
Tokens (already in v2.css from slice 2; reuse them): `--p-card:#FFFFFF; --p-line:#E9E9E9; --p-fg:#030303; --p-mut:#464646; --p-mut2:#696969; --p-acc:#C2410C; --p-acc-dark:#9A3412; --p-acc-soft:#FFFAF7; --p-acc-edge:#E2A988; --p-danger:#B42318; --p-danger-soft:#FEF3F2; --p-grey:#EFEFEF`.

CSS (port under `.ev2`, keep values):
```
.card{background:var(--p-card);border:1px solid var(--p-line);border-radius:8px}
.lab{font-size:12px;letter-spacing:.06em;text-transform:uppercase;color:var(--p-mut2);font-weight:600}
.grp{display:flex;flex-direction:column;gap:12px}
.flyer{height:150px;display:flex;align-items:flex-end;padding:12px;color:#FFF;font-size:12px;letter-spacing:.06em;text-transform:uppercase;justify-content:space-between;border-radius:7px 7px 0 0}
.flyer.f1{background:linear-gradient(135deg,#7A1F0A,#C2410C 55%,#F2A65A)}  /* use the real flyer image as background-size:cover when the event has one; gradient only as the stand-in */
.flyer.none{background:var(--p-grey);color:var(--p-mut2)}
.fpill{background:#FFF;color:var(--p-fg);font-weight:600;font-size:14px;letter-spacing:0;text-transform:none;min-height:40px;padding:0 14px;border-radius:99px;border:1px solid #CFCFCF;border-bottom-width:3px;box-shadow:0 2px 6px #00000033}
.fb-list{padding:14px 12px;display:flex;flex-direction:column;gap:12px}
.trow{display:flex;gap:10px;align-items:flex-start;justify-content:space-between}
.trow b{font-size:20px;line-height:1.25;min-width:0;overflow-wrap:anywhere}
.pill{font-size:11px;font-weight:600;letter-spacing:.06em;text-transform:uppercase;padding:4px 8px;border-radius:99px;background:var(--p-acc-soft);color:var(--p-acc);border:1px solid #F5D5C3;white-space:nowrap;margin-top:3px;flex:none}
.pill.off{background:var(--p-grey);color:var(--p-mut);border-color:#DDD}
.pill.x{background:var(--p-danger-soft);color:var(--p-danger);border-color:#F7C9C4}
.fwrap{display:flex;flex-direction:column;gap:6px}.fopts{display:flex;gap:8px}
.fopt{flex:1 1 0;min-height:44px;padding:6px 8px;border-radius:10px;border:1px solid var(--p-line);border-bottom-width:3px;background:#FFF;color:var(--p-fg);font-size:14px;font-weight:600}
.fbtn{width:100%;text-align:left;min-height:66px;padding:10px 10px 10px 14px;display:flex;align-items:center;justify-content:space-between;gap:10px;background:#FFF;border:1.5px solid var(--p-acc-edge);border-bottom:4px solid var(--p-acc);border-radius:12px;box-shadow:0 2px 6px rgba(124,45,18,.16)}
.fbtn:active{transform:translateY(2px);border-bottom-width:2px;margin-bottom:2px;box-shadow:none}
.fbtn>span:first-child{min-width:0}
.fbtn .lab,.fbtn b,.fbtn .s{display:block}
.fbtn b{font-weight:600;overflow-wrap:anywhere}
.fbtn .s{font-size:13px;color:var(--p-mut2)}
.only{display:inline-block;font-size:11px;font-weight:600;padding:2px 6px;border-radius:4px;background:#FFE9DC;color:var(--p-acc-dark);margin-top:3px}
.fgo{flex:none;color:var(--p-acc);font-size:15px;font-weight:700;display:flex;align-items:center;gap:4px}
.row{width:100%;min-height:52px;padding:8px 16px;display:flex;align-items:center;justify-content:space-between;gap:12px;background:none;border:0;border-top:1px solid var(--p-line);text-align:left}
.row:first-child{border-top:0}.row>span:first-child{min-width:0}.row b{font-weight:600}
.row .s{display:block;font-size:13px;color:var(--p-mut2);font-weight:400;overflow-wrap:anywhere}
.row .v{color:var(--p-mut);font-size:15px;text-align:right;flex:none;max-width:55%}
.hint{font-size:13px;color:var(--p-mut2);margin:0}
```
Markup (prototype JS; `B(cls,act,label,arg)` = a `<button type="button" class=cls>`):
```
fact(act,label,main,sub,key,arg,go):
 <div class="fwrap">
   <button class="fbtn"><span><span class="lab">{label}</span><b>{main}</b>{sub?<span class="s">{sub}</span>}{changed?<span class="only">Only this night</span>}</span><span class="fgo">{go||'Change'} &rsaquo;</span></button>
   {changed?<div class="fopts"><button class="fopt">Back to usual</button></div>}
 </div>
flyerBlock(fl,tag): <div class="flyer {fl?'f1':'none'}"><span>{fl?'Flyer':'No flyer'}{tag}</span><button class="fpill">Flyer and photos</button></div>   // tag = ' · only this night' when this night has its own flyer
Card order: <div class="grp"><div class="lab">What dancers see on this night. Tap to change.</div><div class="card">
   flyerBlock + <div class="fb-list"><div class="trow"><b>{name}</b>{statusPill}</div>
   fact('when','When',{long date},'{start} to {end}','sessions') fact('where','Where',{venue name},{area},'venue')
   fact('price','Price',{price.m},{price.s}, door?'doorPrice':'prices') fact('about','Description',aboutShort(about),'','about') ...
statusPill: cancelled night or cancelled event -> <span class="pill x">Cancelled</span>; else <span class="pill{status==='Live'?'':' off'}">{Live|Paused|Ended}</span>
aboutShort(t): t ? (t.length>60 ? t.slice(0,60)+'…' : t) : 'No description'
priceLabel(): door -> {m:'£'+doorPrice, s:'Pay at the door'}; link -> {m:'Tickets on another site', s: link || 'your link'}; stripe not connected -> {m:'Not on sale yet', s:'Set up tickets first'}; no tickets -> {m:'Add a ticket', s:''}; else {m:(count>1?'From ':'')+(min?'£'+min:'Free'), s: count+(count===1?' ticket':' tickets')}
All dates sheet: title 'All dates'; <p class="hint">Tap a date to see and change that night.</p><div class="card">{12 x row('pickClose', longDate(d), '', cancelled?'Cancelled':changed?'Changed':'')}</div>; row = <button class="row"><span><b>{title}</b></span><span class="v">{value}</span><span class="chev">&rsaquo;</span></button>
```
Copy exactly: "What dancers see on this night. Tap to change." / "Flyer and photos" / "No flyer" / " · only this night" / "Change ›" / "Only this night" / "Back to usual" / toast "Back to usual for <full date>" / "All dates" / "Tap a date to see and change that night." / "Cancelled" / "Changed" / "No description" / "Pay at the door" / "Tickets on another site" / "your link" / "Not on sale yet" / "Set up tickets first" / "Add a ticket" / "From " / "Free" / "1 ticket" / "2 tickets".

## Prototype checklist (every line is built; any tap that leaves the prototype = not done)
- [ ] N-10 label above the card
- [ ] N-11 card + flyer block 150px, radius 7px 7px 0 0, padding 12px, white 12px capitals "Flyer"; no flyer: #EFEFEF bg, #696969 "No flyer"
- [ ] N-12 " · only this night" on the flyer text when this night has its own flyer
- [ ] N-13 white pill "Flyer and photos" (14px/600, min height 40px, padding 0 14px, radius 99px, border 1px #CFCFCF with 3px bottom, shadow 0 2px 6px #00000033); tap = nothing yet (slice 9)
- [ ] N-14 event name 20px bold with status pill beside it
- [ ] N-15 pill Live (normal), Paused, Ended (off), Cancelled (red; cancelled night or cancelled event)
- [ ] N-16 fact list padding 14px 12px, 12px gap
- [ ] N-17 When: label "When", bold full date, second line "19:30 to 00:00" 13px #696969, right word "Change ›" #C2410C 15px bold
- [ ] N-18 Where: bold venue name, second line the area
- [ ] N-19..N-23 Price in the five modes (door / tickets / link / Stripe not connected / no tickets)
- [ ] N-24 Description first 60 characters then ellipsis; empty = "No description"
- [ ] N-25 tag "Only this night" only on a fact this night changed (11px/600, padding 2px 6px, radius 4px, bg #FFE9DC, text #9A3412)
- [ ] N-26 "Back to usual" under a changed fact (min height 44px, radius 10px, border 1px #E9E9E9 with 3px bottom, 14px/600, 6px gap); toast "Back to usual for <date>" with Undo
- [ ] SH-DATES-01..05 sheet "All dates": title, hint, 12 rows (min height 52px, long date title), value "Cancelled" or "Changed", row tap closes the sheet and shows that night on tab "This night"

## Tap rows owned by this slice (tap-table.md)
| row | button | destination |
|---|---|---|
| 5 | More dates (last chip) | sheet "All dates" |
| 6 | date row in the sheet | sheet closes; first screen, tab "This night", that night |
| 12 | Back to usual | stays on the screen; change gone; toast "Back to usual for <date>" + Undo |
Rows for When / Where / Price / Description / Flyer pill are built in later slices: here they are inert (no navigation). They must NOT go anywhere.

## Tests (add to nightCard.test.tsx; `npm run test:unit`)
price label in the five modes; "Only this night" tag only on a changed fact; Back to usual sends the inverse step and shows the toast; chip tags; dates sheet row picks a night and closes; sheet with more than 12 coming dates shows 12 rows.

## Done means
`npm run pre-ship`, vitest green. Push early (checkpoint at 60%). End the handover `docs/briefs/editor-v2-slice3-night-card.handover.md` with a TAP TABLE (button | destination | prototype/OLD). One OLD row = keep building. A prototype element you cannot build: STOP and write it at the top of the handover, never a "remaining differences" list.
