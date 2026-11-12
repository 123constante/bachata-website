# Dancer dashboard: option B polish (design record)

Admin #1537, parent #1531. Docs / design only, no app code, no DB writes.
Screens: `option-b-polished.html` (open with `#new`, `#partial`, `#saveOff`, `#complete`, `#completeEmpty`, `#unclaimed`, `#switch`, `#addProfile`, `#account`
for one 390x844 frame; no hash shows all nine). Critique fixes (admin #1545): see "Critique round" at the end; where it conflicts with the decisions below, the critique round wins. Shots: `shots/b-polished-<shape>.png` (390x844 at 2x).
Base: `option-b.html` on `claude/profile-dash-dancer-designs` (PR #1561, not on main yet, so this branch does not depend on it) + the owner-picked switch mock
(`docs/briefs/dash-switch-mock.md` on the brief branch). Inventory first: `INVENTORY-polish.md` (separate name: PR #1561 adds its own INVENTORY.md) (72 items, 69 covered).

## Tokens (all from `src/modules/dancer-app/theme/dancer.css`, no new colours except two named below)

| Token | Value | Use |
|---|---|---|
| `--da-bg` | #202226 | page, tabs, sheet |
| `--da-surface` / `-2` | #2A2D32 / #33373D | cards, tiles / fields, disabled button, segment track |
| `--da-text` / `--da-text-muted` | #FFFFFF / #A3A9B3 | text / secondary text (min 5.06:1 on surface-2, 5.84:1 on surface) |
| `--da-accent` / `--da-on-accent` | #F5865A / #1D0A03 | ONE primary button per screen, current-tab bar, "now" segment |
| `--da-plum` | #C9ADFF | picture ring, tile icons |
| `--da-border` | #3D4148 | hairlines, ghost button |
| `--da-pop-teal` / `--da-pop-gold` | #4FE0CF / #FFCF66 | organiser / DJ avatar rings; gold = "needs a check" state pill |
| NEW `--ok` | #7BE0A0 | done segments, current-profile check (from the option round) |
| NEW state pill bg | #3A3220 | gold text 9+:1 on it |
| sizes | radius 14, tap 44, header 52, tabs 60, gap 12, pad 16 | `--da-radius`, `--da-tap`, `--da-header-h`, `--da-tabs-h` |

Type: greeting 26/800, card title 20/800, label 13/700 caps, body 16, secondary 14, small 12-13. All px (the site's 13.5px root makes rem small, CLAUDE.md trap).

## Decisions (what changed from option B)

1. **The switch is the picture, top right.** Matches the shipped hint "You can switch later by tapping your picture, top right." (`ContinueAsPage.tsx:28`).
   With 2+ sides: picture + "Dancer" + chevron (the owner's pill). With one side (D129, `SwitcherGate.tsx:8-15`): the picture alone, opening "Your account".
   The mock showed the pill on every frame; that would offer a switch to people with nothing to switch to.
2. **Sheet follows the shipped `ProfileSwitcher`**: title, Close (44x44), side rows with picture + name + kind, check on the current side, then Account settings and Sign out.
   Long organiser names ellipsis on one line (tested with a 38-char name).
3. **DJ is drawn as an area row ("DJ area")**, not a side: `ProfileSide` is dancer | organiser only (G-7).
4. **"+ Add a profile" opens a second sheet with only live paths**: "Run events? Become an organiser" (+ the real beta note) and "Teach or DJ? Message us" (G-8).
5. **Step card**: "STEP N OF 4" + a 4-segment bar (done green / now orange / to-do grey) instead of a thin % bar; the 4 steps are `REQUIRED_STEPS`
   (`nextStep.ts:18`), button labels are `NEXT_STEP` verbatim (`nextStep.ts:21-29`), so Home and Me stay one mapping.
6. **D1 copy** "Skip nothing, it is quick" replaced by "Four quick steps: your name, your city, how you dance, a photo." (says what is coming, no command).
7. **Numbers never headline when empty.** D1/D2 show a one-line note saying when numbers appear. D3 with 0 nights replaces the big "0" with
   "Find your first night" + why + one button. D3 with nights shows "NIGHTS ATTENDED 12" at 32px (not 40) and the next going night as one card.
8. **Save-off moved out of Home.** The option tile said "save is off until a change" on Home, a rule about a screen you are not on. Home tile now says
   "3 of 4 done"; the rule is shown where it happens (`#saveOff`): disabled Save + "Change something to save. Nothing is sent until you do."
9. **D4 claim (G-2).** Claim is automatic today; no click-claim RPC. The frame is a labelled state ("Needs a check from us"), the live action is
   "Message us to claim it", and "Claim this page" is drawn DISABLED with its reason. No copy points at a control that does not work.
10. **Emoji icons replaced with inline SVG strokes** (emoji render differently per phone and are a mojibake risk; the file is ASCII + entities only).
11. **Disabled = dashed border + muted text on surface-2**, not 55% opacity (opacity dropped the label under 4.5:1).

## Alternatives rejected

- Pill on every frame (mock as drawn): offers a switch to one-profile people; D129 says no.
- DJ as a third side kind: needs an `accountRouting` contract change; out of scope for design.
- A live "Claim your page" primary button: points at a server action that does not exist (brief rule).
- Keeping "0" as a 40px headline: brief says near-empty numbers are empty states, not headline tiles.
- A full checklist on Home (option A): owner picked B (one step at a time); the list stays on Me (#40).
- Ring / percent: `pct` 70 = complete confuses ("70%" reads unfinished); steps-of-4 says the same truth.

## Checks (run 2026-11-12, Playwright Chromium, 390x844, script in the handover)

| Check | Rule | Result |
|---|---|---|
| Tap targets | every `a` / `button` >= 44x44 | 0 under 44 across 8 frames (72 targets) |
| Text contrast | every visible text node vs its composited background >= 4.5:1 | 0 under; minimum 5.06:1 (muted on surface-2) |
| Sideways scroll | `scrollWidth` = 390 | 390 in all 8 |
| Clipping | no text overflow except deliberate ellipsis; no text past x=390 | 0 |
| Cut by tab bar | every `.sc` child bottom <= tab-bar top | 0 |
| Disabled states say why | every `[disabled]` has a non-empty `aria-describedby` reason | 2 disabled (Save, Claim), both with reasons |
| Empty states say what to do | read by hand | D1 note, D2 note, D3-empty card + button, Nights tiles "find one / none coming up", D4 reason |
| Longest prod first name (21) | greeting wraps, not clipped | `#complete` "Hi Christina-Alexandrina": passes |

## Coverage

Inventory items covered 69 / 72 (D 39, R 30). Uncovered: #27 erase_requested_at (always null), #35 views tile (removed by contract), #55 legacy EditProfile (superseded).
Owner calls: G-2 (claim click), G-7 (DJ side), G-8 (add-a-profile destinations and the "Teach or DJ? Message us" copy).

## Critique round (admin #1545, all 8 fixes applied, 2026-11-12)

| # | Fix | What changed in `option-b-polished.html` |
|---|---|---|
| 1 | One-profile account sheet; no "?" | New `#account` frame: title "Your account" + Close, one Dancer row with tick, Add a profile, Account settings, Sign out; no switching words. Header picture with no name (`#new`, `#unclaimed`) is an SVG person in the plum ring. |
| 2 | Switch sheet = shipped `ProfileSwitcher.tsx` | Order: sides (organisers first, `switcherItems`), tick on current; then the areas group (DJ row: plain SVG icon, "DJ", status dot + "Not finished", as `SwitcherAreas` + `StatusDot`) and the "Your areas" link; then Add a profile, Account settings, Sign out. Sheet surface `--da-surface` + `--da-border` top (the shipped dancer sheet). Add-a-profile Back = 44px chevron at LEFT. |
| 3 | Edit "3 of 4 done" with no photo field | `#saveOff` gains a Photo row: placeholder + "No photo yet" + ghost "Add photo" (all four `REQUIRED_STEPS` now live on Edit). 44px back chevron at left of the Edit header. Save stays off with its reason. |
| 4 | No kicker labels | Welcome lines gone; "STEP N OF 4" is now the caption "Step N of 4" under the segment bar; `#complete` card heading "12 nights attended"; next-night heading = event name, "You're going &middot; Fri 14 Nov &middot; Shoreditch" under it; ABOUT YOU gone; `#completeEmpty` heading "Your profile is complete." |
| 5 | `#unclaimed` too busy | Disabled Claim + reason removed (G-2 stays an open owner question); "Message us to claim it" is the one action; "Not me, start my own" is a 44px text link; Message tile replaced by My page. |
| 6 | Next night is a link | Whole card is an `<a>` to the event, right chevron, 74px tall. |
| 7 | No text characters as icons | Authored SVG `i-plus`, `i-person`, `i-back`, `i-fwd`, `i-phones` on the same 2px stroke set; "+" / "?" / "DJ" glyphs gone. Ring letters are single initials, as `SideAvatar` -> `PersonAvatar` draws them. |
| 8 | Dashed = disabled / placeholder only | `.note` is plain muted text, no border; Add a profile icon is solid; dashed survives only on disabled Save and the placeholder avatars (Marco, no-photo). `#new` Options tile (duplicated the tab) replaced by Edit "0 of 4 done". |

Kept: step-of-4 segment bar; numbers never headline when empty; Save-off on Edit; pill only with 2+ profiles.

### Deliberate deviations from shipped code (owner calls)

- **OC-1 Pill with 2+ profiles.** Shipped `ProfileSwitcher` button is a bare 44x44 picture for everyone. The design keeps "picture + Dancer + chevron" when there are 2+ sides (brief: keep). Needs a code change if adopted.
- **OC-2 "Add a profile" row in the sheet.** Not in shipped `ProfileSwitcher` (shipped has "Your areas" for adding teacher / DJ). Drawn between the areas group and Account settings, in both the switch and the one-profile sheet, per brief fix 1-2.
- **OC-3 Plum ring on the no-photo picture.** Shipped `PersonAvatar` draws a filled `--da-avatar` disc (initial or `UserRound` glyph), no ring. The design keeps the plum ring (brief fix 1) and an SVG person in it.
- **OC-4 No-name sheet row label.** Not drawn: shipped `sideTitle` falls back to `DANCER_NAME_PLACEHOLDER`; the one-profile frame shows a named dancer (Ana).
- **OC-5 Sign-out confirm step.** Shipped Sign out asks first ("Sign out?" + Cancel / Yes, sign out); not drawn as its own frame (unchanged behaviour).
- G-2 (click-claim) remains open; no Claim control is drawn at all now.

### Checks re-run (2026-11-12, Playwright Chromium, 390x844, `shots/check-polish.cjs`, 9 frames)

| Check | Result |
|---|---|
| Tap targets >= 44x44 | 0 under, 85 targets |
| Text contrast >= 4.5:1 | 0 under; min 5.06:1 |
| Sideways scroll | scrollWidth 390 in all 9 |
| Clipping / past x=390 / cut by tab bar | 0 / 0 / 0 |
| Disabled has a reason | 1 disabled (Save), with reason |
| NEW dashed border only on `[disabled]` or `.av` placeholder | 0 violations |
| NEW no text glyph in `.pic` / `.ico` / `.av` except one initial | 0 violations |
| NEW no kicker (caps line or label element directly above a heading) | 0 violations |
| Canary: the three NEW checks against the pre-fix HTML | caught: dashed notes + dashed add-pic, "?" / "+" / "DJ" glyphs, STEP N OF 4 / ABOUT YOU / NIGHTS ATTENDED / NEXT NIGHT / YOUR PROFILE IS COMPLETE |
| Empty states (by hand) | D1 note, D2 note, `#completeEmpty` card + Find a night, Nights tiles "find one / none coming up", D4 Message us |
