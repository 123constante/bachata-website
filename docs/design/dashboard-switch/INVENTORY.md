# Dashboard switch &mdash; INVENTORY of the live screens (look round)

Read from `origin/main` @ `1292655` (2026-11-19). Every row is a thing a person can
see or tap today, with the code that draws it. BEFORE frames in `look-round.html`
draw only these rows.

**Coverage: 54 rows (A 32, B 7, C 15); all 54 are drawn in a BEFORE frame or the KEEP-LIST. None left out.**
(A = sheet, `src/components/account/profiles/ProfileSwitcher.tsx` unless noted;
B = organiser area mount; C = organiser Switch page.)

## Brief vs code &mdash; mismatches found

1. The brief names `src/modules/organiser/profile/OrganiserSwitcher.tsx` as screen (b).
   That file is a 2-line re-export of the **chip row** `OrganiserSwitcher` in
   `switch/index.tsx:18-33`, used only on R1 Team (`team/index.tsx:157`). The sheet in
   the organiser area is mounted by a *different* local `OrganiserSwitcher` in
   `src/modules/organiser/shell/OrganiserShell.tsx:46-56`. Screen (b) below is that
   sheet; the chip row is inventoried too (rows C14&ndash;C15) and left frozen.
2. `docs/design/ticket-buyer-onboarding-rule.md` and
   `~/.claude/plans/dancer-dashboard-option-b-switch.html` are not in the repo or this
   sandbox. The "picked at onboarding" signal is taken from the code's own rule:
   `isAreaShown` (`areas/home/areaStatus.ts:67-70`) &mdash; a teacher / DJ step in
   `my_profile_progress_v1` means the role was chosen at sign-up.

## A. The switch sheet (dancer app; mounted by `dancer-app/shell/SwitcherGate.tsx`)

