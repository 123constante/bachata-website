# P3 create event — Design Gate stage 2 (mockups)

## Brief (5 lines)
1. Rebuild "create an event" inside P3 in the P3 look (owner decision 2026-10-30), replacing the R1 wizard bridged in by PR #1202.
2. Parity first: keep every field and rule the current wizard has, and close its gaps (course, end time, first session, venue not found).
3. Phone first at 390x844, dark and light, compact density, tap targets of at least 44px, plain words, full weekday names.
4. Cover every step, empty/loading/error/offline, venue not found, weekly, course, the "A few details first" gate, and cancel with the draft kept.
5. Docs only. The owner picks an approach; nothing is built from this branch.

## Files
Open these from a checkout. The pages link the real `src/modules/organiser/p3/theme/p3.css`, so the tokens cannot drift. No build step is needed.

- `p3-create-event/index.html` — the comparison table: the three approaches against the old wizard.
- `p3-create-event/a.html` — A, "One page": 20 phones.
- `p3-create-event/b.html` — B, "Three steps": 18 phones.
- `p3-create-event/c.html` — C, "Pick first": 21 phones.
- Every page has a Light/Dark switch, and `?theme=dark` also works.
- `p3-create-event/build.py` regenerates all four pages (`python3 build.py`), so a copy change is made once and lands on every page.

## Parity inventory (current wizard, `src/modules/organiser/flows/new/`)

**Steps today:**
1. Which page (only with 2 or more pages).
2. What: One night or Weekly. Course and festival are blocked.
3. Name: required, up to 120 letters. This step creates the server draft.
4. Where: venue search, up to 50 matches. A search with no match is a dead end.
5. First date: the next 30 days only.
6. Start time: there is no end time.
7. Photo: JPEG, PNG or WebP under 10 MB.
8. Go live, or "Save as draft" while the A1 platform gate is off. Go live goes through the "Almost live" profile bridge if profile questions are left.

**Commands:** all go through `series_command_p5`, as `series.upsert` per field, then `series.set_recurrence` (weekly, no end), then `lifecycle 'live'`. Each command has its own idempotency key, and `expected_version` is chained between them.

**Gaps the mockups close:**
- No first session is created, so with A1 on, Go live stays off on every new event.
- Course cannot be created.
- No end time.
- No run-until date for weekly events.
- Dates are limited to 30 days ahead.
- No path when the venue is not found.
- A draft can be kept but not deleted.

**Left for the event page on purpose:** the owner-ticked editor fields from `docs/organiser-rebuild/ARC.md`. These are description, music styles, ticket link, extra organisers, gallery, video, line-up, rooms, and per-date changes. They are editing fields, not create fields.

**Admin editor:** its code lives in the admin repo, so only its documented fields were compared (`docs/event-truth-table.md`, `ARC.md`). Festival creation stays admin-only in all three options.

## Production shapes the mockups use (read-only SELECT, counts only, `event_series_p5`)
- Longest event name: 53 letters. A11 shows it wrapping.
- Courses: up to 16 sessions, most often 8. The course sheet offers 4–12 and "Other".
- Formats: one_off is the large majority, then recurring (about 75), course (about 15), festival (about 15).
- About 600 old one-off rows have no venue and no cover, so "draft without a venue" is a real shape.

## Recommendation: A, "One page"
1. **It matches what the organiser sees afterwards.** The P3 event page is already rows that open bottom sheets, and A uses the same pattern. Creating and editing then feel like one tool, and the sheets can later be shared with the event page instead of being built twice.
2. **Nothing is hidden.** Every requirement for going live is on one screen with a tick. When Go live is off, it says which row is missing. A step can never be skipped by mistake.
3. **Few taps without a fork:** 9 for a one night, against 7 (and blocked) today. Weekly and course need no extra screens, because they only change what the When sheet asks.
4. **B** is the most familiar shape, but the stepper hides later requirements until the last step. It also needs Back/Next state for every combination.
5. **C** is the fastest (7 taps) and its fork copy is the clearest. But it means three forms to maintain, and anyone who picks the wrong kind has to go back to the start.
6. **Worth borrowing from C into A:** the plain-example copy on the kind choice, such as "For example 8 Tuesdays for beginners".

## Owner decisions these mockups assume (flagged, not decided)
- **"Send us this venue"** is a new request path. No such table or command exists today, so building it needs an admin-repo change. The fallback is "Skip for now", which keeps the draft without a venue.
- **"Delete this draft"** on cancel is new. Today a draft can be kept but not deleted.
- **"A few details first"** is new copy for the existing "Almost live" profile bridge. The string does not exist in the code yet.
- **"Every other Friday"** needs `series.set_recurrence` to support an interval. Today it sends weekly only.

## Stopping rule
One independent critique, then the owner picks. No code.
