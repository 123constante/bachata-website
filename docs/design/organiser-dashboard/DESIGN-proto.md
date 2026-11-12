# Organiser dashboard: two options on the owner-confirmed prototype

Brief: `docs/briefs/profile-dash-organiser-proto.md` on `brief/profile-dash-organiser-proto` (admin #1544, parent #1531).
Base: `prototype-base.html` (inert copy of the owner-confirmed "Organiser Area Prototype"). Docs/design only, no app code.

Open either file in a browser. Controls above the phone pick the **shape**, the **tab** and the **data state**
(normal, loading, error). Every view also has a hash: `#<shape>/<tab>[/<state>]`, shapes `three one clear setup door`,
e.g. `option-2.html#door/home`, `option-1.html#one/stats/error`. Add `?shot` to hide the controls (screenshot mode).
`#three/home/ok/switch` opens the Switch sheet; `#door/home/ok/scan` opens the scanner.

## Kept from the base
- Role strip: role-coloured, badge, page name, role and seat on the line **below** the name (no kicker above it).
- Top-right **Switch** button opens the Switch sheet (reads **Account** when the person has one page). Sheet lists every page with a "Showing" tag, then Add another page, Account and help.
- Organiser tabs Home / Events / Tickets / Stats / Team.

## What differs
| | Option 1: Next night first | Option 2: Needs you first |
|---|---|---|
| Tabs | Bottom bar with icons (thumb reach) | Pill row on top, under the role strip |
| Home order | Big next-night card (date, tickets sold bar, gold **Share this night**), then **Needs you** (max 3), then Also coming up | Heading + one-line summary, **Needs you** numbered (all items), then **Your nights** agenda with date blocks; gold action on the next night |
| Door night (Home) | Hero turns into "Friday Social is tonight", checked-in bar, gold **Open scanner**, Share drops to outline | "Tonight": the night card moves above the to-do list, checked-in bar, gold **Open scanner** |
| Unfinished setup | Progress bar + checklist card, gold **Add your first night** | Numbered steps list (same look as to-dos), empty "Your nights" says what to do, gold **Add your first night** |
| Events | Flat list with status tags | Agenda grouped by month, "No date yet" group |
| Tickets | Two number tiles (sold, sales) + payout/refund rows + by night | One summary sentence, key/value rows, by-night rows with progress bars |
| Stats | 2-column tiles, only numbers above zero | Key/value list, only numbers above zero |
| Team | People rows with badges + "Door team for a night" | Key/value people list + a "Door helpers" group |

## Rules applied (both options)
- Stats: no page views / link opens anywhere. A number shows only when it is above zero (Casa Bachata hides tickets and sales; Salsa Nights has an empty state instead of zeros).
- One gold primary per screen: Home = Share this night (Open scanner on the door night, Add your first night while unfinished); Events = New event; Tickets = Add a ticket type / Connect payouts; Stats = Share this night; Team = Invite someone; scanner = Start camera / Next guest.
- "Going" is never a tile: it is one muted line under the tickets bar (option 1) or absent (option 2).
- Headings have no uppercase kicker above them; section headings are sentence case.
- Icons are inline SVG (`<use href="#i-...">`), no text characters.
- Dashed borders only on the disabled Share button and the camera placeholder.
- Empty / loading / error: every one says what to do (loading says it retries on its own and to check signal; error has Try again).
- Disabled control says why: locked "Share this night" while unfinished, with "Sharing opens once you have a published night."
- Door helper (Switch sheet in the door shape, "Door: Friday Social"): scanner only, no tabs, note that they see no sales or money.

## Decision for the owner
On the door night the one gold action on Home becomes **Open scanner**; Share this night stays as an outline button. If Share must stay gold on the night, the scanner moves to outline.

## Checks (Playwright, 390x844, both options)
162 views per run: 5 shapes x 5 tabs x 3 data states x 2 options, plus the Switch sheet per shape and the scanner.
- Text contrast >= 4.5 against the composited background: pass (0 failures).
- Every button/link >= 44x44: pass.
- No clipping (no element whose content is wider than its box, incl. ellipsis), nothing past the 390 frame, no sideways page scroll: pass.
- Rule checks: at most one gold button, no "views"/"opened your link" text, no text-character icons, dashed only on disabled/placeholder, every disabled button followed by its reason, no zero numbers: pass.
- Mutation check of the checker: muted text to #9a9a9a (contrast), action buttons to 30px (tap), a second gold on door Home (gold), dashed note border (dashed), 40px page name (clip): each one was caught.

## Screenshots (390x844 at 2x, `shots/`)
`option-{1,2}-{three,one,clear,setup,door}.png` (Home per shape), plus `-three-switch` (Switch sheet), `-one-stats`, `-door-scanner`.

## Not verified
- Real phone (Safari/Chrome on device): only headless Chromium.
- Real data shapes: numbers, names and links are examples; no app code reads them yet.
