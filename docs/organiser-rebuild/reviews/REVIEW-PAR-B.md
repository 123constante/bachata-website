# REVIEW-PAR-B -- parity pass on PR #809: UX copy and accessibility

Reviewer: ticket dt_ea1ac8fd9021, brief `R-PAR-B.md` (d558f5c7) following `R-INT-B.md`. Branch `claude/org-r1-review-PARB` from `claude/org-r1-integrate` @ 5369379. Scope `git diff e04dea00..5369379` (99 files). No source file changed; this file and the screenshots in `docs/organiser-rebuild/walk-PAR/` are the only commits.

**Verdict: 1 BLOCKING / 9 SHOULD / 9 NOTE**

## Method

- PRODUCTION build: `VITE_ENABLE_ORGANISER_SELF_SERVE=true npm run build` -> exit 0; served with `node scripts/_serve-build.mjs --port 4173`.
- Walk: a throwaway Playwright spec (not committed) at 390x844 against `tests/e2e/helpers/organiserFake.ts`, plus four added series. That gives five shapes: **cs** = Friday Bachata, a class and a party each date, 12 coming dates. **w10** = Thursday Social, a weekly party with no end, so 10+ coming dates. **one** = a one-date event. **fest** = a festival over three dates. **zero** = a weekly series that ended 25 Sep, so 0 coming dates.
- Each of 12 screens was visited per shape: One event, Details, Change what, Change time, Sessions/line-up, Take off, Note, Copy, Pick several, Cancel `?from=change`, `?do=stop`, `?do=weekly`. On each one, every visible control was measured for <44px and every element for horizontal scroll. Then three follow-ups:
  - Change time was driven on cs: the start moved to 20:30, the end set past midnight, then the end set before the start.
  - Keyboard-open states were taken at 390x480 for the time, note and price fields.
  - Focus return was checked after the Gallery and Videos sheets.
- A static read of the diff was delegated to a sub-agent. I re-checked every finding below against the source (file:line quoted).

## Findings

### BLOCKING

**B1. Go live on a complete draft says only "Needs the next platform update." and never says what to do.** `events/lifecycleModel.ts:40`: `if (!a1) return add ? \`${A1_REASON}. Before then, ${add}.\` : \`${A1_REASON}.\`;`
- When nothing is missing, the `add` branch is null, so the reason is the bare A1 sentence. Owner priority (2) allows that sentence only if the next sentence says what to do.
- Real shape: a draft with a venue, a coming date and a cover.
- Fix: in the no-`add` branch, append a next step such as "Your event is ready; nothing to do now. Go live switches on here after the update."

### SHOULD

**S1. Change time preview shows an impossible new time when the end is before the start.** `flows/change/Time.tsx` (session rows, ~L75-87).
- Walked on cs: start 20:30, end 19:00. The Party row shows **21:30–19:00** in bold as the new time, while the line under Save says "The end must be after the start".
- Screenshot: `walk-PAR/cs-time-end-before-start.png`.
- Fix: when `badEnd` is set, keep the old end in the preview, or show the row in the error colour.

**S2. "Every session moves by 30 min later" is ungrammatical, and it is the key line for owner priority 1.** `flows/change/changeModel.ts:159-160`.
- Fix: write `Every session moves ${durationWords(mins)} ${earlier|later}`, which reads "Every session moves 30 min later".

**S3. A one-session date has no preview at all.** `Time.tsx`: the list and the delta line render only when `many` is true.
- On a one-date party (walk `one-time.png`), moving the start silently moves the end. The only end the organiser sees is the old one ("ends 01:00 now").
- On the same date, the start field shows 20:00 but the date's only session is 21:00–01:00 (`one-lineup.png` header). The organiser cannot tell which start they are editing. (The fake's series start differs from its session start; the screen copes badly with that shape.)
- Fix: show "Now 21:00–01:00 -> new 22:00–02:00" for a single session too.
- Fix: label the field "Night starts" when the date start differs from the first session.

**S4. Stop repeating with 0 coming dates offers an enabled button reading "0 dates stay. No new dates after them."** The rule is `flows/event/eventSteps.ts:57` (`stop: !repeats ? null : ... { reason: null }`).
- Real path: One event of an ended series shows the Stop repeating row (`zero-event.png`), and that row leads to `zero-stop.png`.
- Prod has 2 pages with 0 series, and ended series are common in the 746.
- Fix: when there are no coming dates, hide the row, or turn it off with "No coming dates, so nothing repeats. Add a date first."