| # | Element | State / rule | file:line |
|---|---|---|---|
| A1 | Gate: button hidden until sides load | `state.status !== 'ready'` &rarr; null | SwitcherGate.tsx:13 |
| A2 | Strip button, 44px pill, avatar 32 + word | always | ProfileSwitcher.tsx:87-104 |
| A3 | Button word "Switch" (2+ profiles) / "Account" (1) | `stripLabel(several)` | :29, :103 |
| A4 | aria-label "Switch profile" / "Your account" | several | :89 |
| A5 | Avatar = current side, else glyph disc | `current` | :102 |
| A6 | Bottom sheet, backdrop black/50, portalled, max-w 480 | open | :107-118 |
| A7 | Dark dancer surface (`--da-surface` #2A2D32) | dancer | :82-84 |
| A8 | Title "Switch profile" / "Your account" / "Add a profile" | several / adding | :119-122 |
| A9 | "Close" text button 44&times;44 | always | :123-125 |
| A10 | Esc and backdrop tap close | open | :67-74, :108 |
| A11 | "Loading your profiles&hellip;" | loading | :127-131 |
| A12 | "We could not load your profiles. Close this and try again in a moment." | failed | :132-136 |
| A13 | Group heading "DANCER" / "ORGANISER" (12px caps, muted) | group non-empty | :159-164 |
| A14 | Side row 56px: avatar 36 (circle dancer, rounded organiser) | each side | :166-175, SideAvatar.tsx:13 |
| A15 | Side name (organiser name / dancer first name / "Your dancer profile") | each | SideAvatar.tsx:6-7 |
| A16 | Side kind line "Dancer" / "Organiser" | each | SideAvatar.tsx:10, :178 |
| A17 | "&check; Showing" tag on current side | `item.current` | :180-185 |
| A18 | Order: organisers first, then dancer | switcherItems | accountRouting.ts:528 |
| A19 | "+ Add a profile" row | dancer area only, ready | :195-200 |
| A20 | Add step: "Run events? Become an organiser" | adding | :139-141 |
| A21 | Add step: "DJ or teach? Message us" (external) | adding | :142-150 |
| A22 | Add step: "Back" | adding | :151-153 |
| A23 | Teacher / DJ area rows (name + status dot + words) | `isAreaShown` (held OR picked at sign-up) | SwitcherAreas.tsx:31-52 |
| A24 | Status words: Complete / "N left" / Not finished | areaStatus | areaStatus.ts:72-80 |
| A25 | Status dot: full / half / ring | kind | StatusDot.tsx |
| A26 | Teacher / DJ row opens its area; "Discard changes?" guard | tap | SwitcherAreas.tsx:21-27, :40 |
| A27 | "Your areas" link | ready | SwitcherAreas.tsx:54-56 |
| A28 | "Account settings" link (dancer: app path) | always | :208-210 |
| A29 | "Sign out" | not confirming | :211-214 |
| A30 | Confirm: "Sign out?" + "You can sign back in any time with your email." | confirming | :216-218 |
| A31 | Cancel / "Yes, sign out" (accent fill) / "Signing out&hellip;" | confirming / busy | :219-240 |
| A32 | Dividers between sides, add, areas, settings | always | :157, :196, :202 |

## B. The same sheet in the organiser area (`organiser/shell/OrganiserShell.tsx`)

| # | Element | State / rule | file:line |
|---|---|---|---|
| B1 | Icon-only 44&times;44 avatar button, no word | always | ProfileSwitcher.tsx:97 |
| B2 | 44px placeholder while chunk loads; error = nothing | lazy | OrganiserShell.tsx:49-54 |
| B3 | Tick follows `?o=`; single organiser auto-ticked | where.organiserId | accountRouting.ts:530-534 |
| B4 | Site tokens (black bg, white text) not dancer surface | organiser | ProfileSwitcher.tsx:117 |
| B5 | NO "Add a profile" row | `dancer` false | :195 |
| B6 | Settings goes to `/account/settings` | organiser | :208 |
| B7 | Sign-out confirm fill = `bg-primary` (orange) | organiser | :234 |

Rows A6, A8&ndash;A18, A23&ndash;A32 also apply here unchanged.

## C. Organiser Switch page `/account/o/switch` (`organiser/switch/index.tsx`)

| # | Element | State / rule | file:line |
|---|---|---|---|
| C1 | Shell title "Switch page", Back to hub | always | :76 |
| C2 | Skeleton "Loading your pages" (2 rows) | pending | :78 |
| C3 | Error "Your pages did not load" / "You&rsquo;re offline" + Retry | failed / paused | :80-85 |
| C4 | Card of page rows 56px | ready | :87-120 |
| C5 | Page name | each | :98 |
| C6 | Role word Owner / Manager (none for other seats) | each | :99, strip.ts:16 |
| C7 | To-do count badge, OTHER pages only (P3) | todos > 0 | :102-110 |
| C8 | "Live" chip (green) | lifecycle live | :111-113 |
| C9 | "Showing" chip on chosen page (P3) | selected | :115-117 |
| C10 | Tap = remember choice + open hub `?o=` | tap | :70-73 |
| C11 | "Your other pages" + Teacher / DJ / Dancer rows (P3, active roles) | held | :39-60 |
| C12 | "Add a page" link (gold text) | always | :123-130 |
| C13 | "Add a profile" dashed card: Organiser / Teacher / DJ / Dancer rows + benefit lines, "Not now", Undo toast | P3, missing roles | AddProfileCard.tsx:57-150, addProfileModel.ts:19-29 |
| C14 | R1 Team chip row "Choose an organiser" | 2+ pages, R1 | switch/index.tsx:18-33 |
| C15 | Welcome copy "Switch any time from &hellip;" | after invite | Welcome.tsx, welcomeModel.ts:18-26 |

## Real-data shapes (prod, read-only counts, 2026-11-19)

- Organiser pages per user (owner/manager): 1 page = 20 users, 2 = 1, 3+ = 1.
- `person_roles`: teaching active 127, djing active 43, dancing active 122 (inactive: 10 / 4 / 14).
- So: most organisers see ONE organiser row; teacher / DJ rows are common &mdash; the
  "coming soon" change touches many real people, which is why it is drawn in every option.
