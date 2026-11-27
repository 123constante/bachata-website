# Brief: Editor v2 slice 6, Guest list row and sheet

Branch: claude/editor-v2-s1c
Size: 5 files, 300 lines
Repo: 123constante/bachata-website. Flag `organiserEditorV2` stays OFF; zero migrations; no admin change.

The prototype file is NOT reachable from the cloud. Everything you need from it is embedded below. The embedded snippets are the spec: copy words exactly. Slices 1-5 are on the branch: read `docs/briefs/editor-v2-slice5-night-hub.handover.md` first (NightHub has a `children` slot after the Raffle row; `ShareSheet`, `V2Sheet`, `gbp`, tokens in `v2/v2.css`). DESIGN-REGISTRY rows 61-81 win over this brief.

## Files (touch only these)
- src/modules/organiser/p3/v2/GuestSheet.tsx (new): `GuestRow` (the one-line button with pill) and `GuestSheet` (uses `V2Sheet`).
- src/modules/organiser/p3/v2/NightHub.tsx: render `<GuestRow/>` inside the group, BEFORE the Raffle row (prototype order: Guest list, Raffle, Note). Max 20 lines. Pass `occurrenceId`, the night's long date label, the share link, `toast`.
- src/modules/organiser/p3/v2/copy.ts: add the lines below.
- src/modules/organiser/p3/guestlist/guestListModel.ts: add `plusOnes: number` to `GuestEntry`, parsed from the RPC row field `plus_ones` (`num(x.plus_ones)`, default 0). Nothing else in that file. Admin DDL for `plus_ones` is merged and applied to prod (20261121002119); the RPC returns it on every name row.
- src/modules/organiser/p3/v2/__tests__/guest.test.tsx (new)
Do NOT edit GuestListSheet.tsx, guestListApi.ts, EditorV2, SaveBar, saveNow.ts, editorModel.ts, screens/*, R4*. v2.css: only if a class below is missing, append max 20 lines (then say so in the handover). Files over 2 KB: `scripts/safe-edit.py` / `scripts/safe-write.py`. JSX entities only, explicit px for sizes.

## Build
1. **Row** (tap 17): same markup as the Raffle row in NightHub (`.fwrap > button.fbtn.ln > .lt "Guest list" + .lv > .pill + .fgo ›`). Pill "On &middot; <n> names" (singular "On &middot; 1 name") or "Off" (`.pill.off`). Data: `readNight(occurrenceId,'names','',PAGE)` from `../guestlist/guestListApi` via `useQuery` with key `[GL_KEY, occurrenceId, 'names', '', PAGE]` (same key family as GuestListLive so one invalidate refreshes both); `night.enabled` and `counts.names`. While loading show the row with no pill; on error the row with no pill. Hide the row entirely when the read gives `ok:false` with `night_not_found` / `not_on_team`, or when `flags.organiserGuestListLive` is off (same rule as the old row: read `GuestListRow` in GuestListSheet.tsx, copy its gate, record it in the handover).
2. **Sheet "Guest list"** (tap 17 opens it; V2Sheet; stays open on every toggle):
   - A switch row (`swrow`, role="switch", aria-checked) "Guest list". Tap (tap 67) calls `setNight(occurrenceId, !enabled, capacityMax, cutoffTime)` (keep the night's existing places and closing time; do not touch them), then invalidates `GL_KEY`, redraws the sheet, plain toast "Guest list on" / "Guest list off" (NO Undo; plain-toast path as in slice 5). On a failed outcome: toast `reasonWords(reason)`, switch unchanged. Disable the switch while busy. When `readOnly` is set (past, cancelled, view_only): switch disabled, and the line `READ_ONLY_WORDS[readOnly]` under it.
   - OFF state: only `<p class="txt">Off. Dancers cannot put their name down. Turn it on to get a link to share.</p>`.
   - ON state: `<p class="txt">{n} names for {longDate}.</p>` ("1 name for ..." singular), then `<div class="card">` with one `.row` per entry: `<b>{firstName}</b>` and, only when `plusOnes>0`, `<span class="v">+{plusOnes}</span>`. When `total > entries.length` show `<p class="txt">Showing {entries.length} of {total}.</p>` below. Zero names: the card is replaced by `<p class="txt">No names yet.</p>`. Then `<p class="txt">Share this link so dancers can put their name down.</p>`, `.box` with the link (select-all), `btn sec` "Copy link" (tap 66, same copy code and toasts as the Share sheet: "Link copied" / "Select the link to copy it").
   - Link = the SAME public event-page link of this night that `ShareSheet` uses (owner click 2026-11-22: event page link). Reuse the prop; do not invent a URL.
   - `{longDate}` = the picked night's long date, same helper the Night card uses (e.g. "Thursday 26 November"); full weekday names.
3. Check-in, scan, add name, places, closing time and every other old guest-list feature stay OUT of this slice (the prototype sheet has none). Record in the handover that the editor sheet does not offer them.

## Embedded prototype (spec)
```
row:    factLn('guest','Guest list',onOff(S.guestOn,'3 names'))   pill "On · 3 names" | "Off"
sheet:  title 'Guest list'
        sw = <button class="swrow" role="switch" aria-checked="{on}"><span>Guest list</span><span class="sw [on]"></span></button>
OFF:    sw + <p class="txt">Off. Dancers cannot put their name down. Turn it on to get a link to share.</p>
ON:     sw + <p class="txt">3 names for {longDate}.</p>
        <div class="card"><div class="row"><b>Aisha Khan</b><span class="v">+1</span></div><div class="row"><b>Tom Whitfield</b></div><div class="row"><b>Lucia Marin</b><span class="v">+2</span></div></div>
        <p class="txt">Share this link so dancers can put their name down.</p><div class="box" id="f-link">{link}</div><button class="btn sec">Copy link</button>
toggle: render(); reopen sheet; toast 'Guest list on' | 'Guest list off'
```
CSS: reuse what slices 2-5 added (`.swrow`, `.sw`, `.sw.on`, `.row`, `.v`, `.box`, `.txt`, `.card`, `.pill`, `.btn.sec`). If one is missing add it under `.ev2-sheet`: switch row min-height 52px; `.row` padding 12px 16px, border-bottom 1px solid var(--p-line); `.row .v` 15px color var(--p-mut).

Copy exactly: "Guest list" / "On · <n> names" / "On · 1 name" / "Off" / "Guest list on" / "Guest list off" / "Off. Dancers cannot put their name down. Turn it on to get a link to share." / "<n> names for <date>." / "Share this link so dancers can put their name down." / "Copy link" / "Link copied" / "Select the link to copy it".

## Prototype checklist (every line is built; any tap that leaves the prototype = not done)
- [ ] N-35 One-line button "Guest list" with pill "On · <n> names" or "Off" (off style); opens the sheet "Guest list"
- [ ] SH-GUEST-01 Title "Guest list"
- [ ] SH-GUEST-02 Switch row "Guest list"; toast "Guest list on" / "Guest list off" (no Undo); the sheet stays open
- [ ] SH-GUEST-03 Off: text "Off. Dancers cannot put their name down. Turn it on to get a link to share."
- [ ] SH-GUEST-04 On: text "<n> names for <date>."
- [ ] SH-GUEST-05 On: rows of names with their extra count on the right ("+1", "+2"; none when 0)
- [ ] SH-GUEST-06 On: text "Share this link so dancers can put their name down."
- [ ] SH-GUEST-07 On: the link in a link box and button "Copy link" (toast "Link copied")
- [ ] Picking another date chip redraws the pill and the sheet for that night

## Tap table (fill it in the handover `docs/briefs/editor-v2-slice6-guest-list.handover.md`; columns: button | destination | prototype/OLD; any OLD = not done)
| # | Button | Where | Result |
| 17 | Guest list [On · n names / Off] | group This night | Sheet "Guest list" (real names and link; prototype stubs replaced) |
| 66 | Copy link | sheet Guest list | toast "Link copied"; blocked: "Select the link to copy it" |
| 67 | Guest list (switch) | sheet Guest list | same sheet redrawn on or off; toast "Guest list on" / "Guest list off" |

## Tests (guest.test.tsx, vitest; mock guestListApi)
Row hidden when flag off or night_not_found; pill "On · 3 names", "On · 1 name", "Off"; sheet off text exact; on text with n names and date; names listed with "+1" / "+2" and none for 0; "No names yet."; switch calls setNight with existing capacity and cutoff and the toast has no Undo; failed setNight toasts the reason and leaves the switch; readOnly disables the switch; copy success and blocked toasts; parseRead maps plus_ones (default 0).

## Handover
Write `docs/briefs/editor-v2-slice6-guest-list.handover.md`: what was built, filled tap table, assumptions (gate, link source, first-PAGE cap, what the sheet leaves out), files and line counts. Open no PR; push to `claude/editor-v2-s1c` as the dispatch rules say.