**S5. "Put it back" has three names.**
- `cancel/Confirm.tsx` and `events/OneEvent.tsx` say "Put it back".
- `dates/DateSheet.tsx:125` says **"Put it back on"**. That file is in this diff.
- `events/DatesTakenOff.tsx:66` says **"Put back"**.
- Owner priority (3) is one name per action. Fix: use "Put it back" in all three.

**S6. Two different confirm bodies for the same "Take this date off".**
- `flows/change/TakeOff.tsx` says "It disappears from the calendar. Dancers see no cancellation." and never says the date can be brought back.
- `dates/DateSheet.tsx` uses a different body that includes `PUT_BACK_WHERE`.
- Fix: put one body in `shared/copy.ts` `TAKE_OFF`, with `PUT_BACK_WHERE`, and use it in both places.

**S7. Go live's reason sends a missing date to Details, which has no date control.** `events/lifecycleModel.ts:27,39` builds "add a date from today on in Details". Details has Name, Venue, Time, Ends, Level, Music, Tickets, Gallery, Videos and Prices, but no date row (`cs-details.png`).
- Fix: route the date item to Add a date (`ORG_PATHS.addEvent`). Keep only the venue and cover in "in Details".

**S8. Pick several: on iPhone the shift-days field cannot take a minus.** `flows/change/Pick.tsx:157`: `type="number" inputMode="numeric"`.
- The iOS numeric keypad has no minus key, so "earlier" moves cannot be typed. The copy asks for minus to mean earlier.
- Fix: replace it with an Earlier/Later choice plus an unsigned number of days.

**S9. Prices: "Give every price a name" fires twice, as soon as Add a price is tapped.**
- Walk `cs-prices-keyboard.png`: an alert above Save, plus the same words as the disabled reason under Save, before the organiser has typed anything.
- The Ends field also alerts on every keystroke (`events/DetailsExtras.tsx`, `role="alert"`).
- Fix: validate on blur or on Save, and show the reason once.

### NOTE

- **N1. Line-up page heading.** The row says "Sessions and line-up", but the page section heading says **SCHEDULE** (`cs-lineup.png`), and WhichDate/OneEvent buttons say "Sessions". The aria-labels match the row. Consider "Sessions" as the section heading.
- **N2. The reset label and its done line differ.** `Time.tsx:17` has the done line "Back to the usual time"; the button says "Back to usual time". Use one.
- **N3. Copy: the disabled button can read "Copy 0 changes".** `flows/change/Copy.tsx` (~L234). Its `aria-disabled` has no `aria-describedby` to the reason. Use "Nothing to copy".
- **N4. Pick on 0 coming dates: "No coming dates to pick. Add a date first." has no link** (`zero-pick.png`). Copy's empty state does have one. Add the same link.
- **N5. `?do=weekly` / `?do=stop` that do not apply say only "This event cannot do that now."** (`cs-weekly.png`, `one-stop.png`). They are reachable by URL only (the rows are hidden), so this is low impact. Still, say why ("It already repeats weekly").
- **N6. Step headings are cut off on a phone.** "Stop repeating - Summer Wed..." (`zero-stop.png`). The hyphenated "action - name" title truncates the event name. Put the name on its own line.
- **N7. "1 weeks" can render.** `flows/event/EventStep.tsx:122`: `${c.count} weeks` when the cap leaves room for one week. Pluralise.
- **N8. Raw non-ASCII in source.** `events/seriesExtras.ts:83` has the `£` and `€` literals, the only non-ASCII bytes in the diff (`LC_ALL=C grep -naP "^\+.*[\x80-\xff]"`). Repo rule (cp1252 round-trip): use `'£'` / `'€'`.
- **N9. A11y details.**
  - Change time's `aria-live` sits on a conditionally mounted `<p>` (`Time.tsx:114`), so its first appearance may not be announced. Keep the node mounted.
  - The `aria-label` on the time inputs overrides the visible "(optional)" and the hint. Use `aria-describedby`.
  - The `Off` pseudo-links (`<a role="link" aria-disabled>` with no href, `LifecycleActions.tsx:16-20`, `Done.tsx:23`) are not focusable, so a screen-reader user never reaches their reason.
  - Discard confirm uses the gold primary button for a destructive action.

### Checked and holding (no finding)

- **Tap targets: 0 organiser controls under 44px across all 66 shape x screen walks** plus the interaction states. The only sub-44 hits were the site-wide footer links and the 1x1 skip link, which are out of scope. The sub-agent's grep for `h-(8|9|10|11|12)` on added lines was empty. Every new row is `min-h-[52px]` or `[48px]`.
- **No horizontal scroll** on any walked screen (`document.scrollWidth` = 390 everywhere).
- **Focus return:** Gallery and Videos sheets are `role=dialog`, focus moves in, and Escape returns focus to `org-detail-gallery` / `org-detail-videos`.
- **Keyboard-open:**
  - The time field (`cs-time-keyboard.png`) and the note field (`cs-note-keyboard.png`) stay visible at 390x480, with Save on screen.
  - The prices field is visible, but see S9.
