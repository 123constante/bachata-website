

## Fix: Sticky Red Broadcast Ticker

### Problem
1. **Not sticking on scroll**: The broadcast overlay effects div (`z-50`) on the Tonight page sits above the ticker (`z-40`), visually covering it. Additionally, `overflow-x-hidden` on the parent container can clip `position: fixed` children in some browsers.
2. **Not red**: The main ticker bar uses a dark/black background (`bg-neutral-950/95`) and the right-side LIVE section uses `bg-neutral-900/80` -- neither is red.

### Fix

**`src/components/BroadcastTicker.tsx`**
- Raise `z-index` from `z-40` to `z-[55]` so it sits above the overlay effects (`z-50`)
- Change the main bar background from `bg-neutral-950/95` to `bg-red-700` (solid red)
- Change the fade-edge gradients from `from-neutral-950` to `from-red-700` so they blend seamlessly with the red background
- Change the right-side LIVE/clock section background from `bg-neutral-900/80` to `bg-red-800` (slightly darker red for visual separation)
- Update the top border from `border-red-600/60` to `border-red-500` for a cleaner look against the red background

**`src/pages/Tonight.tsx`**
- Move the `overflow-x-hidden` from the outermost container div to an inner wrapper so it does not interfere with the fixed-position ticker

### Result
The banner will be fully red across its entire width and will always remain visible at the bottom of the viewport while scrolling.
