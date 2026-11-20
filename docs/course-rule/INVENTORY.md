# Course page keep-list (course rule card, phase 1)

What a dancer sees on `/event/:id` for a **course** today, top to bottom, with where it comes from.
Line numbers are on branch `claude/course-rule`. The build must leave every row unchanged; the
only new thing is the rule card (row 13a), and only with `VITE_ENABLE_COURSE_SIGNUP_RULE=true`.

| # | Item | Source |
|---|------|--------|
| 1 | Header, back link, search, breadcrumbs (`buildBreadcrumbs('event.detail')`) | `BentoPage.tsx:693-703` (GlobalLayout) |
| 2 | Hero title (event name) | `BentoPage.tsx:703-708` (`hero`) |
| 3 | Velvet page backdrop | `BentoPage.tsx:714-718` |
| 4 | Lifecycle banners: cancelled / paused (sticky) | `BentoPage.tsx:725-737`, `EventCancelledBanner`, `EventPausedBanner` |
| 5 | Ended record card or thin cancelled strip | `BentoPage.tsx:756-778`, `EventEndedRecord`, `CancelledRedStrip` |
| 6 | "More events" forward door (ended series only) | `BentoPage.tsx:790-800`, `MoreEventsSection` |
| 7 | Tap-hint sticker ("Psst, every card opens something") | `BentoPage.tsx:803`, `TapHintSticker` |
| 8 | Cover tile (2x3) + share button | `BentoGrid.tsx:105`, `BentoPage.tsx:491`, `CoverBlock` |
| 9 | Date tile (day / date / month; opens calendar) | `BentoGrid.tsx:107`, `BentoPage.tsx:502`, `DateBlock` |
| 10 | Promo tile OR City tile (mutually exclusive) | `BentoGrid.tsx:108-109`, `BentoPage.tsx:565-572`, `PromoBlock`, `CityBlock` |
| 11 | Venue tile (name, address link) | `BentoGrid.tsx:113`, `BentoPage.tsx:529`, `VenueBlock` |
| 12 | Video tile (when a playable video exists) | `BentoGrid.tsx:117`, `BentoPage.tsx:586`, `VideoBlock` |
| 13 | Organiser card | `BentoGrid.tsx:120`, `BentoPage.tsx:541`, `OrganiserCardBlock` |
| 13b | Schedule tile (times, programme, level labels, person chips) | `BentoGrid.tsx:121`, `BentoPage.tsx:549`, `ScheduleBlock` |
| 13a | **NEW, flag-gated:** course rule card | `BentoGrid.tsx:126`, `BentoPage.tsx:525`, `SignupRuleBlock` |
| 14 | Dates: Weeks ladder ("N-week course &middot; level", Week rows, Cancelled rows, times) | `BentoGrid.tsx:127`, `BentoPage.tsx:511-523`, `WeeksLadderBlock.tsx:52,137` |
| 15 | About / description | `BentoGrid.tsx:128`, `BentoPage.tsx:527`, `DescriptionBlock` |
| 16 | Raffle tile (hidden on cancelled / ended) | `BentoGrid.tsx:132`, `BentoPage.tsx:584`, `RaffleBlock` |
| 17 | Guest list tile (hidden past / disabled) | `BentoGrid.tsx:133`, `BentoPage.tsx:574`, `GuestListBlock` |
| 18 | Tickets page (opened from the bar, `publicTicketing`) | `BentoPage.tsx:808-840`, `EventTicketsPage` |
| 19 | Group chat (WhatsApp) block | `BentoPage.tsx:846`, `GroupChatBlock` |
| 20 | RSVP slot | `BentoPage.tsx:852`, `RsvpSlot` |
| 21 | Level badge / rating slot | `BentoPage.tsx:863`, `LevelSlot` |
| 22 | Music styles row | `BentoPage.tsx:870`, `MusicStylesRow` |
| 23 | More events (live series) | `BentoPage.tsx:876`, `MoreEventsSection` |
| 24 | Add-to-calendar chooser (modal) | `BentoPage.tsx:890`, `AddToCalendarChooser` |
| 25 | Sticky action bar: Get Tickets / Get directions / calendar / share | `BentoPage.tsx:902`, `EventStickyActionBar` |
| 26 | Report a problem link | `BentoPage.tsx:934`, `ReportProblemLink` |
| 27 | Loading shimmers (one per visible tile) | `BentoPage.tsx:472-488` |

## Gaps
- GAP: rows 18-23 have their own internal hide rules not itemised here (unchanged files, not opened).
- GAP: the rule card shows on a course even when the Week rows are hidden (one date, or paused);
  it then sits above About. The brief does not say; left as is for the owner.
- GAP: no skeleton tile for the card while loading (deliberate, so flag-off loading is identical).

## Coverage
27 rows listed + 1 new; 27 of 27 unchanged in code (only the LAYOUT list gained one id that
BentoPage hides unless the flag is on, the format is `course` and a rule is set). Verified at
390x844: flag off and rule unset give main's block list `cover, date, city, venue, schedule,
dates, description, raffle`.
