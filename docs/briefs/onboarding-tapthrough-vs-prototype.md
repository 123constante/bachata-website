# Brief: tap-through audit of the organiser onboarding screens vs the approved prototype (AUDIT, read-only, Sonnet)

Owner picked the PLAYFUL mood, a % on the progress bar, and flags (country pickers). An earlier walk looked calm/plain. Compare what is BUILT on main behind `organiserP3` with the approved clickable prototype (merged in #1124, find it under docs/design/ or the onboarding prototype folder; read its README for the owner picks).

## Do
1. Run the built onboarding flow at 390x844 (Playwright, `VITE_ENABLE_ORGANISER_SELF_SERVE=true VITE_ENABLE_ORGANISER_P3=true`, every server call faked with `page.route`, non-supabase host as in tests/e2e/walk-p3-golive.spec.ts). Tap through EVERY screen (Welcome, person screens 10-19, page screens, Review, Live).
2. For each screen: screenshot + one table row: prototype screen, built screen, mood match (playful vs plain), % on progress bar, flags, one question per screen, no scroll, tap targets >= 44px, copy differences.
3. List the gaps ranked by how much the owner would notice, each with the file to change. No fixes.

## Output
Docs-only `docs/audits/onboarding-tapthrough-2026-10-29.md` (+ screenshots under docs/audits/onboarding-tapthrough/) on branch `claude/onboarding-tapthrough-audit`. Never change product code. Not verified section. Push once, subject ending `[worker-done tapthrough]`.
