# Brief: Editor v2 slice 5, Going card, tiles, Raffle row, Share this night

Branch: claude/editor-v2-s1c
Size: 5 files, 330 lines
Repo: 123constante/bachata-website. Flag `organiserEditorV2` stays OFF; zero migrations; no admin change.

The prototype file is NOT reachable from the cloud. Everything you need from it is embedded below (CSS, markup, copy). The embedded snippets are the spec: copy sizes, colours and words exactly. Slices 1-4 are on the branch: read `docs/briefs/editor-v2-slice4-cancel-night.handover.md` first (NightCard, Facts, V2Sheet, V2Toast, `useSaveNow`, tokens in `v2/v2.css`). DESIGN-REGISTRY rows 61-81 win over this brief.

## Files (touch only these)
- src/modules/organiser/p3/v2/NightHub.tsx (new): `NightHub` = going card + two tiles + group "This night" (Raffle row only for now) + Share button and line; also exports `ShareSheet` (uses `V2Sheet`). One file on purpose (size cap).
- src/modules/organiser/p3/v2/EditorV2.tsx: render `<NightHub .../>` right after `<NightCard/>` (max 15 lines: pass series id, name, picked date, ticketsSold 0, moneyPence 0, share link, a `toast(text)` callback). Plain toasts without Undo: reuse `V2Toast`; if `useSaveNow` has no plain-toast path, add a tiny local `useState` toast in EditorV2 (do NOT edit saveNow.ts).
- src/modules/organiser/p3/v2/copy.ts: add the lines below.
- src/modules/organiser/p3/v2/v2.css: CSS appended under `.ev2` (max 40 lines); add only what is missing.
- src/modules/organiser/p3/v2/__tests__/nightHub.test.tsx (new)
Do NOT edit SaveBar, EventPageV2, NightV2, NightCard, CancelNight, saveNow.ts, editorModel.ts, screens/*, R4*, events/raffle/*. Files over 2 KB: `scripts/safe-edit.py` / `scripts/safe-write.py`. JSX entities only, explicit px for sizes (phone html font is 13.5px).

## Build
1. **Going card** (tap 15, prototype is a STUB, but the registry says build today's list): mount the EXISTING going list. Reuse `P3NightGoing`-style code from `src/modules/organiser/p3/screens/P3Going.tsx` and `@/modules/going` (`useMyEventGoing(seriesId,{bySeries:true})`, `p3NightOf`, `GoingPeopleSheet`, `Sheet`). The card is ONE full-width button (`.card.going`): overlapping round initials (first names of up to 3 going people, then "+N" for the rest), text "<n> going", chevron; tap opens the same people list in a sheet as today (title = event name). Initials come from the going read if it carries names; if it does not, show no initials and only "<n> going" and say so in the handover. Hide the card entirely when `p3GoingSlot` says none or the night is not in the read (same rule as today). Do not call `p3GoingOn`-gated hooks outside the gate (see P3Going.tsx pattern).
2. **Tiles**: "Tickets sold" and "Money" (`£<n>`, 24px bold; "after fees" under). The workspace has no ticket totals yet: props `ticketsSold` and `moneyPence` default 0, wired 0; slice 15 supplies real numbers. Format money as the prototype `gbp()`: whole pounds when no pence, else 2 decimals. Say in the handover that the tiles show 0 until slice 15.
3. **Group "This night"**: heading 18px bold. It will later hold refund, Guest list, Note rows (other slices): build the group as a container that renders its `children` after the Raffle row's `fb-list`; do NOT build refund / guest / note now.
4. **Raffle row** (tap 18, prototype is a STUB, build today's raffle screen): one-line `fbtn ln` button "Raffle" with pill "On · <n> entries" (singular "1 entry") or "Off" (off pill). Data: `fetchRaffleNights(seriesId)` / `raffleNightsQueryKey` from `../events/raffle/raffleApi` + `raffleModel` (find this night's `Night` by occurrence id). Tap opens the existing `RaffleSheet` (`../events/raffle/RaffleSheet`) for that night: its on/off switch is inside it, exactly as today. While the read loads, show nothing; on error show the row without a pill. Record the choice in the handover.
5. **Share this night** (tap 20, 66): primary button (`btn pri`) under the group, line "Send dancers the link to this night." (`.why`). Sheet "Share this night": `<p class="txt">`, a `.box` with the link (select-all on tap, `user-select:all`), button "Copy link". Copy uses `navigator.clipboard.writeText` in try/catch; success toast "Link copied"; blocked or error toast "Select the link to copy it". Toasts have NO Undo. The link = the real public link of this night: find the helper the old night screen / Home Share uses (`dash/shareLinks` or `eventPage` share code; read it, reuse it, do not invent a URL scheme). The prototype's sample link is a stub.

## Embedded prototype (spec)
```
card going:      <button class="card going" data-act="stub"><span class="av"><i>ML</i><i>DR</i><i>PS</i><i>+20</i></span><b>23 going</b></button>   (chevron at the right end, as other full-width rows)
tiles:           <div class="tiles"><div class="card tile"><div class="lab">Tickets sold</div><div class="num">{sold}</div></div><div class="card tile"><div class="lab">Money</div><div class="num">{gbp}</div><div class="quiet">after fees</div></div></div>
group:           <div class="grp"><div class="lab hd">This night</div><div class="card"> {refund row} <div class="fb-list"> {Guest list row} {Raffle row} {Note row} </div></div></div>
Raffle row:      factLn('stub','Raffle', onOff(S.raffleOn,'12 entries'))  =  <div class="fwrap"><button class="fbtn ln"><span class="lt">Raffle</span><span class="lv"><span class="pill [off]">On &middot; 12 entries | Off</span></span><span class="fgo">&rsaquo;</span></button></div>
share:           <div><button class="btn pri">Share this night</button><div class="why">Send dancers the link to this night.</div></div>
sheet Share:     title 'Share this night'; <p class="txt">Send dancers the link to this night.</p><div class="box" id="f-link">{link}</div><button class="btn pri">Copy link</button>
copy toasts:     'Link copied'  |  'Select the link to copy it'
CSS:
.card{background:var(--p-card);border:1px solid var(--p-line);border-radius:8px}
.lab{font-size:12px;letter-spacing:.06em;text-transform:uppercase;color:var(--p-mut2);font-weight:600}
.grp>.lab.hd{font-size:18px;letter-spacing:0;text-transform:none;color:var(--p-fg);font-weight:700}
.going{width:100%;padding:14px 16px;display:flex;align-items:center;gap:12px;text-align:left}
.av{display:flex}
.av i{width:28px;height:28px;border-radius:50%;background:#EDE7E2;border:2px solid #FFF;margin-left:-8px;font-style:normal;font-size:11px;font-weight:600;display:grid;place-items:center;color:var(--p-mut)}
.av i:first-child{margin-left:0}
.tiles{display:grid;grid-template-columns:1fr 1fr;gap:12px}
.tile{padding:14px 16px}
.num{font-size:24px;font-weight:700;font-variant-numeric:tabular-nums}
.quiet{font-size:13px;color:var(--p-mut2)}
.fbtn.ln{min-height:52px;padding:8px 10px 8px 14px}
.fbtn.ln .lt{flex:none;font-weight:700;font-size:16px;color:var(--p-fg)}
.fbtn.ln .lv{flex:1 1 0;min-width:0;text-align:right;font-size:15px;color:var(--p-mut);white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.fgo{flex:none;color:var(--p-acc);font-size:15px;font-weight:700;display:flex;align-items:center;gap:4px}
.pill{font-size:11px;font-weight:600;letter-spacing:.06em;text-transform:uppercase;padding:4px 8px;border-radius:99px;background:var(--p-acc-soft);color:var(--p-acc);border:1px solid #F5D5C3;white-space:nowrap;margin-top:3px;flex:none}
.pill.off{background:var(--p-grey);color:var(--p-mut);border-color:#DDD}
.box{border:1px dashed var(--p-field);border-radius:8px;padding:12px;font-size:14px;overflow-wrap:anywhere;user-select:all;background:var(--p-bg)}
.why{font-size:13px;color:var(--p-mut2);text-align:center;margin-top:6px}
.txt{margin:0;font-size:15px;color:var(--p-mut)}
```
Reuse the v2.css tokens/classes slices 2-4 already define (`.ev2 .grp`, `.fbtn`, `.btn`, `.pill`, `.fb-list` exist); add only what is missing, scoped under `.ev2` / `.ev2-sheet`. One-off events: the group heading is "On the night" instead of "This night" (prototype `S.oneOff`).

Copy exactly: "<n> going" / "Tickets sold" / "Money" / "after fees" / "This night" / "On the night" (one-off) / "Raffle" / "On · <n> entries" / "Off" / "Share this night" / "Send dancers the link to this night." / "Copy link" / "Link copied" / "Select the link to copy it".

## Prototype checklist (every line is built; any tap that leaves the prototype = not done)
- [ ] N-31 Going card: padding 14px 16px, 12px gap; overlapping round initials (28px, #EDE7E2, 2px white border, -8px overlap, 11px weight 600) then "+N"; text "<n> going"; chevron; opens the same going list as today
- [ ] N-32 Two tiles side by side (12px gap, padding 14px 16px): "Tickets sold" 24px bold; "Money" "£<n>" 24px bold and "after fees" 13px #696969
- [ ] N-33 Group heading "This night" (18px bold); "On the night" on a one-off
- [ ] N-36 One-line button "Raffle" with pill "On · 12 entries" or pill "Off"; opens the raffle screen of today
- [ ] N-38 Button "Share this night" (primary); opens the sheet "Share this night"
- [ ] N-39 Line under it: "Send dancers the link to this night."
- [ ] SH-SHARE-01..04 title, text, link box (selects all on tap), button "Copy link" + the two toasts
- [ ] Picking another date chip redraws going, tiles, raffle and link for that night (N-40)

## Tap table (put the filled table in the handover `docs/briefs/editor-v2-slice5-night-hub.handover.md`; columns: button | destination | prototype/OLD; any OLD = not done; the two stub rows 15 and 18 are marked "prototype stub, built as today's screen (registry)")
| # | Button | Where | Result |
| 15 | 23 going | going card | the going list as today (sheet) |
| 18 | Raffle | group This night | today's raffle sheet, switch inside |
| 20 | Share this night | bottom of This night | Sheet "Share this night" |
| 66 | Copy link | sheet | toast "Link copied"; blocked: "Select the link to copy it" |

## Tests (nightHub.test.tsx, vitest)
Going card hidden when switch off / night not in read; "<n> going" text; tiles show 0 and format money (whole pounds vs pence); Raffle pill On·n entries / 1 entry / Off; row opens RaffleSheet; Share sheet copy exact; copy success and blocked toasts (mock clipboard); toasts have no Undo; heading "On the night" for one-off.

## Handover
Write `docs/briefs/editor-v2-slice5-night-hub.handover.md`: what was built, the filled tap table, every assumption (initials source, raffle loading/error choice, share link helper, tiles 0 until slice 15), files and line counts. Open no PR; push to `claude/editor-v2-s1c` as the dispatch rules say.
