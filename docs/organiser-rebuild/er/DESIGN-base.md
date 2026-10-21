---
name: Bachata Calendar
description: Dense dark directory for the UK bachata scene — amber on black, community-native, mobile-first.
colors:
  primary: "#FF9900"
  primary-dark: "#CC6600"
  primary-light: "#FFCC33"
  background: "#000000"
  card: "#121212"
  surface: "#212121"
  surface-hover: "#333333"
  foreground: "#FFFFFF"
  muted-foreground: "#AAAAAA"
  border: "#333333"
  bento-surface: "#101F1C"
  bento-surface-raised: "#1A2E2A"
  bento-accent: "#B38A4E"
  bento-fg: "#D8CCB0"
  venue-bg: "#160E08"
  venue-ember: "#E5662C"
  gold-shimmer-lo: "#C9A84C"
  gold-shimmer-hi: "#FFF1A8"
  whatsapp-green: "#117D42"
typography:
  display:
    fontFamily: "Inter, system-ui, sans-serif"
    fontSize: "clamp(1.75rem, 3.5vw + 0.5rem, 4.5rem)"
    fontWeight: 900
    lineHeight: 1.1
    letterSpacing: "-0.04em"
  headline:
    fontFamily: "Inter, system-ui, sans-serif"
    fontSize: "clamp(1.25rem, 2vw + 0.4rem, 1.875rem)"
    fontWeight: 700
    lineHeight: 1.1
    letterSpacing: "-0.02em"
  body:
    fontFamily: "Inter, system-ui, sans-serif"
    fontSize: "0.875rem"
    fontWeight: 400
    lineHeight: 1.5
  label:
    fontFamily: "Inter, system-ui, sans-serif"
    fontSize: "0.75rem"
    fontWeight: 500
    lineHeight: 1.3
rounded:
  sm: "8px"
  md: "10px"
  lg: "12px"
  full: "9999px"
spacing:
  xs: "4px"
  sm: "8px"
  md: "12px"
  lg: "16px"
  xl: "24px"
components:
  button-primary:
    backgroundColor: "{colors.primary}"
    textColor: "#000000"
    rounded: "{rounded.full}"
    padding: "8px 24px"
  button-primary-hover:
    backgroundColor: "{colors.primary-light}"
  button-ghost:
    backgroundColor: "transparent"
    textColor: "{colors.foreground}"
    rounded: "{rounded.full}"
    padding: "8px 24px"
  card:
    backgroundColor: "{colors.card}"
    textColor: "{colors.foreground}"
    rounded: "{rounded.lg}"
    padding: "{spacing.md}"
---

# Design System: Bachata Calendar

## Overview

**Creative North Star: "The Scene Insider's Notebook"**

This is a system built from the inside out. The palette — amber gold on pure black — reads like light spilling out of a nightclub onto a dark street: warm, purposeful, zero waste. Every surface decision starts from the premise that the person looking at it is standing in a venue corridor, phone in hand, making a decision in ten seconds. Information density is not a constraint to work around; it is the design language itself.

The system is warm without being decorative. Gold and amber carry meaning — interactive, tonight, important — not mood. The dark grounds (black, near-black charcoal, warm mahogany) are not minimalism; they are focus. Text is white or gold; everything else recedes. The only time the palette opens up is in specifically themed surfaces: the event page's velvet-and-brass world, the venue page's Latin-warm mahogany, the festival timetable's daylight-legible light theme. Each of those is a deliberate departure with a named reason; the default world is this one.

Components feel physical. Buttons have press states that feel like contact. Active elements glow faintly at the amber frequency. The system acknowledges touch — 44px minimum targets, transitions that respond at the moment you move, not after. Inter carries everything: its optical weights deliver headline authority and label practicality from the same typeface, with no serif romanticism.

