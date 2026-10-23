# P3 DESIGN OPTIONS - shared brief (all three mockup workers)

Read first, on this brief branch: `docs/organiser-rebuild/p2/COMMON.md` (owner answers, binding), `p2/AUDIT-foundation.md` (gaps G01-G40, SALVAGE table), `p2/BENCHMARK.md` (pros comparison, patterns to copy, anti-patterns). Then the CURRENT Ember look on `origin/main`: `src/modules/organiser/ui/ember.css`, `src/modules/organiser/theme.css`, `src/modules/organiser/ui/EmberWorld.tsx`, and the rebuild head `origin/claude/er-c8-eventpage` organiser screens.

## What the owner said (binding)
- Organisers are low-tech (WhatsApp/Instagram level), on a phone almost always. Biggest fears: organisers give up because it is confusing, and wrong info shown publicly.
- Taste: admires Airbnb (warm, photo-led, friendly). KEEP the Ember look and polish it (do not invent a new brand). Friendly, simple words. Spacious, ONE thing per screen. Light/dark follows the phone. English only.
- Launch scope the mockup must show: organiser HOME; one EVENT page (weekly social); simple STATS tile (views, saves; real counts exist in `event_views`); CREATE A COURSE flow (multi-week block); LINE-UP picking real profiles; CANCEL or MOVE one date; PHOTOS/cover; CO-ORGANISERS (all equal, invite one); PUBLIC PREVIEW ("see what dancers see"); FIRST DAY: "we found your events" takeover screen (matched automatically, no claim step).
- Not at launch (leave room, do not design in detail): tickets, notifications to attendees, featured listing (later paid product - one quiet placeholder spot is fine).
- Admin only, NOT shown to organisers: delete event, merge duplicates.

## Data to show (real, public)
Use London Loves Bachata as the signed-in organiser (6 live series incl. courses, 2 leaders, ~893 views in 30 days) - real event names/venues/dates from the public site or `origin/main` seed shapes; numbers may be rounded. Also show one EMPTY state (an organiser with one event and no photo) and one LONG name / many dates case somewhere.

## Output (ONE push, no PR, no source edits)
Branch named in your brief, from `origin/main`. Files:
1. `docs/organiser-rebuild/p3/mockups/<letter>.html` - ONE self-contained clickable HTML file: inline CSS/JS only (Google Fonts allowed; no other external requests, no images from the web - use CSS gradients/SVG shapes as photo stand-ins, or tiny inline SVG). Phone frame 390x844 centred on desktop, full-bleed on a phone. Every screen listed above reachable by tapping (simple JS screen switcher, back works). Light AND dark via `prefers-color-scheme` plus a small toggle. Colours as CSS custom properties on `:root` taken from ember.css (polish allowed; name any new token).
2. `docs/organiser-rebuild/p3/mockups/<letter>.md` - max 40 lines: the idea in 3 lines; screen list; which gaps (G-numbers) and benchmark patterns it answers; trade-offs vs the other directions; new primitives it needs (e.g. ActionRow, QuietButton, ChoiceList, InlineError, StepFrame); self-checks measured (contrast >= 4.5 for text, tap targets >= 44px, no sideways scroll at 390, every empty/error state says what the person CAN do); Verified / Not verified.

## Quality bar
This is the owner's choice point, so it must look finished, not wireframe: real copy (friendly, short), real hierarchy, real spacing. One primary action per screen. No jargon ("series", "occurrence", "P5", "lifecycle" never appear; say "event", "date", "live", "paused"). Errors and empty states are kind and say the next step.
