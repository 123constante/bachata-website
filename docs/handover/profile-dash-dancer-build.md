# Dancer dashboard build, slice 1 (admin 1534) -- design record

Branch `claude/profile-dash-dancer-build`. Website only, no DB change. Design: `docs/design/profile-dash/dancer-option-a.html`.

## What shipped
- Home main card + Claim your page (first worker): `screens/home/homeModel.ts` (one mapping), `HomeMainCard.tsx`, `ClaimYourPage.tsx`.
- Strip button top right (`ProfileSwitcher.tsx`, dancer area only): reads **Switch** with 2+ profiles, **Account** with one (`SwitcherGate.tsx`; D129: no Switch word for one profile).
- Switch sheet: every profile, tick on the current, **Add a profile**, Account settings, Sign out.
- Add a profile sheet: "Run events? Become an organiser" (organiser area) and "DJ or teach? Message us". Back returns.
- Edit screen: already has no hardcoded name/city (reads the profile) and an untouched Save is disabled with "Nothing has changed yet. Edit a field above to save." and sends no request (covered by walk + existing tests).
- Fixed a duplicate `lazyWithRetry` import in `EditScreen.tsx` (TS2300).

## Tests
- `screens/home/__tests__/homeComponents.test.tsx`: HomeMainCard per shape; ClaimYourPage per status (linked, no_match, ambiguous, email_unproven, unavailable) + the one dismissal.
- `__tests__/emberRestyle.test.tsx`: Account vs Switch label, Add a profile sheet.
- `tests/e2e/dancer-app/profile-dash-walk.spec.ts` (in `test:e2e`): 8 walks at 390x844; screenshots in `docs/handover/profile-dash/walk/` (run with `WALK_SHOTS=1`).

## Continuation 3
- Calm first screen: Home now renders greeting, optional notices, rate nudge (only when a night needs rating), the one main card and the Preview row. HomeHero, Going tile, NumbersTiles, PartnerTile and LineupPeople no longer render (files left in place, no importer on Home). Nights attended lives in the main card.
- Switch sheet grouped Dancer then Organiser, a "Showing" tag with the tick on the current row, "+ Add a profile" below. There is no DJ side in `profileSides`; DJ/teacher areas still come from the "Your areas" row, so no DJ group heading is drawn.
- Isolation check fixed: docs and walk screenshots moved under `docs/handover/` (an allowed doc prefix); screenshots now in `docs/handover/profile-dash/walk/`.
- Tests that pinned the removed blocks were rewritten as absence checks over the same shapes.

## Not done / owner calls
- Real-device and real Google Fonts not checked.
- Walk shapes: stub, unfinished, complete (12 / none), unclaimed match (single + ambiguous), one profile (Account), two and three sides.
