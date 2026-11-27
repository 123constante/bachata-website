# /classes rebuild: page plan

Mockups: A.html (Departure board), B.html (Flyer wall), C.html (Two doors). The picked mockup is the whole spec.
Data in the mockups is real: prod `get_calendar_events_v2`, London, Friday 27 November to Thursday 3 December 2026.

## 1. One decision the owner must confirm first

Today the list shows `has_class && !has_party` = **5 rows** this week. London has **27** nights with a class this
week; 22 of them are a class followed by a social (La Fabrica Mondays, Bachata Playground, Pura Nights...).
All three mockups list all 27 and tag each row "+ social 21:00" or "Class only".
This reverses rule S1b (2026-11-26, "a party with a class slot is not a class") on this page only.
Why: a page titled "Bachata classes in London" with 5 links is thin for Google and useless to a dancer.
If the owner says no: same layouts, 5 rows, the "Class only / Class + social" filter and tag are dropped.

## 2. Sections, top to bottom (shared by A, B, C; order differs per direction, see section 6)

| # | Section | Heading / copy | Tap |
|---|---|---|---|
| 1 | Header | Existing site bar + breadcrumb `Home > Classes` | unchanged |
| 2 | Title | h1 `Bachata classes in London` (city: `Bachata classes in {city}`) | none |
| 3 | Standfirst | `27 classes this week, in time order. Most rotate partners, so you can come on your own.` | none |
| 4 | Updated line | `Updated Friday 27 November` + `3 with a beginners slot` | none |
| 5 | Split | `New to bachata?` / `Your first class` and `I already dance` / `Tonight's classes` | `#first-class`, `#d-{today}` |
| 6 | Day nav (sticky) | `Today`, `Tomorrow`, then full weekday names, each with its count | `#d-YYYY-MM-DD` |
| 7 | Filter (A only) | `All 27`, `Beginners slot 3`, `Class only 5`, `Class + social 22` | client filter, no route change |
| 8 | This week | h2 `This week's bachata classes`; h3 per day `Friday 27 November` | row = event page |
| 9 | Beginner list | h2 `Beginner bachata classes this week` | row = event page |
| 10 | First class | h2 `Your first bachata class` + 3 steps (4 in C) | CTA `Read the beginner's guide` = `/learn-bachata-london` |
| 11 | Questions | h2 `Bachata class questions`, 4 native `<details>` | open/close |
| 12 | By day | h2 `Bachata classes by day`, 7 links | `/bachata-london-{weekday}` |
| 13 | Calendar | h2 `Full class calendar`, lede `Every date beyond this week.` | existing EventCalendar, untouched |
| 14 | More | h2 `More in London`: `Tonight`, `Parties`, `Teachers` | `/tonight`, `/parties`, `/teachers` |
| 15 | Footer | existing | unchanged |

Row tap = `eventHref(e)` (today that is `https://{slug}.bachatacalendar.co.uk/`). Whole row is one link, min 56px tall.
Step copy: `Pick a beginners slot` / `Turn up alone` / `Stay for the social`. FAQ copy is in the mockups, verbatim.

## 3. Heading outline (SEO)

- h1 Bachata classes in London
- h2 This week's bachata classes (h3 per day: Friday 27 November ... Thursday 3 December)
- h2 Your first bachata class (C: "Your first bachata class in London")
- h2 Beginner bachata classes this week
- h2 Bachata class questions (emit FAQPage JSON-LD from the same array)
- h2 Bachata classes by day
- h2 Full class calendar
- h2 More in London

Everything above is server-rendered text and plain `<a href>`. Day nav is hash links, so it works with no JS.
Keep the loader as is (`loadSeoLandingDay`, 7-day window, `serverTodayKey` pin). Keep the existing ItemList JSON-LD.

## 4. Two paths

- BEGINNER: taps `New to bachata?` -> first-class steps -> 3 beginner rows -> event page, or the guide.
  Never has to read the 27-row list. Two taps to a class.
- DANCER: lands on today (first day section is directly under the nav) -> scans times -> taps a row. One tap.
  Day nav jumps to any other day; A adds the filter chips.

## 5. Data fields per row (all exist on `CalendarEventRow`)

| Shown | Field |
|---|---|
| Name | `name` (as stored, no case change) |
| Venue | `location` |
| Day group | `instance_date` |
| Time | `class_start` to `class_end` (fall back to `occurrence_starts_at`; `has_timed_session === false` = `Time TBC`) |
| "+ social 21:00" / "Class only" | `has_party`, `party_start` |
| Organiser | `primary_organiser_name` (A, C hero) |
| Flyer | `cover_image_url` (B, C; all 27 rows have one; fallback = plain amber-brown tile) |
| "Course" / "One-off" | `format` = `course` / `one_off` (A) |
| Style tag | `meta_data.music_styles` reduced to `Sensual`, `Dominican`, `Bachata + salsa` or nothing (A) |
| Run of the night | `meta_data.program[]` start + title, organiser text verbatim (B rail first slot, C cards) |
| Cancelled | `is_cancelled` = row struck through + `Cancelled`, not a link target change |
| Link | `slug` via `eventHref` |

