# Handover: P3 W4a Phase A (design only) &mdash; 2026-10-27

Branch `claude/p3-w4a-team-switch-page` (from `main` @ 4c683ce). Ticket dt_54c8895e4544.

## Done
- Inventory of Team / Switch / Welcome / Organiser page / flyer: table in `docs/design/p3-w4a.md`.
- Design brief (5 lines) in the same record.
- Three standalone mockups at 390x844, light + dark toggle: `mockups/p3-w4a/A.html` (You hub,
  recommended), `B.html` (page-first You + switch sheet), `C.html` (segments in You). Built by
  `python3 mockups/p3-w4a/build.py`, which inlines the real `p3.css` (no second token file).
- Playwright check of the mockups: 0 sideways scroll, 0 taps under 44px.

## Left (Phase B, after the owner picks A / B / C)
1. Re-read `main` (other arcs land on these screens) and the open team-picker work.
2. Prod shape survey (read-only counts, project stsdtacfauprzrdebmzg).
3. Build per pick behind `organiserP3`; reuse hooks, RPC wrappers, strings, tests.
4. Matrix tests screen x shape; walk 390x844; contrast; critique; R1 routes unchanged with the flag off.

## Owner decisions needed
- Pick A, B or C.
- OK to show Add someone DISABLED with its reason for a Contributor (today it is hidden)?
- Welcome 7c wording "Switch any time from You" (was "...from Home").
