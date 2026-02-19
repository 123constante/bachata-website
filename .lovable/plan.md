

## Live TV Broadcast Banner for the Tonight Page

### What We're Building
A sticky bottom banner that mimics a live TV news broadcast ticker -- exactly like the screenshot reference. It will sit fixed at the bottom of the Tonight page with:
- A bold red **"BREAKING"** label on the left
- A red background bar with a continuously scrolling news ticker
- A green pulsing **"LIVE"** dot with real-time stats and event updates
- The current time displayed

### Implementation

**1. New Component: `src/components/BroadcastTicker.tsx`**

A self-contained sticky bottom bar component with:
- `position: fixed; bottom: 0` so it stays visible while scrolling
- High `z-index` to sit above all content (but below modals)
- A red "BREAKING" badge on the far left with white text on solid red background
- A dark red/black background bar spanning the full width
- A CSS-animated marquee scrolling right-to-left with dynamic headlines (e.g. "LIVE: 378 dancers heading out tonight", "Thursday Bachata at Salsa Street looking PACKED with 34 confirmed")
- A green pulsing dot next to "LIVE" text on the right side
- Uses the existing `animate-pulse` for the live dot and a new `ticker-scroll` keyframe for the marquee

**2. Tailwind Config Update: `tailwind.config.ts`**

Add a new keyframe and animation for the ticker scroll:
- `ticker-scroll`: translates from `0%` to `-100%` over ~20 seconds, linear, infinite
- This creates the smooth horizontal news-ticker scroll effect

**3. Update `src/pages/Tonight.tsx`**

- Import and render `<BroadcastTicker />` at the bottom of the page
- Increase `pb` (bottom padding) to account for the fixed ticker height (~48px)
- Remove the existing inline "Live Feed Ticker" section (lines ~175-200) since the new sticky banner replaces it

### Visual Details

The banner will have:
- Height: ~40-48px
- Background: dark (near-black) with a subtle red tint
- Top border: thin red line for the broadcast feel
- "BREAKING" label: solid red background, white bold uppercase text, rounded
- Ticker text: white on the dark background, smoothly scrolling
- Right side: green pulsing dot + "LIVE" + dynamic stat (e.g., event count or viewer count)
- Current time in monospace font on the far right

### Technical Notes
- The ticker uses CSS animation (not JS intervals) for smooth 60fps scrolling
- Duplicate content technique: the ticker text is rendered twice side-by-side so the scroll loops seamlessly
- The component pulls event data from the parent or uses sensible defaults
- Bottom padding on the page ensures no content is hidden behind the fixed bar

