

# Make the Breaking News Ticker Sticky

## Change

Convert the inline breaking news ticker (currently scrolls away with the page) into a **fixed bottom bar** that stays visible at all times as the user scrolls through event cards.

## What Happens

- The ticker moves from its current inline position (between the header and events grid) to `fixed bottom-0 left-0 right-0 z-40`
- Bottom padding is added to the main content container so event cards aren't hidden behind the ticker
- The ticker also gets `bottom-20` on mobile to clear the `MobileBottomNav` component

## Technical Details

### File: `src/pages/Tonight.tsx`

1. **Extract the ticker block** (lines ~220-244) from the inline flow
2. **Move it outside** the scrollable content area, applying fixed positioning:
   ```
   fixed bottom-0 left-0 right-0 z-40
   ```
3. **Increase bottom padding** on the outer container from `pb-20` to `pb-36` so the last event card isn't obscured
4. **Mobile nav clearance**: add responsive bottom offset (`md:bottom-0 bottom-16`) to avoid overlapping the mobile bottom navigation bar

### File: `tailwind.config.ts`

Register the missing `scroll` keyframe that the ticker's `animate-scroll` class relies on:

```
"scroll": {
  "0%": { transform: "translateX(0)" },
  "100%": { transform: "translateX(-50%)" },
}
```

Animation utility: `"scroll": "scroll 30s linear infinite"`

No new dependencies required.