DERIVED, not a field: **"Beginners slot"** = any `meta_data.program[].title` or `name` matching `/beginner/i`.
One shared helper + table test over this week's 27 real titles. 3 match today.

NOT AVAILABLE, would need data (kept out of all mockups):
- Level (structured). Only free text such as "Level 1", "3 Levels of Bachata", "6 levels".
- Price. "FREE" appears only inside organiser slot titles; shown verbatim there, never as a price tag.
- Teacher names. Only on the event page snapshot, not on the list row.
- Area / postcode / nearest tube. Row has venue name + lat/lng only, so no "by area" filter.

## 6. What differs per direction

- A Departure board: text only. Split buttons, sticky day strip + filter chips, time-first rows, first-class section after the list.
- B Flyer wall: flyer mosaic behind the h1, beginner rail FIRST (3 big cards), then sticky day tabs and a 3-column flyer grid.
- C Two doors: sticky switch `This week` / `First class` swaps the page body. Week side: "Next class" hero card,
  then day drawers (`<details>`, today + tomorrow open). First-class side: 4 steps + 3 beginner cards with the run of the night.
  Both panels are in the server HTML; the switch must be a real control with `aria-selected`, default `This week`.
  SEO caveat for C: the hidden panel and closed drawers are in the HTML but not visible on load; Google may weigh them less.

## 7. Empty and edge states

- No classes in 7 days: section 8 body = `No classes listed for the next seven days.` + button `See the full calendar` (`#calendar`).
  Standfirst becomes `Most classes rotate partners, so you can come on your own.` Updated line stays. Day nav and filter hidden.
- A day with no classes: omit that day from the list and the nav (no empty headings).
- No beginner match this week: section 9 heading stays, body = `No beginners slot listed this week.` + link `Read the beginner's guide`.
  The `New to bachata?` button still works (steps + guide).
- Filter with zero rows on a day (A): hide that day. Zero overall cannot happen (chips with count 0 are not rendered).
- Recurring event twice in the window: keep today's dedup (soonest occurrence only).
- City pages (`/city/:slug/classes`, no loader): h1 + city standfirst + calendar only, as today. No fake list.

## 8. Removed vs today

- The hero: 112px mortarboard emoji, floating star/sparkle icons, centred two-colour title. Replaced by a plain left-aligned h1.
  (GlobalLayout `hero` is optional; the page renders its own h1. Keep `buildBreadcrumbs('classes')`.)
- `ListingIntro` paragraph with inline "Start here" and "find a teacher by style" links. Replaced by standfirst + split buttons;
  `/teachers` moves to "More in London".
- Row design `name / venue · time` in a bordered box. Replaced per direction.
- "Updated ... · 5 classes this week" line above the h2: kept, moved under the standfirst.
- Nothing removed from: EventCalendar (excluded files, untouched), footer, loader, cache tags.

## 9. Shared for /parties and /tonight

Build once, reuse:
- `WeekList` (rename/extend `LiveEventsSection`): group by day, day nav with counts, row slot, empty states.
  Props decide the time shown (`class_start` vs `party_start`) and the row component.
- `DayNav`: sticky hash-link strip with counts. /tonight does not need it; /parties does.
- `EventRow` (A), `FlyerCard` (B) or `ThumbRow` + `NextUpCard` (C): /parties swaps the tag to `Class first 19:00`; /tonight uses one day.
- `PageTitle`: h1 + standfirst + updated line.
- `ByDayLinks`, `MoreLinks`, `FaqList` (+ FAQPage JSON-LD).
Classes only: the split buttons, `isBeginnerSlot` helper, first-class steps, beginner list.

## 10. Build notes

- Tap targets in px, min 44px (site `html` font-size is about 13.5px on phones; rem sizes shrink).
- JSX: `&rsquo;` `&mdash;` `&middot;` `&rsaquo;`, never raw punctuation.
- Colours are the site tokens: background #000, card #121212, border #333/#2b2b2b, muted text #ababab, primary #FFA600, accent #FFCC33. Font Inter.
- Density: rows and 3-column grids follow `.claude/rules/design-density.md`. B's beginner rail (236px cards) is the one wide-card exception.
- Flyers load lazy, fixed aspect boxes (no layout shift). A ships zero images.
- Mockup stubs to ignore: the top bar, the dashed calendar box, the footer line.
