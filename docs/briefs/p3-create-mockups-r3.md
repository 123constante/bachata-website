# Brief: P3 create-event mockups r3 (claude/p3-create-mockups) -- COMPLETE option C

Owner picked C ("pick first") from r2 and said: "there is many things that are missing like things monthly events. Why do i always have to correct these things." r2 failed the PARITY CHECK (memory: feedback_mockup_parity_deep_check). r2 showed only Weekly; the product already supports weekly, monthly (nth weekday AND day-of-month), every-N-months, custom, single and fixed-dates series (see src/modules/organiser/events/schedule.ts, createModel.ts, seriesCommands.ts, newEvent.ts).

## Step 1 (do BEFORE drawing anything): write docs/design/p3-create-event/INVENTORY.md
A table of EVERY thing a person can set when creating an event, with columns: field | admin app (c:/dev/bachata-admin-11april create/edit event) | current Website organiser wizard (src/modules/organiser/events) | public event page shows it? | in mockup C r3? Sources to read (cite file:line): admin event editor, NewEventPage.tsx, newEvent.ts, createModel.ts, eventModel.ts, schedule.ts, seriesCommands.ts, takenOff.ts, dateCap.ts, media.ts, eventType.ts, ReviewCard.tsx, reviewModel.ts, the event-page bento. Include at minimum: every event type (class, social, festival, workshop, course, party...), title, description, city/venue (new venue too), organisers/co-hosts, price/free/ticket link/Stripe tickets, cover image, levels, dance styles, DJs/teachers/line-up, age/dress code, capacity, online events, language, contact, repeat rules (weekly with weekdays, every other week, monthly nth weekday, monthly day-of-month, every N months, custom dates, one date, end date / "until", dates taken off, series cap), per-session times (times live on SESSIONS, not the event), draft vs publish, duplicate/copy, cancellation. Anything in admin but missing in the Website = list it as GAP and still draw it (rule: admin-only is a gap to plan, not skip).

## Step 2: redraw C at 390x844 to cover the whole inventory
- Keep C's idea (pick the kind first, then details). Every repeat option above has its own state (monthly: nth weekday picker + day-of-month picker; every N months; ends: on a date / after N / never within cap).
- Show these states too: one-off event, weekly class, monthly social, festival (multi-day), course (several sessions), online, free vs paid, with empty/error/disabled-with-reason states. Taps >= 44px explicit px. Compact density (3-col grids, text-sm).
- Use the shared look (src/modules/organiser/p3/theme/p3.css). Full weekday names in copy.
- Update comparison.md/design record; keep A and B files untouched as history.

## Step 3: self-audit
Add an "Inventory coverage" section: N inventory rows, N shown, list of any not shown and why. Zero silent omissions. Push, then end with the marker [worker-done dt_<ticket>] in the commit subject.
Docs/HTML only. Do not touch src/.
