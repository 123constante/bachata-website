# Handover: W2-D person hub mockups (ready for the owner's pick)

Ticket dt_2790581403f1. Branch `claude/w2d-hub-mock` off `main` at a48ccd3. Mockups only: no `src/` change, no PR
(per the brief), no migrations, Supabase read-only (one SELECT survey, counts only).
Design record with options, trade-offs and numbers: [`docs/design/w2d-hub.md`](../design/w2d-hub.md).

## Pictures (390x844)
- Contact sheet: `docs/mockups/w2d-hub/overview.png` (3 columns A, B, C; one row per shape)
- Option A (stacked cards, big photo): `docs/mockups/w2d-hub/a-s1.png`, `a-s2.png`, `a-s3.png`, `a-s4.png`
- Option B (role switcher): `docs/mockups/w2d-hub/b-s1.png`, `b-s2.png`, `b-s3.png`, `b-s4.png`
- Option C (hero card + Also): `docs/mockups/w2d-hub/c-s1.png`, `c-s2.png`, `c-s3.png`, `c-s4.png`
- Wall tile tap, one-role vs multi-role: `docs/mockups/w2d-hub/tap.png`
- Shapes: s1 dancer + DJ with gigs (Elias), s2 dancer + DJ no photo, s3 dancer + teacher (teacher closed), s4 three roles.

## Recommendation
**C** (one hero card for the main role + an "Also" row): leads with the strongest role, one obvious first tap, other roles
still visible, same height for 2 or 3 roles so the fade always shows. A second; B last.

## Numbers (all 12 views)
Lowest text contrast 7.43 (>= 4.5); smallest tap 44x44; seam step into the footer 3/255 per row (gate < 6); no text on a
gradient; scrollWidth 390; no big empty gap (20px padding above the fade).

## Owner calls
1. Pick A, B or C.
2. The 36 dancer + teacher people have one role WITH a page while teacher pages are closed, so by the skip rule they never see
   the hub (shape 3 shows what they would see). Recommend: count roles with a page.
3. The fade into the footer needs the footer's 64px top gap painted on the hub route only (site-wide footer otherwise unchanged).

## Not done / not verified
Real photos (placeholders), the real site header, 360/430 widths, a real phone, gig counts in prod, an active-only survey
(see the design record). No Vercel preview needed for docs; no CI jobs apply beyond the docs checks run below.

## Next steps
Owner picks; then a build brief (Design Gate stage 3) for the chosen layout + the redirect, behind `flags.personHub`.
