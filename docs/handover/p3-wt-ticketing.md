# Handover: P3 W-T ticketing, Phase A (design only)

Branch `claude/p3-wt-ticketing`. Brief `brief/p3-wt-ticketing`.

## Done
- Design brief + inventory of the shipped ticketing screens: `docs/design/p3-wt-ticketing.md`.
- Three standalone 390x844 mockups (light / dark toggle) in `mockups/p3-wt-ticketing/`:
  `A-tickets-page.html` (recommended), `B-inline-on-event.html`, `C-tickets-sheet.html`.
- No source code changed. No Supabase read or write.

## Left / next (Phase B, on the owner's pick)
1. Owner picks A, B or C (and OKs the two copy changes in the design doc).
2. Prod shape survey (SELECT only), then build per the brief's Phase B list.
3. Delete old `/account/tickets` in the same PR series once the walk passes.