- **Words and weekdays:** full weekday names on every walked screen ("Friday 23 October"). There is no American spelling or jargon in the user strings of the diff (sub-agent grep on `^\+` lines for color, organiz, canceled, center, occurrence, override, payload, RPC, tap/press: no user-facing hits). The Home WhatsApp step is gone (`*-00-home.png`).
- **Cancel from Change:** `?from=change` renders the cancel confirm; the INT3 Back/Keep-it test holds.
- **Take this date off:** consistent label on Change what, Line-up and the screen itself. On a one-date event and a festival it is correctly off, with the reason "Only a date of the weekly repeat can be taken off. Cancel it instead." and Cancel directly below.
- **Change time on class+social works:**
  - At 20:30 both sessions shift (20:30–21:30, 21:30–00:00), with the old times struck through.
  - An end past midnight (00:30) is accepted.
  - An end before the start is refused under Save.
  - S1, S2 and S3 above are the wording and preview problems that remain.

## Screen x shape grid

W = walked at 390x844 on the production build (screenshot `walk-PAR/<shape>-<screen>.png`). R = read in code only. `-` = not applicable.

| screen | cs (class+social, 12 coming) | w10 (weekly 10+) | one (one date) | fest (festival, 3 dates) | zero (0 coming) |
|---|---|---|---|---|---|
| Home | W | W | W | W | W |
| One event (+ lifecycle card, live) | W | W | W | W | W (S4) |
| One event, draft Go live / Discard | R (B1; P-SERIES walk 01-02) | R | R | R | R |
| Details (+ Gallery/Videos sheets) | W (+ sheets, focus) | W | W | W | W |
| Details Ends / Prices / team prices | W prices (S9); R ends, team | R | R | R | R |
| Change what | W | W | W | W | W (past-date refusal) |
| Change time | W + 3 interactions + keyboard (S1-S3) | W (one session) | W (S3) | W | W (refused, past) |
| Sessions / line-up | W | W | W | W | W (past date) |
| Take this date off | W | W | W (off + reason) | W (off + reason) | W (refused) |
| Note / ticket / picture | W note + keyboard; R ticket/picture | W note | W note | W note | W (refused) |
| Copy | W | W | W (empty + Add a date) | W | W (refused) |
| Pick several | W | W | W | W | W (N4) |
| Cancel from Change | W | W | W | W | W (refused) |
| Stop repeating | W | W | W (N5) | W (N5) | W (S4) |
| Make it weekly | W (N5) | W (N5) | W | W | W |
| New wizard last step | R (P-SERIES walk 14; N on copy) | - | - | - | - |

## CI table (run locally on 5369379)

| check | result |
|---|---|
| `npm run build` (prod, self-serve on) | pass, exit 0 |
| `npx vitest run src/modules/organiser` | 105 files, 3251 passed, 2 skipped |
| `npx tsc --noEmit -p .` | pass, no output |
| walk spec (8 Playwright tests) | 8 passed (1.4m) |
| full `npm run lint`, `test:e2e` gate, `db-contract-check` | NOT run (out of a UX/a11y reviewer's ONE pass; INT3 handover lists its per-job table) |

## Verified

- Production build; 66 shape x screen walks plus 6 interaction/keyboard states at 390x844 and 390x480 against the route-mocked fake; tap-target and horizontal-scroll measurement in the browser; focus return after two sheets; organiser unit suite and typecheck green.

## Not verified

- **Real iOS/Android keyboards:** keyboard-open states were simulated by shrinking the viewport. S8's missing minus key is known iOS behaviour, not observed here.
- **Locale:** Chromium rendered the time inputs in 12-hour format (en-US). UK phones show 24-hour.
- **Screen readers:** no screen reader was run. The a11y notes come from the DOM and source.
- **Not walked, read only:**
  - The draft Go live card (P-SERIES walk covers it).
  - The Ends and team-price editors.
  - The ticket and picture detail screens.
  - The new-event wizard last step.
- **No prod SELECT run.** Shapes are from the R-INT-B survey (2026-10-17); I made no Supabase call.
- **Vercel preview:** not checked. `VERCEL_TOKEN` is set but was not used: this is a docs-only review branch, and the walk ran on a local production build instead.
