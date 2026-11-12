# Dancer dashboard: two options on the owner-confirmed prototype

Brief: `docs/briefs/profile-dash-dancer-proto.md` on `brief/profile-dash-dancer-proto` (admin #1545, parent #1531).
Docs/design only. No app code.

## Files
- `prototype-base.html`: inert copy of the owner-confirmed "Organiser Area Prototype". The base for both options.
- `option-1.html`: **Focus**.
- `option-2.html`: **Agenda**.
- `shots/`: 390x844 screenshots, `o1-*` for option 1 and `o2-*` for option 2.

Open a file in a browser. On a phone-width window the app fills the screen and the controls sit below it. On a wide window the controls sit under a 390x844 frame.
Every shape can be opened by link: `#three`, `#one`, `#clear`, `#unfinished`, `#door`. Add `/going`, `/profile`, `/switch`, `/scan` (door only), `/loading` or `/error`. Option 2 also has `/saved`.

## Kept from the base
- The role strip: dancer colour, role icon, name, with "Dancer" written under the name. The base's small uppercase label above the name is gone (no kicker labels).
- The top-right Switch sheet. With 3 roles it says "Switch" and lists Organiser, Teacher and Dancer pages, with "Showing" on the current one. With 1 role it says "Account".
- Dancer tabs: Home, Going, Profile.
- Tokens, fonts, card, row, sheet and scanner patterns. The scanner for door staff is the base's door scanner.

## What differs between the options
| | Option 1: Focus | Option 2: Agenda |
|---|---|---|
| Home leads with | One large card for the single thing that matters now. In order: on the door tonight, then finish profile, then the next plan, then "Nothing planned yet" | A card about you: photo, name, city, "Dancing since", then count tiles |
| Rest of Home | "After that": a quiet list of up to 2 more plans, then a link to Going | "Coming up": a day-by-day timeline with date circles. Tonight is highlighted |
| Counts | One sentence under the greeting ("3 plans coming up, 1 ticket, 4 saved.") | Tiles (Plans, Tickets, Saved) |
| Unfinished profile | Takes over the focus card as a checklist, and the button names the next missing field | A progress bar and a "Finish profile" button inside the "you" card. The timeline stays visible |
| Door | The focus card says "You are on the door tonight" and has "Open scanner" | The first timeline item, "Tonight", has "Open scanner" |
| Going tab | Sections: This week, Later, Saved for later | Plans and Saved switch, each laid out on the timeline |
| Profile tab | An editable field list. Missing fields have an "Add" tag | A public preview ("This is how dancers, organisers and teachers see you") and a "Still to add" list |

## Shapes drawn (both options)
- **3 roles** (`#three`): Organiser, Teacher and Dancer pages. 3 plans (1 with a ticket, 1 Going, 1 Interested) and 4 saved.
- **1 role** (`#one`): dancer only. 1 plan and 2 saved. Switch reads "Account".
- **Caught up** (`#clear`): profile complete, nothing planned, nothing saved. Every list has an empty state that says what to do ("Find events this week").
- **Unfinished** (`#unfinished`): no photo, no city, no styles. "Share my profile" is disabled and says why ("Add photo and home city and styles you dance first, so people know it is you.").
- **Door** (`#door`): on the door tonight. Shows "Open scanner", when access ends, and what door staff can and cannot see. Scanner results are Valid, Already used and Wrong event, and the camera placeholder says what to do if the camera does not open.
- **Loading / error** (any shape): the loading state says to check the connection if it takes long. The error state says what to do and has "Try again".

## Rules applied
- Stats: no page views anywhere. A count is shown only when it is above 0. Option 1 drops that part of the sentence; option 2 does not draw the tile.
- No kicker labels. Section headings are plain sentence-case headings.
- SVG icons only. No text characters used as icons (no chevrons, ticks or crosses made of characters).
- Dashed borders only on disabled controls, the missing-photo placeholder and the camera placeholder.
- Every empty, loading and error state says what to do. The one disabled control says why.

## Checks (390x844, Playwright, Chromium, 17 states per option)
A scripted pass over each state measured:
- the lowest text contrast against the composited background
- the size of every visible button
- sideways scroll of the page, the scroll area and the sheet
- text clipped without an ellipsis, and text outside the frame
- dashed borders outside the allowed placeholders
- text-character icons
- "N views" text
- a zero shown next to plans, tickets, saved or going

| | Lowest contrast | Taps under 44px | Sideways scroll | Clipping | Rule breaks |
|---|---|---|---|---|---|
| Option 1 | 6.05 | 0 | 0 | 0 | 0 |
| Option 2 | 6.05 | 0 | 0 | 0 | 0 |

The contrast pass skips disabled controls, which WCAG exempts. Both disabled buttons still use the muted token, at about 5.5:1.

## Real-data shapes (read-only survey, prod, 2026-11-12, counts only)
- 14 claimed, active dancer profiles. All 14 have a photo and a home city, so "unfinished" is rare today. It matters for new sign-ups.
- `event_attendance` holds 7 rows (5 going, 2 interested) across 5 people: 4 have 1 row, 1 has 2 or 3.
- So most real dancers today match **Caught up** or **1 plan**. The empty states and the one-item Home are the screens most people will see, and both options are built for them. The 3-plan and 4-saved shapes are the growth case.

## Not verified
- Not checked on a real phone, only Chromium at 390x844.
- Fonts were blocked in the screenshot run, so the shots use the fallback font. The layout was checked with that font.
- Light theme was not drawn. The brief asks for dark.

## Next
profile-dash asks the owner to pick option 1 or option 2 (or a mix: for example option 2's "you" card above option 1's focus card).
