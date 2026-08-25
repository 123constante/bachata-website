# Product

## Register

product

## Users

London bachata dancers, ~95% on mobile. They arrive wanting to find events tonight or this week, discover who runs local nights, or look up a venue or teacher. They know the scene socially (WhatsApp groups, Instagram) but need a single trustworthy source for what's on and when.

## Product Purpose

Bachata Calendar (bachata.community.uk) is the public directory and event calendar for the UK bachata scene. It lists events, venues, teachers, DJs, and organisers. Success looks like a dancer opening the app, finding what they need in under 10 seconds, and showing up to the right place.

## Brand Personality

Warm, trustworthy, vibrant. The platform should feel like it was made by someone inside the scene, not a generic events aggregator. Dark-themed, information-dense, community-native.

## Anti-references

- Apple-style generous whitespace — too cold, too spacious for a dense directory
- Eventbrite / Meetup — generic, corporate, not scene-native
- Cream/sand/paper light themes — wrong register entirely, with ONE recorded
  exception: the festival timetable (see "The light exception" below)
- Bouncy SaaS dashboards with big hero metrics

## Design Principles

1. **Density over breathing room** — dancers want to scan many options fast; never hide information behind whitespace
2. **Scene-native warmth** — the visual language should feel like the community it serves (dark, warm, amber/gold tones). One recorded exception: see "The light exception" below
3. **Mobile-first always** — 95% of users are on a phone; desktop is secondary
4. **Trust through specificity** — show real dates, real venues, real counts; never vague or approximate
5. **Hierarchy communicates urgency** — what's happening soonest should be most visible

## The light exception — the festival timetable

Principle 2 says dark, warm, amber/gold, and the Anti-references list rules out
paper-light themes. **The festival timetable at `/festival/:id` is light, on
purpose, and it is the only surface that is.** Decided by Ricky on 2026-08-25
against a side-by-side light/warm-dark build of the same grid, knowing what this
document said; recorded here so the next reader does not "fix" it back to dark.

**Why it earns the exception.** Every other surface is browsed — the reader is
choosing what to do. The timetable is *used*, on the day, standing in a venue
corridor or outdoors in daylight, deciding which room to walk into in the next
ten minutes. Dense colour-coded blocks on a dark ground lose their edges at high
screen brightness in sun, and phones cap brightness lower on dark content. Here
outdoor legibility beats mood, and it beats it only here.

**Scope, so this does not spread.** The exception covers the timetable grid
alone: the box, its room headers, its hour rail and its session cards. The page
around it — hero, lineup, tickets, venue, footer — is unchanged, and so is the
day picker sitting above the box, which reads as part of the dark page. The
timetable's light tokens are declared on `.program-wrap` in `FestivalDetail.tsx`
and are namespaced `--tl-*`, so nothing outside can inherit them.

The register is still ours: it is brutalist, not soft — hard black rules, hard
offset shadows, no blur, no gradients, no rounded pastel cards. It is the
opposite of the Apple-style whitespace on the Anti-references list, and shares
that list's actual objection, which is coldness and spaciousness rather than
light itself.

## Accessibility & Inclusion

WCAG AA minimum. Contrast ratios must hold on the warm dark backgrounds (amber text on brown = test carefully). Touch targets minimum 44px. Reduced motion respected.