**Key Characteristics:**
- Dense, scannable card grids (3-column mobile default)
- Amber/gold accent on pure black or near-black grounds
- Inter across all type roles — weight and size do the hierarchy work
- Mostly flat depth — surface steps from black → card (#121212) → surface (#212121)
- Touch-first: 44px targets, p-3 card padding, gap-3 grids
- Surface-specific worlds (bento, venue, festival timetable) break from the default deliberately and with committed palettes

## Colors

A two-temperature palette: the cold black ground holds everything; the amber-gold band (39°–45° hue) does all the work of emphasis, interaction, and identity.

### Primary
- **Bachata Amber** (#FF9900 / `hsl(39 100% 50%)`): The identity colour. Interactive elements, ring focus, the "tonight" signal. Used at full saturation on actions; at reduced opacity for hover states and glows.
- **Deep Amber** (#CC6600 / `hsl(30 100% 40%)`): The active/pressed state of primary; also border accents on dark surfaces.
- **Bright Gold** (#FFCC33 / `hsl(45 100% 60%)`): Accent and hover; the lighter end of the amber band. The `accent` token.

### Secondary
- **Gold Shimmer** (#C9A84C → #FFF1A8): The sparkle-title gradient, guest-list highlights, the gold sweep animation. Used in motion contexts to signal premium moments (guest list confirmation, raffle interaction).
- **WhatsApp Signal Green** (#117D42): Single-use only — the WhatsApp contact icon on organiser and event pages. Never repurposed.

### Tertiary
- **Bento Brass** (#B38A4E / `hsl(38 39% 50%)`): The tarnished-brass accent of the event page's velvet world. Not interchangeable with Bachata Amber; belongs only within the bento surface context.

### Neutral
- **Pure Black** (#000000): Page background. The ground everything rests on.
- **Card Dark** (#121212 / `hsl(0 0% 7%)`): Card and popover surface — one step up from black.
- **Surface Dark** (#212121 / `hsl(0 0% 13%)`): Secondary surface, muted backgrounds, hover targets.
- **Border Dark** (#333333 / `hsl(0 0% 20%)`): Hairlines, input outlines, rule separators.
- **Muted Text** (#AAAAAA / `hsl(0 0% 67%)`): Secondary labels, metadata, captions.
- **White** (#FFFFFF): Primary body text and high-emphasis labels on all dark grounds.

### Named Rules
**The One Frequency Rule.** Gold and amber carry identity meaning — tonight, interactive, important. Never use them decoratively, and never dilute the band with off-hue warm tones. A second warm accent that is not on this palette is not a variant; it is a conflict.

**The Deliberate World Rule.** The bento, venue, and festival-timetable surfaces each carry their own committed palette. Do not pull those tokens into the default world, and do not mix the worlds on a single surface.

## Typography

**Display / Body Font:** Inter (system-ui fallback)

**Character:** Inter across all roles — optical weight differences deliver authority at the headline scale and legibility at the label scale from the same face. No serif, no display pairing. The type system reads as built, not styled.

### Hierarchy
- **Display** (weight 900, `clamp(1.75rem, 3.5vw + 0.5rem, 4.5rem)`, line-height 1.1, tracking -0.04em): Page heroes and organiser name on profile pages.
- **Headline** (weight 700, `clamp(1.25rem, 2vw + 0.4rem, 1.875rem)`, line-height 1.1, tracking -0.02em): Section titles, card primary headings on larger surfaces.
- **Title** (weight 600–700, 1rem–1.125rem): Card headings in 3-column grids; event names in list rows.
- **Body** (weight 400, 0.875rem, line-height 1.5): All descriptive copy, bios, metadata blocks. `max-w-prose` (~65ch) on standalone paragraphs.
- **Label** (weight 500, 0.75rem, line-height 1.3): Dates, tags, counts, stat labels, icon captions. Uppercase with tracking only when a specific surface (pill, stat chip) warrants it.

### Named Rules
**The Weight Hierarchy Rule.** In a single-typeface system, weight is the contrast. 900 → 700 → 600 → 400 → 500-label must each read as a distinct step. Never collapse two adjacent roles to the same weight.

## Layout

Mobile-first 3-column grid is the default for all listing surfaces (venues, events, teachers, DJs, dancers, organisers). Card padding: p-3 (12px). Grid gap: gap-3 (12px). The grid never collapses to 1-column unless the card has a physical reason to need full width.

The base font-size is fluid: `clamp(13.5px, 0.78rem + 0.28vw, 16px)` — all rem-derived sizes scale with viewport without breakpoint jumps.

Container: `max-w-[1200px]` centred with `padding: 0 clamp(0.75rem, 2vw, 1.5rem)`. The event bento page uses a narrower `max-w-[430px]` with `px-2` to mirror a phone canvas exactly.

Responsive behaviour: 3-column mobile → 3-column tablet → 4+ columns desktop. Detailed page layouts (organiser profile, venue detail, event page) are single-column on mobile with section stacking.

Vertical rhythm: `space-y-3` default, `space-y-6` only between major section blocks.

## Elevation & Depth

The system is **mostly flat**. Depth reads through surface brightness steps, not shadows:

- `background` (#000000) → `card` (#121212) → `surface` (#212121) → `surface-hover` (#333333)

Each step is +7% lightness on the neutral axis, giving a three-tier layering vocabulary (page / card / interactive) without any shadow tokens on the standard palette.

**State feedback uses glow, not lift.** The primary glow (`box-shadow: 0 0 30px hsl(39 100% 50% / 0.6)`) on hover/focus replaces the translateY lift that flat-design systems reach for. The origin stays planted; the light moves.

**Explicit shadows exist only in themed sub-surfaces:** the bento event page uses a `0 4px 24px rgba(0,0,0,0.12)` ambient for tile separation; the venue page hero uses a warm shadow for depth in photography contexts.

### Named Rules
**The Flat-By-Default Rule.** Surfaces are flat at rest. State transitions surface glow, not height. A `translateY(-2px)` hover is acceptable on interactive cards; a box shadow on a resting card is not.

## Shapes

**Rounded corners throughout, on a single scale anchored at 12px (0.75rem):**
- `rounded-lg` (12px): Cards, modals, larger containers.
- `rounded-md` (10px): Medium interactive elements, chips.
- `rounded-sm` (8px): Smaller tags, inputs.
- `rounded-full` (9999px): Pills, avatar rings, icon-only buttons.

No sharp corners on interactive elements. No asymmetric radii. The form language is consistent and clean — approachable, not playful.

Icon buttons use circle or rounded-full treatment. Contact icons on the organiser profile are 44px circles with low-opacity amber backgrounds.

## Components

### Buttons
Buttons feel physical — pressed states are honest, not subtle.

- **Shape:** Rounded-full (pill); py-2 px-6 default, py-2 px-3 compact.
- **Primary:** Amber background (#FF9900), black text, font-weight 600. Hover: bright gold (#FFCC33) + translateY(-2px) + glow shadow. Active: deep amber (#CC6600) + scale(0.98).
- **Ghost / Outline:** Transparent background, white text, 1px border-border. Hover: surface-hover background.
- **Icon button:** Rounded-full, 44px touch target, amber bg at ~10% opacity, icon in amber/white.

### Chips & Tags
- **Style:** Rounded-full pill, text-xs (0.75rem), font-weight 500.
- **Default:** Surface background (`hsl(0 0% 13%)`), muted-foreground text, 0.5px border.
- **Active / selected:** Primary amber background, black text.
- **Guest list pill:** Gold fill at 8% opacity, gold border at 20%, gold text — plus the slow gold sweep animation.

### Cards
Compact by default. p-3 padding, rounded-lg, card background (#121212), 1px border (#333333).

- **Standard card:** No shadow at rest. Subtle border. Hover: surface-hover background or translateY(-2px) depending on context.
- **Glow card:** Adds a `::before` pseudo-element with an amber-to-transparent gradient border, opacity 0 at rest → 1 on hover.

### Inputs
- **Style:** Rounded-sm, 1px border (#333333) background (#212121), white text.
- **Focus-visible:** Ring in amber (#FF9900), no glow excess.
- **Dark input (gl-input):** Near-transparent bg, gold border at 30% opacity, gold focus ring.

### Navigation
Global header: fixed, bg-background, `backdrop-filter: blur` on scroll. Transitions background-color and backdrop-filter on scroll via CSS (`transition: 0.3s ease`).
Bottom nav: Mobile-only, fixed, full-width tabs with icon + label; active tab in amber.

### Signature Components
- **Stat chips (organiser/event profile):** Amber number large, muted label small, stacked, tappable with `scrollIntoView` navigation.
- **Section row (organiser past events):** 44px row height, tight typography, year separator, "Show earlier" toggle.
- **Contact row (organiser profile):** 44px icon circles in a flex row — WhatsApp (#117D42), Instagram, Facebook, Website, Email.

## Do's and Don'ts

### Do:
- **Do** use 3-column grids (gap-3, p-3) for all listing surfaces on mobile.
- **Do** keep gold/amber for interactive elements, "tonight" signals, and the identity mark only.
- **Do** use weight and size to create type hierarchy — Inter at 900/700/600/400/500 gives five distinct steps.
- **Do** set touch targets to minimum 44px for all interactive elements.
- **Do** use `space-y-3` as the default vertical rhythm, `space-y-6` only between major sections.
- **Do** prefer brightness-step depth (black → card → surface) over shadows at rest.
- **Do** use the glow (`box-shadow: 0 0 30px hsl(var(--primary) / 0.6)`) as the hover/focus depth signal.

### Don't:
- **Don't** use gradient text (`.gradient-text`) on body copy or card headings — it is an existing pattern in the codebase but belongs only to specific celebration/hero contexts.
- **Don't** use Apple-style generous whitespace. This is a dense directory, not a marketing site.
- **Don't** mix bento-brass, venue-ember, or festival-teal with the default amber palette on the same surface.
- **Don't** collapse a listing to 1-column without a physical reason (e.g. a full-width map card).
- **Don't** use `kicker` eyebrow labels above headings — the heading carries its own weight.
- **Don't** add a card border thicker than 1px.
- **Don't** use `translateY` hover lifts on resting text — only on card or button interactive elements.
